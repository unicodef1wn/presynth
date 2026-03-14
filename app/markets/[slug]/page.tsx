'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Loader2, TrendingUp, Activity, BarChart2, Zap, ShieldAlert, Cpu, ArrowLeft, Pin, PinOff, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, ComposedChart } from 'recharts';
import Link from 'next/link';
import { Tooltip } from '../../components/ui/Tooltip';
import { extractMarketCondition, calculateTargetProbability } from '../../lib/synthTargetMath';

export default function MarketDetail() {
    const params = useParams();
    const slug = params?.slug as string;
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isPinned, setIsPinned] = useState(false);

    // Generate proper title from slug if needed
    const generateTitleFromSlug = (slug: string, asset: string, endDate: string): string => {
        const betweenMatch = slug.match(/-between-(\d+(?:k|m)?)-(\d+(?:k|m)?)-/);
        const aboveMatch = slug.match(/-above-(\d+(?:k|m)?)-/);
        const belowMatch = slug.match(/-below-(\d+(?:k|m)?)-/);
        
        const formatDate = (dateStr: string) => {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        };
        
        const formatPrice = (price: string) => {
            const p = price.toLowerCase();
            if (p.endsWith('m')) return `$${parseFloat(p.slice(0, -1))}M`;
            if (p.endsWith('k')) return `$${parseFloat(p.slice(0, -1))}k`;
            return `$${parseFloat(p).toLocaleString()}`;
        };
        
        const dateStr = endDate ? formatDate(endDate) : 'March 17';
        
        if (betweenMatch) {
            return `Will the price of ${asset} be between ${formatPrice(betweenMatch[1])} and ${formatPrice(betweenMatch[2])} on ${dateStr}?`;
        }
        if (aboveMatch) {
            return `Will the price of ${asset} be above ${formatPrice(aboveMatch[1])} on ${dateStr}?`;
        }
        if (belowMatch) {
            return `Will the price of ${asset} be below ${formatPrice(belowMatch[1])} on ${dateStr}?`;
        }
        return slug;
    };

    useEffect(() => {
        setMounted(true);
        if (slug) {
            const pinned = JSON.parse(localStorage.getItem('pinnedMarkets') || '[]');
            setIsPinned(pinned.includes(slug));
        }
    }, [slug]);

    const togglePin = () => {
        let pinned = JSON.parse(localStorage.getItem('pinnedMarkets') || '[]');
        if (isPinned) {
            pinned = pinned.filter((p: string) => p !== slug);
        } else {
            pinned.push(slug);
        }
        localStorage.setItem('pinnedMarkets', JSON.stringify(pinned));
        setIsPinned(!isPinned);
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!slug) return;

        fetch(`/api/polymarket/${slug}`)
            .then(res => res.json())
            .then(async (marketData) => {
                if (marketData.error) throw new Error(marketData.error);

                let combinedData = { ...marketData };
                
                // Fix title with "___" by extracting price from slug or groupItemTitle
                if (marketData.title && marketData.title.includes('___')) {
                    const priceMatch = slug.match(/-(\d+(?:k|m|b)?)-/i) || 
                                     (marketData.groupItemTitle && marketData.groupItemTitle.match(/(\d+(?:k|m|b)?)/i));
                    if (priceMatch && priceMatch[1]) {
                        const priceStr = priceMatch[1].toLowerCase();
                        let formattedPrice: string;
                        if (priceStr.endsWith('b')) formattedPrice = `$${parseFloat(priceStr.slice(0, -1))}B`;
                        else if (priceStr.endsWith('m')) formattedPrice = `$${parseFloat(priceStr.slice(0, -1))}M`;
                        else if (priceStr.endsWith('k')) formattedPrice = `$${parseFloat(priceStr.slice(0, -1))}k`;
                        else formattedPrice = `$${priceStr}`;
                        
                        combinedData.title = marketData.title.replace(/___/g, formattedPrice);
                    }
                }

                if (marketData.asset) {
                    try {
                        const condition = extractMarketCondition(slug) || extractMarketCondition(marketData.title);

                        const processSynthData = (sd: any) => {
                            const forecast = sd.forecast || [];
                            let fairProb = sd.synth_probability_up ?? 0.5;

                            if (condition && sd.finalDistribution) {
                                if (condition.type === 'directional' && sd.synth_probability_up != null) {
                                    // For Up or Down markets, trust the direct API probability
                                    fairProb = sd.synth_probability_up;
                                } else {
                                    // For specific price targets, calculate from distribution
                                    const calc = calculateTargetProbability(condition, sd.finalDistribution);
                                    // If calculation returned 0.5 but we have a direct synth prob, use it as fallback
                                    fairProb = (calc === 0.5 && sd.synth_probability_up != null) ? sd.synth_probability_up : calc;
                                }
                            }

                            let polyProb = sd.polymarket_probability_up ?? 0.5;
                            if (marketData.outcomes && marketData.outcomePrices && marketData.outcomePrices.length > 0) {
                                // Default to the first outcome (useful for binary Yes/No markets)
                                let outcomeIndex = 0;

                                // For multi-outcome markets (e.g. "78000", "77000"), find the exact outcome index
                                if (condition && marketData.outcomes.length > 2) {
                                    const matchingIdx = marketData.outcomes.findIndex((outcome: string) => {
                                        // Try converting outcome to number and comparing
                                        const outNum = parseFloat(outcome.replace(/,/g, ''));
                                        if (!isNaN(outNum) && outNum === condition.price1) return true;
                                        // Try matching string includes (e.g. "78k")
                                        if (outcome.toLowerCase().includes(condition.price1.toString()) ||
                                            (condition.price1 >= 1000 && outcome.toLowerCase().includes((condition.price1 / 1000) + 'k'))) {
                                            return true;
                                        }
                                        return false;
                                    });
                                    if (matchingIdx !== -1) {
                                        outcomeIndex = matchingIdx;
                                    }
                                }

                                polyProb = parseFloat(marketData.outcomePrices[outcomeIndex]);
                            } else if (marketData.impliedOdds !== undefined) {
                                polyProb = marketData.impliedOdds;
                            }

                            const edge = fairProb - polyProb;

                            // Odds: how much you win per $1 bet on UP
                            // odds = (1 - polyProb) / polyProb
                            const oddsUp = polyProb > 0 ? (1 - polyProb) / polyProb : null;

                            // EV per $1 bet on UP
                            // EV = synthProb × (1 - polyProb) - (1 - synthProb) × polyProb
                            const ev = fairProb * (1 - polyProb) - (1 - fairProb) * polyProb;

                            // Confidence from synthdata
                            const confidence = sd.confidence ?? null;

                            return {
                                current_price: sd.current_price,
                                percentiles: { forecast_future: { percentiles: forecast } },
                                fairProbability: fairProb,
                                discrepancy: edge,
                                edgeSource: sd.source === 'live' ? 'live' : 'mock',
                                polymarketProbability: polyProb,
                                oddsUp,
                                ev,
                                confidence,
                                volatility: null,
                                liquidation: null,
                                skew: sd.skew,
                                tailRiskUpside: sd.tailRiskUpside,
                                tailRiskDownside: sd.tailRiskDownside,
                            };
                        };

                        // Use pre-embedded synth data if available (from polymarket pre-fetch)
                        const embedded = marketData.synthData;

                        if (embedded && embedded.source === 'live') {
                            combinedData.synthdata = processSynthData(embedded);
                        } else {
                            // Fallback: fetch from API if no embedded data
                            const sRes = await fetch(`/api/synthdata?asset=${marketData.asset}`);
                            const sData = await sRes.json().catch(() => null);

                            if (sData) {
                                combinedData.synthdata = processSynthData(sData);
                            }
                        }
                    } catch (e) {
                        console.error("Synthdata fetch error:", e);
                    }
                }

                setData(combinedData);
                setLoading(false);
            })
            .catch(e => {
                console.error(e);
                setLoading(false);
            });
    }, [slug]);

    const CustomForecastTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#111114]/95 backdrop-blur-xl border border-white/5 p-3 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] font-mono text-[10px] space-y-2">
                    <p className="text-zinc-500 uppercase tracking-widest">{(() => {
                        const raw = payload[0].payload.time;
                        const d = new Date(typeof raw === 'number' ? (raw < 1e12 ? raw * 1000 : raw) : raw);
                        return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                    })()}</p>
                    {payload.map((entry: any, index: number) => {
                        let name = entry.name;
                        if (entry.dataKey === "p50") name = "MEDIAN_PRED";
                        if (entry.dataKey === "p80") name = "UPPER_BOUND";
                        if (entry.dataKey === "p20") name = "LOWER_BOUND";

                        return (
                            <div key={index} className="flex justify-between gap-6 items-center">
                                <span className="text-zinc-500 font-bold tracking-tighter">{name}:</span>
                                <span className="text-white font-bold text-sm">
                                    ${parseFloat(entry.value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    if (!mounted || loading) {
        return (
            <div className="flex flex-col h-[60vh] items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <span className="text-primary font-mono text-xs tracking-widest uppercase animate-pulse">Syncing with nodes...</span>
            </div>
        );
    }

    if (!data || data.error) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-500 gap-4">
                <ShieldAlert className="w-12 h-12 opacity-50 text-rose-500" />
                <h2 className="text-xl font-mono font-bold text-white uppercase italic">Data Extraction Error</h2>
                <p className="text-sm font-mono tracking-tight text-zinc-400">MARKET NOT FOUND FOR: {slug}</p>
                <Link href="/markets" className="mt-4 text-primary font-mono text-xs hover:underline flex items-center gap-2">
                    <ArrowLeft className="w-3 h-3" /> RETURN TO BASE
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-10 w-full max-w-7xl mx-auto py-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-8 items-start relative px-4 mt-24">
                {data.image && (
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-primary/5 rounded-2xl blur-xl group-hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100" />
                        <img src={data.image} alt="Market Icon" className="w-24 h-24 rounded-2xl border border-white/10 relative z-10 bg-[#111114] shadow-sm" />
                    </div>
                )}
                <div className="flex flex-col gap-4 flex-1">
                    <h1 className="text-4xl md:text-5xl font-mono font-bold tracking-tighter text-white leading-none">
                        {data.title && data.title.length > 20 && !data.title.match(/\$\d+|\d+k|\d+m|between|above|below/i) 
                            ? generateTitleFromSlug(slug, data.asset || 'Bitcoin', data.endDate) 
                            : data.title}
                    </h1>
                    <div className="text-zinc-400 max-w-4xl leading-relaxed text-sm font-mono mt-2">
                        <div className={`relative ${!isDescriptionExpanded && data.description?.length > 300 ? "max-h-20 overflow-hidden" : ""}`}>
                            <p className="tracking-tighter">{data.description}</p>
                            {!isDescriptionExpanded && data.description?.length > 300 && (
                                <div className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-[#0a0a0c] to-transparent pointer-events-none"></div>
                            )}
                        </div>
                        {data.description?.length > 300 && (
                            <button
                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                className="mt-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-widest"
                            >
                                {isDescriptionExpanded ? "Read Less" : "Read More"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 px-4 font-mono mt-4">
                <a
                    href={`https://polymarket.com/event/${data.eventSlug || data.slug || slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold tracking-widest hover:bg-primary transition-colors shadow-sm"
                >
                    <Zap className="w-4 h-4" />
                    Trade on Polymarket
                </a>
                <a
                    href={`https://t.me/presynthbot?start=${data.slug || slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-6 py-3 rounded-xl font-bold tracking-widest hover:bg-white/10 transition-colors"
                >
                    <Activity className="w-4 h-4" />
                    Set Alert
                </a>
                <button
                    onClick={togglePin}
                    className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-6 py-3 rounded-xl font-bold tracking-widest hover:bg-white/10 transition-colors"
                >
                    {isPinned ? <PinOff className="w-4 h-4 text-primary" /> : <Pin className="w-4 h-4" />}
                    {isPinned ? 'Remove from dashboard' : 'Pin to dashboard'}
                </button>
            </div>

            {/* Advanced Insights Row */}
            {data.synthdata && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 font-mono">
                    {/* Card 1: Synth Probability + Edge */}
                    <Card className="bg-[#111114]/80 border-white/10 shadow-sm relative group">
                        <CardContent className="p-6 flex flex-col gap-3 relative z-10">
                            <Tooltip position="top" content="The probability of an event occurring, calculated by the SynthData neural network based on historical data and current sentiment.">
                                <span className="flex items-center gap-2 text-primary text-[10px] tracking-widest font-bold">
                                    <Cpu className="w-4 h-4" />
                                    <span>Synth Probability</span>
                                    {data.synthdata.edgeSource === 'live' ? (
                                        <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[8px]">LIVE</span>
                                    ) : (
                                        <span className="bg-white/10 text-zinc-500 px-1.5 py-0.5 rounded text-[8px]">MOCK</span>
                                    )}
                                </span>
                            </Tooltip>
                            <span className="text-5xl font-bold text-white tracking-tighter">{(data.synthdata.fairProbability * 100).toFixed(1)}%</span>
                            <div className="pt-2 border-t border-white/10 flex flex-col gap-1">
                                <span className={`text-[10px] font-bold tracking-[0.2em] ${data.synthdata.discrepancy > 0 ? 'text-primary' : 'text-rose-500'}`}>
                                    {data.synthdata.discrepancy > 0 ? '+' : ''}{(data.synthdata.discrepancy * 100).toFixed(2)}% Edge
                                </span>
                                {data.synthdata.confidence != null && (
                                    <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-400">
                                        Confidence: {(data.synthdata.confidence * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 2: Odds + EV */}
                    <Card className="bg-[#111114]/80 border-white/10 shadow-sm relative group overflow-visible">
                        <CardContent className="p-6 flex flex-col gap-3 overflow-visible">
                            <Tooltip position="top" content="Odds show how much you win per $1 bet on UP. EV (Expected Value) shows average profit per $1 bet based on Synth probability.">
                                <span className="flex items-center gap-2 text-zinc-500 text-[10px] tracking-widest font-bold">
                                    <Zap className="w-4 h-4" />
                                    <span>Odds & EV</span>
                                </span>
                            </Tooltip>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Odds (UP)</span>
                                <span className="text-4xl font-bold text-white tracking-tighter">
                                    {data.synthdata.oddsUp != null ? data.synthdata.oddsUp.toFixed(2) + 'x' : 'N/A'}
                                </span>
                                <span className="text-[10px] text-zinc-500 tracking-tight">bet $1 → win ${data.synthdata.oddsUp != null ? data.synthdata.oddsUp.toFixed(2) : '—'}</span>
                            </div>
                            <div className="pt-2 border-t border-white/10">
                                <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">EV per $1</span>
                                <div className={`text-xl font-bold tracking-tighter mt-0.5 ${data.synthdata.ev != null && data.synthdata.ev > 0 ? 'text-primary' : 'text-rose-500'
                                    }`}>
                                    {data.synthdata.ev != null
                                        ? (data.synthdata.ev > 0 ? '+' : '') + '$' + data.synthdata.ev.toFixed(3)
                                        : 'N/A'}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 3: Skew + Tail Risk */}
                    <Card className="bg-[#111114]/80 border-white/10 shadow-sm relative group">
                        <CardContent className="p-0 flex flex-col h-full relative z-10">
                            {/* Skew Section */}
                            <div className="p-4 flex-1 flex flex-col justify-center border-b border-white/5">
                                <Tooltip position="bottom" content="Market skewness ((p75-p50) vs (p50-p25)). > 1.1 Bullish, < 0.9 Bearish, otherwise Neutral.">
                                    <span className="flex items-center gap-2 text-primary text-[10px] tracking-widest font-bold mb-1">
                                        <TrendingUp className="w-3.5 h-3.5" />
                                        <span>Skew</span>
                                    </span>
                                </Tooltip>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-white tracking-tighter">
                                        {data.synthdata.skew != null ? data.synthdata.skew.toFixed(2) : '1.00'}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase">
                                        {data.synthdata.skew != null
                                            ? (data.synthdata.skew > 1.1 ? 'Bullish' : data.synthdata.skew < 0.9 ? 'Bearish' : 'Neutral')
                                            : 'Neutral'}
                                    </span>
                                </div>
                            </div>

                            {/* Tail Risk Section */}
                            <div className="p-4 flex-1 flex flex-col justify-center bg-white/[0.02]">
                                <Tooltip position="bottom" content="Extreme scenarios (p01 and p99). Useful for setting stop-loss and take-profit targets based on expected volatility limits.">
                                    <span className="flex items-center gap-2 text-rose-500 text-[10px] tracking-widest font-bold mb-1">
                                        <Target className="w-3.5 h-3.5" />
                                        <span>Tail Risk</span>
                                    </span>
                                </Tooltip>
                                <div className="flex gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold text-white tracking-tighter">
                                            {data.synthdata.tailRiskUpside != null ? '+' + (data.synthdata.tailRiskUpside * 100).toFixed(1) + '%' : '+--%'}
                                        </span>
                                        <span className="text-[8px] text-zinc-500 font-bold tracking-[0.2em] uppercase">Max Gain (p99)</span>
                                    </div>
                                    <div className="w-px bg-white/10 my-1"></div>
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold text-rose-500 tracking-tighter">
                                            {data.synthdata.tailRiskDownside != null ? '-' + (data.synthdata.tailRiskDownside * 100).toFixed(1) + '%' : '--%'}
                                        </span>
                                        <span className="text-[8px] text-zinc-500 font-bold tracking-[0.2em] uppercase">Max Loss (p01)</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="flex flex-col gap-4 px-4 w-full">
                {/* Danger Zone Indicator */}
                {data.synthdata?.liquidation?.crash_probability > 0.05 && (
                    <div className="w-full bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center gap-4 animate-pulse">
                        <div className="bg-rose-500/20 p-2 rounded-lg">
                            <ShieldAlert className="w-6 h-6 text-rose-500" />
                        </div>
                        <div className="flex flex-col font-mono">
                            <span className="text-rose-500 font-bold tracking-widest uppercase">DANGER_ZONE: HIGH_TAIL_RISK</span>
                            <span className="text-xs text-rose-500/70">The model detected an abnormally high probability of a critical event ({">"}{(data.synthdata.liquidation.crash_probability * 100).toFixed(1)}%). It is highly recommended to hedge exposures.</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full mt-2 h-[500px] px-4 pb-20">
                {/* Probability Distribution (Synthdata Percentiles) */}
                <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center gap-3">
                        <div className="h-4 w-1 bg-primary" />
                        <h2 className="text-[10px] font-mono font-bold text-white flex items-center gap-2 tracking-[0.4em]">
                            Forecast Model
                        </h2>
                    </div>
                    <Card className="bg-[#111114]/80 border-white/10 p-6 h-full relative group shadow-sm">
                        {data.synthdata?.percentiles?.forecast_future?.percentiles ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={data.synthdata.percentiles.forecast_future.percentiles}>
                                    <defs>
                                        <linearGradient id="neonGradientDetail" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#DFFE00" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="#DFFE00" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="4 4" stroke="white" strokeOpacity={0.05} vertical={false} />
                                    <XAxis dataKey="time" hide />
                                    <YAxis
                                        stroke="#52525b"
                                        fontSize={10}
                                        tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`}
                                        domain={['auto', 'auto']}
                                        axisLine={false}
                                        tickLine={false}
                                        fontFamily="monospace"
                                    />
                                    <RechartsTooltip content={<CustomForecastTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Area
                                        type="monotone"
                                        dataKey={(d) => [d['p20'], d['p80']]}
                                        stroke="transparent"
                                        fill="url(#neonGradientDetail)"
                                        name="CONF_INTERVAL"
                                        isAnimationActive={false}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="p50"
                                        stroke="#DFFE00"
                                        strokeWidth={3}
                                        dot={false}
                                        isAnimationActive={false}
                                        name="MEDIAN_PRICE"
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <Cpu className="w-8 h-8 text-zinc-400" />
                                <div className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
                                    {data.asset ? 'Waiting_for_forecast_data...' : 'Forecast_unavailable_for_this_asset'}
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Price History (Polymarket) */}
                <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-center gap-3">
                        <div className="h-4 w-1 bg-white" />
                        <h2 className="text-[10px] font-mono font-bold text-white flex items-center gap-2 tracking-[0.4em]">
                            Market History
                        </h2>
                    </div>
                    <Card className="bg-[#111114]/80 border-white/10 shadow-sm p-6 h-full relative">
                        {data.history && data.history.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.history}>
                                    <CartesianGrid strokeDasharray="4 4" stroke="white" strokeOpacity={0.05} vertical={false} />
                                    <XAxis dataKey="time" hide />
                                    <YAxis
                                        stroke="#52525b"
                                        fontSize={10}
                                        tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                        domain={[0, 1]}
                                        axisLine={false}
                                        tickLine={false}
                                        fontFamily="monospace"
                                    />
                                    <RechartsTooltip
                                        content={({ active, payload, label }: any) => {
                                            if (!active || !payload?.length) return null;
                                            const time = new Date(label);
                                            const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                            const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                                            return (
                                                <div className="bg-[#111114]/95 backdrop-blur-xl border border-white/5 p-3 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] font-mono text-[10px] space-y-1.5">
                                                    <p className="text-zinc-400 tracking-widest uppercase font-bold">{dateStr} · {timeStr}</p>
                                                    {payload.map((entry: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between gap-6 items-center">
                                                            <span style={{ color: entry.color }} className="font-bold tracking-tighter flex items-center gap-1.5">
                                                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                {entry.name}
                                                            </span>
                                                            <span className="text-white font-bold text-sm">{(entry.value * 100).toFixed(1)}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }}
                                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    />
                                    {data.outcomes.map((outcome: string, idx: number) => {
                                        const primaryColors = [
                                            '#DFFE00', // Neon Yellow/Green
                                            '#3b82f6', // Blue
                                            '#ef4444', // Red
                                            '#a855f7', // Purple
                                            '#14b8a6', // Teal
                                            '#f97316', // Orange
                                            '#ec4899', // Pink
                                            '#84cc16', // Lime
                                            '#06b6d4', // Cyan
                                            '#f43f5e', // Rose
                                            '#8b5cf6', // Violet
                                            '#f59e0b', // Amber
                                        ];
                                        // Use predefined colors first, then fall back to generated distinct HSL colors
                                        const hue = (idx * 137.508) % 360;
                                        const color = idx < primaryColors.length ? primaryColors[idx] : `hsl(${hue}, 85%, 65%)`;

                                        return (
                                            <Line
                                                key={outcome}
                                                type="monotone"
                                                dataKey={outcome}
                                                stroke={color}
                                                strokeWidth={2}
                                                dot={false}
                                                strokeOpacity={0.8}
                                            />
                                        );
                                    })}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <Activity className="w-8 h-8 text-zinc-400" />
                                <div className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Loading_trade_history...</div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
