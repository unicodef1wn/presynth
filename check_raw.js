async function check() {
    const res = await fetch('http://localhost:3000/api/polymarket');
    const data = await res.json();
    console.log(`Polymarket returned ${data.length} markets`);
    const assets = [...new Set(data.map(m => m.asset))];
    console.log(`Assets found: ${assets.join(', ')}`);
    
    const btc = data.filter(m => m.asset === 'BTC').length;
    const eth = data.filter(m => m.asset === 'ETH').length;
    const sol = data.filter(m => m.asset === 'SOL').length;
    console.log(`BTC: ${btc}, ETH: ${eth}, SOL: ${sol}`);
}
check();
