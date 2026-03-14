async function debugAggregator() {
    const res = await fetch('http://localhost:3000/api/aggregator');
    if (!res.ok) {
        console.error("Aggregator failed:", res.status);
        const text = await res.text();
        console.error(text);
        return;
    }
    const data = await res.json();
    console.log(`Aggregator returned ${data.length} markets`);
    
    const eth = data.filter(m => m.asset === 'ETH');
    console.log(`ETH markets in aggregator: ${eth.length}`);
    
    if (eth.length > 0) {
        console.log("Example ETH market:", JSON.stringify(eth[0], null, 2));
    } else {
        // If 0, let's look at raw Polymarket data and see what's happening
        const polyRes = await fetch('http://localhost:3000/api/polymarket');
        const polyData = await polyRes.json();
        const ethPoly = polyData.filter(m => m.asset === 'ETH');
        console.log(`ETH markets in Polymarket raw: ${ethPoly.length}`);
        if (ethPoly.length > 0) {
             console.log("Example ETH raw market:", ethPoly[0].title, "Slug:", ethPoly[0].slug);
        }
    }
    
    const btc = data.filter(m => m.asset === 'BTC').length;
    const sol = data.filter(m => m.asset === 'SOL').length;
    console.log(`BTC: ${btc}, SOL: ${sol}`);
}
debugAggregator();
