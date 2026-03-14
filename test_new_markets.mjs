async function test() {
    // Current time: 2026-03-03T17:18:42+03:00
    // Try to find markets with "March 3" or created today
    const url = "https://gamma-api.polymarket.com/markets?active=true&closed=false&order=createdAt&ascending=false&limit=100";
    const res = await fetch(url);
    const data = await res.json();
    console.log(`Newest 100 markets count: ${data.length}`);
    data.slice(0, 50).forEach(m => {
        const title = m.question || m.groupItemTitle;
        if (title.includes("Bitcoin") || title.includes("Ethereum") || title.includes("Solana")) {
            console.log(`[${m.id}] ${title} | Ends: ${m.endDate} | Vol: ${m.volume}`);
        }
    });
}
test();
