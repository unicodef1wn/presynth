async function findShortTerm() {
    const assets = ['Bitcoin', 'Ethereum', 'Solana'];
    console.log("Searching for current short-term markets...");

    for (const asset of assets) {
        const url = `https://gamma-api.polymarket.com/events?query=${asset}%20Up%20or%20Down&active=true&closed=false`;
        process.stdout.write(`Querying ${asset}... `);
        try {
            const res = await fetch(url);
            const data = await res.json();
            console.log(`Found ${data.length} events.`);
            data.forEach(e => console.log(` - [${e.id}] ${e.title} (Start: ${e.startDate})`));
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }

    console.log("\nSearching newest markets directly...");
    const marketUrl = "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=200";
    try {
        const res = await fetch(marketUrl);
        const data = await res.json();
        const short = data.filter(m => m.question.toLowerCase().includes('up or down') || m.question.toLowerCase().includes('price on'));
        console.log(`Found ${short.length} short-term markets in top 200:`);
        short.forEach(m => console.log(` - [${m.id}] ${m.question} (Ends: ${m.endDate})`));
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}
findShortTerm();
