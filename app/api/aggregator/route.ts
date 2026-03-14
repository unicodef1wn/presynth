import { NextResponse } from 'next/server';
import { supabase } from '../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("Aggregator: Fetching markets from Supabase cache...");
        
        // Fetch from Supabase instead of direct APIs
        const { data: markets, error } = await supabase
            .from('markets')
            .select('data')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Aggregator: Supabase error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!markets || markets.length === 0) {
            console.log("Aggregator: No cached markets found. Please run /api/sync.");
            return NextResponse.json({ error: 'No cached markets found' }, { status: 404 });
        }

        // Extract the market data from the JSONB column
        const processedMarkets = markets.map(row => row.data);

        console.log(`Aggregator: Returning ${processedMarkets.length} cached markets.`);
        return NextResponse.json(processedMarkets);

    } catch (error) {
        console.error('Aggregator error:', error);
        return NextResponse.json({ error: 'Failed to fetch cached data' }, { status: 500 });
    }
}
