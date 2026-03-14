import { NextResponse } from 'next/server';

import { fetchPolymarketData } from '../../lib/polymarket';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const parsedMarkets = await fetchPolymarketData();
        return NextResponse.json(parsedMarkets, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            }
        });
    } catch (error) {
        console.error('Error fetching from Polymarket:', error);
        return NextResponse.json({ error: 'Failed to fetch Polymarket data' }, { status: 500 });
    }
}
