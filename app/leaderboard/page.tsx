'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { TrendingUp, Loader2, ArrowUpRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Reveal } from "../components/ui/animations/Reveal";
import { StaggerText } from "../components/ui/animations/StaggerText";

const ASSETS = ['ALL', 'BTC', 'ETH', 'SOL'];

export default function Leaderboard() {
    const [markets, setMarkets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [assetFilter, setAssetFilter] = useState<string>('ALL');

    useEffect(() => {
        setMounted(true);
        const fetchData = () => {
            fetch(`/api/aggregator?t=${Date.now()}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setMarkets(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        };
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const displayedMarkets = [...markets]
        .map(m => {
            const polyOddsVal = m.impliedOdds || 0.5;
            const synthOddsVal = parseFloat(m.synthdata?.fairProbability || "0.5");
            const discrepancy = m.synthdata?.discrepancy ? parseFloat(m.synthdata.discrepancy) : (synthOddsVal - polyOddsVal);
            return { ...m, polyOddsVal, synthOddsVal, discrepancy };
        })
        // Hide only absurd spreads (>90%) — these are dead markets with no liquidity
        .filter(m => Math.abs(m.discrepancy) <= 0.90)
        .filter(m => assetFilter === 'ALL' || m.asset === assetFilter)
        .sort((a, b) => {
            if (sortConfig) {
                let aVal: number, bVal: number;
                if (sortConfig.key === 'polyOdds') { aVal = a.polyOddsVal; bVal = b.polyOddsVal; }
                else if (sortConfig.key === 'synthOdds') { aVal = a.synthOddsVal; bVal = b.synthOddsVal; }
                else if (sortConfig.key === 'spread') { aVal = a.discrepancy; bVal = b.discrepancy; }
                else { return 0; }
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            }
            return Math.abs(b.discrepancy) - Math.abs(a.discrepancy);
        });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };

    return (
        <div className="flex flex-col gap-10 w-full max-w-7xl mx-auto py-8">
            <div className="flex flex-col items-center justify-center gap-6 px-4 mt-16 pb-6">
                <div className="flex flex-col items-center text-center gap-4">
                    <h1 className="text-4xl md:text-5xl font-mono font-bold tracking-tighter text-white leading-[1.1] flex items-center justify-center gap-3 w-full uppercase">
                        <StaggerText text="Market Edge" />
                    </h1>
                    <div className="text-zinc-400 text-sm font-mono max-w-2xl tracking-tighter">
                        <StaggerText text="Shows the difference between Polymarket Odds and Synth Odds, measured as a percentage" delay={0.4} />
                    </div>
                </div>
            </div>

            <Reveal delay={0.5}>
                <Card className="mx-4 bg-[#111114]/80 border-white/10 overflow-hidden rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-center items-center w-full pt-8 pb-4">
                            <div className="flex flex-wrap gap-1.5">
                                {ASSETS.map(asset => (
                                    <button
                                        key={asset}
                                        onClick={() => setAssetFilter(asset)}
                                        className={cn(
                                            "px-3 py-1 rounded-lg text-[10px] font-bold tracking-widest transition-all font-mono border",
                                            assetFilter === asset
                                                ? "bg-primary/10 text-primary border-primary/30"
                                                : "text-zinc-500 border-white/10 hover:text-white hover:border-white/20"
                                        )}
                                    >
                                        {asset}
                                    </button>
                                ))}
                            </div>
                        </div>
                    <CardContent className="p-0 font-mono">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-32 gap-4">
                                {mounted && <Loader2 className="w-10 h-10 animate-spin text-primary" />}
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em]">Analyzing_market_data...</span>
                            </div>
                        ) : (
                            <div className="overflow-auto" data-lenis-prevent style={{ maxHeight: '65vh', overscrollBehavior: 'contain' }}>
                                <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                                    <thead>
                                        <tr className="bg-[#111114] sticky top-0 z-10">
                                            <th scope="col" className="px-8 py-5 text-zinc-500 font-bold tracking-widest">Analysis Subject</th>
                                            <th scope="col" className="px-8 py-5 text-zinc-500 font-bold tracking-widest">Asset</th>
                                            <th scope="col" className="px-8 py-5 text-zinc-500 font-bold tracking-widest cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('polyOdds')}>
                                                Poly Odds {sortConfig?.key === 'polyOdds' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                            </th>
                                            <th scope="col" className="px-8 py-5 text-zinc-500 font-bold tracking-widest cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('synthOdds')}>
                                                Synth Odds {sortConfig?.key === 'synthOdds' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                                            </th>
                                            <th scope="col" className="px-8 py-5 text-right text-zinc-500 font-bold tracking-widest cursor-pointer hover:text-white transition-colors select-none" onClick={() => handleSort('spread')}>
                                                Spread {sortConfig?.key === 'spread' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↓'}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedMarkets.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-8 py-20 text-center text-zinc-400 font-bold uppercase tracking-[0.2em]">
                                                    NO RECORDS FOUND
                                                </td>
                                            </tr>
                                        )}
                                        {displayedMarkets.map((m, idx) => {
                                            const polyOddsStr = m.impliedOdds ? (m.impliedOdds * 100).toFixed(1) + '%' : (m.isMulti ? 'Multi' : '—');
                                            const isEdgePositive = m.discrepancy > 0;

                                            return (
                                                <tr key={m.marketId || idx} className="hover:bg-white/5 transition-all group border-b border-white/10">
                                                    <td className="px-8 py-5 font-bold text-white tracking-tighter max-w-xs">
                                                        <Link href={`/markets/${m.slug}`} className="hover:text-primary transition-colors flex items-start gap-2">
                                                            <span className="flex-1 line-clamp-2">{m.title}</span>
                                                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0 mt-0.5" />
                                                        </Link>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className="bg-white/5 text-zinc-400 px-3 py-1 rounded border border-white/10 font-bold tracking-widest text-[9px]">
                                                            {m.asset || 'RAW'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-zinc-400 font-bold">{polyOddsStr}</td>
                                                    <td className={cn("px-8 py-5 font-bold", m.synthdata?.isRisk ? "text-rose-500" : "text-white")}>
                                                        {(parseFloat(m.synthdata?.fairProbability) * 100).toFixed(1)}%
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <div className={cn(
                                                            "flex items-center justify-end gap-2 font-black italic text-sm",
                                                            isEdgePositive ? "text-primary text-glow" : "text-zinc-500"
                                                        )}>
                                                            {mounted && <TrendingUp className={cn("w-4 h-4", !isEdgePositive && "opacity-50")} />}
                                                            {isEdgePositive ? '+' : ''}{(m.discrepancy * 100).toFixed(1)}%
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {!loading && displayedMarkets.length > 0 && (
                            <div className="px-8 py-3 border-t border-white/10 text-[10px] text-zinc-600 font-mono tracking-widest">
                                {displayedMarkets.length} MARKETS · SPREADS &gt;90% HIDDEN (ILLIQUID)
                            </div>
                        )}
                    </CardContent>
                </Card>
            </Reveal>
        </div>
    );
}
