import { fetchPolymarketData } from './polymarket';
import { fetchAllSynthForAssets } from './synthdata';
import { extractMarketCondition, calculateTargetProbability } from './synthTargetMath';

export async function getAggregatedMarkets() {
    const polymarketData = await fetchPolymarketData();

    if (!Array.isArray(polymarketData) || polymarketData.length === 0) {
        return [];
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

    // 3. FILTERING: Keep it relaxed so we show SOME data even if edge is small
    const safeAggregated = aggregated.filter(item => 
        item.synthdata !== null &&
        item.impliedOdds !== null &&
        !item.title.toLowerCase().includes('up or down') &&
        !item.slug.toLowerCase().includes('up-or-down')
    );

    return safeAggregated;
}
