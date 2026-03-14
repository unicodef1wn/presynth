'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/Card";
import { Search, TrendingUp, Zap, ArrowUpRight, Pin } from "lucide-react";
import Link from 'next/link';
import { Reveal } from "./components/ui/animations/Reveal";
import { StaggerText } from "./components/ui/animations/StaggerText";
import Magnetic from "./components/ui/animations/Magnetic";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [pinnedMarkets, setPinnedMarkets] = useState<any[]>([]);
  const [topOpportunities, setTopOpportunities] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);

    // Fetch pinned
    const slugs = JSON.parse(localStorage.getItem('pinnedMarkets') || '[]');
    if (slugs.length > 0) {
      fetch('/api/polymarket')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPinnedMarkets(data.filter((m: any) => slugs.includes(m.slug)));
          }
        })
        .catch(console.error);
    }

    // Fetch top opportunities (highest Edge) every 30s
    const fetchTop = async () => {
      try {
        const res = await fetch('/api/aggregator');
        const data = await res.json();
        if (Array.isArray(data)) {
          // Calculate edge and sort safely
          const sorted = data.map(m => {
            const rawPoly = Number(m.impliedOdds);
            const polyOdds = isNaN(rawPoly) ? 0.5 : rawPoly;

            const rawFair = m.synthdata?.fairProbability;
            const fairProb = rawFair !== undefined && rawFair !== null && !isNaN(Number(rawFair))
              ? Number(rawFair)
              : 0.5;

            const rawDisc = m.synthdata?.discrepancy;
            const edge = rawDisc !== undefined && rawDisc !== null && !isNaN(Number(rawDisc))
              ? Number(rawDisc)
              : (fairProb - polyOdds);

            return { ...m, edge, polyOdds, fairProb };
          }).sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge));

          setTopOpportunities(sorted.slice(0, 2));
        }
      } catch (e) {
        console.error("Failed to fetch top opportunities:", e);
      }
    };

    fetchTop();
    const interval = setInterval(fetchTop, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-12 w-full max-w-6xl mx-auto py-8">
      {/* Hero section */}
      <div className="flex flex-col items-center text-center gap-6 relative mt-24 mb-10">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />

        <h1 className="display-super text-white flex flex-col items-center justify-center">
          <StaggerText text="Prediction effectiveness" />
          <div className="text-primary">
            <StaggerText text="w/PreSynth" delay={0.2} />
          </div>
        </h1>
      </div>


      {/* Command Center */}
      {mounted && pinnedMarkets.length > 0 && (
        <Reveal delay={0.4}>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                <Pin className="h-5 w-5 text-zinc-300" />
              </div>
              <h2 className="text-xl font-mono font-bold text-white uppercase tracking-widest">
                Command Center
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent ml-4" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pinnedMarkets.map((m, idx) => (
                <Link href={`/markets/${m.slug}`} key={idx} className="group block h-full">
                  <Magnetic>
                    <Card className="hover:border-primary/30 transition-all duration-500 border-white/10 bg-[#111114]/80 h-full relative overflow-hidden group-hover:shadow-[0_0_30px_rgba(223,254,0,0.05)]">
                      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-1 group-hover:translate-x-1">
                        <ArrowUpRight className="h-4 w-4 text-primary" />
                      </div>
                      <CardHeader className="pb-2 relative z-10">
                        <div className="text-[10px] font-mono text-zinc-500 tracking-[0.2em] mb-1 truncate uppercase">
                          {m.asset ? m.asset.split(' ')[0] : 'MARKET'}
                        </div>
                        <CardTitle className="text-sm leading-snug transition-all text-white group-hover:text-primary">
                          {m.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="relative z-10 pt-2 border-t border-white/10 mt-2">
                        <div className="flex justify-between items-end">
                          <span className="text-[10px] text-zinc-500 font-mono tracking-widest">Odds</span>
                          <div className="text-xl font-mono font-bold text-white">
                            {m.impliedOdds ? (m.impliedOdds * 100).toFixed(1) + '%' : 'N/A'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Magnetic>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* Grid of sample markets / Quick stats */}
      <Reveal delay={0.5}>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-mono font-bold text-white tracking-tight">Top Opportunities</h2>
              <div className="h-px w-24 bg-gradient-to-r from-white/10 to-transparent" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((market, idx) => {
                const polyOddsRaw = Number(market.polyOdds);
                const synthOddsRaw = Number(market.fairProb);
                const edgeRaw = Number(market.edge);

                const polyOdds = isNaN(polyOddsRaw) ? 0 : polyOddsRaw * 100;
                const synthOdds = isNaN(synthOddsRaw) ? 0 : synthOddsRaw * 100;
                const edgeDisplay = isNaN(edgeRaw) ? '0.0' : (edgeRaw * 100).toFixed(1);
                const isPositive = !isNaN(edgeRaw) && edgeRaw > 0;

                return (
                  <Link href={`/markets/${market.slug}`} key={idx} className="group">
                    <Card className="hover:border-primary/30 group relative overflow-hidden bg-[#111114]/80 h-full hover:shadow-[0_0_40px_rgba(223,254,0,0.05)] border-white/10 transition-all duration-500">
                      <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-all transform group-hover:-translate-y-1 group-hover:translate-x-1 duration-500">
                        {mounted && <ArrowUpRight className="h-6 w-6 text-primary" />}
                      </div>

                      <CardHeader className="pb-2 relative z-10">
                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-zinc-500 tracking-[0.2em] uppercase">{market.asset || 'MARKET'}</div>
                          <CardTitle className="text-xl md:text-2xl transition-all text-white group-hover:text-primary leading-tight">
                            {market.title}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="relative z-10">
                        <div className="flex flex-col gap-6 mt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono text-zinc-500">Polymarket Odds</span>
                              <div className="text-3xl font-mono font-bold text-white">{polyOdds.toFixed(1)}%</div>
                            </div>
                            <div className="space-y-1 text-right">
                              <span className="text-[10px] font-mono text-zinc-500">Synth</span>
                              <div className="text-3xl font-mono font-bold text-white">{synthOdds.toFixed(1)}%</div>
                            </div>
                          </div>

                          <div className="relative py-2">
                            <div className="h-px w-full bg-white/10 overflow-hidden relative">
                              {isPositive ? (
                                <>
                                  <div className="h-full bg-zinc-600 absolute left-0 z-10" style={{ width: `${polyOdds}%` }} />
                                  <div className="h-full bg-primary absolute left-0 z-0 shadow-[0_0_10px_rgba(223,254,0,0.5)]" style={{ width: `${synthOdds}%` }} />
                                </>
                              ) : (
                                <>
                                  <div className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] absolute left-0 z-10" style={{ width: `${polyOdds}%` }} />
                                  <div className="h-full bg-zinc-600 absolute left-0 z-0" style={{ width: `${synthOdds}%` }} />
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-4 border-t border-white/10 font-mono">
                            <span className="text-xs text-zinc-500 tracking-widest">{isPositive ? 'Expected Edge' : 'Signal Strength'}</span>
                            <span className={`text-xl font-bold ${isPositive ? 'text-primary' : 'text-zinc-400'}`}>
                              {isPositive ? `+${edgeDisplay}%` : 'Neutral'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })
            ) : (
              <div className="col-span-1 md:col-span-2 flex items-center justify-center p-12 py-24 text-zinc-500 font-mono text-sm tracking-widest uppercase border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                {mounted ? 'Scanning for opportunities...' : ''}
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
