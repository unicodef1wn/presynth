
const tickers = ['NVIDIA', 'Tesla', 'Apple', 'Google'];

async function check() {
    for (const ticker of tickers) {
        console.log(`\n=== Ticker: ${ticker} ===`);
        const url = `https://gamma-api.polymarket.com/events?query=${encodeURIComponent(ticker)}&active=true&closed=false&limit=20`;
        try {
            const res = await fetch(url);
            const events = await res.json();
            if (events.length === 0) {
                console.log('No events found');
                continue;
            }
            events.forEach(e => {
                console.log(`- Title: "${e.title}"`);
                console.log(`  Slug:  "${e.slug}"`);
            });
        } catch (e) {
            console.error(`Error fetching ${ticker}:`, e.message);
        }
    }
}

check();
