import { NextResponse } from 'next/server';

import { fetchPolymarketData } from '../../lib/polymarket';
import { fetchAllSynthForAssets } from '../../lib/synthdata';
import { extractMarketCondition, calculateTargetProbability } from '../../lib/synthTargetMath';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        console.log("Aggregator: Fetching Polymarket data...");
        const polymarketData = await fetchPolymarketData();
        console.log(`Aggregator: Polymarket returned ${polymarketData?.length || 0} matched markets`);

        if (!Array.isArray(polymarketData) || polymarketData.length === 0) {
            console.log("Aggregator: No relevant markets found after matching assets.");
            return NextResponse.json({ error: 'No relevant markets found' }, { status: 404 });
        }

        // 1. Group unique assets
        const uniqueAssets = [...new Set(polymarketData.map(m => m.asset).filter(Boolean))] as string[];

        // 2. Await actual SynthData cache/fetch
        console.log(`Aggregator: Fetching real SynthData for ${uniqueAssets.length} assets`);
        const synthDataMap = await fetchAllSynthForAssets(uniqueAssets);
        
        // Debug: log what we got
        console.log("Aggregator: SynthDataMap keys:", Object.keys(synthDataMap));
        for (const [asset, sd] of Object.entries(synthDataMap)) {
            console.log(`Aggregator: ${asset} - finalDistribution: ${sd.finalDistribution ? JSON.stringify(sd.finalDistribution) : 'null'}, synth_probability_up: ${sd.synth_probability_up}`);
        }

        // 3. Map it deeply into the response
        const aggregated = polymarketData.map(market => {
            const sd = market.asset ? synthDataMap[market.asset.toUpperCase()] : null;

            let finalPolyOdds = market.impliedOdds;

            // Try to extract a price condition from slug or title
            const condition = extractMarketCondition(market.slug) || extractMarketCondition(market.title);

            let fairProb: number;

            if (condition) {
                if (condition.type === 'directional' && sd?.synth_probability_up !== null && sd?.synth_probability_up != undefined) {
                    fairProb = sd.synth_probability_up;
                    console.log(`Market ${market.slug}: DIRECTIONAL, using sd.synth_probability_up=${fairProb}`);
                } else if (sd?.finalDistribution) {
                    fairProb = calculateTargetProbability(condition, sd.finalDistribution);
                    console.log(`Market ${market.slug}: condition=${JSON.stringify(condition)}, fairProb=${fairProb.toFixed(4)}`);
                } else {
                    console.log(`Market ${market.slug}: NO distribution, using polyOdds fallback`);
                    fairProb = finalPolyOdds ?? 0.5;
                }
            } else {
                console.log(`Market ${market.slug}: no condition, asset=${market.asset}, sd=${sd ? 'exists' : 'null'}`);
                fairProb = sd?.synth_probability_up ?? 0.5;
                console.log(`Market ${market.slug}: fairProb=${fairProb}`);
            }

            // Recompute edge accurately for this specific sub-market row
            const discrepancy = fairProb - (finalPolyOdds || 0.5);

            return {
                ...market,
                impliedOdds: finalPolyOdds, // pass the accurate exact poly odds down
                synthdata: sd ? {
                    fairProbability: fairProb,
                    discrepancy: discrepancy,
                    isRisk: discrepancy > 0.05
                } : {
                    fairProbability: 0.5,
                    discrepancy: 0,
                    isRisk: false
                }
            };
        });

        // Filter out items without priceChange24h to be safe
        // AND exclude 50% synth probability (no edge/calculation fallback)
        const safeAggregated = aggregated.filter(item => 
            item.priceChange24h !== null && 
            item.impliedOdds !== 0.5 &&
            !item.title.toLowerCase().includes('up or down') &&
            !item.slug.toLowerCase().includes('up-or-down') &&
            item.synthdata && 
            Math.abs(item.synthdata.fairProbability - 0.5) > 0.001
        );

        return NextResponse.json(safeAggregated);

    } catch (error) {
        console.error('Aggregator error:', error);
        return NextResponse.json({ error: 'Failed to aggregate data' }, { status: 500 });
    }
}
