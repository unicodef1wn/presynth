const fetch = require('node-fetch');

async function debugSolana() {
    try {
        const res = await fetch('http://localhost:3000/api/synthdata?asset=SOL');
        const data = await res.json();
        console.log('SOL Data keys:', Object.keys(data));
        console.log('Final Distribution:', data.finalDistribution ? Object.keys(data.finalDistribution).length + ' points' : 'NULL');
        console.log('First few distribution points:', data.finalDistribution ? Object.entries(data.finalDistribution).slice(0, 3) : 'N/A');
    } catch (e) {
        console.error(e);
    }
}
debugSolana();
