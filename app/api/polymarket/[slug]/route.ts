import { NextResponse } from 'next/server';

import { detectAssetFromContext } from '../../../lib/polymarket';
import { fetchSynthData } from '../../../lib/synthdata';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    // Use await for params as required in Next 15+
    const { slug } = await params;

    try {
        // 1. Fetch event metadata from Gamma API
        let gammaRes = await fetch(`${GAMMA_API_BASE}/events?slug=${slug}`);

        if (!gammaRes.ok) {
            throw new Error(`Gamma API responded with status: ${gammaRes.status}`);
        }

        let events = await gammaRes.json();

        // If not found by event slug, try fetching by market slug
        if (!events || events.length === 0) {
            const marketRes = await fetch(`${GAMMA_API_BASE}/markets?slug=${slug}`);
            if (marketRes.ok) {
                const markets = await marketRes.json();
                if (markets && markets.length > 0) {
                    // Fetch the full event for this market
                    const eventId = markets[0].events?.[0]?.id || markets[0].eventId;
                    if (eventId) {
                        const eventRes = await fetch(`${GAMMA_API_BASE}/events?id=${eventId}`);
                        if (eventRes.ok) {
                            const eventData = await eventRes.json();
                            events = Array.isArray(eventData) ? eventData : [eventData];
                        }
                    }
                }
            }
        }

        if (!events || events.length === 0) {
            return NextResponse.json({ error: 'Market not found' }, { status: 404 });
        }

        const event = events[0];
        const activeMarkets = event.markets.filter((m: any) => !m.closed && m.active);
        if (activeMarkets.length === 0) {
            return NextResponse.json({ error: 'No active markets within event' }, { status: 404 });
        }

        let outcomes: string[] = [];
        let outcomePrices: string[] = [];
        let clobTokenIds: string[] = [];

        if (activeMarkets.length === 1) {
            // Binary market (YES/NO)
            const mainMarket = activeMarkets[0];
            try { outcomes = JSON.parse(mainMarket.outcomes || '["Yes", "No"]'); } catch (e) { }
            try { outcomePrices = JSON.parse(mainMarket.outcomePrices || '["0", "0"]'); } catch (e) { }
            try { clobTokenIds = JSON.parse(mainMarket.clobTokenIds || '[]'); } catch (e) { }
        } else {
            // Categorical multi-market (e.g. "Bitcoin by March 31", "Bitcoin by June 30")
            for (const m of activeMarkets) {
                outcomes.push(m.groupItemTitle || m.question || 'Option');
                try {
                    const prices = JSON.parse(m.outcomePrices || '["0"]');
                    outcomePrices.push(prices[0]); // YES price for this specific outcome
                } catch (e) { outcomePrices.push("0"); }

                try {
                    const tokens = JSON.parse(m.clobTokenIds || '[]');
                    clobTokenIds.push(tokens[0]); // YES token for this specific outcome history
                } catch (e) { clobTokenIds.push(""); }
            }
        }

        // 2. Fetch history from CLOB API (all time history, fidelity 60m)
        let historyDict: { [time: number]: any } = {};

        const fetchPromises = clobTokenIds.map(async (tokenId: string, i: number) => {
            const outcomeName = outcomes[i] || `Option ${i}`;
            if (!tokenId) return;
            try {
                const clobRes = await fetch(`https://clob.polymarket.com/prices-history?market=${tokenId}&interval=all&fidelity=60`);
                if (clobRes.ok) {
                    const clobData = await clobRes.json();
                    if (clobData && clobData.history) {
                        clobData.history.forEach((pt: any) => {
                            const time = pt.t * 1000;
                            if (!historyDict[time]) historyDict[time] = { time };
                            historyDict[time][outcomeName] = parseFloat(pt.p);
                        });
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch CLOB history for ${outcomeName}:`, e);
            }
        });

        await Promise.all(fetchPromises);

        let history = Object.values(historyDict).sort((a: any, b: any) => a.time - b.time);

        // Forward-fill missing values so charts do not have broken lines
        if (history.length > 0) {
            let lastVals: any = {};
            for (let point of history) {
                outcomes.forEach((o: string) => {
                    if (point[o] !== undefined) {
                        lastVals[o] = point[o];
                    } else if (lastVals[o] !== undefined) {
                        point[o] = lastVals[o];
                    }
                });
            }
        }

        const detectedAsset = detectAssetFromContext(event.description, event.title).asset;

        // 3. Return combined data
        // Synth data is fetched separately by the frontend via /api/synthdata (uses 1h cache)
        return NextResponse.json({
            title: event.title,
            description: event.description,
            image: event.image,
            volume: event.volume,
            liquidity: activeMarkets[0].liquidity,
            outcomes: outcomes,
            outcomePrices: outcomePrices,
            history: history,
            asset: detectedAsset,
            eventSlug: event.slug,
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
