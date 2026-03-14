async function test() {
    const endpoints = [
        "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&sortBy=volume24h",
        "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&query=15m",
        "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&query=Up%20or%20Down"
    ];
    for (const url of endpoints) {
        console.log(`\n--- Fetching: ${url} ---`);
        const res = await fetch(url);
        const data = await res.json();
        console.log(`Count: ${data.length}`);
        data.slice(0, 5).forEach(m => {
            console.log(`[${m.id}] ${m.question} | Ends: ${m.endDate} | Vol: ${m.volume}`);
        });
    }
}
test();
