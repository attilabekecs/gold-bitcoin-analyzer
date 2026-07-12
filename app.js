const state = {
  assets: {
    bitcoin: null,
    gold: null,
  },
  news: [],
  sentiment: { score: 0, label: "Semleges" },
  selectedAsset: "bitcoin",
  selectedTradeAsset: "bitcoin",
  charts: {},
  intradayChart: null,
  intraday: {
    bitcoin: null,
    gold: null,
  },
  timeframe: 30,
  exchangeRates: { USD: 1, EUR: 1, HUF: 1 },
  settings: null,
  portfolio: [],
  alerts: [],
  dataHealth: {
    bitcoin: "pending",
    gold: "pending",
    news: "pending",
    fx: "pending",
  },
  refreshTimer: null,
  intradayTimer: null,
};

const endpoints = {
  goldSpot: "https://api.gold-api.com/price/XAU",
  goldHistory: "https://freegoldapi.com/data/latest.json",
  exchangeRates: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,HUF",
  newsBase: "https://api.gdeltproject.org/api/v2/doc/doc",
};

const positiveWords = [
  "gain", "gains", "growth", "rise", "rises", "rally", "surge", "record", "high",
  "bull", "bullish", "buy", "strong", "recovery", "adoption", "approve", "approved",
  "inflow", "optimism", "breakout", "upside", "boost", "safe haven",
];

const negativeWords = [
  "loss", "losses", "fall", "falls", "drop", "drops", "crash", "low", "bear",
  "bearish", "sell", "weak", "fear", "ban", "hack", "fraud", "outflow", "risk",
  "warning", "decline", "downside", "liquidation", "lawsuit", "uncertainty",
];

document.addEventListener("DOMContentLoaded", () => {
  state.settings = loadSettings();
  state.portfolio = loadLocalArray("aurum-portfolio");
  state.alerts = loadLocalArray("aurum-alerts");
  document.getElementById("year").textContent = new Date().getFullYear();
  document.getElementById("portfolioDate").valueAsDate = new Date();
  document.getElementById("refreshButton").addEventListener("click", loadDashboard);
  document.getElementById("copyPromptButton").addEventListener("click", copyAnalysisPrompt);
  document.getElementById("aiAnalyzeButton").addEventListener("click", requestAiAnalysis);
  document.getElementById("settingsButton").addEventListener("click", openSettings);
  document.getElementById("closeSettingsButton").addEventListener("click", closeSettings);
  document.getElementById("settingsForm").addEventListener("submit", saveSettings);
  document.getElementById("resetSettingsButton").addEventListener("click", resetSettings);
  document.getElementById("portfolioForm").addEventListener("submit", addPortfolioEntry);
  document.getElementById("alertForm").addEventListener("submit", addAlert);
  document.getElementById("notificationButton").addEventListener("click", requestNotifications);
  ["riskCapital", "riskPercent", "riskEntry", "riskStop", "riskTarget"].forEach((id) => {
    document.getElementById(id).addEventListener("input", calculateRisk);
  });
  document.querySelectorAll("[data-indicator-asset]").forEach((button) => {
    button.addEventListener("click", () => selectIndicatorAsset(button.dataset.indicatorAsset));
  });
  document.querySelectorAll("[data-timeframe]").forEach((button) => {
    button.addEventListener("click", () => selectTimeframe(Number(button.dataset.timeframe)));
  });
  document.querySelectorAll("[data-trade-asset]").forEach((button) => {
    button.addEventListener("click", () => selectTradeAsset(button.dataset.tradeAsset));
  });
  applySettings();
  renderPortfolio();
  renderAlerts();
  calculateRisk();
  loadDashboard();
});

async function loadDashboard() {
  setLoading(true);
  hideError();

  const [
    bitcoinResult,
    goldResult,
    newsResult,
    ratesResult,
    bitcoinIntradayResult,
    goldIntradayResult,
  ] = await Promise.allSettled([
    fetchBitcoin(),
    fetchGold(),
    fetchNews(),
    fetchExchangeRates(),
    fetchBitcoinIntraday(),
    fetchGoldIntraday(),
  ]);

  const errors = [];

  if (bitcoinResult.status === "fulfilled") {
    state.assets.bitcoin = bitcoinResult.value;
    state.dataHealth.bitcoin = "ok";
  } else {
    errors.push("A Bitcoin-adatok most nem érhetők el.");
    state.assets.bitcoin = null;
    state.dataHealth.bitcoin = "error";
  }

  if (goldResult.status === "fulfilled") {
    state.assets.gold = goldResult.value;
    state.dataHealth.gold = goldResult.value.warning ? "warning" : "ok";
  } else {
    errors.push("Az aranyadatok most nem érhetők el.");
    state.assets.gold = null;
    state.dataHealth.gold = "error";
  }

  if (newsResult.status === "fulfilled") {
    state.news = newsResult.value;
    state.sentiment = analyzeSentiment(state.news);
    state.dataHealth.news = state.news.length ? "ok" : "warning";
  } else {
    errors.push("A hírfolyam most nem érhető el.");
    state.news = [];
    state.sentiment = { score: 0, label: "Semleges" };
    state.dataHealth.news = "error";
  }

  if (ratesResult.status === "fulfilled") {
    state.exchangeRates = { USD: 1, ...ratesResult.value };
    state.dataHealth.fx = "ok";
  } else {
    state.exchangeRates = { USD: 1, EUR: 1, HUF: 1 };
    state.dataHealth.fx = state.settings.currency === "USD" ? "warning" : "error";
    if (state.settings.currency !== "USD") errors.push("A devizaátváltás most nem érhető el.");
  }

  state.intraday.bitcoin =
    bitcoinIntradayResult.status === "fulfilled" ? bitcoinIntradayResult.value : null;
  state.intraday.gold =
    goldIntradayResult.status === "fulfilled" ? goldIntradayResult.value : null;

  ["bitcoin", "gold"].forEach((assetKey) => {
    const asset = state.assets[assetKey];
    if (asset) {
      asset.analysis = analyzeAsset(asset, assetSpecificSentiment(assetKey));
      renderAsset(assetKey);
    } else {
      renderUnavailableAsset(assetKey);
    }
  });

  renderSentiment();
  renderNews();
  renderIndicators(state.selectedAsset);
  renderTradingCenter();
  renderPortfolio();
  renderDataHealth();
  checkAlerts();

  if (errors.length) showError(errors.join(" "));
  document.getElementById("lastUpdated").textContent = new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date());
  setLoading(false, errors.length >= 4);
}

async function fetchJson(url, timeout = 12000, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBitcoin() {
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${state.timeframe}&interval=daily`;
  const headers = state.settings.coinGeckoKey
    ? { "x-cg-demo-api-key": state.settings.coinGeckoKey }
    : {};
  const data = await fetchJson(url, 12000, headers);
  const points = (data.prices || [])
    .map(([time, price]) => ({ time: Number(time), price: Number(price) }))
    .filter((point) => Number.isFinite(point.price));

  if (points.length < Math.min(7, state.timeframe)) throw new Error("Nincs elegendő Bitcoin-adat");
  return buildAsset("Bitcoin", points, points.at(-1).price);
}

async function fetchBitcoinIntraday() {
  const data = await fetchJson(
    "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1",
    12000,
  );
  if (data.error?.length) throw new Error(data.error.join(", "));
  const series = Object.entries(data.result || {}).find(([key, value]) => {
    return key !== "last" && Array.isArray(value);
  })?.[1];
  const candles = (series || [])
    .slice(-180)
    .map((item) => ({
      time: Number(item[0]) * 1000,
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
      volume: Number(item[6]),
    }))
    .filter(isValidCandle);
  if (candles.length < 30) throw new Error("Nincs elegendő 1 perces Bitcoin-adat");
  return buildIntradayAsset("Bitcoin", candles, "Kraken · 1p");
}

async function fetchGoldIntraday() {
  if (!state.settings.twelveDataKey) return null;
  const params = new URLSearchParams({
    symbol: "XAU/USD",
    interval: "1min",
    outputsize: "180",
    apikey: state.settings.twelveDataKey,
  });
  const data = await fetchJson(`https://api.twelvedata.com/time_series?${params}`, 15000);
  if (data.status === "error") throw new Error(data.message || "Twelve Data hiba");
  const candles = (data.values || [])
    .map((item) => ({
      time: new Date(`${item.datetime}Z`).getTime(),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: Number(item.volume || 0),
    }))
    .filter(isValidCandle)
    .sort((left, right) => left.time - right.time);
  if (candles.length < 30) throw new Error("Nincs elegendő 1 perces aranyadat");
  return buildIntradayAsset("Arany", candles, "Twelve Data · 1p");
}

function isValidCandle(candle) {
  return (
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close)
  );
}

function buildIntradayAsset(name, candles, source) {
  return {
    name,
    candles,
    source,
    currentPrice: candles.at(-1).close,
    updatedAt: candles.at(-1).time,
  };
}

async function fetchGold() {
  if (state.settings.twelveDataKey) {
    try {
      const outputSize = Math.min(state.timeframe, 365);
      const url = `https://api.twelvedata.com/time_series?symbol=XAU%2FUSD&interval=1day&outputsize=${outputSize}&apikey=${encodeURIComponent(state.settings.twelveDataKey)}`;
      const data = await fetchJson(url, 15000);
      if (data.status === "error") throw new Error(data.message);
      const points = (data.values || [])
        .map((item) => ({ time: new Date(item.datetime).getTime(), price: Number(item.close) }))
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price))
        .sort((a, b) => a.time - b.time);
      if (points.length >= 7) return buildAsset("Arany", points, points.at(-1).price);
    } catch {
      state.dataHealth.gold = "warning";
    }
  }

  const [spotResult, historyResult] = await Promise.allSettled([
    fetchJson(endpoints.goldSpot),
    fetchJson(endpoints.goldHistory, 18000),
  ]);

  let points = [];
  if (historyResult.status === "fulfilled" && Array.isArray(historyResult.value)) {
    points = historyResult.value
      .map((item) => ({
        time: new Date(item.date).getTime(),
        price: Number(item.price),
      }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price))
      .sort((a, b) => a.time - b.time)
      .slice(-state.timeframe);
  }

  const spotData = spotResult.status === "fulfilled" ? spotResult.value : null;
  const spotPrice = Number(spotData?.price);

  const lastHistorical = points.at(-1);
  const historyAgeDays = lastHistorical
    ? (Date.now() - lastHistorical.time) / 86400000
    : Infinity;
  const historyIsFresh = historyAgeDays <= 5;

  if (!historyIsFresh) points = [];

  if (Number.isFinite(spotPrice)) {
    const today = new Date().setHours(12, 0, 0, 0);
    const lastPoint = points.at(-1);
    if (!lastPoint || Math.abs(today - lastPoint.time) > 18 * 60 * 60 * 1000) {
      points.push({ time: today, price: spotPrice });
    } else {
      lastPoint.price = spotPrice;
    }
  }

  if (!points.length) throw new Error("Nincs elérhető aranyadat");
  const asset = buildAsset("Arany", points, Number.isFinite(spotPrice) ? spotPrice : points.at(-1).price);
  asset.warning = !historyIsFresh;
  return asset;
}

function buildAsset(name, points, currentPrice) {
  const previousPoint = points.at(-2);
  const previousIsRecent = previousPoint
    ? Math.abs(points.at(-1).time - previousPoint.time) <= 4 * 86400000
    : false;
  const change = previousIsRecent && previousPoint.price
    ? ((currentPrice - previousPoint.price) / previousPoint.price) * 100
    : null;
  return {
    name,
    points,
    prices: points.map((point) => point.price),
    currentPrice,
    change,
  };
}

async function fetchNews() {
  const cutoffTime = Date.now() - 7 * 86400000;
  const queries = [
    "bitcoin cryptocurrency sourcelang:english",
    "gold bullion sourcelang:english",
  ];
  const results = await Promise.allSettled(
    queries.map((query) => {
      const params = new URLSearchParams({
        query,
        mode: "artlist",
        maxrecords: "8",
        timespan: "48h",
        format: "json",
        sort: "datedesc",
      });
      return fetchJson(`${endpoints.newsBase}?${params}`, 10000);
    }),
  );
  const articles = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value.articles || []);
  const freshEnglishArticles = articles.filter((article) => {
    const language = String(article.language || "English").toLowerCase();
    const seenAt = parseGdeltDate(article.seendate).getTime();
    return language === "english" && seenAt >= cutoffTime;
  });
  if (!freshEnglishArticles.length) {
    try {
      const googleNewsRss =
        'https://news.google.com/rss/search?q=bitcoin%20OR%20%22gold%20price%22%20OR%20bullion&hl=en-US&gl=US&ceid=US:en';
      const rssData = await fetchJson(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleNewsRss)}`,
        8000,
      );
      const rssArticles = (rssData.items || [])
        .filter(
          (article) =>
            article.title &&
            isSafeHttpUrl(article.link) &&
            isMarketNewsTitle(article.title) &&
            new Date(`${article.pubDate}Z`).getTime() >= cutoffTime,
        )
        .map((article) => ({
          title: article.title.trim(),
          url: article.link,
          domain: extractNewsSource(article.title),
          date: new Date(`${article.pubDate}Z`),
        }))
        .slice(0, 12);
      if (rssArticles.length) return rssArticles;
    } catch {
      // Continue with the final keyless fallback.
    }

    try {
      const cutoffSeconds = Math.floor(cutoffTime / 1000);
      const fallback = await fetchJson(
        `https://hn.algolia.com/api/v1/search_by_date?query=bitcoin%20gold&tags=story&numericFilters=created_at_i%3E${cutoffSeconds}&hitsPerPage=12`,
        8000,
      );
      const fallbackArticles = (fallback.hits || [])
        .filter(
          (article) =>
            article.title &&
            isSafeHttpUrl(article.url) &&
            new Date(article.created_at).getTime() >= cutoffTime,
        )
        .map((article) => ({
          title: article.title.trim(),
          url: article.url,
          domain: new URL(article.url).hostname.replace("www.", ""),
          date: new Date(article.created_at),
        }));
      if (fallbackArticles.length) return fallbackArticles;
    } catch {
      // The normal error below gives the user a useful fallback link.
    }
    throw new Error("A hírforrás nem válaszol");
  }
  const seen = new Set();
  return freshEnglishArticles
    .filter((article) => article.title && isSafeHttpUrl(article.url))
    .filter((article) => {
      const key = article.url || article.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => parseGdeltDate(b.seendate) - parseGdeltDate(a.seendate))
    .slice(0, 12)
    .map((article) => ({
      title: article.title.trim(),
      url: article.url,
      domain: article.domain || new URL(article.url).hostname.replace("www.", ""),
      date: parseGdeltDate(article.seendate),
    }));
}

function isMarketNewsTitle(title) {
  const value = title.toLowerCase();
  if (/\b(bitcoin|btc|cryptocurrency|crypto market)\b/.test(value)) return true;
  return (
    /\b(gold|bullion|xau)\b/.test(value) &&
    /\b(price|market|invest|inflation|rate|dollar|bank|trading|ounce|forecast|rally|fall|rise)\b/.test(value)
  );
}

function extractNewsSource(title) {
  const parts = title.split(" - ");
  return parts.length > 1 ? parts.at(-1).trim() : "Google News";
}

async function fetchExchangeRates() {
  const data = await fetchJson(endpoints.exchangeRates, 8000);
  if (!data.rates?.EUR || !data.rates?.HUF) throw new Error("Hiányzó devizaadat");
  return data.rates;
}

function parseGdeltDate(value) {
  if (!value) return new Date();
  const normalized = String(value).replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
    "$1-$2-$3T$4:$5:$6Z",
  );
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function isSafeHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function calculateRsi(prices, period = 14) {
  if (prices.length <= period) return null;
  const recent = prices.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < recent.length; index += 1) {
    const difference = recent[index] - recent[index - 1];
    if (difference >= 0) gains += difference;
    else losses += Math.abs(difference);
  }

  if (losses === 0) return 100;
  const relativeStrength = gains / period / (losses / period);
  return 100 - 100 / (1 + relativeStrength);
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function exponentialMovingAverage(values, period) {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let result = average(values.slice(0, period));
  values.slice(period).forEach((value) => {
    result = (value - result) * multiplier + result;
  });
  return result;
}

function standardDeviation(values) {
  if (!values.length) return null;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function analyzeAsset(asset, sentimentScore) {
  const { prices } = asset;
  const rsi = calculateRsi(prices);
  const sma7 = average(prices.slice(-7));
  const sma21 = prices.length >= 21 ? average(prices.slice(-21)) : null;
  const momentumBase = prices.at(-8);
  const momentum = momentumBase ? ((prices.at(-1) - momentumBase) / momentumBase) * 100 : null;
  const ema12 = exponentialMovingAverage(prices, 12);
  const ema26 = exponentialMovingAverage(prices, 26);
  const macd = ema12 !== null && ema26 !== null ? ema12 - ema26 : null;
  const bollingerValues = prices.length >= 20 ? prices.slice(-20) : [];
  const bollingerMiddle = average(bollingerValues);
  const bollingerDeviation = standardDeviation(bollingerValues);
  const bollingerUpper =
    bollingerMiddle !== null && bollingerDeviation !== null
      ? bollingerMiddle + bollingerDeviation * 2
      : null;
  const bollingerLower =
    bollingerMiddle !== null && bollingerDeviation !== null
      ? bollingerMiddle - bollingerDeviation * 2
      : null;
  const recentLevels = prices.slice(-Math.min(30, prices.length));
  const support = recentLevels.length >= 7 ? Math.min(...recentLevels) : null;
  const resistance = recentLevels.length >= 7 ? Math.max(...recentLevels) : null;
  let score = 0;
  const reasons = [];

  if (rsi !== null) {
    if (rsi < 35) {
      score += 1;
      reasons.push("RSI: túladott");
    } else if (rsi > 65) {
      score -= 1;
      reasons.push("RSI: túlvett");
    } else {
      reasons.push("RSI: semleges");
    }
  }

  if (sma7 !== null && sma21 !== null) {
    if (sma7 > sma21) {
      score += 1;
      reasons.push("Emelkedő átlagtrend");
    } else {
      score -= 1;
      reasons.push("Csökkenő átlagtrend");
    }
  } else {
    reasons.push("Korlátozott előzmény");
  }

  if (momentum !== null) {
    if (momentum > 1) score += 1;
    else if (momentum < -1) score -= 1;
    reasons.push(`7 nap: ${formatPercent(momentum)}`);
  }

  if (macd !== null) {
    if (macd > 0) score += 0.5;
    else if (macd < 0) score -= 0.5;
    reasons.push(macd >= 0 ? "MACD: pozitív" : "MACD: negatív");
  }

  if (bollingerUpper !== null && bollingerLower !== null) {
    if (prices.at(-1) <= bollingerLower) score += 0.5;
    else if (prices.at(-1) >= bollingerUpper) score -= 0.5;
  }

  if (sentimentScore > 0.2) {
    score += 0.5;
    reasons.push("Pozitív hírek");
  } else if (sentimentScore < -0.2) {
    score -= 0.5;
    reasons.push("Negatív hírek");
  }

  let signal = "Tartás";
  let className = "neutral";
  if (score >= 2) {
    signal = "Vételi jelzés";
    className = "positive";
  } else if (score <= -2) {
    signal = "Eladási jelzés";
    className = "negative";
  }

  const dataCompleteness =
    [rsi, sma21, momentum, macd, bollingerUpper].filter((value) => value !== null).length / 5;
  let confidence = Math.round(Math.min(86, 44 + Math.abs(score) * 11 + dataCompleteness * 12));
  if (prices.length < 7) {
    signal = "Nincs elég adat";
    className = "neutral";
    confidence = 15;
    reasons.unshift("Csak aktuális ár érhető el");
  }

  return {
    rsi,
    sma7,
    sma21,
    momentum,
    macd,
    bollingerUpper,
    bollingerLower,
    support,
    resistance,
    score,
    signal,
    className,
    confidence,
    reasons,
  };
}

function analyzeIntraday(assetKey) {
  const intraday = state.intraday[assetKey];
  if (!intraday) return buildDailyTradeFallback(assetKey);

  const candles = intraday.candles;
  const closes = candles.map((candle) => candle.close);
  const currentPrice = closes.at(-1);
  const ema9 = exponentialMovingAverage(closes, 9);
  const ema21 = exponentialMovingAverage(closes, 21);
  const ema12 = exponentialMovingAverage(closes, 12);
  const ema26 = exponentialMovingAverage(closes, 26);
  const macd = ema12 !== null && ema26 !== null ? ema12 - ema26 : null;
  const rsi = calculateRsi(closes);
  const atr = calculateAtr(candles, 14);
  const minuteBase = closes.at(-2);
  const momentumBase = closes.at(-16);
  const minuteChange = minuteBase ? ((currentPrice - minuteBase) / minuteBase) * 100 : null;
  const momentum15 = momentumBase ? ((currentPrice - momentumBase) / momentumBase) * 100 : null;
  const volumes = candles.map((candle) => candle.volume).filter((volume) => volume > 0);
  const averageVolume = average(volumes.slice(-31, -1));
  const volumeRatio =
    averageVolume && candles.at(-1).volume > 0 ? candles.at(-1).volume / averageVolume : null;
  const dailyClass = state.assets[assetKey]?.analysis?.className;
  let score = 0;
  const reasons = [];

  if (ema9 !== null && ema21 !== null) {
    if (ema9 > ema21) {
      score += 1.5;
      reasons.push("EMA 9 a 21 felett");
    } else {
      score -= 1.5;
      reasons.push("EMA 9 a 21 alatt");
    }
  }

  if (rsi !== null) {
    if (rsi > 72) {
      score -= 1;
      reasons.push("RSI túlvett");
    } else if (rsi < 28) {
      score += 0.5;
      reasons.push("RSI túladott, fordulat még nem biztos");
    } else if (rsi >= 52 && rsi <= 68) {
      score += 0.75;
      reasons.push("RSI támogatja az emelkedést");
    } else if (rsi < 45) {
      score -= 0.5;
      reasons.push("RSI gyenge");
    }
  }

  if (macd !== null) {
    score += macd >= 0 ? 1 : -1;
    reasons.push(macd >= 0 ? "Pozitív MACD" : "Negatív MACD");
  }

  if (momentum15 !== null) {
    if (momentum15 > 0.12) score += 1;
    else if (momentum15 < -0.12) score -= 1;
    reasons.push(`15 perces lendület: ${formatPercent(momentum15)}`);
  }

  if (dailyClass === "positive") {
    score += 1;
    reasons.push("A napi trend is pozitív");
  } else if (dailyClass === "negative") {
    score -= 1;
    reasons.push("A napi trend is negatív");
  } else {
    reasons.push("A napi trend nem erősít meg irányt");
  }

  if (volumeRatio !== null && volumeRatio > 1.3 && minuteChange !== null) {
    score += minuteChange >= 0 ? 0.5 : -0.5;
    reasons.push("Átlag feletti forgalom");
  }

  let signal = "KIVÁRÁS";
  let className = "neutral";
  if (score >= 2.5) {
    signal = "VÉTELI JEL";
    className = "positive";
  } else if (score <= -2.5) {
    signal = "ELADÁSI JEL";
    className = "negative";
  }

  const ageMinutes = Math.max(0, (Date.now() - intraday.updatedAt) / 60000);
  let confidence = Math.round(Math.min(88, 46 + Math.abs(score) * 7));
  if (ageMinutes > 5) confidence = Math.min(confidence, 45);

  const hasPlan = className !== "neutral" && atr !== null;
  const isBuy = className === "positive";
  const entryLow = hasPlan ? currentPrice - atr * (isBuy ? 0.2 : 0.1) : null;
  const entryHigh = hasPlan ? currentPrice + atr * (isBuy ? 0.1 : 0.2) : null;
  const stop = hasPlan ? currentPrice + atr * (isBuy ? -1.5 : 1.5) : null;
  const target = hasPlan ? currentPrice + atr * (isBuy ? 3 : -3) : null;

  const summaries = {
    positive:
      "A rövid és napi trend elegendő megerősítést ad egy óvatos vételi forgatókönyvhöz. Csak a jelzett stop mellett mérlegeld.",
    negative:
      "A rövid távú technikai kép gyenge. Új vétel most nem indokolt; meglévő pozíciónál a kockázat csökkentése mérlegelhető.",
    neutral:
      "Nincs elég egyirányú megerősítés. Most a kivárás fegyelmezettebb döntés, mint egy új pozíció nyitása.",
  };

  return {
    signal,
    className,
    confidence,
    currentPrice,
    minuteChange,
    momentum15,
    ema9,
    ema21,
    rsi,
    atr,
    entryLow,
    entryHigh,
    stop,
    target,
    riskReward: hasPlan ? 2 : null,
    reasons,
    summary: summaries[className],
    source: intraday.source,
    updatedAt: intraday.updatedAt,
    hasIntraday: true,
  };
}

function buildDailyTradeFallback(assetKey) {
  const asset = state.assets[assetKey];
  const analysis = asset?.analysis;
  if (!asset || !analysis) return null;
  const signalMap = {
    positive: "VÉTELI JEL",
    negative: "ELADÁSI JEL",
    neutral: "KIVÁRÁS",
  };
  return {
    signal: signalMap[analysis.className] || "KIVÁRÁS",
    className: analysis.className,
    confidence: Math.min(50, analysis.confidence),
    currentPrice: asset.currentPrice,
    minuteChange: null,
    momentum15: null,
    ema9: null,
    ema21: null,
    rsi: analysis.rsi,
    atr: null,
    entryLow: null,
    entryHigh: null,
    stop: null,
    target: null,
    riskReward: null,
    reasons: ["Nincs 1 perces adat", ...analysis.reasons],
    summary:
      "Csak a lassabb napi adatok érhetők el, ezért ez nem alkalmas azonnali belépési döntésre.",
    source: assetKey === "gold" ? "Napi adat · Twelve Data kulcs szükséges" : "Napi tartalékadat",
    updatedAt: Date.now(),
    hasIntraday: false,
  };
}

function calculateAtr(candles, period) {
  if (candles.length <= period) return null;
  const ranges = candles.slice(-period).map((candle, index, selected) => {
    const sourceIndex = candles.length - period + index;
    const previousClose =
      sourceIndex > 0 ? candles[sourceIndex - 1].close : selected[index].open;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  return average(ranges);
}

function exponentialMovingAverageSeries(values, period) {
  const result = Array(values.length).fill(null);
  if (values.length < period) return result;
  const multiplier = 2 / (period + 1);
  let ema = average(values.slice(0, period));
  result[period - 1] = ema;
  for (let index = period; index < values.length; index += 1) {
    ema = (values[index] - ema) * multiplier + ema;
    result[index] = ema;
  }
  return result;
}

function analyzeSentiment(articles) {
  if (!articles.length) return { score: 0, label: "Semleges" };
  const scores = articles.map((article) => scoreText(article.title));
  const score = scores.reduce((sum, value) => sum + value, 0) / articles.length;
  return { score, label: sentimentLabel(score) };
}

function assetSpecificSentiment(assetKey) {
  const keywords =
    assetKey === "bitcoin" ? ["bitcoin", "crypto", "btc"] : ["gold", "bullion", "xau"];
  const relevant = state.news.filter((article) => {
    const title = article.title.toLowerCase();
    return keywords.some((keyword) => title.includes(keyword));
  });
  return analyzeSentiment(relevant.length ? relevant : state.news).score;
}

function scoreText(text) {
  const normalized = text.toLowerCase();
  const positive = positiveWords.filter((word) => normalized.includes(word)).length;
  const negative = negativeWords.filter((word) => normalized.includes(word)).length;
  if (positive + negative === 0) return 0;
  return (positive - negative) / (positive + negative);
}

function sentimentLabel(score) {
  if (score > 0.2) return "Pozitív";
  if (score < -0.2) return "Negatív";
  return "Semleges";
}

function renderAsset(assetKey) {
  const asset = state.assets[assetKey];
  const prefix = assetKey === "bitcoin" ? "btc" : "gold";
  const currency = state.settings.currency;
  document.getElementById(`${prefix}Price`).textContent = formatNumber(
    convertCurrency(asset.currentPrice),
    currency === "HUF" ? 0 : 2,
  );
  document.getElementById(`${prefix}Pair`).textContent =
    `${assetKey === "bitcoin" ? "BTC" : "GOLD"} / ${currency}`;
  document.getElementById(`${prefix}Currency`).textContent =
    `${currency}${assetKey === "gold" ? " / uncia" : ""}`;

  const changeElement = document.getElementById(`${prefix}Change`);
  changeElement.textContent = asset.change === null ? "Nincs friss előzmény" : formatPercent(asset.change);
  changeElement.className = `change ${valueClass(asset.change)}`;

  const signalElement = document.getElementById(`${prefix}Signal`);
  signalElement.textContent = asset.analysis.signal;
  signalElement.className = `signal ${asset.analysis.className}`;
  document.getElementById(`${prefix}Confidence`).textContent = `${asset.analysis.confidence}%`;

  const reasonsElement = document.getElementById(`${prefix}Reasons`);
  const reasons = asset.warning
    ? ["A történeti adat elavult", ...asset.analysis.reasons]
    : asset.analysis.reasons;
  reasonsElement.replaceChildren(
    ...reasons.slice(0, 4).map((reason) => {
      const span = document.createElement("span");
      span.textContent = reason;
      return span;
    }),
  );

  renderChart(assetKey, asset);
}

function renderUnavailableAsset(assetKey) {
  const prefix = assetKey === "bitcoin" ? "btc" : "gold";
  document.getElementById(`${prefix}Price`).textContent = "Nem elérhető";
  document.getElementById(`${prefix}Change`).textContent = "–";
  document.getElementById(`${prefix}Signal`).textContent = "Nincs adat";
  document.getElementById(`${prefix}Confidence`).textContent = "–";
  document.getElementById(`${prefix}Reasons`).replaceChildren();
  state.charts[assetKey]?.destroy();
  delete state.charts[assetKey];
}

function renderChart(assetKey, asset) {
  if (typeof Chart === "undefined") return;
  const canvasId = assetKey === "bitcoin" ? "btcChart" : "goldChart";
  const color = assetKey === "bitcoin" ? "#e2863b" : "#b98a35";
  const context = document.getElementById(canvasId);
  state.charts[assetKey]?.destroy();
  state.charts[assetKey] = new Chart(context, {
    type: "line",
    data: {
      labels: asset.points.map((point) =>
        new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric" }).format(point.time),
      ),
      datasets: [{
        data: asset.prices.map(convertCurrency),
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: createGradient(context, color),
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: { label: (item) => formatMoney(item.raw) },
        },
      },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  });
}

function createGradient(canvas, color) {
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 150);
  gradient.addColorStop(0, `${color}33`);
  gradient.addColorStop(1, `${color}00`);
  return gradient;
}

function selectTradeAsset(assetKey) {
  state.selectedTradeAsset = assetKey;
  document.querySelectorAll("[data-trade-asset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tradeAsset === assetKey);
  });
  renderTradingCenter();
}

function renderTradingCenter() {
  const decisions = {
    bitcoin: analyzeIntraday("bitcoin"),
    gold: analyzeIntraday("gold"),
  };
  updateDecisionShortcut("bitcoin", decisions.bitcoin);
  updateDecisionShortcut("gold", decisions.gold);

  const assetKey = state.selectedTradeAsset;
  const decision = decisions[assetKey];
  const name = assetKey === "bitcoin" ? "Bitcoin" : "Arany";
  const status = document.getElementById("intradayStatus");
  const empty = document.getElementById("intradayEmpty");
  const canvas = document.getElementById("intradayChart");
  document.getElementById("tradeAssetName").textContent = `${name} rövid távú jelzés`;
  document.getElementById("intradayChartTitle").textContent = `${name} · 1 perces`;

  if (!decision) {
    document.getElementById("tradeSignal").textContent = "NINCS ADAT";
    document.getElementById("tradeSignal").className = "trade-signal neutral";
    document.getElementById("tradeSummary").textContent =
      "A technikai jelzéshez szükséges adatok most nem érhetők el.";
    status.className = "live-data-state warning";
    status.querySelector("strong").textContent = "Nincs intraday adat";
    status.querySelector("small").textContent = "Próbáld újra később";
    renderIntradayChart(assetKey, null);
    return;
  }

  const signal = document.getElementById("tradeSignal");
  signal.textContent = decision.signal;
  signal.className = `trade-signal ${decision.className}`;
  document.getElementById("tradePrice").textContent = formatMoney(
    convertCurrency(decision.currentPrice),
  );
  const minuteChange = document.getElementById("tradeMinuteChange");
  minuteChange.textContent =
    decision.minuteChange === null ? "1p: nincs adat" : `1p: ${formatPercent(decision.minuteChange)}`;
  minuteChange.className = valueClass(decision.minuteChange);
  document.getElementById("tradeConfidence").textContent = `${decision.confidence}%`;
  document.getElementById("tradeConfidenceBar").style.width = `${decision.confidence}%`;
  document.getElementById("tradeSummary").textContent = decision.summary;
  document.getElementById("tradeEma").textContent =
    decision.ema9 === null || decision.ema21 === null
      ? "–"
      : decision.ema9 >= decision.ema21
        ? "Emelkedő"
        : "Csökkenő";
  document.getElementById("tradeRsi").textContent =
    decision.rsi === null ? "–" : formatNumber(decision.rsi, 1);
  document.getElementById("tradeMomentum").textContent =
    decision.momentum15 === null ? "–" : formatPercent(decision.momentum15);
  document.getElementById("tradeAtr").textContent =
    decision.atr === null ? "–" : formatMoney(convertCurrency(decision.atr));
  document.getElementById("tradeEntry").textContent =
    decision.entryLow === null
      ? "Nincs aktív belépő"
      : `${formatMoney(convertCurrency(decision.entryLow))} – ${formatMoney(convertCurrency(decision.entryHigh))}`;
  document.getElementById("tradeStop").textContent =
    decision.stop === null ? "–" : formatMoney(convertCurrency(decision.stop));
  document.getElementById("tradeTarget").textContent =
    decision.target === null ? "–" : formatMoney(convertCurrency(decision.target));
  document.getElementById("tradeRiskReward").textContent =
    decision.riskReward === null ? "–" : `1 : ${formatNumber(decision.riskReward, 1)}`;
  document.getElementById("tradeReasons").replaceChildren(
    ...decision.reasons.slice(0, 6).map((reason) => {
      const item = document.createElement("span");
      item.textContent = reason;
      return item;
    }),
  );
  document.getElementById("intradaySource").textContent = decision.source;

  status.className = `live-data-state ${decision.hasIntraday ? "live" : "warning"}`;
  status.querySelector("strong").textContent = decision.hasIntraday
    ? "1 perces adat aktív"
    : "Lassabb adat";
  status.querySelector("small").textContent = decision.hasIntraday
    ? "Automatikus frissítés"
    : "API-kulcs vagy forrás szükséges";
  empty.hidden = decision.hasIntraday;
  canvas.hidden = !decision.hasIntraday;
  renderIntradayChart(assetKey, decision.hasIntraday ? state.intraday[assetKey] : null);
}

function updateDecisionShortcut(assetKey, decision) {
  const element = document.getElementById(
    assetKey === "bitcoin" ? "decisionBtcSignal" : "decisionGoldSignal",
  );
  if (!element) return;
  element.textContent = decision?.signal || "Nincs adat";
  element.className = decision?.className || "neutral";
}

function renderIntradayChart(assetKey, intraday) {
  state.intradayChart?.destroy();
  state.intradayChart = null;
  if (!intraday || typeof Chart === "undefined") {
    document.getElementById("intradayUpdated").textContent =
      "Az intraday diagram jelenleg nem elérhető.";
    return;
  }

  const canvas = document.getElementById("intradayChart");
  const closes = intraday.candles.map((candle) => candle.close);
  const convertedCloses = closes.map(convertCurrency);
  const ema9 = exponentialMovingAverageSeries(closes, 9).map((value) =>
    value === null ? null : convertCurrency(value),
  );
  const ema21 = exponentialMovingAverageSeries(closes, 21).map((value) =>
    value === null ? null : convertCurrency(value),
  );
  const priceColor = assetKey === "bitcoin" ? "#e2863b" : "#b98a35";
  const labels = intraday.candles.map((candle) =>
    new Intl.DateTimeFormat("hu-HU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(candle.time),
  );

  state.intradayChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Ár",
          data: convertedCloses,
          borderColor: priceColor,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.18,
        },
        {
          label: "EMA 9",
          data: ema9,
          borderColor: "#286849",
          borderWidth: 1.2,
          pointRadius: 0,
          tension: 0.18,
        },
        {
          label: "EMA 21",
          data: ema21,
          borderColor: "#b98a35",
          borderDash: [5, 4],
          borderWidth: 1.2,
          pointRadius: 0,
          tension: 0.18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatMoney(item.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#8a8f8b", maxTicksLimit: 8, font: { size: 9 } },
        },
        y: {
          position: "right",
          grid: { color: "rgba(111, 119, 113, 0.12)" },
          ticks: {
            color: "#8a8f8b",
            font: { size: 9 },
            callback: (value) => formatNumber(value, state.settings.currency === "HUF" ? 0 : 2),
          },
        },
      },
    },
  });
  document.getElementById("intradayUpdated").textContent =
    `Utolsó 1 perces gyertya: ${new Intl.DateTimeFormat("hu-HU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(intraday.updatedAt)} · ${intraday.candles.length} gyertya`;
}

async function refreshBitcoinIntraday() {
  try {
    state.intraday.bitcoin = await fetchBitcoinIntraday();
    if (state.selectedTradeAsset === "bitcoin") renderTradingCenter();
  } catch {
    // Keep the last valid intraday series during a temporary source failure.
  }
}

function renderIndicators(assetKey) {
  const analysis = state.assets[assetKey]?.analysis;
  if (!analysis) {
    [
      "indicatorRsi",
      "indicatorSma",
      "indicatorMomentum",
      "indicatorMacd",
      "indicatorBollinger",
      "indicatorLevels",
    ].forEach((id) => {
      document.getElementById(id).textContent = "–";
    });
    return;
  }

  document.getElementById("indicatorRsi").textContent =
    analysis.rsi === null ? "Nincs adat" : analysis.rsi.toFixed(1);
  setPill(
    "indicatorRsiState",
    analysis.rsi === null ? "Nincs adat" : analysis.rsi < 35 ? "Túladott" : analysis.rsi > 65 ? "Túlvett" : "Semleges",
    analysis.rsi === null ? "neutral" : analysis.rsi < 35 ? "positive" : analysis.rsi > 65 ? "negative" : "neutral",
  );

  const smaDifference =
    analysis.sma7 !== null && analysis.sma21 !== null
      ? ((analysis.sma7 - analysis.sma21) / analysis.sma21) * 100
      : null;
  document.getElementById("indicatorSma").textContent =
    smaDifference === null ? "Nincs adat" : formatPercent(smaDifference);
  setPill(
    "indicatorSmaState",
    smaDifference === null ? "Nincs adat" : smaDifference >= 0 ? "Emelkedő" : "Csökkenő",
    smaDifference === null ? "neutral" : valueClass(smaDifference),
  );

  document.getElementById("indicatorMomentum").textContent =
    analysis.momentum === null ? "Nincs adat" : formatPercent(analysis.momentum);
  setPill(
    "indicatorMomentumState",
    analysis.momentum === null ? "Nincs adat" : analysis.momentum > 1 ? "Erősödik" : analysis.momentum < -1 ? "Gyengül" : "Oldalaz",
    analysis.momentum === null ? "neutral" : valueClass(analysis.momentum, 1),
  );

  document.getElementById("indicatorMacd").textContent =
    analysis.macd === null ? "Nincs adat" : formatMoney(convertCurrency(analysis.macd));
  setPill(
    "indicatorMacdState",
    analysis.macd === null ? "Nincs adat" : analysis.macd >= 0 ? "Pozitív" : "Negatív",
    analysis.macd === null ? "neutral" : valueClass(analysis.macd),
  );

  const currentPrice = state.assets[assetKey].currentPrice;
  let bollingerPosition = null;
  if (analysis.bollingerUpper !== null && analysis.bollingerLower !== null) {
    const range = analysis.bollingerUpper - analysis.bollingerLower;
    bollingerPosition = range
      ? ((currentPrice - analysis.bollingerLower) / range) * 100
      : 50;
  }
  document.getElementById("indicatorBollinger").textContent =
    bollingerPosition === null ? "Nincs adat" : `${bollingerPosition.toFixed(0)}%`;
  setPill(
    "indicatorBollingerState",
    bollingerPosition === null
      ? "Nincs adat"
      : bollingerPosition > 90
        ? "Felső sáv"
        : bollingerPosition < 10
          ? "Alsó sáv"
          : "Sávon belül",
    bollingerPosition === null
      ? "neutral"
      : bollingerPosition > 90
        ? "negative"
        : bollingerPosition < 10
          ? "positive"
          : "neutral",
  );

  document.getElementById("indicatorLevels").textContent =
    analysis.support === null
      ? "Nincs adat"
      : `${formatMoney(convertCurrency(analysis.support))} / ${formatMoney(convertCurrency(analysis.resistance))}`;
  setPill(
    "indicatorLevelsState",
    analysis.support === null ? "Nincs adat" : "30 nap",
    "neutral",
  );
}

function setPill(id, text, className) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.className = `pill ${className}`;
}

function selectIndicatorAsset(assetKey) {
  state.selectedAsset = assetKey;
  document.querySelectorAll("[data-indicator-asset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.indicatorAsset === assetKey);
  });
  renderIndicators(assetKey);
}

function renderSentiment() {
  const { score, label } = state.sentiment;
  const badge = document.getElementById("sentimentBadge");
  badge.textContent = label;
  badge.className = `sentiment-badge ${valueClass(score, 0.2)}`;
  const position = Math.max(5, Math.min(95, 50 + score * 40));
  document.getElementById("sentimentNeedle").style.left = `${position}%`;

  const count = state.news.length;
  document.getElementById("sentimentSummary").textContent = count
    ? `${count} friss angol nyelvű cím kulcsszavas vizsgálata alapján a hírek összhangulata ${label.toLowerCase()}. Ez egyszerű becslés, nem teljes szövegű AI-elemzés.`
    : "Nem érkezett elemezhető hír. A jelzések most csak az árfolyamadatokra támaszkodnak.";
}

function renderNews() {
  const grid = document.getElementById("newsGrid");
  grid.replaceChildren();

  if (!state.news.length) {
    const fallback = document.createElement("a");
    fallback.className = "news-card";
    fallback.href = "https://news.google.com/search?q=bitcoin%20OR%20gold";
    fallback.target = "_blank";
    fallback.rel = "noopener noreferrer";
    const title = document.createElement("h3");
    title.textContent = "A hírfolyam átmenetileg nem elérhető";
    const action = document.createElement("span");
    action.textContent = "Hírek megnyitása a Google News oldalán ↗";
    fallback.append(title, action);
    grid.append(fallback);
    return;
  }

  state.news.slice(0, 6).forEach((article) => {
    const card = document.createElement("a");
    card.className = "news-card";
    card.href = article.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const meta = document.createElement("div");
    meta.className = "news-meta";
    const domain = document.createElement("span");
    domain.textContent = article.domain;
    const date = document.createElement("span");
    date.textContent = relativeTime(article.date);
    meta.append(domain, date);

    const title = document.createElement("h3");
    title.textContent = article.title;
    const action = document.createElement("span");
    action.textContent = "Cikk megnyitása ↗";
    card.append(meta, title, action);
    grid.append(card);
  });
}

function relativeTime(date) {
  const hours = Math.max(0, Math.round((Date.now() - date.getTime()) / 3600000));
  if (hours < 1) return "Most";
  if (hours < 24) return `${hours} órája`;
  return `${Math.round(hours / 24)} napja`;
}

function loadSettings() {
  const defaults = {
    currency: "USD",
    refreshMinutes: 5,
    coinGeckoKey: "",
    twelveDataKey: "",
    aiEndpoint: "https://aurum-satoshi-ai.attila-bekecs.workers.dev/analyze",
    aiAccessToken: "",
  };
  try {
    const saved = JSON.parse(localStorage.getItem("aurum-settings") || "{}");
    return {
      ...defaults,
      ...saved,
      aiEndpoint: saved.aiEndpoint || defaults.aiEndpoint,
    };
  } catch {
    return defaults;
  }
}

function loadLocalArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveLocalArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast("A böngésző nem engedte a helyi mentést.");
  }
}

function applySettings() {
  const currency = state.settings.currency;
  document.getElementById("activeCurrency").textContent = currency;
  document.getElementById("riskCapitalLabel").textContent = `Tőke (${currency})`;
  clearInterval(state.refreshTimer);
  clearInterval(state.intradayTimer);
  if (state.settings.refreshMinutes > 0) {
    state.refreshTimer = setInterval(loadDashboard, state.settings.refreshMinutes * 60000);
  }
  state.intradayTimer = setInterval(refreshBitcoinIntraday, 60000);
}

function openSettings() {
  document.getElementById("settingCurrency").value = state.settings.currency;
  document.getElementById("settingRefresh").value = String(state.settings.refreshMinutes);
  document.getElementById("settingCoinGeckoKey").value = state.settings.coinGeckoKey;
  document.getElementById("settingTwelveDataKey").value = state.settings.twelveDataKey;
  document.getElementById("settingAiEndpoint").value = state.settings.aiEndpoint;
  document.getElementById("settingAiAccessToken").value = state.settings.aiAccessToken;
  document.getElementById("settingsDialog").showModal();
}

function closeSettings() {
  document.getElementById("settingsDialog").close();
}

function saveSettings(event) {
  event.preventDefault();
  state.settings = {
    currency: document.getElementById("settingCurrency").value,
    refreshMinutes: Number(document.getElementById("settingRefresh").value),
    coinGeckoKey: document.getElementById("settingCoinGeckoKey").value.trim(),
    twelveDataKey: document.getElementById("settingTwelveDataKey").value.trim(),
    aiEndpoint: document.getElementById("settingAiEndpoint").value.trim(),
    aiAccessToken: document.getElementById("settingAiAccessToken").value.trim(),
  };
  localStorage.setItem("aurum-settings", JSON.stringify(state.settings));
  applySettings();
  closeSettings();
  showToast("Beállítások elmentve.");
  loadDashboard();
}

function resetSettings() {
  localStorage.removeItem("aurum-settings");
  state.settings = loadSettings();
  applySettings();
  closeSettings();
  showToast("Alapbeállítások visszaállítva.");
  loadDashboard();
}

function selectTimeframe(days) {
  if (state.timeframe === days) return;
  state.timeframe = days;
  document.querySelectorAll("[data-timeframe]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.timeframe) === days);
  });
  loadDashboard();
}

function addPortfolioEntry(event) {
  event.preventDefault();
  const asset = document.getElementById("portfolioAsset").value;
  const quantity = Number(document.getElementById("portfolioQuantity").value);
  const buyPrice = Number(document.getElementById("portfolioBuyPrice").value);
  const date = document.getElementById("portfolioDate").value;
  if (!(quantity > 0) || !(buyPrice > 0) || !date) return;
  state.portfolio.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    asset,
    quantity,
    buyPrice,
    date,
  });
  saveLocalArray("aurum-portfolio", state.portfolio);
  event.target.reset();
  document.getElementById("portfolioDate").valueAsDate = new Date();
  renderPortfolio();
  showToast("Tranzakció hozzáadva.");
}

function removePortfolioEntry(id) {
  state.portfolio = state.portfolio.filter((entry) => entry.id !== id);
  saveLocalArray("aurum-portfolio", state.portfolio);
  renderPortfolio();
}

function renderPortfolio() {
  const table = document.getElementById("portfolioTable");
  if (!table) return;
  table.replaceChildren();
  let totalCostUsd = 0;
  let totalValueUsd = 0;

  state.portfolio.forEach((entry) => {
    const currentPrice = state.assets[entry.asset]?.currentPrice;
    const cost = entry.quantity * entry.buyPrice;
    const value = Number.isFinite(currentPrice) ? entry.quantity * currentPrice : null;
    totalCostUsd += cost;
    if (value !== null) totalValueUsd += value;

    const row = document.createElement("tr");
    const cells = [
      entry.asset === "bitcoin" ? "Bitcoin" : "Arany",
      formatNumber(entry.quantity, 6),
      `$${formatNumber(entry.buyPrice, 2)}`,
      value === null ? "Nincs adat" : formatMoney(convertCurrency(value - cost)),
    ];
    cells.forEach((valueText, index) => {
      const cell = document.createElement("td");
      cell.textContent = valueText;
      if (index === 3 && value !== null) cell.className = valueClass(value - cost);
      row.append(cell);
    });
    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.className = "delete-button";
    removeButton.type = "button";
    removeButton.textContent = "Törlés";
    removeButton.addEventListener("click", () => removePortfolioEntry(entry.id));
    actionCell.append(removeButton);
    row.append(actionCell);
    table.append(row);
  });

  const hasEntries = state.portfolio.length > 0;
  const pnlUsd = totalValueUsd - totalCostUsd;
  const returnPercent = totalCostUsd ? (pnlUsd / totalCostUsd) * 100 : 0;
  document.getElementById("portfolioValue").textContent =
    hasEntries ? formatMoney(convertCurrency(totalValueUsd)) : "–";
  document.getElementById("portfolioCost").textContent =
    hasEntries ? formatMoney(convertCurrency(totalCostUsd)) : "–";
  const pnlElement = document.getElementById("portfolioPnl");
  pnlElement.textContent = hasEntries ? formatMoney(convertCurrency(pnlUsd)) : "–";
  pnlElement.className = hasEntries ? valueClass(pnlUsd) : "";
  const returnElement = document.getElementById("portfolioReturn");
  returnElement.textContent = hasEntries ? formatPercent(returnPercent) : "–";
  returnElement.className = hasEntries ? valueClass(returnPercent) : "";
}

function calculateRisk() {
  const capital = Number(document.getElementById("riskCapital").value);
  const riskPercent = Number(document.getElementById("riskPercent").value);
  const entry = Number(document.getElementById("riskEntry").value);
  const stop = Number(document.getElementById("riskStop").value);
  const target = Number(document.getElementById("riskTarget").value);
  const riskAmount = capital > 0 && riskPercent > 0 ? capital * riskPercent / 100 : null;
  const priceRisk = entry > 0 && stop > 0 ? Math.abs(entry - stop) : null;
  const position = riskAmount !== null && priceRisk ? riskAmount / priceRisk : null;
  const rewardRatio = priceRisk && target > 0 ? Math.abs(target - entry) / priceRisk : null;
  document.getElementById("riskAmount").textContent =
    riskAmount === null ? "–" : formatMoney(riskAmount);
  document.getElementById("riskPosition").textContent =
    position === null ? "–" : formatNumber(position, 6);
  document.getElementById("riskReward").textContent =
    rewardRatio === null ? "–" : `1 : ${rewardRatio.toFixed(2)}`;
}

function addAlert(event) {
  event.preventDefault();
  const price = Number(document.getElementById("alertPrice").value);
  if (!(price > 0)) return;
  state.alerts.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    asset: document.getElementById("alertAsset").value,
    direction: document.getElementById("alertDirection").value,
    price,
    triggered: false,
  });
  saveLocalArray("aurum-alerts", state.alerts);
  document.getElementById("alertPrice").value = "";
  renderAlerts();
  showToast("Árriasztás elmentve.");
}

function removeAlert(id) {
  state.alerts = state.alerts.filter((alert) => alert.id !== id);
  saveLocalArray("aurum-alerts", state.alerts);
  renderAlerts();
}

function renderAlerts() {
  const list = document.getElementById("alertsList");
  if (!list) return;
  list.replaceChildren();
  if (!state.alerts.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "Még nincs beállított riasztás.";
    list.append(empty);
    return;
  }
  state.alerts.forEach((alert) => {
    const item = document.createElement("div");
    item.className = "alert-item";
    const text = document.createElement("span");
    const assetName = alert.asset === "bitcoin" ? "Bitcoin" : "Arany";
    text.textContent = `${assetName}: ${alert.direction === "above" ? "fölötte" : "alatta"} $${formatNumber(alert.price, 2)}${alert.triggered ? " ✓ teljesült" : ""}`;
    const removeButton = document.createElement("button");
    removeButton.className = "delete-button";
    removeButton.type = "button";
    removeButton.textContent = "Törlés";
    removeButton.addEventListener("click", () => removeAlert(alert.id));
    item.append(text, removeButton);
    list.append(item);
  });
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    showToast("Ez a böngésző nem támogatja az értesítéseket.");
    return;
  }
  const permission = await Notification.requestPermission();
  showToast(permission === "granted" ? "Értesítések engedélyezve." : "Az értesítés nem lett engedélyezve.");
}

function checkAlerts() {
  let changed = false;
  state.alerts.forEach((alert) => {
    if (alert.triggered) return;
    const currentPrice = state.assets[alert.asset]?.currentPrice;
    if (!Number.isFinite(currentPrice)) return;
    const triggered =
      alert.direction === "above" ? currentPrice >= alert.price : currentPrice <= alert.price;
    if (!triggered) return;
    alert.triggered = true;
    changed = true;
    const assetName = alert.asset === "bitcoin" ? "Bitcoin" : "Arany";
    const message = `${assetName}: $${formatNumber(currentPrice, 2)} – a figyelt árszint teljesült.`;
    showToast(message);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Aurum & Satoshi árriasztás", { body: message });
    }
  });
  if (changed) {
    saveLocalArray("aurum-alerts", state.alerts);
    renderAlerts();
  }
}

function renderDataHealth() {
  const labels = {
    pending: ["Ellenőrzés…", ""],
    ok: ["Elérhető", "ok"],
    warning: ["Korlátozott", "warning"],
    error: ["Nem elérhető", "error"],
  };
  [
    ["sourceBitcoin", "bitcoin"],
    ["sourceGold", "gold"],
    ["sourceNews", "news"],
    ["sourceFx", "fx"],
  ].forEach(([elementId, key]) => {
    const element = document.getElementById(elementId);
    const [text, className] = labels[state.dataHealth[key]];
    element.textContent = text;
    element.className = `source-state ${className}`;
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function buildAnalysisPrompt() {
  const assetLines = Object.entries(state.assets).map(([key, asset]) => {
    if (!asset?.analysis) return `${key}: nincs elérhető adat`;
    const analysis = asset.analysis;
    return [
      `${asset.name}: $${formatCurrency(asset.currentPrice)}`,
      `napi változás: ${asset.change === null ? "nincs friss összehasonlító adat" : formatPercent(asset.change)}`,
      `RSI(14): ${analysis.rsi?.toFixed(1) ?? "nincs adat"}`,
      `SMA7: ${analysis.sma7?.toFixed(2) ?? "nincs adat"}`,
      `SMA21: ${analysis.sma21?.toFixed(2) ?? "nincs adat"}`,
      `7 napos momentum: ${analysis.momentum === null ? "nincs adat" : formatPercent(analysis.momentum)}`,
      `MACD: ${analysis.macd?.toFixed(2) ?? "nincs adat"}`,
      `támasz: ${analysis.support?.toFixed(2) ?? "nincs adat"}`,
      `ellenállás: ${analysis.resistance?.toFixed(2) ?? "nincs adat"}`,
      `algoritmikus jelzés: ${analysis.signal} (${analysis.confidence}% becsült bizalom)`,
    ].join(", ");
  });
  const intradayLines = ["bitcoin", "gold"].map((key) => {
    const decision = analyzeIntraday(key);
    if (!decision) return `${key} intraday: nincs adat`;
    return [
      `${key} intraday jelzés: ${decision.signal}`,
      `bizalom: ${decision.confidence}%`,
      `1 perces változás: ${decision.minuteChange === null ? "nincs adat" : formatPercent(decision.minuteChange)}`,
      `15 perces momentum: ${decision.momentum15 === null ? "nincs adat" : formatPercent(decision.momentum15)}`,
      `RSI: ${decision.rsi?.toFixed(1) ?? "nincs adat"}`,
      `ATR: ${decision.atr?.toFixed(2) ?? "nincs adat"}`,
      `adatforrás: ${decision.source}`,
    ].join(", ");
  });

  const headlines = state.news.slice(0, 8).map((article) => `- ${article.title}`).join("\n");
  return `Elemezd az alábbi Bitcoin- és aranypiaci pillanatképet magyarul.

${assetLines.join("\n")}
${intradayLines.join("\n")}
Hírek egyszerű kulcsszavas hangulata: ${state.sentiment.label}
Portfólióelemek száma: ${state.portfolio.length}

Friss hírcímek:
${headlines || "- Nincs elérhető hírcím"}

Kérlek:
1. Külön értékeld a Bitcoin és az arany rövid távú technikai képét.
2. Magyarázd el, mely hírek hathatnak az árfolyamokra, és ellenőrizd a hírek megbízhatóságát.
3. Adj optimista, semleges és pesszimista forgatókönyvet.
4. Ne ígérj biztos hozamot, jelezd az adatok korlátait és a fő kockázatokat.
5. Az értékelés oktatási célú legyen, ne személyre szabott pénzügyi tanács.

Adatok időpontja: ${new Date().toLocaleString("hu-HU")}`;
}

async function copyAnalysisPrompt() {
  const button = document.getElementById("copyPromptButton");
  const prompt = buildAnalysisPrompt();
  try {
    await navigator.clipboard.writeText(prompt);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = prompt;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
  }
  const original = button.textContent;
  button.textContent = "Másolva ✓";
  setTimeout(() => { button.textContent = original; }, 1800);
}

async function requestAiAnalysis() {
  const endpoint = state.settings.aiEndpoint;
  const accessToken = state.settings.aiAccessToken;
  if (!endpoint || !accessToken) {
    showToast("Add meg az AI backend URL-t és hozzáférési tokent a beállításokban.");
    openSettings();
    return;
  }
  if (!isSafeHttpUrl(endpoint)) {
    showToast("Az AI backend URL érvénytelen.");
    return;
  }

  const button = document.getElementById("aiAnalyzeButton");
  const resultElement = document.getElementById("aiResult");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Elemzés folyamatban…";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        prompt: buildAnalysisPrompt(),
        generatedAt: new Date().toISOString(),
      }),
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      const message =
        typeof payload === "object" && payload?.error
          ? [
              payload.error,
              payload.code ? `Hibakód: ${payload.code}` : "",
              payload.details ? `Részlet: ${payload.details}` : "",
            ].filter(Boolean).join("\n")
          : `A backend hibát jelzett (${response.status}).`;
      throw new Error(message);
    }
    const analysis =
      typeof payload === "string" ? payload : payload.analysis || payload.text || payload.result;
    if (!analysis) throw new Error("Üres válasz");
    resultElement.textContent = analysis;
    resultElement.hidden = false;
    showToast("AI-elemzés elkészült.");
  } catch (error) {
    resultElement.textContent =
      `AI-diagnosztika\n\n${error.message || "Az AI backend nem válaszolt. Ellenőrizd a beállításokat."}`;
    resultElement.hidden = false;
    showToast("Az AI-hiba részletei megjelentek.");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function convertCurrency(value) {
  if (!Number.isFinite(value)) return value;
  const rate = state.exchangeRates[state.settings.currency] ?? 1;
  return value * rate;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: state.settings.currency,
    maximumFractionDigits: state.settings.currency === "HUF" ? 0 : 2,
  }).format(value);
}

function formatNumber(value, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits }).format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "–";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function valueClass(value, threshold = 0) {
  if (value > threshold) return "positive";
  if (value < -threshold) return "negative";
  return "neutral";
}

function setLoading(isLoading, failed = false) {
  const button = document.getElementById("refreshButton");
  const status = document.getElementById("marketStatus");
  button.disabled = isLoading;
  button.classList.toggle("loading", isLoading);
  if (isLoading) {
    status.className = "status";
    status.innerHTML = "<span></span> Adatok betöltése";
  } else if (failed) {
    status.className = "status error";
    status.innerHTML = "<span></span> Nincs adatkapcsolat";
  } else {
    status.className = "status live";
    status.innerHTML = "<span></span> Adatkapcsolat aktív";
  }
}

function showError(message) {
  const banner = document.getElementById("errorBanner");
  banner.textContent = `${message} Próbáld meg később a frissítés gombbal.`;
  banner.hidden = false;
}

function hideError() {
  document.getElementById("errorBanner").hidden = true;
}
