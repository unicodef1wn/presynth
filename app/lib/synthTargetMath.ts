export interface MarketCondition {
    type: 'above' | 'below' | 'between' | 'directional';
    price1: number;
    price2?: number;
}

export const extractMarketCondition = (text: string): MarketCondition | null => {
    if (!text) return null;
    const textLower = text.toLowerCase();

    // Helper to parse price with k/m suffix
    const parsePrice = (str: string): number => {
        const clean = str.replace(/,/g, '').toLowerCase();
        if (clean.endsWith('k')) return parseFloat(clean.slice(0, -1)) * 1000;
        if (clean.endsWith('m')) return parseFloat(clean.slice(0, -1)) * 1000000;
        return parseFloat(clean);
    };

    // 1. Check for "between X and Y" or "between-X-Y" format
    const betweenMatch = text.match(/between\s+[\$]?([\d,]+[kKmM]?)\s+and\s+[\$]?([\d,]+[kKmM]?)/i) ||
        text.match(/-between-(\d+[kKmM]?)-(\d+[kKmM]?)/i);

    if (betweenMatch) {
        const p1 = parsePrice(betweenMatch[1]);
        const p2 = parsePrice(betweenMatch[2]);
        return { type: 'between', price1: Math.min(p1, p2), price2: Math.max(p1, p2) };
    }

    // 2. Check for "below" or "less than"
    const belowMatch = text.match(/below\s+[\$]?([\d,]+[kKmM]?)/i) ||
        text.match(/less than\s+[\$]?([\d,]+[kKmM]?)/i) ||
        text.match(/-below-(\d+[kKmM]?)/i);
    if (belowMatch) {
        return { type: 'below', price1: parsePrice(belowMatch[1]) };
    }

    // 3. Check for "above", "greater than", "hit", "crosses"
    const aboveMatch = text.match(/above\s+[\$]?([\d,]+[kKmM]?)/i) ||
        text.match(/greater than\s+[\$]?([\d,]+[kKmM]?)/i) ||
        text.match(/(?:hit|crosses)\s+[\$]?([\d,]+[kKmM]?)/i) ||
        text.match(/-above-(\d+[kKmM]?)/i) ||
        text.match(/-hits-(\d+[kKmM]?)/i) ||
        text.match(/-crosses-(\d+[kKmM]?)/i);
    if (aboveMatch) {
        return { type: 'above', price1: parsePrice(aboveMatch[1]) };
    }

    // 4. Check for "Up or Down"
    if (textLower.includes('up or down') || textLower.includes('up/down')) {
        return { type: 'directional', price1: 0 };
    }

    return null;
};

const getProbBelow = (price: number, points: Array<{ prob: number, price: number }>): number => {
    if (points.length === 0) return 0.5;

    // Extrapolate below
    if (price <= points[0].price) {
        const ratio = price / points[0].price;
        return points[0].prob * Math.max(0, ratio);
    }

    // Extrapolate above
    if (price >= points[points.length - 1].price) {
        const ratio = points[points.length - 1].price / price;
        return 1 - (1 - points[points.length - 1].prob) * Math.max(0, ratio);
    }

    // Interpolate
    for (let i = 0; i < points.length - 1; i++) {
        if (price >= points[i].price && price <= points[i + 1].price) {
            const range = points[i + 1].price - points[i].price;
            const fraction = range === 0 ? 0 : (price - points[i].price) / range;
            return points[i].prob + fraction * (points[i + 1].prob - points[i].prob);
        }
    }
    return 0.5;
};

export const calculateTargetProbability = (condition: MarketCondition, finalDistribution: any): number => {
    // finalDistribution could be:
    // 1. Record<string, number> e.g. { "0.2": 100, "0.5": 150 }
    // 2. Array<{ percentile: number, price: number }>
    let points: Array<{ prob: number, price: number }> = [];

    if (Array.isArray(finalDistribution)) {
        points = finalDistribution.map((item: any) => ({
            prob: Number(item.percentile ?? item.p ?? item.prob ?? 0),
            price: Number(item.price ?? item.value ?? item.v ?? 0)
        })).filter(p => !isNaN(p.prob) && (p.prob > 0 || p.price > 0));
    } else if (typeof finalDistribution === 'object' && finalDistribution !== null) {
        points = Object.entries(finalDistribution)
            .map(([percentile, price]) => ({ prob: Number(percentile), price: price as number }))
            .filter(p => !isNaN(p.prob));
    }

    points.sort((a, b) => a.price - b.price);

    if (points.length === 0) return 0.5;

    let prob = 0.5;
    if (condition.type === 'above') {
        prob = 1 - getProbBelow(condition.price1, points);
    } else if (condition.type === 'below') {
        prob = getProbBelow(condition.price1, points);
    } else if (condition.type === 'between' && condition.price2) {
        prob = getProbBelow(condition.price2, points) - getProbBelow(condition.price1, points);
    } else if (condition.type === 'directional') {
        // For directional, we use the median (p50) vs distribution. 
        // But usually, it's better handled at the page level using synth_probability_up.
        // As a last resort, we return 0.5 if we can't do better here.
        prob = 0.5;
    }

    // If calculation resulted in a neutral 0.5 exactly but we have a directional intent, 
    // it's better to return something slightly off to avoid the "50.0% bug" appearance if possible,
    // though here 0.5 is mathematically correct if unknown.
    return Math.max(0.001, Math.min(0.999, prob));
};

