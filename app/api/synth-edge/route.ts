import { NextResponse } from 'next/server';
import { fetchSynthEdge } from '../../lib/synthdata';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const asset = searchParams.get('asset');

    if (!asset) {
        return NextResponse.json({ error: 'Asset parameter is required' }, { status: 400 });
    }

    try {
        const edgeData = await fetchSynthEdge(asset);

        if (!edgeData) {
            return NextResponse.json({ error: 'No edge data available', asset }, { status: 404 });
        }

        return NextResponse.json(edgeData, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            }
        });
    } catch (error) {
        console.error('Error in synth-edge API route:', error);
        return NextResponse.json({ error: 'Failed to fetch edge data' }, { status: 500 });
    }
}
