// === REAL SYNTH API INTEGRATION ===
// Fetches prediction data and edge data from api.synthdata.co
// Pre-fetches per asset (not per market) to minimize API calls

const SYNTH_BASE_URL = 'https://api.synthdata.co';
const SYNTH_CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour cache

// Our ticker → Synth API ticker mapping
const ASSET_TO_SYNTH: Record<string, string> = {
    'BTC': 'BTC',
    'ETH': 'ETH',
    'SOL': 'SOL',
    'SPY': 'SPYX',
};

// Unified cache for all synth data per asset
const synthCache = new Map<string, { data: SynthAssetData; timestamp: number }>();

export interface SynthAssetData {
    // Forecast data (from prediction-percentiles)
    current_price: number | null;
    forecast: Array<{
        time: string;
        p20: number;
        p50: number;
        p80: number;
    }>;
    // Full probability distribution for the 24h mark
    finalDistribution: Record<string, number> | null;
    // Edge data (from polymarket/up-down/daily)
    synth_probability_up: number | null;
    polymarket_probability_up: number | null;
    edge: number | null;
    skew: number | null;
    tailRiskUpside: number | null;
    tailRiskDownside: number | null;
    confidence: number | null; // 1 - (p95 - p05) / currentPrice
    // Meta
    source: 'live' | 'mock';
    cached: boolean;
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 10000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { headers, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// Fetch all synth data for a single asset (forecast + edge)
async function fetchSynthForAsset(asset: string): Promise<SynthAssetData> {
    const synthTicker = ASSET_TO_SYNTH[asset.toUpperCase()];
    if (!synthTicker) {
        console.warn(`SynthAPI: Unknown asset ${asset}, no mapping found`);
        return getMockData(asset);
    }

    const apiKey = process.env.SYNTHDATA_API_KEY;
    if (!apiKey) {
        console.warn('SynthAPI: No API key configured, using mock data');
        return getMockData(asset);
    }

    const headers = { 'Authorization': `Apikey ${apiKey}` };

    try {
        // Fetch both endpoints in parallel
        const [forecastRes, edgeRes] = await Promise.allSettled([
            fetchWithTimeout(
                `${SYNTH_BASE_URL}/insights/prediction-percentiles?asset=${synthTicker}&horizon=24h`,
                headers
            ),
            fetchWithTimeout(
                `${SYNTH_BASE_URL}/insights/polymarket/up-down/daily?asset=${synthTicker}`,
                headers,
                15000 // edge endpoint is slower
            ),
        ]);

        // Parse forecast
        let currentPrice: number | null = null;
        let forecast: SynthAssetData['forecast'] = [];
        let finalDistribution: Record<string, number> | null = null;

        if (forecastRes.status === 'fulfilled') {
            if (forecastRes.value.ok) {
                const fData = await forecastRes.value.json();
                currentPrice = fData.current_price || fData.price || null;
                const percentiles = fData.forecast_future?.percentiles || [];

                if (percentiles.length > 0) {
                    // Strip out time if any, keeping only probabilities
                    const lastP = percentiles[percentiles.length - 1];
                    console.log(`SynthAPI: ${asset} lastP raw:`, JSON.stringify(lastP).substring(0, 200));
                    finalDistribution = {};
                    for (const [k, v] of Object.entries(lastP)) {
                        if (!isNaN(parseFloat(k))) {
                            finalDistribution[k] = Number(v);
                        }
                    }
                    console.log(`SynthAPI: ${asset} finalDistribution:`, JSON.stringify(finalDistribution));
                } else {
                    console.warn(`SynthAPI: ${asset} NO percentiles found in forecast_future`);
                }

                // The API returns 289 data points over 24h with NO time field
                // Just percentile keys: 0.2, 0.5, 0.8, 0.05, 0.35, 0.65, 0.95, etc.
                // We generate time from array index: 289 points / 24h ≈ 5 min per point
                const nowMs = Date.now();
                const totalDurationMs = 24 * 60 * 60 * 1000; // 24 hours
                const intervalMs = percentiles.length > 1 ? totalDurationMs / (percentiles.length - 1) : totalDurationMs;

                forecast = percentiles.map((p: any, i: number) => {
                    const timeMs = nowMs + (i * intervalMs);
                    return {
                        time: new Date(timeMs).toISOString(),
                        p20: p['0.2'] ?? p['0.05'] ?? p.p20 ?? 0,
                        p50: p['0.5'] ?? p.p50 ?? 0,
                        p80: p['0.8'] ?? p['0.95'] ?? p.p80 ?? 0,
                    };
                });
                console.log(`SynthAPI: Forecast for ${asset} (${synthTicker}): ${forecast.length} points, price=$${currentPrice}, time range: ${forecast[0]?.time} → ${forecast[forecast.length - 1]?.time}`);
            } else {
                console.warn(`SynthAPI: Forecast failed for ${asset}, using mock forecast fallback`);
                const mock = getMockData(asset);
                currentPrice = mock.current_price;
                forecast = mock.forecast;
                finalDistribution = mock.finalDistribution;
                await forecastRes.value.text().catch(() => { }); // prevent socket leak
            }
        } else {
            console.warn(`SynthAPI: Forecast timeout/error for ${asset}, using mock forecast fallback`);
            const mock = getMockData(asset);
            currentPrice = mock.current_price;
            forecast = mock.forecast;
            finalDistribution = mock.finalDistribution;
        }

        // Parse edge
        let synthProbUp: number | null = null;
        let polyProbUp: number | null = null;
        let edge: number | null = null;

        if (edgeRes.status === 'fulfilled') {
            if (edgeRes.value.ok) {
                const eData = await edgeRes.value.json();
                synthProbUp = eData.synth_probability_up ?? null;
                polyProbUp = eData.polymarket_probability_up ?? null;
                if (synthProbUp != null && polyProbUp != null) {
                    edge = synthProbUp - polyProbUp;
                }
                console.log(`SynthAPI: Edge for ${asset}: synth=${synthProbUp} poly=${polyProbUp} edge=${edge?.toFixed(4)}`);
            } else {
                console.warn(`SynthAPI: Edge endpoint failed/timeout for ${asset}, using mock fallback`);
                const mock = getMockData(asset);
                synthProbUp = mock.synth_probability_up;
                polyProbUp = mock.polymarket_probability_up;
                edge = mock.edge;
                await edgeRes.value.text().catch(() => { }); // prevent socket leak
            }
        } else {
            console.warn(`SynthAPI: Edge timeout/error for ${asset}, using mock fallback`);
            const mock = getMockData(asset);
            synthProbUp = mock.synth_probability_up;
            polyProbUp = mock.polymarket_probability_up;
            edge = mock.edge;
        }

        // Calculate Skew, Tail Risk, and Confidence
        let skewValue: number | null = null;
        let tailRiskUpside: number | null = null;
        let tailRiskDownside: number | null = null;
        let confidenceValue: number | null = null;

        if (finalDistribution) {
            // Robustly extract percentiles whether finalDistribution is an object or an array
            const getP = (p: number): number | null => {
                if (Array.isArray(finalDistribution)) {
                    const found = finalDistribution.find((item: any) => {
                        const val = item.percentile ?? item.p ?? item.prob;
                        return val !== undefined && Math.abs(Number(val) - p) < 0.001;
                    });
                    return found ? (found.price ?? found.value ?? found.v) : null;
                }
                return finalDistribution[p.toString()] || finalDistribution[p] || null;
            };

            const p01 = getP(0.01) || getP(0.05) || getP(0.1) || getP(0.2);
            const p05 = getP(0.05) || getP(0.1) || getP(0.01);
            const p25 = getP(0.25) || getP(0.2);
            const p50 = getP(0.5);
            const p75 = getP(0.75) || getP(0.8);
            const p95 = getP(0.95) || getP(0.9) || getP(0.99);
            const p99 = getP(0.99) || getP(0.95) || getP(0.9) || getP(0.8);

            if (p25 && p50 && p75) {
                const upside = p75 - p50;
                const downside = p50 - p25;
                if (downside > 0) skewValue = upside / downside;
            }
            if (p01 && p99 && currentPrice !== null && currentPrice !== undefined && currentPrice !== 0) {
                tailRiskUpside = (p99 - currentPrice) / currentPrice;
                tailRiskDownside = (currentPrice - p01) / currentPrice;
            }
            if (p05 && p95 && currentPrice !== null && currentPrice !== undefined && currentPrice !== 0) {
                confidenceValue = Math.max(0, Math.min(1, 1 - (p95 - p05) / currentPrice));
            }
        }

        return {
            current_price: currentPrice,
            forecast,
            finalDistribution,
            synth_probability_up: synthProbUp,
            polymarket_probability_up: polyProbUp,
            edge,
            skew: skewValue,
            tailRiskUpside,
            tailRiskDownside,
            confidence: confidenceValue,
            source: (forecast.length > 0 || synthProbUp != null) ? 'live' : 'mock',
            cached: false,
        };
    } catch (error) {
        console.error(`SynthAPI: Error fetching ${asset}:`, error);
        return getMockData(asset);
    }
}

// === MAIN EXPORT: Fetch synth data for multiple assets at once ===
// Called once when building the market list — one request per asset
export async function fetchAllSynthForAssets(assets: string[]): Promise<Record<string, SynthAssetData>> {
    const result: Record<string, SynthAssetData> = {};
    const uncached: string[] = [];

    // Check cache first
    for (const asset of assets) {
        const key = asset.toUpperCase();
        const cached = synthCache.get(key);
        if (cached && Date.now() - cached.timestamp < SYNTH_CACHE_DURATION_MS) {
            result[key] = { ...cached.data, cached: true };
        } else {
            uncached.push(key);
        }
    }

    if (uncached.length === 0) {
        console.log(`SynthAPI: All ${assets.length} assets served from cache`);
        return result;
    }

    console.log(`SynthAPI: Fetching ${uncached.length} assets: ${uncached.join(', ')} (${assets.length - uncached.length} cached)`);

    // Fetch uncached assets in parallel
    const fetchResults = await Promise.allSettled(
        uncached.map(asset => fetchSynthForAsset(asset))
    );

    fetchResults.forEach((res, idx) => {
        const asset = uncached[idx];
        if (res.status === 'fulfilled') {
            result[asset] = res.value;
            synthCache.set(asset, { data: res.value, timestamp: Date.now() });
        } else {
            console.error(`SynthAPI: Failed to fetch ${asset}:`, res.reason);
            result[asset] = getMockData(asset);
        }
    });

    return result;
}

// Single-asset fetch (for individual market pages if needed)
export async function fetchSynthData(asset: string): Promise<SynthAssetData> {
    const key = asset.toUpperCase();
    const cached = synthCache.get(key);
    if (cached && Date.now() - cached.timestamp < SYNTH_CACHE_DURATION_MS) {
        return { ...cached.data, cached: true };
    }

    const data = await fetchSynthForAsset(asset);
    synthCache.set(key, { data, timestamp: Date.now() });
    return data;
}

// Keep fetchSynthEdge for backward compatibility
export async function fetchSynthEdge(asset: string) {
    const data = await fetchSynthData(asset);
    return {
        synth_probability_up: data.synth_probability_up,
        polymarket_probability_up: data.polymarket_probability_up,
        edge: data.edge,
    };
}

function getMockData(asset: string): SynthAssetData {
    const now = Date.now();
    const basePrice = asset === 'BTC' ? 65000 : asset === 'ETH' ? 2000 : asset === 'SOL' ? 90 : 200;
    return {
        current_price: basePrice,
        forecast: Array.from({ length: 24 }, (_, i) => ({
            time: new Date(now + i * 3600000).toISOString(),
            p20: basePrice * 0.97 + (i * basePrice * 0.001),
            p50: basePrice + (i * basePrice * 0.002),
            p80: basePrice * 1.03 + (i * basePrice * 0.003),
        })),
        finalDistribution: {
            "0.01": basePrice * 0.90,
            "0.2": basePrice * 0.99,
            "0.5": basePrice * 1.04,
            "0.8": basePrice * 1.10,
            "0.99": basePrice * 1.25
        },
        synth_probability_up: 0.51,
        polymarket_probability_up: 0.50,
        edge: 0.01,
        skew: 1.15,
        tailRiskUpside: 0.125,
        tailRiskDownside: 0.082,
        confidence: 0.85,
        source: 'mock',
        cached: false,
    };
}
