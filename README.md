# PreSynth

An analytical platform designed to analyze spreads between Polymarket and Synth.

It retrieves data via API and currently supports BTC, SOL, and ETH markets (for now), with contracts expiring within a maximum of 24 hours.

The result is a figure representing the spreads, which will be useful and valuable for those looking to profit from this. You can pin markets of interest and set alerts in Telegram.

## Sections on the Website

**Home** - the main tab where users land. It displays the two best markets with the most promising opportunities currently available.

**Markets** - all markets suitable for finding spreads between odds on Polymarket and Synth.

When you click on a market, you can see basic information:

1. Name
2. Market context
3. Link to the market on Polymarket
4. Option to set an alert via the Telegram bot
5. Option to pin to the dashboard

Analytical information:

1. The most important metrics are Synth Probability and Edge. Edge is calculated using the formula:

Synth Probability - Polymarket Probability = Edge

2. There is Confidence, which is a measure of certainty.

It is calculated using the formula:

1 - (p95 - p05) / currentPrice

3. Odds & EV. This shows how much profit you can potentially earn.

A quick estimate of how much youll earn if you bet $1.

There is an EV metric, which shows the edge as a decimal (fairProb - polyProb)

It is calculated using the formula:

EV = fairProb  (1 ? polyProb) ? (1 ? fairProb)  polyProb

4. Skew - a metric for calculating market asymmetry (p75 - p50) vs. (p50 - p25)

> 1.1 = Bullish
< 0.9 = Bearish
Otherwise = Neutral

5. Tail Risk - a metric for accounting for extreme price fluctuations.

Shows the maximum gain - p99
Shows the maximum loss - p01

6. Forecast Model - displays a chart showing the Confidence Interval and Median Prediction

All of this is presented with a beautiful visualization of market trends over time + up-to-date data for specific time periods.

7. Market History - visualization of changes in odds for specific markets

Different colors = different prices; you can see how they changed throughout the market

**Radar** - a section that allows you to easily filter markets by Asset, Poly Odds, Synth Odds, and Spread. This is especially convenient if you simply need to find the best spread options or other data.

---

## Stack

```
Frontend:  Next.js 16 (App Router), React 19, TypeScript, TailwindCSS 4, Recharts, Framer Motion, Lucide
Data:      Synth API (prediction-percentiles, polymarket/up-down/daily), Polymarket Gamma API
```

---
## Assets

| Asset | Synth ticker | Polymarket matching |
|-------|--------------|---------------------|
| BTC | BTC | btc, bitcoin |
| ETH | ETH | eth, ethereum |
| SOL | SOL | sol, solana |
| SPY | SPYX | spy, S&P 500, sp500 |

---


## Setup

```bash
git clone https://github.com/unicodef1wn/presynth.git
cd presynth
npm install
cp .env.example .env.local
# Add SYNTHDATA_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment

```env
# .env.local
SYNTHDATA_API_KEY=your_synth_api_key_here
```

Without the key, Synth data falls back to mock (e.g. 0.5 probability).

