'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Activity, Clock, Zap, ArrowRight, Radio, Radar, Terminal, Cpu, Info } from "lucide-react";
import { cn } from "../lib/utils";
import { Reveal } from "../components/ui/animations/Reveal";
import { StaggerText } from "../components/ui/animations/StaggerText";

interface FeedEvent {
    id: string;
    type: 'NEW_MARKET' | 'VOLATILITY_SPIKE' | 'EDGE_DETECTED';
    timestamp: Date;
    marketName: string;
    slug: string;
    asset: string;
    details: string;
    severity: 'low' | 'medium' | 'high';
    volume?: number | string;
}

export default function LiveFeed() {
    const [events, setEvents] = useState<FeedEvent[]>([]);
    const [isLive, setIsLive] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!isLive) return;

        let initialLoad = true;
        let knownMarkets = new Set<string>();

        const fetchFeed = async () => {
            try {
                const res = await fetch('/api/aggregator');
                const markets = await res.json();

                if (!Array.isArray(markets)) return;

                if (initialLoad && Array.isArray(markets)) {
                    const initialEvents: FeedEvent[] = markets.slice(0, 15).map(m => ({
                        id: `initial-${m.marketId}`,
                        type: 'NEW_MARKET',
                        timestamp: new Date(),
                        marketName: m.title,
                        slug: m.slug,
                        asset: m.asset,
                        details: `Tracking ${m.asset} market on Polymarket. Volume: ${typeof m.volume === 'number' ? '$' + Math.round(m.volume).toLocaleString() : m.volume}`,
                        severity: 'low'
                    }));
                    setEvents(initialEvents);

                    markets.forEach(m => knownMarkets.add(m.marketId));
                    initialLoad = false;
                    return;
                }

                const newEvents: FeedEvent[] = [];
                const now = new Date();

                markets.forEach(m => {
                    const id = m.marketId;

                    if (!knownMarkets.has(id)) {
                        knownMarkets.add(id);
                        newEvents.push({
                            id: `new-${id}-${now.getTime()}`,
                            type: 'NEW_MARKET',
                            timestamp: now,
                            marketName: m.title,
                            slug: m.slug,
                            asset: m.asset,
                            details: `New ${m.asset} prediction market detected on Polymarket.`,
                            severity: 'medium'
                        });
                    }

                    if (Math.random() > 0.90) {
                        const isVolatility = Math.random() > 0.5;
                        if (isVolatility && m.priceChange24h) {
                            const spike = (m.priceChange24h * 100).toFixed(1);
                            if (Math.abs(parseFloat(spike)) > 5) {
                                newEvents.push({
                                    id: `vol-${id}-${now.getTime()}`,
                                    type: 'VOLATILITY_SPIKE',
                                    timestamp: now,
                                    marketName: m.title,
                                    slug: m.slug,
                                    asset: m.asset,
                                    details: `Sudden probability shift of ${spike}% detected in the last hour.`,
                                    severity: Math.abs(parseFloat(spike)) > 15 ? 'high' : 'medium'
                                });
                            }
                        } else if (!isVolatility && m.synthdata && m.synthdata.discrepancy) {
                            const edge = (parseFloat(m.synthdata.discrepancy) * 100).toFixed(1);
                            if (Math.abs(parseFloat(edge)) > 5) {
                                newEvents.push({
                                    id: `edge-${id}-${now.getTime()}`,
                                    type: 'EDGE_DETECTED',
                                    timestamp: now,
                                    marketName: m.title,
                                    slug: m.slug,
                                    asset: m.asset,
                                    details: `Synthdata ML models detected a ${edge}% valuation edge.`,
                                    severity: 'high'
                                });
                            }
                        }
                    }
                });

                if (newEvents.length > 0) {
                    setEvents(prev => [...newEvents, ...prev].slice(0, 50));
                }
            } catch (e) {
                console.error("Feed error:", e);
            }
        };

        fetchFeed();
        const interval = setInterval(fetchFeed, 20000);
        return () => clearInterval(interval);

    }, [isLive]);

    const getIconForType = (type: string) => {
        switch (type) {
            case 'NEW_MARKET': return mounted && <Activity className="w-5 h-5 text-sky-400" />;
            case 'VOLATILITY_SPIKE': return mounted && <Zap className="w-5 h-5 text-rose-500" />;
            case 'EDGE_DETECTED': return mounted && <Cpu className="w-5 h-5 text-primary text-glow" />;
            default: return mounted && <Info className="w-5 h-5 text-zinc-500" />;
        }
    };

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'high': return 'border-rose-500/20 bg-rose-500/5 shadow-[inset_0_0_20px_rgba(244,63,94,0.03)]';
            case 'medium': return 'border-amber-500/10 bg-amber-500/5 shadow-[inset_0_0_20px_rgba(245,158,11,0.02)]';
            case 'low': return 'border-primary/10 bg-primary/20 shadow-[inset_0_0_20px_rgba(223,254,0,0.02)]';
            default: return 'border-white/5 bg-white/[0.01]';
        }
    };

    return (
        <div className="flex flex-col gap-10 w-full max-w-7xl mx-auto py-8">
            <div className="flex flex-col items-center justify-center gap-6 px-4 uppercase font-mono mt-16 pb-6 text-center">
                <div className="flex flex-col items-center gap-4">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white leading-none flex items-center justify-center gap-3 w-full">
                        <StaggerText text="Live" /> <span className="text-primary opacity-80">
                            <StaggerText text="Feed" delay={0.2} />
                        </span>
                    </h1>
                    <div className="text-zinc-400 text-sm max-w-2xl tracking-tighter leading-tight">
                        <StaggerText text="Real-time event stream: New Markets, Volatility Spikes, and Al signals" delay={0.4} />
                    </div>
                </div>

            </div>

            <Reveal delay={0.5}>
                <Card className="mx-4 border-white/10 bg-[#111114]/80 backdrop-blur-xl overflow-hidden relative shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-2xl">
                    <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[size:40px_40px]"></div>

                    <CardHeader className="border-b border-white/10 bg-white/5 backdrop-blur-2xl px-8 py-5 sticky top-0 z-10 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Terminal className="w-4 h-4 text-zinc-500" />
                            <CardTitle className="text-zinc-400 font-mono text-[10px] font-bold uppercase tracking-[0.4em]">
                                Live Feed
                            </CardTitle>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0 h-[700px] overflow-y-auto font-mono scroll-smooth relative">
                        <div className="flex flex-col p-6 gap-4">
                            {events.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-30 select-none">
                                    <Radio className="w-12 h-12 text-primary animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-[1em] text-zinc-500">Waiting_for_Signals...</span>
                                </div>
                            )}

                            {events.map((ev, index) => (
                                <Link
                                    href={`/markets/${ev.slug}`}
                                    key={ev.id}
                                    className={cn(
                                        "p-4 rounded-xl border transition-all duration-700 animate-in slide-in-from-right-4 group relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111114]/60 hover:bg-[#111114] hover:shadow-[0_4px_20px_rgba(223,254,0,0.05)]",
                                        getSeverityStyles(ev.severity)
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-white/5 rounded-lg border border-white/10 shadow-sm group-hover:border-primary/50 transition-colors shrink-0">
                                            {getIconForType(ev.type)}
                                        </div>
                                        <div className="flex flex-col gap-1 overflow-hidden">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-bold text-sm tracking-tight truncate group-hover:text-primary transition-colors">{ev.marketName}</span>
                                                <span className="bg-white/5 text-zinc-400 px-2 py-0.5 rounded border border-white/10 text-[9px] font-bold tracking-widest uppercase whitespace-nowrap hidden sm:block">
                                                    {ev.asset}
                                                </span>
                                            </div>
                                            <p className="text-zinc-500 text-xs lowercase leading-relaxed truncate max-w-2xl">
                                                <span className={cn(
                                                    "font-black uppercase tracking-widest mr-2",
                                                    ev.type === 'NEW_MARKET' && "text-sky-400",
                                                    ev.type === 'VOLATILITY_SPIKE' && "text-rose-500",
                                                    ev.type === 'EDGE_DETECTED' && "text-primary",
                                                )}>
                                                    [{ev.type === 'NEW_MARKET' ? 'NEW MARKET' :
                                                        ev.type === 'VOLATILITY_SPIKE' ? 'VOLATILITY SPIKE' :
                                                            'NODE SIGNAL'}]
                                                </span>
                                                {ev.details}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pl-14 md:pl-0 w-full md:w-auto">
                                        {ev.volume !== undefined && ev.volume !== null && (
                                            <span className="text-[10px] text-zinc-500 font-mono tracking-widest hidden sm:block">
                                                VOL: {typeof ev.volume === 'number' ? '$' + Math.round(ev.volume).toLocaleString() : ev.volume}
                                            </span>
                                        )}
                                        <span className="text-[10px] text-zinc-400 font-bold tabular-nums tracking-widest">
                                            {ev.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100 hidden md:block" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </Reveal>
        </div>
    );
}
