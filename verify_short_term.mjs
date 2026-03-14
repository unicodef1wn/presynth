async function verify() {
    try {
        console.log("Fetching aggregator data...");
        const response = await fetch(`http://localhost:3000/api/aggregator`);
        const markets = await response.json();

        console.log(`Total Matches: ${markets.length}`);

        const shortTerm = markets.filter(m =>
            m.title.toLowerCase().includes('up or down') ||
            m.title.toLowerCase().includes('15m') ||
            m.title.toLowerCase().includes('6h')
        );

        console.log(`\nShort-term markets found: ${shortTerm.length}`);
        if (shortTerm.length > 0) {
            shortTerm.slice(0, 10).forEach(m => {
                console.log(` - [${m.asset}] ${m.title} (Vol: ${m.volume}, End: ${m.endDate})`);
            });
        } else {
            console.log("FAIL: No short-term markets found in the output.");
        }

        // Check for specific assets
        ['BTC', 'ETH', 'SOL'].forEach(asset => {
            const assetShort = shortTerm.filter(m => m.asset === asset);
            console.log(`${asset} short-term: ${assetShort.length}`);
        });

    } catch (e) {
        console.error("Verification failed:", e.message);
    }
}
verify();
