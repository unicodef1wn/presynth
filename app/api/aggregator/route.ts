import { NextResponse } from 'next/server';

import { fetchPolymarketData } from '../../lib/polymarket';
import { fetchAllSynthForAssets } from '../../lib/synthdata';
import { extractMarketCondition, calculateTargetProbability } from '../../lib/synthTargetMath';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("Aggregator: Fetching Polymarket data...");
        const polymarketData = await fetchPolymarketData();

        if (!Array.isArray(polymarketData) || polymarketData.length === 0) {
            console.log("Aggregator: No relevant markets found.");
            return NextResponse.json({ error: 'No relevant markets found' }, { status: 404 });
        }

        // 1. Warm up asset cache
        const uniqueAssets = [...new Set(polymarketData.map(m => m.asset).filter(Boolean))] as string[];
        const assetDataMap = await fetchAllSynthForAssets(uniqueAssets);

        // 2. Map data for each market
        const aggregated = polymarketData.map(market => {
            const sd = market.asset ? assetDataMap[market.asset.toUpperCase()] : null;
            if (!sd) return { ...market, synthdata: null };

            let fairProb: number | null = null;
            const condition = extractMarketCondition(market.slug) || extractMarketCondition(market.title);

            if (condition) {
                if (condition.type === 'directional' && sd.synth_probability_up !== null) {
                    fairProb = sd.synth_probability_up;
                } else if (sd.finalDistribution) {
                    fairProb = calculateTargetProbability(condition, sd.finalDistribution);
                }
            } else if (sd.synth_probability_up !== null) {
                fairProb = sd.synth_probability_up;
            }

            // Calculation fails if fairProb is still null
            if (fairProb === null) return { ...market, synthdata: null };

            // Accurate discrepancy
            const discrepancy = fairProb - (market.impliedOdds || 0.5);

            return {
                ...market,
                synthdata: {
                    fairProbability: fairProb,
                    discrepancy: discrepancy,
                    isRisk: Math.abs(discrepancy) > 0.05
                }
            };
        });

        // 3. STRICT FILTERING: Eliminate 0% spread and invalid data
        const safeAggregated = aggregated.filter(item => 
            item.synthdata !== null &&
            item.impliedOdds !== null &&
            item.impliedOdds !== 0.5 && // Filter out dead 50/50 markets
            Math.abs(item.synthdata.discrepancy) > 0.0001 && // Eliminate EXACT 0.0% spreads (fallbacks)
            !item.title.toLowerCase().includes('up or down') &&
            !item.slug.toLowerCase().includes('up-or-down')
        );

        console.log(`Aggregator: Returning ${safeAggregated.length} markets with validated Synth edge.`);
        return NextResponse.json(safeAggregated);

    } catch (error) {
        console.error('Aggregator error:', error);
        return NextResponse.json({ error: 'Failed to aggregate data' }, { status: 500 });
    }
}
