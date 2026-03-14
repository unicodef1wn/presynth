import fetch from 'node-fetch';

async function run() {
    try {
        const res = await fetch('http://localhost:3000/api/aggregator');
        const data = await res.json();
        console.log("Total markets:", data.length);

        const testMarkets = data.slice(0, 5).map(m => {
            const polyOdds = m.impliedOdds || 0.5;
            const fairProbStr = m.synthdata?.fairProbability || "0.5";
            const fairProb = parseFloat(fairProbStr);
            const edge = m.synthdata?.discrepancy ? parseFloat(m.synthdata.discrepancy) : (fairProb - polyOdds);
            return {
                title: m.title,
                impliedOdds: m.impliedOdds,
                polyOdds,
                synthdata_fairProbability: m.synthdata?.fairProbability,
                fairProb,
                discrepancy: m.synthdata?.discrepancy,
                edge
            }
        });

        console.log("Sample Edge calculations:");
        console.dir(testMarkets, { depth: null });

    } catch (e) {
        console.error("Error:", e);
    }
}
run();
