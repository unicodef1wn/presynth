
function calculateTailRisk(finalDistribution, currentPrice) {
    let tailRiskUpside = null;
    let tailRiskDownside = null;

    if (finalDistribution) {
        // Mocking the logic from synthdata.ts
        const p01 = finalDistribution['0.01'] || finalDistribution['0.05'] || finalDistribution['0.1'] || finalDistribution['0.2'];
        const p99 = finalDistribution['0.99'] || finalDistribution['0.95'] || finalDistribution['0.9'] || finalDistribution['0.8'];

        console.log(`Debug keys: p01=${p01}, p99=${p99}, price=${currentPrice}`);

        if (p01 && p99 && currentPrice !== null && currentPrice !== undefined && currentPrice !== 0) {
            tailRiskUpside = (p99 - currentPrice) / currentPrice;
            tailRiskDownside = (currentPrice - p01) / currentPrice;
        }
    }
    return { tailRiskUpside, tailRiskDownside };
}

const testCases = [
    {
        name: "Standard distribution",
        dist: { '0.01': 100, '0.5': 150, '0.99': 200 },
        price: 150
    },
    {
        name: "Fallback to 0.05/0.95",
        dist: { '0.05': 120, '0.5': 150, '0.95': 180 },
        price: 150
    },
    {
        name: "Missing price (0)",
        dist: { '0.01': 100, '0.99': 200 },
        price: 0
    },
    {
        name: "Very low price",
        dist: { '0.01': 0.1, '0.99': 0.5 },
        price: 0.2
    }
];

testCases.forEach(tc => {
    console.log(`\nCase: ${tc.name}`);
    const res = calculateTailRisk(tc.dist, tc.price);
    console.log(`Result: Upside=${res.tailRiskUpside ? (res.tailRiskUpside * 100).toFixed(1) + '%' : 'null'}, Downside=${res.tailRiskDownside ? (res.tailRiskDownside * 100).toFixed(1) + '%' : 'null'}`);
});
