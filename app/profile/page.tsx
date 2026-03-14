'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Wallet, ShieldAlert, ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

export default function Profile() {
    const [positions, setPositions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [address, setAddress] = useState('');
    const [analyzed, setAnalyzed] = useState(false);
    const [autoAnalyze, setAutoAnalyze] = useState(false);

    useEffect(() => {
        const storedWallet = localStorage.getItem('walletConnected');
        if (storedWallet) {
            setAddress(storedWallet);
            setAutoAnalyze(true);
        }
    }, []);

    useEffect(() => {
        if (autoAnalyze && address) {
            handleAnalyze();
            setAutoAnalyze(false); // Only run once
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoAnalyze, address]);

    const handleAnalyze = async () => {
        if (!address) return;
        setLoading(true);
        setAnalyzed(false);

        try {
            // 1. Fetch real Polymarket positions
            const cleanAddress = address.replace(/^0x/, '').toLowerCase();
            const polyRes = await fetch(`https://data-api.polymarket.com/positions?user=${address}&network=polygon`);
            console.log('Polymarket API response status:', polyRes.status);
            const polyPositions = await polyRes.json();
            console.log('Polymarket positions:', polyPositions);

            // 2. Fetch our internal aggregator for ML analysis
            const res = await fetch('/api/aggregator');
            const data = await res.json();

            if (Array.isArray(polyPositions) && polyPositions.length > 0) {
                const now = new Date();
                const mappedPositions = polyPositions
                    .map((p) => {
                        // Try to find matching market in our aggregator by conditionId or marketId
                        const matchedMarket = Array.isArray(data)
                            ? data.find((m: any) => {
                                // Match by conditionId (most reliable)
                                if (p.conditionId && m.conditionId === p.conditionId) return true;
                                // Match by marketId
                                if (m.marketId === p.marketId) return true;
                                // Match by eventId + outcome (for multi-outcome markets)
                                if (m.eventId === p.eventId && m.asset === p.asset) return true;
                                return false;
                            })
                            : null;

                        // Only include positions that have matching market data
                        if (!matchedMarket) return null;

                        // Include ALL positions, even if not in our DB
                        return {
                            ...matchedMarket,
                            positionOutcome: p.outcome || 'YES',
                            amount: parseFloat(p.size || p.amount || "0"),
                            entryOdds: parseFloat(p.avgPrice || "0"),
                            impliedOdds: parseFloat(p.curPrice || p.currentPrice || matchedMarket?.impliedOdds || "0.5"),
                            synthdata: matchedMarket?.synthdata || {
                                isRisk: false,
                                fairProbability: p.curPrice || p.currentPrice || 0.5,
                                discrepancy: 0
                            },
                            endDate: p.endDate,
                            icon: p.icon
                        };
                    })
                    .filter(Boolean)
                    .filter((p: any) => {
                        // Filter out expired positions
                        if (!p.endDate) return true; // Keep if no end date
                        const endDate = new Date(p.endDate);
                        return endDate > now; // Only keep active positions
                    });

                setPositions(mappedPositions);
                setAnalyzed(true);
            } else {
                setPositions([]);
                setAnalyzed(true);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to analyze positions. The aggregator might be down or API is blocked.");
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col gap-12 w-full max-w-7xl mx-auto py-8">
            <div className="flex flex-col items-center justify-center text-center gap-4 mt-16 pb-6 w-full">
                <h1 className="text-4xl md:text-5xl font-mono font-bold tracking-tighter text-white leading-none uppercase flex items-center gap-3">
                    Portfolio <span className="text-primary opacity-80">Profiler</span>
                </h1>
                <p className="text-zinc-400 text-sm max-w-2xl tracking-tighter leading-tight font-mono">
                    Enter a Polymarket Wallet Address to analyze your real active positions against Synthdata predictive ML models.
                </p>
            </div>

            {!loading && (
                <div className="flex flex-col md:flex-row gap-4 items-center justify-center mt-2 mb-8 max-w-3xl mx-auto w-full px-4">
                    <div className="relative w-full group">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                            <Wallet className="h-6 w-6 text-zinc-500 group-focus-within:text-white transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="block w-full pl-16 pr-4 py-5 bg-[#111114]/80 backdrop-blur-xl border border-white/10 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all font-mono text-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
                            placeholder="0x... (Try typing any address)"
                        />
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={loading || !address}
                        className="w-full md:w-auto px-8 py-5 bg-primary/10 hover:bg-primary/20 hover:text-white border border-primary/20 disabled:opacity-50 text-primary font-mono tracking-widest font-bold rounded-2xl transition-all shadow-md shrink-0 flex justify-center items-center gap-2 uppercase"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze Risk'}
                    </button>
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <span className="text-zinc-500 font-mono text-xs tracking-widest uppercase animate-pulse">
                        Analyzing Wallet {address.substring(0, 6)}...{address.length > 4 ? address.substring(address.length - 4) : ''}
                    </span>
                </div>
            )}

            {analyzed && positions.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        <Card className="bg-[#111114]/80 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-widest">Total Positions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <span className="text-3xl font-mono font-bold text-white">{positions.length}</span>
                            </CardContent>
                        </Card>

                        <Card className="bg-[#111114]/80 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(223,254,0,0.05)] transition-all">
                            <CardHeader className="pb-2 flex flex-row justify-between items-center">
                                <CardTitle className="text-[10px] font-mono font-medium text-white uppercase tracking-widest">Smart Bets</CardTitle>
                                <ShieldCheck className="h-5 w-5 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <span className="text-3xl font-mono font-bold text-primary">
                                    {positions.filter(p => !p.synthdata.isRisk).length}
                                </span>
                                <p className="text-[10px] tracking-widest uppercase font-mono text-zinc-500 mt-1">Backed by ML Models</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-rose-500/5 border-rose-500/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(244,63,94,0.1)] transition-all">
                            <CardHeader className="pb-2 flex flex-row justify-between items-center">
                                <CardTitle className="text-[10px] font-mono font-medium text-rose-500 uppercase tracking-widest">High Risk</CardTitle>
                                <ShieldAlert className="h-5 w-5 text-rose-500" />
                            </CardHeader>
                            <CardContent>
                                <span className="text-3xl font-mono font-bold text-rose-500">
                                    {positions.filter(p => p.synthdata.isRisk).length}
                                </span>
                                <p className="text-[10px] tracking-widest uppercase font-mono text-rose-500/70 mt-1">Against Models</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mt-8 px-4">
                        <div className="flex items-center gap-4 mb-6">
                            <h2 className="text-xl font-mono font-bold text-white uppercase tracking-widest">Active Analysis</h2>
                            <div className="h-px bg-gradient-to-r from-white/10 to-transparent flex-1" />
                        </div>

                        <div className="grid grid-cols-1 gap-6 pb-20">
                            {positions.map((m, idx) => {
                                const isRisk = m.synthdata?.isRisk;
                                return (
                                    <Card key={idx} className={cn("overflow-hidden relative transition-all duration-500 group", isRisk ? "border-rose-500/30 bg-[#111114]/80 hover:shadow-[0_0_20px_rgba(244,63,94,0.1)]" : "bg-[#111114]/80 border-white/10 hover:shadow-[0_0_30px_rgba(223,254,0,0.05)] hover:border-primary/30")}>
                                        <div className="absolute top-0 right-0 p-4">
                                            {isRisk ? (
                                                <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-mono tracking-widest px-3 py-1.5 rounded uppercase font-bold">HIGH RISK</span>
                                            ) : (
                                                <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono tracking-widest px-3 py-1.5 rounded uppercase font-bold">SAFE EDGE</span>
                                            )}
                                        </div>
                                        <CardHeader>
                                            <CardTitle className="text-xl text-white w-4/5 leading-tight group-hover:text-primary transition-colors">
                                                <Link href={`/markets/${m.slug}`} className="flex items-center gap-2">
                                                    {m.title}
                                                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-primary" />
                                                </Link>
                                            </CardTitle>
                                            <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mt-1">
                                                Position: <span className="text-white">{m.positionOutcome}</span> (<span className="text-primary">${m.amount.toLocaleString()}</span>)
                                            </p>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="bg-white/5 p-6 rounded-xl border border-white/5 flex flex-col md:flex-row gap-6 md:gap-8 md:items-center mt-2 group-hover:border-white/10 transition-colors">
                                                <div className="flex flex-col gap-1 w-full md:w-auto">
                                                    <span className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Your Entry Odds</span>
                                                    <span className="text-2xl font-mono text-zinc-400">{(m.entryOdds * 100).toFixed(1)}%</span>
                                                </div>
                                                <div className="hidden md:block h-12 w-px bg-white/10"></div>
                                                <div className="h-px w-full md:hidden bg-white/10"></div>

                                                <div className="flex flex-col gap-1 w-full md:w-auto">
                                                    <span className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Current Market Odds</span>
                                                    <span className="text-2xl font-mono text-white">{(m.impliedOdds * 100).toFixed(1)}%</span>
                                                </div>
                                                <div className="hidden md:block h-12 w-px bg-white/10"></div>
                                                <div className="h-px w-full md:hidden bg-white/10"></div>

                                                <div className="flex flex-col gap-1 w-full md:w-auto">
                                                    <span className="text-[10px] tracking-widest uppercase font-mono text-zinc-500">Synthdata ML Probability</span>
                                                    <span className={cn("text-2xl font-mono font-bold", isRisk ? "text-rose-500 text-shadow-sm" : "text-primary text-glow")}>
                                                        {(parseFloat(m.synthdata?.fairProbability) * 100).toFixed(1)}%
                                                    </span>
                                                </div>

                                                <div className="flex-1 md:text-right pt-4 md:pt-0">
                                                    {isRisk ? (
                                                        <p className="text-[10px] font-mono tracking-widest uppercase text-rose-500 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 inline-block">
                                                            Market is heavily overvaluing this outcome compared to ML models. Consider hedging.
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] font-mono tracking-widest uppercase text-primary bg-primary/10 p-3 rounded-lg border border-primary/20 inline-block">
                                                            Models confirm you have a mathematical edge here. Hold position.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}

            {analyzed && positions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-40 gap-6 mt-6 px-4">
                    <ShieldCheck className="w-16 h-16 text-zinc-700 opacity-50" />
                    <h2 className="text-2xl font-mono font-bold uppercase tracking-widest text-white text-center">No active positions found</h2>
                    <p className="text-sm text-zinc-500 font-mono tracking-wide max-w-md text-center leading-relaxed">
                        This wallet address does not have any active positions on Polymarket. Try connecting a different wallet or check back later.
                    </p>
                </div>
            )}
        </div>
    );
}
