
const ASSETS = {
    'NVDA': ['nvda', 'nvidia', '(nvda)'],
    'TSLA': ['tsla', 'tesla', '(tsla)'],
    'AAPL': ['aapl', 'apple', '(aapl)'],
    'GOOGL': ['googl', 'goog', 'google', 'alphabet', '(googl)', '(goog)'],
};

const STRICT_PRICE_PATTERNS = [
    /price/i, /\$/, /\babove\b/i, /\bbelow\b/i, /\bhit\b/i, /\breach\b/i, /\bclose[sd]?\b/i,
    /\bfinish\b/i, /up\s+or\s+down/i, /up\/down/i, /[↑↓]/, /_+/, /\bworth\b/i, /\btarget\b/i,
    /\btrading\b/i, /[\d,]+\s*[-–]\s*[\d,]+/, /at\s*[_]+/
];

const EXCLUDE_PATTERNS = [
    /election/i, /president/i, /biden/i, /trump/i, /musk/i, /ceo/i
];

function findAsset(text) {
    const textLower = text.toLowerCase();
    for (const [ticker, variants] of Object.entries(ASSETS)) {
        for (const variant of variants) {
            const pattern = new RegExp(`\\b${variant}\\b`, 'i');
            if (pattern.test(textLower)) return ticker;
        }
    }
    return null;
}

async function test() {
    const query = 'NVIDIA';
    const res = await fetch(`https://gamma-api.polymarket.com/events?query=${query}&active=true&closed=false&limit=50`);
    const events = await res.json();
    console.log(`Found ${events.length} events for ${query}`);
    
    events.forEach(e => {
        const asset = findAsset(e.title);
        const hasPricePattern = STRICT_PRICE_PATTERNS.some(p => p.test(e.title) || p.test(e.description));
        const isExcluded = EXCLUDE_PATTERNS.some(p => p.test(e.title));
        
        console.log(`Title: "${e.title}"`);
        console.log(`  Asset: ${asset}, PricePattern: ${hasPricePattern}, Excluded: ${isExcluded}`);
        
        if (asset && hasPricePattern && !isExcluded) {
            console.log(`  ✅ WOULD BE PARSED`);
        } else {
            console.log(`  ❌ REJECTED`);
        }
    });
}

test();
