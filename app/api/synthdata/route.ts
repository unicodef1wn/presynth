import { NextResponse } from 'next/server';

import { fetchSynthData } from '../../lib/synthdata';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const asset = searchParams.get('asset');

    if (!asset) {
        return NextResponse.json({ error: 'Asset parameter is required' }, { status: 400 });
    }

    try {
        const data = await fetchSynthData(asset);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in synthdata API route:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
