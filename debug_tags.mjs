async function debugTags() {
    // 100511 is the Price Discovery tag
    const tagId = '100511';
    const url = `https://gamma-api.polymarket.com/events?tag_id=${tagId}&active=true&closed=false&limit=50`;

    console.log(`Searching for events with tag: ${tagId}`);
    const res = await fetch(url);
    const events = await res.json();

    console.log(`Found ${events.length} events.`);
    events.forEach(e => {
        console.log(`- [${e.id}] ${e.title}`);
    });
}

debugTags();
