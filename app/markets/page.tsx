'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Search, ArrowUpRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Reveal } from '../components/ui/animations/Reveal';
import { StaggerText } from '../components/ui/animations/StaggerText';

export default function MarketsPage() {
    const [markets, setMarkets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeAsset, setActiveAsset] = useState<string | null>(null);

    const assets = ['BTC', 'ETH', 'SOL'];

    useEffect(() => {
        setMounted(true);
        // Using aggregator API to get synthdata/spreads
        fetch('/api/aggregator?t=' + Date.now())
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setMarkets(data);
                }
                setLoading(false);
            })
            .catch(e => {
                console.error(e);
                setLoading(false);
            });
    }, []);

    const filteredMarkets = markets.filter(m => {
        const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.asset && m.asset.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesAsset = !activeAsset || (m.asset && m.asset.toUpperCase() === activeAsset.toUpperCase());

        return matchesSearch && matchesAsset;
    });

    return (
        <div className="flex flex-col gap-12 w-full max-w-7xl mx-auto py-8">
            <div className="flex flex-col items-center text-center gap-6 mt-16 pb-6">
                <h1 className="text-3xl md:text-5xl font-mono font-bold tracking-tighter text-white leading-[1.1] max-w-4xl px-4 uppercase">
                    <StaggerText text="Polymarket markets linked to the required currencies" />
                </h1>
                <div className="text-zinc-400 text-lg max-w-2xl font-light leading-relaxed">
                    <StaggerText text="Relevant markets where you can check odds from Synth" delay={0.2} />
                </div>
            </div>

            <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full px-4">
                <Reveal delay={0.3}>
                    <div className="relative w-full group">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                            {mounted && <Search className="h-6 w-6 text-zinc-500 group-focus-within:text-white transition-colors" />}
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-16 pr-4 py-5 bg-[#111114]/80 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all font-mono text-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
                            placeholder="Search by title or asset..."
                        />
                    </div>
                </Reveal>

                <Reveal delay={0.4}>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={() => setActiveAsset(null)}
                            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all border ${!activeAsset ? 'bg-primary text-black border-primary' : 'bg-white/5 text-zinc-400 border-white/10 hover:border-white/20'}`}
                        >
                            ALL
                        </button>
                        {assets.map(asset => (
                            <button
                                key={asset}
                                onClick={() => setActiveAsset(asset)}
                                className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all border ${activeAsset === asset ? 'bg-primary text-black border-primary' : 'bg-white/5 text-zinc-400 border-white/10 hover:border-white/20'}`}
                            >
                                {asset}
                            </button>
                        ))}
                    </div>
                </Reveal>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20 px-4">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="rounded-2xl border border-white/10 bg-[#111114]/80 p-6 space-y-5 animate-pulse">
                            <div className="space-y-3">
                                <div className="h-3 w-16 rounded bg-white/5" />
                                <div className="h-5 w-4/5 rounded bg-white/10" />
                                <div className="h-5 w-3/5 rounded bg-white/7" />
                            </div>
                            <div className="flex gap-4">
                                <div className="space-y-1.5">
                                    <div className="h-2.5 w-20 rounded bg-white/5" />
                                    <div className="h-3 w-16 rounded bg-white/8" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20 px-4">
                    {filteredMarkets.map((m, idx) => {
                        const discrepancy = m.synthdata?.discrepancy || 0;
                        const isEdgePositive = discrepancy > 0;
                        const spreadStr = (discrepancy * 100).toFixed(1) + '%';

                        return (
                            <Reveal key={idx} delay={0.05 * (idx % 12)}>
                                <Link href={`/markets/${m.slug}`} className="group">
                                    <Card className="hover:border-primary/30 hover:shadow-[0_0_30px_rgba(223,254,0,0.05)] bg-[#111114]/80 border-white/10 group relative transition-all duration-500 h-full overflow-hidden">
                                        {/* Edge Badge */}
                                        {isEdgePositive && (
                                            <div className="absolute top-0 right-0 px-4 py-1.5 bg-primary text-black font-mono font-black text-[10px] tracking-tighter uppercase rounded-bl-xl z-10 shadow-[0_0_20px_rgba(223,254,0,0.3)]">
                                                +{spreadStr} Edge
                                            </div>
                                        )}

                                        <CardHeader className="pb-4 space-y-4">
                                            <div className="space-y-1">
                                                <div className="text-[10px] font-mono text-zinc-500 tracking-[0.2em] uppercase">
                                                    {m.asset ? m.asset.split(' ')[0].toUpperCase() : 'MARKET'}
                                                </div>
                                                <CardTitle className="text-lg leading-snug text-white transition-all group-hover:text-primary min-h-[3.5rem] flex items-center font-bold tracking-tight">
                                                    {m.title}
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Volume (Total)</span>
                                                    <span className="text-sm text-zinc-300 font-mono font-bold tracking-tight">
                                                        {typeof m.volume === 'number' ? '$' + Math.floor(m.volume).toLocaleString('en-US') : m.volume}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Spread</span>
                                                    <span className={cn(
                                                        "text-sm font-mono font-bold",
                                                        isEdgePositive ? "text-primary" : "text-white"
                                                    )}>
                                                        {isEdgePositive ? '+' : ''}{spreadStr}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </Reveal>
                        );
                    })}
                    {filteredMarkets.length === 0 && !loading && (
                        <div className="col-span-full py-20 text-center">
                            <span className="text-zinc-500 font-mono text-sm tracking-widest uppercase">No markets found matching your criteria</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
