/** English dictionary — complete, including analysis text. */

import type { Dictionary } from "./tr";

export const en: Dictionary = {
  "app.tagline": "Technical analysis and buy/sell signals",
  "common.loading": "Loading…",
  "common.refresh": "Refresh",
  "common.search": "Search",
  "common.searchPlaceholder": "Search crypto (BTC, ETH, SOL, Bitcoin…)",
  "common.searchHint": "Type at least 2 characters",
  "common.noResults": "No results",
  "common.all": "All",
  "common.details": "Details",
  "common.analyze": "Analyse",
  "common.price": "Price",
  "common.change": "Change",
  "common.change24h": "24h change",
  "common.volume": "Volume",
  "common.high": "High",
  "common.low": "Low",
  "common.updated": "updated",
  "common.demoData": "DEMO DATA",
  "common.demoNotice":
    "Market data could not be reached, so demo data is shown. These numbers do not reflect the real market.",
  "common.error": "Something went wrong",
  "common.pair": "Pair",
  "common.asset": "Asset",
  "common.signal": "Signal",
  "common.score": "Score",
  "common.confidence": "Confidence",
  "common.trend": "Trend",
  "common.pattern": "Pattern",
  "common.none": "—",
  "common.language": "Language",
  "common.close": "Close",
  "common.openMenu": "Open menu",
  "common.trades": "Trades",
  "common.indicatorCount": "{count} indicators",

  "nav.features": "Features",
  "nav.how": "How it works",
  "nav.indicators": "Indicators",
  "nav.faq": "FAQ",
  "nav.login": "Log in",
  "nav.register": "Start free",
  "nav.panel": "Dashboard",
  "nav.goPanel": "Go to dashboard",
  "nav.scanner": "Signal scanner",
  "nav.watchlist": "Watchlist",
  "nav.settings": "Settings",
  "nav.logout": "Log out",
  "nav.markets": "Markets",

  "market.kripto": "Crypto",
  "market.abd": "US stocks",
  "market.bist": "Turkish stocks",
  "market.emtia": "Forex & commodities",
  "market.kripto.desc": "Bitcoin, Ethereum and hundreds of altcoins — 24/7",
  "market.abd.desc": "S&P 500, Nasdaq and the most traded US equities",
  "market.bist.desc": "BIST 100 index and leading Borsa İstanbul shares",
  "market.emtia.desc": "Gold, silver, oil, USD/TRY and the major pairs",
  "market.closedNote": "This market is closed outside session hours; the last close is shown.",

  "interval.1m": "1 minute",
  "interval.5m": "5 minutes",
  "interval.15m": "15 minutes",
  "interval.30m": "30 minutes",
  "interval.1h": "1 hour",
  "interval.4h": "4 hours",
  "interval.1d": "1 day",
  "interval.1w": "1 week",

  "signal.STRONG_BUY": "STRONG BUY",
  "signal.BUY": "BUY",
  "signal.WAIT": "WAIT",
  "signal.SELL": "SELL",
  "signal.STRONG_SELL": "STRONG SELL",
  "verdict.BUY": "BUY",
  "verdict.SELL": "SELL",
  "verdict.NEUTRAL": "NEUTRAL",
  "category.trend": "Trend",
  "category.momentum": "Momentum",
  "category.volatility": "Volatility",
  "category.volume": "Volume",

  "home.badge": "Hundreds of crypto pairs, one analysis engine",
  "home.title": "Analyse it,\nsee the buy/sell signal",
  "home.lead":
    "We pull live crypto data from Binance, compute 16 technical indicators, turn them into a weighted score and produce a {signals} signal — and explain why.",
  "home.ctaPrimary": "Create a free account",
  "home.ctaSecondary": "How does it work?",
  "home.disclaimerShort":
    "This is a technical analysis tool. Its signals are not investment advice; your decisions are your own responsibility.",
  "home.searchTitle": "What would you like to analyse?",
  "home.searchSub": "Type a name or symbol; we search hundreds of pairs.",
  "home.marketsTitle": "Four markets, one engine",
  "home.marketsSub": "The same indicator set and scoring runs on every market.",
  "home.highlightsEyebrow": "Live from the market",
  "home.highlightsTitle": "Highlights",
  "home.highlightsSub":
    "Picks by volume, gains and losses — this page refreshes every minute.",
  "home.highlightsEmpty":
    "Market data is unavailable right now. Running the app on your own server will fill this section with live prices.",
  "home.whyEyebrow": "Why this tool",
  "home.whyTitle": "See the technical analysis\nwithout reading charts",
  "home.whyLead":
    "Every indicator is computed separately, weighted, and combined into a single score. The result is more than a badge: you can read, sentence by sentence, why each indicator voted the way it did.",
  "home.feature.indicators": "16 technical indicators",
  "home.feature.indicators.desc": "RSI, MACD, Bollinger, ADX, Supertrend, OBV and more",
  "home.feature.markets": "Hundreds of pairs",
  "home.feature.markets.desc": "Bitcoin, Ethereum and hundreds of altcoins traded on Binance",
  "home.feature.timeframes": "Multiple timeframes",
  "home.feature.timeframes.desc": "From one minute to weekly, plus higher-timeframe agreement",
  "home.feature.comment": "Plain-language commentary",
  "home.feature.comment.desc": "The reasoning, the risks and the levels, written out",
  "home.feature.plan": "Trade plan",
  "home.feature.plan.desc": "ATR-based stop loss, targets and risk/reward ratio",
  "home.feature.scanner": "Signal scanner",
  "home.feature.scanner.desc": "Scans dozens of assets at once and ranks the strongest signals",
  "home.stat.indicators": "Technical indicators",
  "home.stat.markets": "Markets",
  "home.stat.timeframes": "Timeframes",
  "home.stat.always": "Live market data",
  "home.howEyebrow": "Three steps to a signal",
  "home.howTitle": "How does it work?",
  "home.howSub": "No black box: every step from data to signal is visible.",
  "home.how.1": "1. Data",
  "home.how.1.title": "Market data",
  "home.how.1.desc":
    "The last 300 candles (open, high, low, close, volume) are fetched for your asset and timeframe, then cached.",
  "home.how.2": "2. Analysis",
  "home.how.2.title": "16 indicators, weighted vote",
  "home.how.2.desc":
    "Each indicator produces a direction between −1 and +1, multiplied by its weight and summed. The result becomes one score between −100 and +100.",
  "home.how.3": "3. Commentary",
  "home.how.3.title": "The signal and its reasoning",
  "home.how.3.desc":
    "The score becomes a BUY / SELL / WAIT signal; support and resistance levels, patterns, risks and an ATR-based trade plan are written out.",
  "home.indicatorsEyebrow": "Inside the engine",
  "home.indicatorsTitle": "Indicators we compute",
  "home.indicatorsSub": "All of them in-app, with no external analysis service.",
  "home.ctaTitle": "Open your account and get your first analysis in a minute",
  "home.ctaSub":
    "Sign up with email or continue with Google; your watchlist and preferences stay on your account.",
  "home.faqTitle": "Common questions",
  "home.faqEyebrow": "Frequently asked",
  "faq.q1": "Which markets does this cover?",
  "faq.a1":
    "Crypto pairs, US equities and indices, Borsa İstanbul shares and BIST indices, plus commodities such as gold, silver and oil and the major currency pairs.",
  "faq.q2": "Are the signals investment advice?",
  "faq.a2":
    "No. The output is a rule-based technical analysis summary. Technical indicators look at past price action and guarantee nothing about the future. Markets are risky.",
  "faq.q3": "How is the score calculated?",
  "faq.a3":
    "Each indicator produces a direction from −1 (strong sell) to +1 (strong buy) by its own rule. Those directions are multiplied by the indicator's weight, summed, and divided by the total weight to scale into −100…+100. At or above 45 counts as a strong buy, at or below −45 as a strong sell.",
  "faq.q4": "Which timeframe should I pick?",
  "faq.a4":
    "15 minutes to 1 hour is common for short-term trades, 4 hours to 1 day for swing trades. The detail page also shows the signal on higher timeframes; the more they agree, the more reliable the signal is considered.",
  "faq.q5": "How often is data refreshed?",
  "faq.a5":
    "Crypto every 20 seconds, stocks and commodities every minute. You can refresh at any time from the dashboard. While an exchange is closed, the last close is shown.",
  "footer.legalTitle": "Legal notice:",
  "footer.legal":
    "This site is a technical analysis tool, not an investment advisory service. The signals, scores, levels and commentary here are automated calculations based on past price data and do not constitute a recommendation to buy or sell. Markets are highly volatile; you can lose your entire investment. Prices may be delayed or incomplete.",
  "footer.disclaimerShort":
    "The signals, scores and levels here are computed automatically from past price data and are not investment advice. Prices may be delayed.",

  "auth.loginTitle": "Welcome back",
  "auth.loginSub": "Log in to reach your analysis dashboard.",
  "auth.registerTitle": "Create a free account",
  "auth.registerSub": "Your watchlist and analysis preferences are saved to your account.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.name": "Name (optional)",
  "auth.namePlaceholder": "Your name",
  "auth.passwordPlaceholder": "At least 8 characters",
  "auth.login": "Log in",
  "auth.loggingIn": "Logging in…",
  "auth.register": "Create account",
  "auth.registering": "Creating account…",
  "auth.or": "or",
  "auth.google": "Continue with Google",
  "auth.googleRegister": "Sign up with Google",
  "auth.noAccount": "No account yet?",
  "auth.registerLink": "Sign up free",
  "auth.haveAccount": "Already a member?",
  "auth.loginLink": "Log in",
  "auth.badCredentials": "Email or password is incorrect.",
  "auth.serverProblem": "Could not log in: a server-side problem occurred ({code}).",
  "auth.shortPassword": "Password must be at least 8 characters.",
  "auth.registerFailed": "Registration could not be completed.",
  "auth.registerTerms":
    "By signing up you accept that this app does not give investment advice and that its signals are for technical analysis only.",
  "auth.autoLoginFailed":
    "The account was created but automatic login failed. Please try the login page.",
  "auth.networkError": "Could not reach the server; check your connection and try again.",

  "panel.greeting": "Hello {name}",
  "panel.sub": "Market data {updated} {time}.",
  "panel.loadingMarkets": "Loading market data…",
  "panel.topBuyTitle": "Strongest BUY signals — Top 10",
  "panel.topBuySub": "The 10 assets with the highest buy score in the selected market and timeframe.",
  "panel.topSellTitle": "Strongest sell signals",
  "panel.noBuy": "No asset is producing a buy signal on this timeframe.",
  "panel.noSell": "No asset is producing a sell signal on this timeframe.",
  "panel.breadth": "Market breadth",
  "panel.breadthSub": "rising / falling",
  "panel.totalVolume": "Total volume",
  "panel.marketTable": "Market",
  "panel.marketTableSub": "Click a row to analyse it.",
  "panel.watchlistShortcut": "My watchlist",
  "panel.analyzeAll": "Analyse all",

  "scan.title": "Signal scanner",
  "scan.sub": "Scans {count} assets in {market} on the {interval} timeframe and ranks them by score.",
  "scan.scanned": "{count} assets scanned",
  "scan.rescan": "Scan again",
  "scan.scanning": "Scanning…",
  "scan.buyCount": "Buy signals",
  "scan.sellCount": "Sell signals",
  "scan.waitCount": "Wait",
  "scan.bias": "Market bias",
  "scan.biasBull": "Buyer-heavy",
  "scan.biasBear": "Seller-heavy",
  "scan.biasMixed": "Mixed",
  "scan.filterBuy": "Buy",
  "scan.filterSell": "Sell",
  "scan.filterWatch": "My watchlist",
  "scan.sortScore": "By score",
  "scan.sortConfidence": "By confidence",
  "scan.sortChange": "By change",
  "scan.sortVolume": "By volume",
  "scan.sortRsi": "By RSI",
  "scan.onlyStrong": "Strong signals only",
  "scan.empty": "No asset matches these filters.",
  "scan.assetCount": "{count} assets",
  "scan.footnote":
    "Scores are based on the latest close of the selected timeframe and can change before the candle closes.",

  "watch.title": "My watchlist",
  "watch.sub": "The {count} assets on your list are analysed on the {interval} timeframe.",
  "watch.add": "Add an asset",
  "watch.addPlaceholder": "Search and add to the list",
  "watch.addButton": "Add to list",
  "watch.remove": "Remove",
  "watch.empty":
    "Your watchlist is empty. Use Follow on any asset page, or the search above.",
  "watch.already": "{symbol} is already on your list.",
  "watch.follow": "Follow",
  "watch.unfollow": "Unfollow",

  "settings.title": "Settings",
  "settings.sub": "Manage your analysis preferences and account details.",
  "settings.prefs": "Analysis preferences",
  "settings.defaultInterval": "Default timeframe",
  "settings.defaultMarket": "Default market",
  "settings.scanLimit": "Assets scanned by the scanner",
  "settings.scanLimitHint": "A higher number takes longer.",
  "settings.onlyStrong": "Show only strong signals in the scanner by default",
  "settings.save": "Save",
  "settings.saved": "Settings saved.",
  "settings.saveFailed": "Settings could not be saved.",
  "settings.account": "Account",
  "settings.registeredAt": "Registered",
  "settings.loginMethod": "Login method",
  "settings.loginPassword": "Email + password",
  "settings.loginGoogle": "Google",
  "settings.watchlistCount": "{count} assets",
  "settings.privacy": "Data and privacy",
  "settings.privacy.1":
    "Market data is read from public endpoints only; your brokerage account is never accessed and no orders are placed on your behalf.",
  "settings.privacy.2":
    "Your password is stored with scrypt and a per-user salt; it is never written anywhere in plain text.",
  "settings.privacy.3": "Your watchlist and preferences are kept in the database.",

  "asset.analysisComment": "Analysis commentary",
  "asset.highlights": "Highlights",
  "asset.risks": "Risks and warnings",
  "asset.plan": "Trade plan",
  "asset.planLong": "LONG / BUY",
  "asset.planShort": "SHORT / SELL",
  "asset.planAdvisory": "The signal is WAIT, so this plan is only a scenario.",
  "asset.entry": "Entry",
  "asset.stopLoss": "Stop loss",
  "asset.target": "Target {n}",
  "asset.risk": "Risk",
  "asset.riskReward": "Risk / reward",
  "asset.atr": "ATR (14)",
  "asset.levels": "Support and resistance",
  "asset.resistance": "Resistance",
  "asset.support": "Support",
  "asset.current": "Current",
  "asset.noLevels": "No clear pivot level was found in this data range.",
  "asset.patterns": "Patterns",
  "asset.noPatterns": "No defined pattern was detected in the recent candles.",
  "asset.dayStats": "Session",
  "asset.otherTimeframes": "OTHER TIMEFRAMES",
  "asset.buyVotes": "BUY VOTES",
  "asset.sellVotes": "SELL VOTES",
  "asset.tally":
    "{buy} indicators buy, {sell} indicators sell, {neutral} neutral. Trend strength: {trend} · Volatility: {volatility}",
  "asset.volatilityRegime": "Volatility regime",
  "asset.bandwidth": "Bollinger bandwidth",
  "asset.squeeze": "Band squeeze",
  "asset.squeezeYes": "yes (breakout expected)",
  "asset.squeezeNo": "no",
  "asset.analysisLangNote":
    "Analysis text is currently available in Turkish and English only; it is shown in English for this language.",
  "asset.notFound": "Asset not found.",
  "asset.backToPanel": "Back to dashboard",

  "trend.veryStrong": "very strong",
  "trend.strong": "strong",
  "trend.developing": "developing",
  "trend.weak": "weak / sideways",
  "trend.unknown": "unclear",
  "vol.low": "low",
  "vol.normal": "normal",
  "vol.high": "high",

  "ind.emaCross": "EMA 9 / EMA 21",
  "ind.ema50200": "EMA 50 / EMA 200",
  "ind.priceEma200": "Price / EMA 200",
  "ind.supertrend": "Supertrend (10, 3)",
  "ind.adx": "ADX / DI",
  "ind.vwap": "VWAP (20)",
  "ind.rsi": "RSI (14)",
  "ind.macd": "MACD (12, 26, 9)",
  "ind.stoch": "Stochastic (14, 3, 3)",
  "ind.cci": "CCI (20)",
  "ind.williams": "Williams %R (14)",
  "ind.roc": "Momentum (ROC 10)",
  "ind.bollinger": "Bollinger %B (20, 2)",
  "ind.obv": "OBV slope",
  "ind.mfi": "Money Flow Index (14)",
  "ind.volume": "Volume / 20-candle avg.",

  "note.emaCross.up":
    "The short-term average is {spread}% above the medium-term one — short-term direction is up.",
  "note.emaCross.down":
    "The short-term average is {spread}% below the medium-term one — short-term direction is down.",
  "note.ema50200.golden": "EMA 50 is above EMA 200: the main trend is up (golden cross zone).",
  "note.ema50200.death": "EMA 50 is below EMA 200: the main trend is down (death cross zone).",
  "note.priceEma200.above":
    "Price is above the 200-period average; the long-term picture favours buyers.",
  "note.priceEma200.below":
    "Price is below the 200-period average; the long-term picture favours sellers.",
  "note.supertrend.up": "Supertrend is on the buy side; {level} acts as a trailing support.",
  "note.supertrend.down": "Supertrend is on the sell side; {level} acts as a trailing resistance.",
  "note.adx.weak": "ADX is below 20: the trend is weak and price may be stuck in a range.",
  "note.adx.up": "With ADX at {adx} and +DI ahead, an uptrend is in control.",
  "note.adx.down": "With ADX at {adx} and -DI ahead, a downtrend is in control.",
  "note.vwap.above":
    "Price is above the volume-weighted average; buyers are trading above average cost.",
  "note.vwap.below":
    "Price is below the volume-weighted average; selling pressure sits under average cost.",
  "note.rsi.oversold": "RSI at {rsi} is oversold — a relief bounce is plausible.",
  "note.rsi.overbought": "RSI at {rsi} is overbought — profit taking is a risk.",
  "note.rsi.bull": "RSI at {rsi}: momentum favours buyers, with no extreme reading.",
  "note.rsi.bear": "RSI at {rsi}: momentum favours sellers, with no extreme reading.",
  "note.macd.aboveRising":
    "MACD is above its signal line and the histogram is widening — buying momentum is building.",
  "note.macd.aboveFalling":
    "MACD is above its signal line but the histogram is narrowing — buying momentum is fading.",
  "note.macd.belowRising":
    "MACD is below its signal line but the histogram is narrowing — selling momentum is fading.",
  "note.macd.belowFalling":
    "MACD is below its signal line and the histogram is widening — selling momentum is building.",
  "note.stoch.low": "Stochastic at {k} is in the lower zone; a turn after oversold is watched for.",
  "note.stoch.high": "Stochastic at {k} is in the upper zone; a turn after overbought is a risk.",
  "note.stoch.mid": "Stochastic at {k}: mid-range, with no clear extreme.",
  "note.cci.high": "CCI above +100: strong upward momentum, though it may be overheating.",
  "note.cci.low": "CCI below -100: strong downward momentum or oversold.",
  "note.cci.mid": "CCI is in its normal band; no clear momentum pressure.",
  "note.williams.oversold": "Williams %R is in oversold territory.",
  "note.williams.overbought": "Williams %R is in overbought territory.",
  "note.williams.neutral": "Williams %R is neutral.",
  "note.roc.value": "Price changed {roc}% over the last 10 candles.",
  "note.bb.lower": "Price is pinned to the lower Bollinger band — oversold / bounce zone.",
  "note.bb.upper": "Price is pushing the upper Bollinger band — overbought / profit-taking zone.",
  "note.bb.mid": "Price sits at {percent}% of the band width.",
  "note.obv.up": "On-balance volume is rising: buys arrive on heavier volume than sells.",
  "note.obv.down": "On-balance volume is falling: sells arrive on heavier volume.",
  "note.mfi.low": "Money flow is oversold; outflows may be exhausted.",
  "note.mfi.high": "Money flow is overbought; the pace of inflows may not be sustainable.",
  "note.mfi.mid": "Money flow at {mfi}: inflows and outflows look balanced.",
  "note.volume.surge":
    "Volume is {ratio}× the average and the candle is {direction} — the move is backed by participation.",
  "note.volume.normal": "Volume is near average; there is no strong participation behind the move.",
  "note.volume.up": "green",
  "note.volume.down": "red",

  "pattern.bullish-engulfing.name": "Bullish engulfing",
  "pattern.bullish-engulfing.note":
    "The last candle fully engulfed the previous red body — buyers took control.",
  "pattern.bearish-engulfing.name": "Bearish engulfing",
  "pattern.bearish-engulfing.note":
    "The last candle fully engulfed the previous green body — sellers took control.",
  "pattern.hammer.name": "Hammer",
  "pattern.hammer.note": "Long lower wick: price was pushed down but buyers took it back.",
  "pattern.shooting-star.name": "Shooting star",
  "pattern.shooting-star.note": "Long upper wick: attempts higher were met with selling.",
  "pattern.doji.name": "Doji",
  "pattern.doji.note":
    "Open and close are nearly equal — indecision, often seen before a trend change.",
  "pattern.morning-star.name": "Morning star",
  "pattern.morning-star.note": "A three-candle bottom reversal has completed.",
  "pattern.evening-star.name": "Evening star",
  "pattern.evening-star.note": "A three-candle top reversal has completed.",
  "pattern.golden-cross.name": "Golden cross",
  "pattern.golden-cross.note":
    "EMA 50 recently crossed above EMA 200 — a medium-term trend change.",
  "pattern.death-cross.name": "Death cross",
  "pattern.death-cross.note":
    "EMA 50 recently crossed below EMA 200 — a medium-term trend change.",
  "pattern.macd-cross-up.name": "MACD bullish cross",
  "pattern.macd-cross-up.note": "MACD crossed above its signal line in the last few candles.",
  "pattern.macd-cross-down.name": "MACD bearish cross",
  "pattern.macd-cross-down.note": "MACD crossed below its signal line in the last few candles.",
  "pattern.bullish-divergence.name": "Bullish divergence",
  "pattern.bullish-divergence.note":
    "Price made a new low while RSI made a higher low — downward momentum is weakening.",
  "pattern.bearish-divergence.name": "Bearish divergence",
  "pattern.bearish-divergence.note":
    "Price tested a new high while RSI made a lower high — upward momentum is weakening.",
  "pattern.bb-squeeze.name": "Bollinger squeeze",
  "pattern.bb-squeeze.note":
    "The bands are at their narrowest in 60 candles — energy building before a sharp move.",

  "commentary.headline":
    "{asset} is giving a {signal} signal on the {interval} chart (score {score}, confidence {confidence}%).",
  "commentary.overview":
    "{asset} trades at {price} {currency} and moved {change}% on the last candle. On the {interval} timeframe {summary}: {buy} indicators voted buy, {sell} sell and {neutral} neutral. The weighted score is {score} (on a −100 to +100 scale) and the model's confidence in this signal is {confidence}%.",
  "commentary.summary.STRONG_BUY": "the large majority of indicators agree on the buy side",
  "commentary.summary.BUY": "indicators lean to the buy side",
  "commentary.summary.WAIT": "indicators give no clear direction",
  "commentary.summary.SELL": "indicators lean to the sell side",
  "commentary.summary.STRONG_SELL": "the large majority of indicators agree on the sell side",
  "commentary.trend": "On trend: {parts}.",
  "commentary.trend.emaUp": "EMA 50 ({ema50}) is above EMA 200 ({ema200}), so the main trend is up",
  "commentary.trend.emaDown":
    "EMA 50 ({ema50}) is below EMA 200 ({ema200}), so the main trend is down",
  "commentary.trend.stUp": "Supertrend is on the buy side, using {level} as trailing support",
  "commentary.trend.stDown": "Supertrend is on the sell side, with {level} as trailing resistance",
  "commentary.trend.adx": "ADX at {adx} makes the trend “{label}”",
  "commentary.momentum": "On momentum: {parts}.",
  "commentary.momentum.rsiOverbought":
    "RSI at {rsi} is overbought — even if the rise continues, pullback risk grows",
  "commentary.momentum.rsiOversold":
    "RSI at {rsi} is oversold — the ground for relief buying is forming",
  "commentary.momentum.rsiBull": "RSI at {rsi} sits above the midline, buyers slightly ahead",
  "commentary.momentum.rsiBear": "RSI at {rsi} sits below the midline, sellers slightly ahead",
  "commentary.momentum.macdDown": "MACD trades below its signal line (negative momentum)",
  "commentary.momentum.macdUp": "MACD trades above its signal line (positive momentum)",
  "commentary.momentum.stoch": "Stochastic %K is at {k}",
  "commentary.volatility":
    "Volatility is {regime}: ATR is about {atrPercent}% of price, so a {interval} candle is expected to move around {atr} {currency}.",
  "commentary.volatility.squeeze":
    " The Bollinger bands are at their narrowest in 60 candles; a sharp directional move can follow the squeeze.",
  "commentary.levels":
    "The nearest support is {support} ({supportDistance}% below, tested with {supportTouches} touches) and the nearest resistance {resistance} ({resistanceDistance}% above, {resistanceTouches} touches). A close beyond either level is the first technical reference that confirms or invalidates this signal.",
  "commentary.levels.supportOnly":
    "The nearest support is {support} ({supportDistance}% below, {supportTouches} touches). No clear pivot resistance is visible above.",
  "commentary.levels.resistanceOnly":
    "The nearest resistance is {resistance} ({resistanceDistance}% above, {resistanceTouches} touches). No clear pivot support is visible below.",
  "commentary.plan":
    "Following the score, a {side} scenario gives an entry at {entry}, a stop loss at {stop} ({riskPercent}% risk) and a first target at {target} — roughly a {rr}:1 risk/reward ratio. The stop is placed at whichever is further: the swing point of the last 12 candles or 1.5×ATR.",
  "commentary.plan.advisory":
    "Because the signal is WAIT, the plan below is only a scenario; staying flat until a clear trigger appears is also a choice. ",
  "commentary.plan.long": "long (buy)",
  "commentary.plan.short": "short (sell)",

  "risk.weakTrend":
    "ADX is below 20: the trend is weak, and crossover signals often whipsaw in a range.",
  "risk.lowConfidence": "Agreement between indicators is low; the signal may not persist.",
  "risk.overboughtBuy": "The buy signal was produced in overbought territory; entering late is a risk.",
  "risk.oversoldSell":
    "The sell signal was produced in oversold territory; a sharp relief rally is possible.",
  "risk.highVolatility":
    "Volatility is high (ATR {atrPercent}%); position size should be reduced and the stop distance widened accordingly.",
  "risk.conflictingPattern": "The {pattern} pattern warns in the opposite direction to the signal.",
  "risk.demoData":
    "This analysis was produced with DEMO data (market data was unreachable); the numbers do not reflect the real market.",
  "risk.closedMarket":
    "This market may be closed right now; a signal from the last close can change at the open.",
  "risk.none":
    "No clear technical contradiction was detected; still, never trade without risk management.",

  /* ── Search engine titles and descriptions ── */
  "seo.home.title": "Technical analysis and buy/sell signals",
  "seo.home.description":
    "Buy / sell / wait signals from 16 technical indicators for Bitcoin, Ethereum and hundreds of altcoins — with the reasoning written out in plain language.",

  "seo.kripto.title": "Crypto technical analysis and buy/sell signals",
  "seo.kripto.description":
    "Live technical analysis for Bitcoin, Ethereum and hundreds of altcoins: RSI, MACD, EMA and Bollinger based buy / sell / wait signals with the reasoning for each pair.",
  "seo.abd.title": "US stock market technical analysis and signals",
  "seo.abd.description":
    "Daily technical analysis for S&P 500, Nasdaq and Dow stocks: 16 indicators, support and resistance levels, and a buy / sell / wait signal with its reasoning.",
  "seo.bist.title": "Borsa Istanbul (BIST) technical analysis and signals",
  "seo.bist.description":
    "Technical analysis for BIST 100 and BIST 30 stocks: buy / sell / wait signals built from RSI, MACD, moving averages and chart patterns, explained in plain language.",
  "seo.emtia.title": "Forex, gold and oil technical analysis",
  "seo.emtia.description":
    "Technical analysis and buy/sell signals for USD/TRY, EUR/USD, gold, silver and oil. Exchange rates come from European Central Bank reference rates.",

  "market.kripto.h1": "Crypto technical analysis and signals",
  "market.abd.h1": "US stock market technical analysis and signals",
  "market.bist.h1": "Borsa Istanbul technical analysis and signals",
  "market.emtia.h1": "Forex and commodity technical analysis",

  "market.kripto.aboutTitle": "How to read technical analysis in crypto",
  "market.kripto.about":
    "The crypto market trades around the clock, so there are no weekend gaps and indicators work on an unbroken series. The table lists the last price, daily change and traded volume for each pair; opening a row computes 16 indicators, support and resistance levels, chart patterns and a trade plan for that pair. Because volatility is high, the stop distance is widened according to ATR.",
  "market.abd.aboutTitle": "How signals are produced for US stocks",
  "market.abd.about":
    "The US market trades on weekdays during set hours, so a signal produced after the close can change at the next open. The list contains the indices and the most traded stocks. For each stock, trend (EMA, Supertrend, ADX), momentum (RSI, MACD, Stochastic), volatility (Bollinger, ATR) and volume indicators each cast a vote; the signal is the weighted average of those votes.",
  "market.bist.aboutTitle": "Technical analysis for BIST stocks",
  "market.bist.about":
    "Signals for Borsa Istanbul stocks are produced from daily closing data. The table lists the BIST 100 and BIST 30 indices along with the most traded stocks. Each score runs from −100 to +100: +45 and above is a strong buy, −45 and below a strong sell, and the band in between marks an undecided market, shown as WAIT.",
  "market.emtia.aboutTitle": "Technical analysis for forex, gold and oil",
  "market.emtia.about":
    "Exchange rates come from the European Central Bank's daily reference rates. That series carries closing values only, so indicators that depend on the intraday high and low (ATR, Stochastic, Williams %R) stay narrow here, while close-based ones (RSI, MACD, EMA, Bollinger) work fully. Gold, silver and oil use full candle data.",

  "market.methodology":
    "Every indicator is computed on our own servers from open formulas; no ready-made signals are bought from anyone. The score comes from a weighted vote of the indicators and always returns the same result for the same data. These signals are not investment advice.",

  "market.kripto.faq1.q": "Which timeframes are crypto signals produced on?",
  "market.kripto.faq1.a":
    "Eight timeframes, from one minute to one week. Shorter ones produce more signals but also more noise; the 4-hour and daily timeframes are more reliable for following a trend.",
  "market.kripto.faq2.q": "How fresh is the data?",
  "market.kripto.faq2.a":
    "Crypto prices refresh within seconds, and the last closed candle is used when the page loads. The update time on each row shows the real age of the data.",
  "market.kripto.faq3.q": "Is a signal a decision to buy or sell?",
  "market.kripto.faq3.a":
    "No. A signal summarises what the indicators say at that moment; it knows nothing about your risk tolerance, position size or the news. It is not investment advice.",

  "market.abd.faq1.q": "Is the stock data real time?",
  "market.abd.faq1.a":
    "The free data tier provides daily closing data, not live intraday prices. Each row states when its data was last updated.",
  "market.abd.faq2.q": "Which stocks are listed?",
  "market.abd.faq2.a":
    "The indices and the most traded stocks come in the ready-made list. Any stock outside it can be found through search, and its analysis is computed the moment you open it.",
  "market.abd.faq3.q": "Do signals change while the market is closed?",
  "market.abd.faq3.a":
    "A signal stays fixed while the market is closed, since it is computed from the last close. An opening gap can move the indicators, so expect it to refresh at the open.",

  "market.bist.faq1.q": "Which indicators are used for BIST stocks?",
  "market.bist.faq1.a":
    "The same 16 as everywhere else: RSI, MACD, EMA 9/21/50/200, Bollinger, Stochastic, ATR, ADX, Supertrend, OBV, MFI, CCI, Williams %R, ROC, VWAP and volume ratio.",
  "market.bist.faq2.q": "Are dividends and splits reflected in the prices?",
  "market.bist.faq2.a":
    "The provider's adjusted close series is used, so gaps caused by dividends and splits arrive already corrected.",
  "market.bist.faq3.q": "Is the analysis available in English?",
  "market.bist.faq3.a":
    "Yes. Indicator commentary and the trade plan are produced in both Turkish and English, and the interface is available in eight languages.",

  "market.emtia.faq1.q": "Where does the USD/TRY rate come from?",
  "market.emtia.faq1.a":
    "From the European Central Bank's reference rates, published every business day. No new rate is published on weekends and holidays; the last business day's rate applies.",
  "market.emtia.faq2.q": "Is the gold price per gram or per ounce?",
  "market.emtia.faq2.a":
    "Gold and silver are shown at the international ounce/dollar price (XAU/USD, XAG/USD); converting to grams or another currency is up to you.",
  "market.emtia.faq3.q": "Which type of oil is listed?",
  "market.emtia.faq3.a":
    "Both WTI and Brent. The gap between them comes from regional supply conditions, and their signals can diverge.",

  "nav.home": "Home",
  /* ── Plans and credits ── */
  "nav.plans": "Pricing",
  "nav.subscription": "My plan",

  "plan.ucretsiz": "Free",
  "plan.basic": "Basic",
  "plan.premium": "Premium",
  "plan.ultimate": "Ultimate",
  "plan.vurgu.dakikalik": "1-minute and 5-minute timeframes unlocked",
  "plan.vurgu.oncelik": "Priority email support",

  "plans.title": "Plans and pricing",
  "plans.sub":
    "One credit per analysis; browsing lists, market pages and search costs nothing.",
  "plans.free": "Free",
  "plans.perMonth": "/mo",
  "plans.creditLine": "analysis credits / month",
  "plans.scanLine": "Up to {count} assets per scan",
  "plans.watchLine": "Watchlist of {count} assets",
  "plans.intervalLine": "Timeframes: {list}",
  "plans.popular": "Most chosen",
  "plans.current": "Your current plan",
  "plans.choose": "Choose this plan",
  "plans.start": "Start free",
  "plans.downgrade": "Back to the free plan",
  "plans.changed": "Your plan has been updated.",
  "plans.detailLink": "See plan details and credit rules",
  "plans.paymentClosed":
    "The payment provider is not connected yet, so paid plans cannot be activated right now. Once it is, upgrading will be a single step on this page.",
  "plans.creditTitle": "How credits work",
  "plans.creditSub": "Credits pay for detailed analysis, not for browsing.",
  "plans.credit.1": "A detailed analysis of one asset costs 1 credit.",
  "plans.credit.2":
    "Reopening the same asset on the same timeframe within 30 minutes is free; refreshing the page never costs a credit.",
  "plans.credit.3":
    "One run of the signal scanner costs 1 credit — no matter how many assets it scans.",
  "plans.credit.4": "Price lists, market pages and search cost nothing.",
  "plans.credit.5": "Credits renew every month; unused credits do not roll over.",
  "plans.faq.q1": "When exactly is a credit spent?",
  "plans.faq.a1":
    "When you open an asset's analysis page and when you run the signal scanner. If the analysis fails because of a data error, the credit is refunded.",
  "plans.faq.q2": "What happens when I run out of credits?",
  "plans.faq.a2":
    "New analyses stop until the period renews; price lists, market pages, search and your watchlist stay open.",
  "plans.faq.q3": "Can I change my plan at any time?",
  "plans.faq.a3":
    "Yes. An upgrade starts a fresh credit period, and returning to the free plan is always allowed.",
  "plans.faq.q4": "How does payment work?",
  "plans.faq.a4":
    "The payment provider is not connected yet, so only the free plan is available at the moment. Paid plans will open on this same page once it is.",

  "sub.title": "My plan",
  "sub.sub": "Your plan, remaining credits and upgrade options.",
  "sub.currentPlan": "Current plan",
  "sub.noLedger":
    "The credit ledger cannot be read right now. Your analyses keep working; the counter appears once the database is connected.",

  "credit.remaining": "credits left",
  "credit.renews": "Renews on {date}",
  "credit.scanLimit": "{count} assets per scan",
  "credit.watchLimit": "{count} assets on the watchlist",
  "credit.exhausted": "You are out of analysis credits for this period.",
  "credit.upgrade": "See plans",
  "credit.periodLocked": "This timeframe is not in your plan — upgrading unlocks it.",

  "home.stat.languages": "Languages",

  "seo.plans.title": "Plans and pricing",
  "seo.plans.description":
    "Fibonex plans: monthly analysis credits, scanner limits and timeframes. One credit per analysis; browsing lists and market pages is free.",

  "auth.apple": "Sign in with Apple",
  "auth.appleRegister": "Sign up with Apple",
};
