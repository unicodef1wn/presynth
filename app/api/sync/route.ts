import { NextResponse } from 'next/server';
import { getAggregatedMarkets } from '../../lib/aggregatorCore';
import { supabaseAdmin } from '../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        
        // Simple protection (change this in production)
        if (process.env.NODE_ENV === 'production' && key !== 'prediction_dive_sync_key_2024') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log("Sync: Starting aggregation...");
        const aggregated = await getAggregatedMarkets();
        
        if (aggregated.length === 0) {
            return NextResponse.json({ message: 'No markets found to sync.' });
        }

        console.log(`Sync: Upserting ${aggregated.length} markets to Supabase...`);
        
        // Format for Supabase upsert
        const rows = aggregated.map(market => ({
            id: market.slug,
            asset: market.asset,
            data: market,
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabaseAdmin
            .from('markets')
            .upsert(rows, { onConflict: 'id' });

        if (error) {
            console.error('Sync: Supabase upsert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("Sync: Successfully updated Supabase cache.");
        return NextResponse.json({ 
            success: true, 
            count: aggregated.length,
            message: `Synced ${aggregated.length} markets to Supabase.` 
        });

    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: 'Failed to sync data' }, { status: 500 });
    }
}
