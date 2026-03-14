async function dumpQuestions() {
    const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=1000`;
    console.log(`Fetching markets: ${url}`);
    const res = await fetch(url);
    const markets = await res.json();

    const count = markets.length;
    console.log(`Fetched ${count} markets.`);

    const keywords = ['bitcoin', 'ethereum', 'solana', 'up', 'down', 'price'];
    const matches = markets.filter(m => {
        const q = m.question.toLowerCase();
        return keywords.some(k => q.includes(k));
    });

    console.log(`Found ${matches.length} matches with keywords.`);
    matches.forEach(m => {
        console.log(`- [${m.id}] [${m.slug}] ${m.question}`);
    });
}

dumpQuestions();
