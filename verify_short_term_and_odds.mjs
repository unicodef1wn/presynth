
const testMarkets = [
    { title: "NVIDIA (NVDA) closes week of Mar 16 at ___?", endDate: "2026-03-16T23:59:59Z", volume: 500000 },
    { title: "Bitcoin Up or Down on March 14?", endDate: "2026-03-14T23:59:59Z", volume: 1000 },
    { title: "Tesla (TSLA) closes above $300 on March 14?", endDate: "2026-03-14T23:59:59Z", volume: 500 },
    { title: "Apple (AAPL) closes week of Mar 16 at ___?", endDate: "2026-03-16T23:59:59Z", volume: 1000000 }
];

function sortMarkets(markets) {
    const now = new Date("2026-03-14T02:00:00Z").getTime();
    return [...markets].sort((a, b) => {
        const aEnd = new Date(a.endDate).getTime();
        const bEnd = new Date(b.endDate).getTime();
        const aDiff = (aEnd - now) / (1000 * 60 * 60);
        const bDiff = (bEnd - now) / (1000 * 60 * 60);

        const aIsShort = aDiff > -2 && aDiff <= 24;
        const bIsShort = bDiff > -2 && bDiff <= 24;

        if (aIsShort && !bIsShort) return -1;
        if (!aIsShort && bIsShort) return 1;

        return (Number(b.volume) || 0) - (Number(a.volume) || 0);
    });
}

const sorted = sortMarkets(testMarkets);
console.log("=== Sorting Test ===");
sorted.forEach(m => console.log(`[${m.endDate}] Vol: ${m.volume} | ${m.title}`));

// Test condition parsing
function extractMarketCondition(text) {
    const textLower = text.toLowerCase();
    
    // Simplified regex from original
    const aboveMatch = text.match(/above\s+[\$]?([\d,]+)/i);
    if (aboveMatch) return { type: 'above', price1: parseFloat(aboveMatch[1].replace(/,/g, '')) };

    if (textLower.includes('up or down') || textLower.includes('up/down')) {
        return { type: 'directional', price1: 0 };
    }
    return null;
}

console.log("\n=== Condition Parsing Test ===");
["Bitcoin Up or Down on March 14?", "Tesla closes above $300", "Apple at ___?"].forEach(t => {
    const cond = extractMarketCondition(t);
    console.log(`Title: "${t}" -> Type: ${cond ? cond.type : 'NONE'}`);
});
