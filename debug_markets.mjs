async function discover() {
    const queries = [
        'Bitcoin',
        'Ethereum',
        'Solana',
        'Up or Down',
        'Price Discovery'
    ];

    for (const q of queries) {
        const url = `https://gamma-api.polymarket.com/events?query=${encodeURIComponent(q)}&active=true&closed=false&limit=100`;
        console.log(`\n--- Query: ${q} ---`);
        const res = await fetch(url);
        const events = await res.json();

        const matches = events.filter(e =>
            e.title.toLowerCase().includes('up or down') ||
            (e.markets && e.markets.some(m => m.question.toLowerCase().includes('up or down')))
        );

        console.log(`Results: ${events.length}, Matches: ${matches.length}`);
        matches.forEach(e => {
            console.log(`- [${e.id}] ${e.title} (Tags: ${JSON.stringify(e.tags?.map(t => t.id + ":" + t.name))})`);
        });
    }
}

discover();
