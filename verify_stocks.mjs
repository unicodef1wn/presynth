
const ASSETS = {
    'BTC': ['btc', 'bitcoin'],
    'ETH': ['eth', 'ethereum'],
    'SOL': ['sol', 'solana'],
    'XAU': ['xau', 'gold'],
    'SPY': ['spy', 's&p 500', 's&p500', 'sp500', 's&p'],
    'NVDA': ['nvda', 'nvidia', '(nvda)'],
    'TSLA': ['tsla', 'tesla', '(tsla)'],
    'AAPL': ['aapl', 'apple', '(aapl)'],
    'GOOGL': ['googl', 'goog', 'google', 'alphabet', '(googl)', '(goog)'],
};

const STRICT_PRICE_PATTERNS = [
    /price/i, /\$/, /\babove\b/i, /\bbelow\b/i, /\bhit\b/i, /\breach\b/i,
    /\bclose[sd]?\b/i, /\bfinish\b/i, /up\s+or\s+down/i, /up\/down/i, /[↑↓]/,
    /_+/, /\bworth\b/i, /\btarget\b/i, /\btrading\b/i, /[\d,]+\s*[-–]\s*[\d,]+/,
    /at\s*[_]+/,
];

const EXCLUDE_PATTERNS = [
    /strategic\s+reserve/i, /national\s+reserve/i, /gold\s+medal/i, /golden\s+(globe|gate|age|ratio)/i,
    /olympic/i, /imo\s+gold/i, /\bvs\b/i, /versus/i, /outperform/i, /compared\s+to/i,
    /resign/i, /lawsuit/i, /merger/i, /acquisition/i, /ipo\b/i, /bankruptcy/i,
    /halving/i, /hack\b/i, /airdrop/i, 
    /tweet/i, /twitter/i, /buys\s+bitcoin/i, /company\s+buys/i, /\bpodcast\b/i,
    /\bapp\s+store\b/i, 
    /\bepstein\b/i,
    /\belection\b/i, /\bpresident\b/i, /\bwinning\s+party\b/i, /\bdemocrat\b|\brepublican\b/i, /\bgop\b/i, /\bswing\s+state\b/i,
];

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findAsset(text) {
    const textLower = text.toLowerCase();
    for (const [ticker, variants] of Object.entries(ASSETS)) {
        for (const variant of variants) {
            const pattern = new RegExp(`\\b${escapeRegExp(variant)}\\b`, 'i');
            if (pattern.test(textLower)) return ticker;
        }
    }
    return null;
}

function hasStrictPriceContext(text) {
    const textLower = text.toLowerCase();
    for (const pattern of STRICT_PRICE_PATTERNS) {
        if (pattern.test(textLower)) return true;
    }
    return false;
}

function hasExclusion(text) {
    const textLower = text.toLowerCase();
    for (const pattern of EXCLUDE_PATTERNS) {
        if (pattern.test(textLower)) return true;
    }
    return false;
}

function detectAssetFromContext(title) {
    if (hasExclusion(title)) return { asset: null, reason: 'ExcludePattern' };
    if (!hasStrictPriceContext(title)) return { asset: null, reason: 'NoStrictPriceContext' };
    const asset = findAsset(title);
    if (!asset) return { asset: null, reason: 'NoAssetKeyword' };
    return { asset, reason: 'Match' };
}

async function verify() {
    const testTitles = [
        "NVIDIA (NVDA) closes week of Mar 2 at ___?",
        "NVIDIA (NVDA) Up or Down on March 11?",
        "Tesla (TSLA) closes above ___ on March 12?",
        "Apple (AAPL) closes week of Mar 9 at ___?",
        "Google (GOOGL) closes above ___ on March 13?",
        "Will NVIDIA (NVDA) finish week of March 9 above___?",
        "Elon Musk says something about Tesla", // Should still be EXCLUDED if Musk is in exclude
        "Apple launches new iPhone", // Should be OK now since iPhone is removed from EXCLUDE
    ];

    console.log("\n=== Testing Refined Detection Logic ===");
    testTitles.forEach(title => {
        const { asset, reason } = detectAssetFromContext(title);
        console.log(`[${asset || 'NONE'}] Reason: ${reason || 'Match'} | Title: "${title}"`);
    });
}

verify();
