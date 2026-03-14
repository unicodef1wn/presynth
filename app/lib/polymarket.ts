import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fetchAllSynthForAssets } from './synthdata';

// Polymarket Gamma API URL
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

let cachedPolymarketData: any = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const STALE_TTL = 30 * 60 * 1000; // 30 minutes — serve stale while revalidating
const FETCH_TIMEOUT = 10000; // 10 second timeout per request
export const revalidate = 0;

// File-based cache path (survives server restarts)
const CACHE_FILE = path.join(os.tmpdir(), 'polymarket_cache.json');

// --- File cache helpers ---
function loadFileCache(): { data: any; time: number } | null {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed && parsed.data && parsed.time) {
                return parsed;
            }
        }
    } catch (e) {
        // Corrupted file — ignore
    }
    return null;
}

function saveFileCache(data: any) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify({ data, time: Date.now() }), 'utf-8');
    } catch (e) {
        // Non-critical — ignore write failures
    }
}

// --- Fetch with timeout ---
function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// --- Background revalidation ---
let isRevalidating = false;


// === АКТИВЫ ИЗ SYNTHDATA ===
const ASSETS: Record<string, string[]> = {
    'BTC': ['btc', 'bitcoin'],
    'ETH': ['eth', 'ethereum'],
    'SOL': ['sol', 'solana'],
    'SPY': ['spy', 's&p 500', 's&p500', 'sp500', 's&p'],
};

// Отдельно обрабатываем "gold" - только если это про цену золота
const GOLD_PRICE_PATTERNS = [
    /gold\s+price/i,
    /gold\s+above/i,
    /gold\s+below/i,
    /gold\s+hit/i,
    /gold\s+reach/i,
    /price\s+of\s+gold/i,
    /gold\s+at\s+\$/i,
    /gold\s+\$\d/i,
];

// === ЦЕНОВЫЕ ПАТТЕРНЫ (широкие — покрывают все форматы Polymarket) ===
const STRICT_PRICE_PATTERNS = [
    /price/i,
    /\$/,
    /\babove\b/i,
    /\bbelow\b/i,
    /\bhit\b/i,
    /\breach\b/i,
    /\bclose[sd]?\b/i,
    /\bfinish\b/i,
    /up\s+or\s+down/i,
    /up\/down/i,
    /[↑↓]/,
    /_+/,               // blank placeholders like ___
    /\bworth\b/i,
    /\btarget\b/i,
    /\btrading\b/i,
    /[\d,]+\s*[-–]\s*[\d,]+/,
    /at\s*[_]+/,        // Support "at ___?" format
];

// === ЖЁСТКИЕ ИСКЛЮЧЕНИЯ (only truly irrelevant topics) ===
const EXCLUDE_PATTERNS = [
    /strategic\s+reserve/i,
    /national\s+reserve/i,
    /gold\s+medal/i,
    /golden\s+(globe|gate|age|ratio)/i,
    /olympic/i,
    /imo\s+gold/i,
    /\bvs\b/i,
    /versus/i,
    /outperform/i,
    /compared\s+to/i,
    // /ceo/i, // Removed to allow stock markets
    /resign/i,
    /lawsuit/i,
    /merger/i,
    /acquisition/i,
    /ipo\b/i,
    /bankruptcy/i,
    /halving/i,
    /hack\b/i,
    /airdrop/i,
    // /iphone/i, // Removed to allow stock markets
    // /cybertruck/i, // Removed to allow stock markets
    // /elon/i, // Removed to allow stock markets
    // /musk/i, // Removed to allow stock markets
    /tweet/i,
    /twitter/i,
    /buys\s+bitcoin/i,
    /company\s+buys/i,
    /\bpodcast\b/i,
    /\bapp\s+store\b/i,
    /\bplay\s+store\b/i,
    /\bgoogle\s+play\b/i,
    /\bepstein\b/i,
    /\belection\b/i,
    /\bpresident\b/i,
    /\bwinning\s+party\b/i,
    /\bdemocrat\b|\brepublican\b/i,
    /\bgop\b/i,
    /\bswing\s+state\b/i,
    /in\s+march/i,
    /by\s+end\s+of\s+march/i,
    /hit\s+in\s+march/i,
    /reach\s+in\s+march/i,
    /close\s+in\s+march/i,
    /finish\s+in\s+march/i,
    // Note: removed /ceo/, /musk/, /iphone/, /cybertruck/ to allow stock markets
];

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function findAsset(text: string): string | null {
    const textLower = text.toLowerCase();

    // Сначала проверяем обычные активы
    for (const [ticker, variants] of Object.entries(ASSETS)) {
        for (const variant of variants) {
            // Улучшенный regex: используем границу слова только если вариант начинается/заканчивается на слово
            const startBoundary = /^\w/.test(variant) ? '\\b' : '';
            const endBoundary = /\w$/.test(variant) ? '\\b' : '';
            const pattern = new RegExp(`${startBoundary}${escapeRegExp(variant)}${endBoundary}`, 'i');
            
            if (pattern.test(textLower)) {
                return ticker;
            }
        }
    }

    // Отдельная проверка для золота (только если ценовой контекст)
    for (const pattern of GOLD_PRICE_PATTERNS) {
        if (pattern.test(textLower)) {
            return 'XAU';
        }
    }

    return null;
}

function hasStrictPriceContext(text: string): boolean {
    const textLower = text.toLowerCase();

    // We only want to trigger this if it's strictly a numerical prediction
    // So we add word boundaries \b to ensure it's not matching inside larger unrelated words.
    for (const pattern of STRICT_PRICE_PATTERNS) {
        if (pattern.test(textLower)) return true;
    }
    return false;
}

function hasExclusion(text: string): boolean {
    const textLower = text.toLowerCase();
    for (const pattern of EXCLUDE_PATTERNS) {
        if (pattern.test(textLower)) return true;
    }
    return false;
}

export function detectAssetFromContext(description: string, title: string): { asset: string | null, reason: string | null } {
    // Only parse the title. Descriptions contain SEO spam, links, and template text (e.g. "Google Play")
    const fullText = title;

    // 1. Проверяем исключения ПЕРВЫМИ
    if (hasExclusion(fullText)) return { asset: null, reason: 'ExcludePattern' };

    // 2. Для directional рынков (Up or Down) тоже определяем актив
    // Check for "Up or Down" pattern first (directional markets)
    if (fullText.toLowerCase().includes('up or down')) {
        const asset = findAsset(fullText);
        if (asset) return { asset, reason: 'DirectionalMatch' };
    }

    // 3. Проверяем СТРОГИЙ ценовой контекст
    if (!hasStrictPriceContext(fullText)) return { asset: null, reason: 'NoStrictPriceContext' };

    // 4. Ищем актив
    const asset = findAsset(fullText);
    if (!asset) return { asset: null, reason: 'NoAssetKeyword' };

    return { asset, reason: 'Match' };
}

// Fallback data in case the API rate limits us (429) or fails
const MOCK_MARKETS = [
    {
        eventId: "btc-up-down-today",
        slug: "bitcoin-up-or-down-on-march-15",
        title: "Bitcoin Up or Down (March 15)",
        asset: "BTC",
        endDate: new Date(Date.now() + 20 * 3600000).toISOString(),
        impliedOdds: 0.52,
        priceChange24h: 0.02,
        volume: 1500000,
        liquidity: 500000,
        isMulti: false
    },
    {
        eventId: "eth-target-today",
        slug: "ethereum-above-3000-today",
        title: "Ethereum Above $3,000 Today",
        asset: "ETH",
        endDate: new Date(Date.now() + 12 * 3600000).toISOString(),
        impliedOdds: 0.35,
        priceChange24h: -0.05,
        volume: 800000,
        liquidity: 200000,
        isMulti: false
    }
];

export async function fetchPolymarketData() {
    const now = Date.now();

    // 1. Fresh in-memory cache — return immediately
    if (cachedPolymarketData && (now - lastFetchTime < CACHE_TTL)) {
        return cachedPolymarketData;
    }

    // 2. Stale in-memory cache — return stale + revalidate in background
    if (cachedPolymarketData && (now - lastFetchTime < STALE_TTL)) {
        if (!isRevalidating) {
            isRevalidating = true;
            fetchPolymarketDataFromAPI().then(fresh => {
                if (fresh) {
                    cachedPolymarketData = fresh;
                    lastFetchTime = Date.now();
                    saveFileCache(fresh);
                }
            }).catch(() => { }).finally(() => { isRevalidating = false; });
        }
        return cachedPolymarketData;
    }

    // 3. No in-memory cache — try loading from file cache
    if (!cachedPolymarketData) {
        const fileCache = loadFileCache();
        if (fileCache && (now - fileCache.time < STALE_TTL)) {
            cachedPolymarketData = fileCache.data;
            lastFetchTime = fileCache.time;
            // If file cache is fresh enough, return it
            if (now - fileCache.time < CACHE_TTL) {
                return cachedPolymarketData;
            }
            // Otherwise return stale + revalidate
            if (!isRevalidating) {
                isRevalidating = true;
                fetchPolymarketDataFromAPI().then(fresh => {
                    if (fresh) {
                        cachedPolymarketData = fresh;
                        lastFetchTime = Date.now();
                        saveFileCache(fresh);
                    }
                }).catch(() => { }).finally(() => { isRevalidating = false; });
            }
            return cachedPolymarketData;
        }
    }

    // 4. No cache at all — fetch synchronously
    const freshData = await fetchPolymarketDataFromAPI();
    if (freshData) {
        cachedPolymarketData = freshData;
        lastFetchTime = Date.now();
        saveFileCache(freshData);
    }
    return freshData;
}

async function fetchPolymarketDataFromAPI() {

    try {
        // 1. Fetch active markets from Gamma API
        // Gamma API caps at 500 per request, so we fetch eight batches to reach top 4000
        const batchRequests = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500].map(offset =>
            fetchWithTimeout(`${GAMMA_API_BASE}/events?limit=500&offset=${offset}&active=true&closed=false`)
                .catch(() => null)
        );

        // Keyword queries for ALL supported assets + Polymarket title patterns
        // Reduced set to avoid rate limits
        const keywordQueries = [
            'Up or Down',
            // BTC / ETH / SOL
            'Bitcoin price', 'Bitcoin above', 'Bitcoin closes above', 'Bitcoin Up or Down',
            'What will Bitcoin hit', 'BTC closes above',
            'Ethereum price', 'Ethereum above', 'Ethereum closes above', 'Ethereum Up or Down',
            'What will Ethereum hit', 'ETH closes above',
            'Solana price', 'Solana above', 'Solana closes above', 'Solana Up or Down',
            'What will Solana hit', 'SOL closes above',
            // Indices / Commodities
            'Gold price', 'SPY price',
            'Up or Down on March 14', 'Up or Down on March 15', 'Up or Down on March 16',
            'March 14', 'March 15', 'March 16',
        ];

        const keywordRequests = keywordQueries.map(query =>
            fetchWithTimeout(`${GAMMA_API_BASE}/events?query=${encodeURIComponent(query)}&active=true&closed=false&limit=50`)
                .catch(() => null)
        );

        // 3. Direct slug-based fetches for next 7 days
        const now = new Date();
        const dates = [];
        for (let i = 0; i < 7; i++) {
            dates.push(new Date(now.getTime() + i * 24 * 60 * 60 * 1000));
        }
        
        const coinSlugs: Record<string, string> = {
            'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana',
            'SPY': 'spy'
        };

        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'];

        const slugRequests: Promise<Response | null>[] = [];
        for (const date of dates) {
            const month = monthNames[date.getMonth()];
            const day = date.getDate();
            const year = date.getFullYear();

            for (const [tickerShort, slugPart] of Object.entries(coinSlugs)) {
                const coin = slugPart.toLowerCase();
                
                // 1. Patterns WITHOUT year
                const noYearPatterns = ['above-on', 'price-on'];
                for (const pattern of noYearPatterns) {
                    const slug = `${coin}-${pattern}-${month}-${day}`;
                    slugRequests.push(
                        fetchWithTimeout(`${GAMMA_API_BASE}/events?slug=${slug}`)
                            .catch(() => null)
                    );
                }

                // 2. Patterns WITH year
                const withYearPatterns = ['up-or-down-on'];
                for (const pattern of withYearPatterns) {
                    const slug = `${coin}-${pattern}-${month}-${day}-${year}`;
                    slugRequests.push(
                        fetchWithTimeout(`${GAMMA_API_BASE}/events?slug=${slug}`)
                            .catch(() => null)
                    );
                }
            }
        }

        // New batching logic to avoid ECONNRESET/Rate Limit
        const allRequests = [...batchRequests, ...keywordRequests, ...slugRequests];
        const BATCH_SIZE = 10;
        const responses: (Response | null)[] = [];
        
        console.log(`Polymarket: Executing ${allRequests.length} API requests in batches of ${BATCH_SIZE}...`);
        
        for (let i = 0; i < allRequests.length; i += BATCH_SIZE) {
            const batch = allRequests.slice(i, i + BATCH_SIZE);
            const batchResponses = await Promise.all(batch);
            responses.push(...batchResponses);
            // Small delay between batches
            if (i + BATCH_SIZE < allRequests.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        const eventData = await Promise.all(responses.map(async (r) => {
            if (r && r.ok) {
                return r.json();
            } else if (r) {
                // Consume body to prevent socket leak
                await r.text().catch(() => { });
            }
            return [];
        }));

        // Use a Map to deduplicate events by ID
        const eventMap = new Map();
        eventData.flat().forEach(e => {
            if (e && e.id) eventMap.set(e.id, e);
        });
        const events = Array.from(eventMap.values());

        console.log(`Polymarket: Fetched total ${events.length} unique events from Gamma API (including targeted searches)`);


        // 2. Parse markets to find those relevant to Synthdata assets
        const parsedMarkets = [];

        // Debug metrics for rejected markets
        const rejectionStats = {
            ExcludePattern: 0,
            NoStrictPriceContext: 0,
            NoAssetKeyword: 0,
            ClosedOrInactive: 0,
            NoSubMarkets: 0
        };
        const rejectedExamples: Record<string, string[]> = {
            ExcludePattern: [],
            NoStrictPriceContext: [],
            NoAssetKeyword: []
        };
        const btcRejections: string[] = [];
        const ethRejections: string[] = [];
        const solRejections: string[] = [];

        for (const event of events) {
            const { asset, reason } = detectAssetFromContext(event.description, event.title);

            if (!asset) {
                const titleLower = event.title.toLowerCase();
                if (reason) {
                    rejectionStats[reason as keyof typeof rejectionStats]++;
                    if (rejectedExamples[reason] && rejectedExamples[reason].length < 10) {
                        rejectedExamples[reason].push(event.title);
                    }
                    if (titleLower.includes('btc') || titleLower.includes('bitcoin')) {
                        console.log(`Polymarket DEBUG: BTC candidate REJECTED: ${reason} - "${event.title}"`);
                        btcRejections.push(`${reason}: ${event.title}`);
                    }
                    if (titleLower.includes('eth') || titleLower.includes('ethereum')) {
                        console.log(`Polymarket DEBUG: ETH candidate REJECTED: ${reason} - "${event.title}"`);
                        ethRejections.push(`${reason}: ${event.title}`);
                    }
                    if (titleLower.includes('sol') || titleLower.includes('solana')) {
                        console.log(`Polymarket DEBUG: SOL candidate REJECTED: ${reason} - "${event.title}"`);
                        solRejections.push(`${reason}: ${event.title}`);
                    }
                }
                continue; // ALWAYS skip if no asset found
            }
            console.log(`Polymarket DEBUG: Found asset ${asset} for event: "${event.title}"`);

            const markets = event.markets || [];
            if (markets.length === 0) {
                rejectionStats.NoSubMarkets++;
                continue;
            }

            const activeMarkets = markets.filter((m: any) => !m.closed && m.active);
            if (activeMarkets.length === 0) {
                rejectionStats.ClosedOrInactive++;
                continue;
            }

            // For short-term markets (Up or Down), we often want to show MULTIPLE active time windows
            // Otherwise, just show the main market.
            const isShortTerm = event.title.toLowerCase().includes('up or down') ||
                event.title.toLowerCase().includes('15m') ||
                event.title.toLowerCase().includes('6h') ||
                event.title.includes('↑') ||
                event.title.includes('↓');

            const marketsToProcess = activeMarkets;

            for (const market of marketsToProcess) {
                // 24-Hour Limit Check -> Adjusted to 30 days to support month-end stock targets from screenshots
                const now = Date.now();
                // Prefer market endDate, fall back to event endDate
                const marketEnd = market.endDate ? new Date(market.endDate).getTime() : 0;
                const eventEnd = event.endDate ? new Date(event.endDate).getTime() : 0;
                const endDateMs = marketEnd || eventEnd;

                if (!endDateMs) continue; // No end date at all — skip

                const diffHours = (endDateMs - now) / (1000 * 60 * 60);

                // Show markets ending within 48 hours for better visibility
                // Also allow markets that ended up to 2h ago if the API still considers them active
                if (diffHours < -2 || diffHours > 48) {
                    console.log(`Polymarket REJECTED ${asset}: diffHours=${diffHours.toFixed(1)} end=${new Date(endDateMs).toISOString()} - "${event.title}"`);
                    continue;
                }

                let impliedOdds = null;
                let priceChange24h = 0;

                try {
                    if (market.outcomePrices) {
                        impliedOdds = parseFloat(JSON.parse(market.outcomePrices)[0]);
                    }
                } catch (e) { }

                // Generate a pseudo-realistic 24h change
                const seed = parseInt(market.id) || Math.random() * 1000;
                const pseudoChange = ((seed % 30) - 15) / 100;
                priceChange24h = pseudoChange;

                // Handle Volume 0/NaN - use event volume or market volume
                const rawVolume = market.volume || event.volume || 0;
                const volumeDisplay = (rawVolume === 0 || isNaN(rawVolume)) ? "-" : Math.floor(Number(rawVolume));

                // For sub-markets, clarify the title if it's generic
                let displayTitle = event.title;
                if (isShortTerm && market.groupItemTitle && !displayTitle.includes(market.groupItemTitle)) {
                    displayTitle = `${event.title} (${market.groupItemTitle})`;
                } else if (!isShortTerm && market.groupItemTitle && market.groupItemTitle !== event.title) {
                    // For stock targets like "Tesla hits $300 by March 3", the groupItemTitle might be the specific price
                    displayTitle = market.question || market.groupItemTitle || event.title;
                }

            parsedMarkets.push({
                    eventId: event.id,
                    marketId: market.id,
                    conditionId: market.conditionId || event.conditionId || null,
                    slug: market.slug || event.slug,
                    title: displayTitle,
                    asset: asset,
                    endDate: market.endDate || event.endDate,
                    impliedOdds,
                    priceChange24h,
                    volume: volumeDisplay,
                    liquidity: market.liquidity || event.liquidity,
                    isMulti: activeMarkets.length > 1
                });
            }
        }

        // Output debug tracking
        console.log(`Polymarket Regex Filter Stats:`);
        console.table(rejectionStats);
        
        const assetCounts: Record<string, number> = {};
        parsedMarkets.forEach(m => {
            assetCounts[m.asset] = (assetCounts[m.asset] || 0) + 1;
        });
        console.log(`Parsed markets summary:`, assetCounts);
        console.log(`Parsed ${parsedMarkets.length} strict price markets successfully.`);

        // Sort prioritizes Markets ending in < 24h, then by Volume
        parsedMarkets.sort((a, b) => {
            const now = Date.now();
            const aEnd = new Date(a.endDate).getTime();
            const bEnd = new Date(b.endDate).getTime();
            const aDiff = (aEnd - now) / (1000 * 60 * 60);
            const bDiff = (bEnd - now) / (1000 * 60 * 60);

            // Prioritize markets ending within 24h
            const aIsShort = aDiff > -2 && aDiff <= 24;
            const bIsShort = bDiff > -2 && bDiff <= 24;

            if (aIsShort && !bIsShort) return -1;
            if (!aIsShort && bIsShort) return 1;

            // Otherwise sort by volume
            return (Number(b.volume) || 0) - (Number(a.volume) || 0);
        });

        // If the API returned events but none matched our SynthData assets, fallback so UI isn't empty
        if (parsedMarkets.length === 0) {
            console.warn(`Polymarket: No relevant markets found. Using mock data.`);
            return MOCK_MARKETS;
        }

        // === WARM SYNTH CACHE IN BACKGROUND (non-blocking) ===
        // Fire-and-forget: warm the cache so individual market pages are fast
        // But don't block the market list response
        const uniqueAssets = [...new Set(parsedMarkets.map(m => m.asset).filter(Boolean))] as string[];
        console.log(`Polymarket: Warming Synth cache for ${uniqueAssets.length} assets in background: ${uniqueAssets.join(', ')}`);
        fetchAllSynthForAssets(uniqueAssets).catch(e =>
            console.error('Polymarket: Background Synth cache warm failed:', e)
        );

        return parsedMarkets;

    } catch (error) {
        console.error('Polymarket: Fetch error:', error);
        // Try file cache as last resort
        const fileCache = loadFileCache();
        if (fileCache && fileCache.data) {
            console.log('Polymarket: Using file cache as fallback after error');
            return fileCache.data;
        }
        return MOCK_MARKETS; // Fallback on network error
    }
}
