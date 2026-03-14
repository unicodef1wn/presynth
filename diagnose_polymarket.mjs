async function diagnose() {
    const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
    const query = 'Up or Down';
    console.log(`Checking events for query: ${query}`);

    const res = await fetch(`${GAMMA_API_BASE}/events?query=${encodeURIComponent(query)}&active=true&closed=false&limit=50`);
    const events = await res.json();
    console.log(`API returned ${events.length} events.`);

    const now = Date.now();

    events.slice(0, 5).forEach(e => {
        console.log(`\n--- Event: ${e.title} (ID: ${e.id}) ---`);
        const markets = e.markets || [];
        const activeMarkets = markets.filter(m => !m.closed && m.active);
        console.log(`Total Markets: ${markets.length}, Active: ${activeMarkets.length}`);

        if (activeMarkets.length > 0) {
            const m = activeMarkets[0];
            const endDateMs = new Date(m.endDate || e.endDate).getTime();
            const diffHours = (endDateMs - now) / (1000 * 60 * 60);
            console.log(`End Date: ${m.endDate || e.endDate}, diffHours: ${diffHours.toFixed(2)}`);
            console.log(`OutcomePrices: ${m.outcomePrices}`);
        }
    });

    console.log("\n--- Checking Asset Detection ---");
    const assets = ['BTC', 'ETH', 'SOL'];
    events.slice(0, 10).forEach(e => {
        const title = e.title.toLowerCase();
        let match = null;
        if (title.includes('btc') || title.includes('bitcoin')) match = 'BTC';
        if (title.includes('eth') || title.includes('ethereum')) match = 'ETH';
        if (title.includes('sol') || title.includes('solana')) match = 'SOL';
        console.log(`Title: ${e.title} -> Detected: ${match}`);
    });
}
diagnose();
