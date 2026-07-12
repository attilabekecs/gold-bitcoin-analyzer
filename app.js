const Catalog = window.AssetCatalog;

const state = {
  assets: Object.fromEntries(Catalog.ALL_KEYS.map((key) => [key, null])),
  news: [],
  sentiment: { score: 0, label: "Semleges" },
  selectedAsset: "bitcoin",
  selectedTradeAsset: "bitcoin",
  selectedIntradayInterval: 1,
  activeView: "overview",
  charts: {},
  marketCharts: {},
  intradayChart: null,
  technicalCharts: {},
  intraday: Object.fromEntries(Catalog.ALL_KEYS.map((key) => [key, null])),
  multiTimeframe: Object.fromEntries(Catalog.ALL_KEYS.map((key) => [key, {}])),
  signalHistory: [],
  pendingSignals: {},
  timeframe: 30,
  exchangeRates: { USD: 1, EUR: 1, HUF: 1 },
  settings: null,
  portfolio: [],
  alerts: [],
  paperAccount: null,
  paperEquityChart: null,
  backtestChart: null,
  strategyLabResult: null,
  botState: null,
  botEquityChart: null,
  dataHealth: {
    ...Object.fromEntries(Catalog.ALL_KEYS.map((key) => [key, "pending"])),
    news: "pending",
    fx: "pending",
  },
  refreshTimer: null,
  intradayTimer: null,
  botTickTimer: null,
  botTickInterval: null,
  loadSequence: 0,
};

const VALID_VIEWS = [
  "overview",
  "bitcoin",
  "gold",
  "markets",
  "news",
  "portfolio",
  "practice",
  "bot",
  "simulator",
  "strategy",
  "ai",
];

const BOT_SECTIONS = ["summary", "settings", "trades", "experiences"];

function parseLocationHash() {
  const raw = window.location.hash.slice(1);
  const [viewPart, subPart] = raw.split("/");
  const view = VALID_VIEWS.includes(viewPart) ? viewPart : "overview";
  const botSection =
    view === "bot" && BOT_SECTIONS.includes(subPart) ? subPart : "summary";
  return { view, botSection };
}

function buildViewHash(view, botSection = "summary") {
  if (view === "bot" && botSection && botSection !== "summary") {
    return `bot/${botSection}`;
  }
  return view;
}

function getAssetMeta(assetKey) {
  return Catalog.getAsset(assetKey);
}

function getAssetName(assetKey) {
  return Catalog.getName(assetKey);
}

function getAssetDecimals(assetKey) {
  return getAssetMeta(assetKey)?.priceDecimals ?? 2;
}

function isTradeableAsset(assetKey) {
  return Catalog.ALL_KEYS.includes(assetKey);
}

function getLoadedAssetKeys() {
  return Catalog.ALL_KEYS.filter((key) => state.assets[key]);
}

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
  state.signalHistory = loadLocalArray("aurum-signal-history");
  state.paperAccount = loadPaperAccount();
  state.botState = window.VirtualBot?.loadBotState() || null;
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
  document.getElementById("signalNotificationButton").addEventListener("click", requestNotifications);
  document.getElementById("paperOrderForm").addEventListener("submit", openPaperPosition);
  document.getElementById("paperAsset").addEventListener("change", updatePaperOrderForm);
  document.getElementById("paperDirection").addEventListener("change", updatePaperOrderForm);
  document.getElementById("paperRiskPercent").addEventListener("input", updatePaperOrderForm);
  document.getElementById("paperStop").addEventListener("input", updatePaperOrderPreview);
  document.getElementById("paperTarget").addEventListener("input", updatePaperOrderPreview);
  document.getElementById("paperUseSignalButton").addEventListener("click", useSignalForPaperOrder);
  document.getElementById("paperResetButton").addEventListener("click", resetPaperAccount);
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
  document.querySelectorAll("[data-intraday-interval]").forEach((button) => {
    button.addEventListener("click", () =>
      selectIntradayInterval(Number(button.dataset.intradayInterval)),
    );
  });
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => setActiveView(button.dataset.viewTarget));
  });
  document.querySelector(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    setActiveView("overview");
  });
  initBotUi();
  window.PracticeLab?.init?.();
  const { view: initialView, botSection: initialBotSection } = parseLocationHash();
  setActiveView(initialView, false);
  if (initialView === "bot") {
    window.BotLab?.switchSection?.(initialBotSection, false);
  }
  window.addEventListener("hashchange", () => {
    const { view, botSection } = parseLocationHash();
    if (view !== state.activeView) {
      setActiveView(view, false);
    }
    if (view === "bot") {
      window.BotLab?.switchSection?.(botSection, false);
    }
  });
  applySettings();
  renderPortfolio();
  renderAlerts();
  renderPaperTrading();
  renderBotTrading();
  updatePaperOrderForm();
  calculateRisk();
  loadDashboard();
});

async function loadDashboard() {
  const sequence = ++state.loadSequence;
  setLoading(true);
  hideError();
  const errors = [];
  let firstMarketPaint = false;
  const isCurrent = () => sequence === state.loadSequence;
  const revealMarket = () => {
    if (!firstMarketPaint && isCurrent()) {
      firstMarketPaint = true;
      setLoading(false);
    }
  };
  const renderProgressiveAsset = (assetKey) => {
    const asset = state.assets[assetKey];
    if (!asset || !isCurrent()) return;
    asset.analysis = analyzeAsset(asset, assetSpecificSentiment(assetKey));
    if (Catalog.isFeatured(assetKey)) renderAsset(assetKey);
    renderMarketsGrid();
    renderIndicators(state.selectedAsset);
    renderTradingCenter();
    renderPortfolio();
    checkAlerts();
    updatePaperPositions(assetKey);
    revealMarket();
  };

  const loadAssetDaily = (assetKey) =>
    Catalog.fetchDaily(assetKey, state.timeframe, state.settings, endpoints)
      .then((asset) => {
        if (!isCurrent()) return;
        state.assets[assetKey] = asset;
        state.dataHealth[assetKey] = asset.warning ? "warning" : "ok";
        renderProgressiveAsset(assetKey);
        renderDataHealth();
      })
      .catch(() => {
        if (!isCurrent()) return;
        const name = getAssetName(assetKey);
        if (Catalog.isFeatured(assetKey)) errors.push(`A ${name}-adatok most nem érhetők el.`);
        state.dataHealth[assetKey] = "error";
        if (!state.assets[assetKey] && Catalog.isFeatured(assetKey)) renderUnavailableAsset(assetKey);
        renderMarketsGrid();
        renderDataHealth();
      });

  const loadAssetIntraday = (assetKey) =>
    Catalog.fetchIntraday(
      assetKey,
      1,
      state.settings,
      formatIntervalShort,
      formatIntervalLong,
    )
      .then((asset) => {
        if (!isCurrent()) return;
        if (asset) state.intraday[assetKey] = asset;
        renderTradingCenter();
        updatePaperPositions(assetKey);
        runVirtualBotTick();
        revealMarket();
      })
      .catch(() => {
        if (!isCurrent()) return;
        renderTradingCenter();
      });

  const loadAssetTimeframes = (assetKey) =>
    Catalog.fetchAdditionalTimeframes(
      assetKey,
      state.settings,
      formatIntervalShort,
      formatIntervalLong,
      endpoints,
    )
      .then((timeframes) => {
        if (!isCurrent()) return;
        state.multiTimeframe[assetKey] = timeframes;
        renderTradingCenter();
      })
      .catch(() => {
        // Optional timeframes may be unavailable for some sources.
      });

  const assetTasks = Catalog.ALL_KEYS.flatMap((assetKey) => [
    loadAssetDaily(assetKey),
    loadAssetIntraday(assetKey),
    loadAssetTimeframes(assetKey),
  ]);

  const ratesTask = fetchExchangeRates()
    .then((rates) => {
      if (!isCurrent()) return;
      state.exchangeRates = { USD: 1, ...rates };
      state.dataHealth.fx = "ok";
      getLoadedAssetKeys().forEach((assetKey) => {
        if (state.assets[assetKey]) renderAsset(assetKey);
      });
      renderMarketsGrid();
      renderTradingCenter();
      renderPortfolio();
      renderDataHealth();
    })
    .catch(() => {
      if (!isCurrent()) return;
      state.dataHealth.fx = state.settings.currency === "USD" ? "warning" : "error";
      if (state.settings.currency !== "USD") {
        errors.push("A devizaátváltás most nem érhető el.");
      }
      renderDataHealth();
    });

  const newsTask = fetchNews()
    .then((articles) => {
      if (!isCurrent()) return;
      state.news = articles;
      state.sentiment = analyzeSentiment(state.news);
      state.dataHealth.news = state.news.length ? "ok" : "warning";
      Catalog.ALL_KEYS.forEach((assetKey) => {
        if (state.assets[assetKey]) renderProgressiveAsset(assetKey);
      });
      renderSentiment();
      renderNews();
      renderDataHealth();
    })
    .catch(() => {
      if (!isCurrent()) return;
      errors.push("A hírfolyam most nem érhető el.");
      state.dataHealth.news = "error";
      renderSentiment();
      renderNews();
      renderDataHealth();
    });

  await Promise.allSettled([...assetTasks, ratesTask, newsTask]);
  if (!isCurrent()) return;

  runVirtualBotTick();
  renderBotTrading();

  if (errors.length) showError(errors.join(" "));
  document.getElementById("lastUpdated").textContent = new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date());
  setLoading(false, !state.assets.bitcoin && !state.assets.gold);
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

async function fetchAdditionalTimeframes(assetKey) {
  return Catalog.fetchAdditionalTimeframes(
    assetKey,
    state.settings,
    formatIntervalShort,
    formatIntervalLong,
    endpoints,
  );
}

async function fetchBitcoinIntraday(interval = 1) {
  return Catalog.fetchIntraday(
    "bitcoin",
    interval,
    state.settings,
    formatIntervalShort,
    formatIntervalLong,
  );
}

async function fetchGoldIntraday(interval = 1) {
  if (!state.settings.twelveDataKey) return null;
  const twelveDataIntervals = { 1: "1min", 5: "5min", 15: "15min", 60: "1h" };
  const params = new URLSearchParams({
    symbol: "XAU/USD",
    interval: twelveDataIntervals[interval] || "1min",
    outputsize: "500",
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
  if (candles.length < 30) {
    throw new Error(`Nincs elegendő ${formatIntervalLong(interval)} aranyadat`);
  }
  return buildIntradayAsset("Arany", candles, `Twelve Data · ${formatIntervalShort(interval)}`, interval);
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

function buildIntradayAsset(name, candles, source, interval = 1) {
  return {
    name,
    candles,
    source,
    interval,
    currentPrice: candles.at(-1).close,
    updatedAt: candles.at(-1).time,
  };
}

function getIntradaySeries(assetKey, interval = state.selectedIntradayInterval) {
  return interval === 1
    ? state.intraday[assetKey]
    : state.multiTimeframe[assetKey]?.[interval] || null;
}

function formatIntervalShort(interval) {
  return interval === 60 ? "1ó" : `${interval}p`;
}

function formatIntervalLong(interval) {
  return interval === 60 ? "1 órás" : `${interval} perces`;
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
  const intraday = getIntradaySeries(assetKey);
  if (!intraday) return buildDailyTradeFallback(assetKey);

  const candles = intraday.candles.slice(-180);
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
  const alignment = calculateTimeframeAlignment(assetKey);
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

  if (alignment.available >= 2 && alignment.bullishRatio >= 0.75) {
    score += 1.25;
    reasons.push(`${alignment.available} idősíkból ${alignment.bullish} emelkedő`);
  } else if (alignment.available >= 2 && alignment.bearishRatio >= 0.75) {
    score -= 1.25;
    reasons.push(`${alignment.available} idősíkból ${alignment.bearish} csökkenő`);
  } else if (alignment.available >= 2) {
    reasons.push("Az idősíkok nem mutatnak egységes irányt");
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
    interval: intraday.interval,
    alignment,
    hasIntraday: true,
  };
}

function calculateTimeframeAlignment(assetKey) {
  const trends = [1, 5, 15, 60]
    .map((interval) => {
      const series = getIntradaySeries(assetKey, interval);
      if (!series?.candles?.length) return null;
      const closes = series.candles.map((candle) => candle.close);
      const ema9 = exponentialMovingAverage(closes, 9);
      const ema21 = exponentialMovingAverage(closes, 21);
      if (ema9 === null || ema21 === null) return null;
      return { interval, bullish: ema9 >= ema21 };
    })
    .filter(Boolean);
  const bullish = trends.filter((trend) => trend.bullish).length;
  const bearish = trends.length - bullish;
  const available = trends.length;
  const dominant = Math.max(bullish, bearish);
  return {
    available,
    bullish,
    bearish,
    bullishRatio: available ? bullish / available : 0,
    bearishRatio: available ? bearish / available : 0,
    stability: available ? (dominant / available) * 100 : 0,
    text: available
      ? `${bullish} emelkedő / ${bearish} csökkenő`
      : "Nincs elég idősík",
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
    interval: null,
    alignment: calculateTimeframeAlignment(assetKey),
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
  const meta = getAssetMeta(assetKey);
  const keywords = meta?.sentimentKeywords || [assetKey];
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

function setActiveView(view, updateHash = true) {
  state.activeView = view;
  document.body.dataset.view = view;
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    const isActive = button.dataset.viewTarget === view;
    button.classList.toggle("active", isActive);
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-pages]").forEach((section) => {
    section.hidden = !section.dataset.pages.split(" ").includes(view);
  });
  document.querySelectorAll(".asset-card[data-asset]").forEach((card) => {
    card.hidden = (view === "bitcoin" || view === "gold") && card.dataset.asset !== view;
  });
  if (view === "bitcoin" || view === "gold") {
    selectTradeAsset(view);
    selectIndicatorAsset(view);
  }
  if (view === "markets" || view === "bot") {
    renderMarketsGrid();
    renderBotTrading();
  }
  if (updateHash) {
    const botSection = view === "bot" ? window.BotLab?.getActiveSection?.() || "summary" : null;
    window.history.replaceState(null, "", `#${buildViewHash(view, botSection)}`);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  requestAnimationFrame(() => {
    state.intradayChart?.resize();
    Object.values(state.charts).forEach((chart) => chart?.resize());
    Object.values(state.technicalCharts).forEach((chart) => chart?.resize());
    state.paperEquityChart?.resize();
    state.botEquityChart?.resize();
    window.BotLab?.resize?.();
    state.backtestChart?.resize();
    window.StrategyLab?.resize?.();
  });
}

function selectIntradayInterval(interval) {
  state.selectedIntradayInterval = interval;
  document.querySelectorAll("[data-intraday-interval]").forEach((button) => {
    const isActive = Number(button.dataset.intradayInterval) === interval;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  renderTradingCenter();
}

function selectTradeAsset(assetKey) {
  state.selectedTradeAsset = assetKey;
  document.querySelectorAll("[data-trade-asset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tradeAsset === assetKey);
  });
  renderTradingCenter();
}

function renderDecisionSwitcher() {
  const container = document.getElementById("decisionAssetSwitcher");
  if (!container) return;
  const featuredButtons = container.querySelectorAll(".featured-asset");
  featuredButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tradeAsset === state.selectedTradeAsset);
  });
  container.querySelectorAll("[data-trade-asset]:not(.featured-asset)").forEach((button) => {
    button.remove();
  });
  Catalog.EXTENDED_KEYS.forEach((assetKey) => {
    const meta = getAssetMeta(assetKey);
    const button = document.createElement("button");
    button.className = "decision-asset";
    button.type = "button";
    button.dataset.tradeAsset = assetKey;
    button.innerHTML =
      `<span><b>${meta.icon}</b> ${meta.shortName}</span>` +
      `<strong id="decisionSignal-${assetKey}" class="neutral">Elemzés…</strong>`;
    button.addEventListener("click", () => selectTradeAsset(assetKey));
    button.classList.toggle("active", state.selectedTradeAsset === assetKey);
    container.append(button);
  });
}

function renderMarketCard(assetKey, target) {
  const meta = getAssetMeta(assetKey);
  const asset = state.assets[assetKey];
  const decision = analyzeIntraday(assetKey);
  const card = document.createElement("article");
  card.className = `market-card ${meta.cardClass}`;
  card.dataset.asset = assetKey;

  const heading = document.createElement("div");
  heading.className = "market-card-heading";
  heading.innerHTML =
    `<div class="asset-icon ${meta.iconClass}">${meta.icon}</div>` +
    `<div><p>${meta.name}</p><span>${meta.pair}</span></div>`;
  const change = document.createElement("span");
  change.className = `change ${valueClass(asset?.change)}`;
  change.textContent = asset?.change === null ? "–" : formatPercent(asset.change);
  heading.append(change);
  card.append(heading);

  const priceRow = document.createElement("div");
  priceRow.className = "market-price-row";
  const price = document.createElement("strong");
  price.textContent = asset
    ? formatNumber(convertCurrency(asset.currentPrice), getAssetDecimals(assetKey))
    : "Nem elérhető";
  priceRow.append(price, document.createTextNode(` ${state.settings.currency}`));
  card.append(priceRow);

  const chartWrap = document.createElement("div");
  chartWrap.className = "market-chart-wrap";
  const canvas = document.createElement("canvas");
  canvas.id = `marketChart-${assetKey}`;
  chartWrap.append(canvas);
  card.append(chartWrap);

  const signalRow = document.createElement("div");
  signalRow.className = "market-signal-row";
  signalRow.innerHTML =
    `<div><span>Jelzés</span><strong class="signal ${decision?.className || "neutral"}">${decision?.signal || "Nincs adat"}</strong></div>` +
    `<div><span>Bizalom</span><strong>${decision?.confidence ?? "–"}${decision?.confidence ? "%" : ""}</strong></div>`;
  card.append(signalRow);

  const source = document.createElement("small");
  source.className = "market-source";
  source.textContent = state.intraday[assetKey]?.source || state.dataHealth[assetKey] || "–";
  card.append(source);

  const action = document.createElement("button");
  action.className = "text-button";
  action.type = "button";
  action.textContent = "Részletek →";
  action.addEventListener("click", () => {
    selectTradeAsset(assetKey);
    setActiveView("overview");
  });
  card.append(action);

  target.append(card);

  if (asset && typeof Chart !== "undefined") {
    state.marketCharts[assetKey]?.destroy();
    state.marketCharts[assetKey] = new Chart(canvas, {
      type: "line",
      data: {
        labels: asset.points.map((point) =>
          new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric" }).format(point.time),
        ),
        datasets: [{
          data: asset.prices.map(convertCurrency),
          borderColor: meta.chartColor,
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          backgroundColor: createGradient(canvas, meta.chartColor),
          tension: 0.35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    });
  }
}

function renderMarketsGrid() {
  const grid = document.getElementById("marketsGrid");
  const preview = document.getElementById("marketsPreviewGrid");
  if (!grid && !preview) return;

  if (grid) {
    grid.replaceChildren();
    Catalog.EXTENDED_KEYS.forEach((assetKey) => renderMarketCard(assetKey, grid));
    if (!Catalog.EXTENDED_KEYS.some((key) => state.assets[key])) {
      grid.append(Object.assign(document.createElement("span"), {
        className: "helper-text",
        textContent: "A további piacok betöltése folyamatban…",
      }));
    }
  }

  if (preview) {
    preview.replaceChildren();
    Catalog.EXTENDED_KEYS.slice(0, 3).forEach((assetKey) => {
      const meta = getAssetMeta(assetKey);
      const asset = state.assets[assetKey];
      const decision = analyzeIntraday(assetKey);
      const item = document.createElement("article");
      item.className = "market-preview-card";
      item.innerHTML =
        `<span class="asset-icon ${meta.iconClass}">${meta.icon}</span>` +
        `<div><strong>${meta.name}</strong><small>${asset ? `$${formatNumber(asset.currentPrice, getAssetDecimals(assetKey))}` : "Betöltés…"}</small></div>` +
        `<span class="signal ${decision?.className || "neutral"}">${decision?.signal || "–"}</span>`;
      item.addEventListener("click", () => setActiveView("markets"));
      preview.append(item);
    });
  }
}

function renderTradingCenter() {
  renderDecisionSwitcher();
  const decisions = Object.fromEntries(
    Catalog.ALL_KEYS.map((assetKey) => [assetKey, analyzeIntraday(assetKey)]),
  );
  Catalog.ALL_KEYS.forEach((assetKey) => updateDecisionShortcut(assetKey, decisions[assetKey]));
  if (state.selectedIntradayInterval === 1) {
    Catalog.ALL_KEYS.forEach((assetKey) => trackSignalChange(assetKey, decisions[assetKey]));
  }

  const assetKey = state.selectedTradeAsset;
  const decision = decisions[assetKey] || analyzeIntraday(assetKey);
  const name = getAssetName(assetKey);
  const interval = state.selectedIntradayInterval;
  const selectedSeries = getIntradaySeries(assetKey, interval);
  const status = document.getElementById("intradayStatus");
  const empty = document.getElementById("intradayEmpty");
  const canvas = document.getElementById("intradayChart");
  document.getElementById("tradeAssetName").textContent = `${name} rövid távú jelzés`;
  document.getElementById("intradayChartTitle").textContent =
    `${name} · ${formatIntervalLong(interval)}`;
  document.getElementById("tradeMomentumLabel").textContent =
    interval === 60 ? "15 órás lendület" : `${15 * interval} perces lendület`;
  renderSignalHistory(assetKey);

  if (!decision) {
    document.getElementById("tradeSignal").textContent = "NINCS ADAT";
    document.getElementById("tradeSignal").className = "trade-signal neutral";
    document.getElementById("tradeSummary").textContent =
      "A technikai jelzéshez szükséges adatok most nem érhetők el.";
    status.className = "live-data-state warning";
    status.querySelector("strong").textContent = "Nincs intraday adat";
    status.querySelector("small").textContent = "Próbáld újra később";
    renderIntradayChart(assetKey, null);
    renderTechnicalCharts(assetKey, null);
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
    decision.minuteChange === null
      ? `${formatIntervalShort(interval)}: nincs adat`
      : `${formatIntervalShort(interval)}: ${formatPercent(decision.minuteChange)}`;
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
  document.getElementById("tradeAlignment").textContent =
    `${decision.alignment.text} · ${formatNumber(decision.alignment.stability, 0)}%`;
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
    ? `${formatIntervalLong(interval)} adat aktív`
    : "Lassabb adat";
  status.querySelector("small").textContent = decision.hasIntraday
    ? "Automatikus frissítés"
    : "API-kulcs vagy forrás szükséges";
  empty.hidden = decision.hasIntraday;
  empty.querySelector("strong").textContent = `Nincs ${formatIntervalLong(interval)} adat`;
  empty.querySelector("span").textContent =
    assetKey === "gold"
      ? "Az arany több idősíkú nézetéhez megfelelő Twelve Data csomag szükséges."
      : getAssetMeta(assetKey)?.dataType === "yahoo"
        ? "A Yahoo Finance adatforrás átmenetileg nem elérhető."
        : "Ez az idősík átmenetileg nem érhető el.";
  canvas.hidden = !decision.hasIntraday;
  renderIntradayChart(assetKey, decision.hasIntraday ? selectedSeries : null);
  renderTechnicalCharts(assetKey, decision.hasIntraday ? selectedSeries : null);
}

function updateDecisionShortcut(assetKey, decision) {
  const element = document.getElementById(`decisionSignal-${assetKey}`);
  if (!element) return;
  element.textContent = decision?.signal || "Nincs adat";
  element.className = decision?.className || "neutral";
}

function trackSignalChange(assetKey, decision) {
  if (!decision?.hasIntraday || !decision.signal || !Number.isFinite(decision.updatedAt)) return;
  const last = state.signalHistory.find((entry) => entry.asset === assetKey);
  if (!last) {
    addSignalHistoryEntry(assetKey, decision, false);
    return;
  }
  if (last.signal === decision.signal) {
    delete state.pendingSignals[assetKey];
    return;
  }
  const pending = state.pendingSignals[assetKey];
  if (!pending || pending.signal !== decision.signal) {
    state.pendingSignals[assetKey] = {
      signal: decision.signal,
      confirmations: 1,
      lastCandle: decision.updatedAt,
    };
    return;
  }
  if (pending.lastCandle === decision.updatedAt) return;
  pending.confirmations += 1;
  pending.lastCandle = decision.updatedAt;
  if (pending.confirmations >= 2) {
    addSignalHistoryEntry(assetKey, decision, true);
    delete state.pendingSignals[assetKey];
  }
}

function addSignalHistoryEntry(assetKey, decision, shouldNotify) {
  const entry = {
    id: `${Date.now()}-${assetKey}`,
    asset: assetKey,
    signal: decision.signal,
    className: decision.className,
    price: decision.currentPrice,
    confidence: decision.confidence,
    alignment: decision.alignment.stability,
    time: Date.now(),
    candleTime: decision.updatedAt,
  };
  state.signalHistory.unshift(entry);
  state.signalHistory = state.signalHistory.slice(0, 200);
  saveLocalArray("aurum-signal-history", state.signalHistory);
  renderSignalHistory(state.selectedTradeAsset);
  if (shouldNotify && "Notification" in window && Notification.permission === "granted") {
    const assetName = getAssetName(assetKey);
    new Notification(`${assetName}: ${decision.signal}`, {
      body: `${decision.confidence}% bizalom · ${decision.alignment.text}`,
    });
  }
}

function renderSignalHistory(assetKey) {
  const list = document.getElementById("signalHistoryList");
  const entries = state.signalHistory.filter((entry) => entry.asset === assetKey).slice(0, 8);
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("span");
    empty.textContent = "Még nincs rögzített jelzés.";
    list.append(empty);
    document.getElementById("signalStability").textContent = "Stabilitás számítása…";
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement("span");
    item.className = entry.className;
    item.textContent =
      `${new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit" }).format(entry.time)} ` +
      `${entry.signal} · $${formatNumber(entry.price, 2)}`;
    list.append(item);
  });
  const latest = entries[0];
  document.getElementById("signalStability").textContent =
    `${latest.signal} · ${formatNumber(latest.confidence, 0)}% bizalom · ` +
    `${formatNumber(latest.alignment, 0)}% idősík-egyezés`;
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
  const candles = intraday.candles.slice(-180);
  const closes = candles.map((candle) => candle.close);
  const convertedCloses = closes.map(convertCurrency);
  const ema9 = exponentialMovingAverageSeries(closes, 9).map((value) =>
    value === null ? null : convertCurrency(value),
  );
  const ema21 = exponentialMovingAverageSeries(closes, 21).map((value) =>
    value === null ? null : convertCurrency(value),
  );
  const priceColor = getAssetMeta(assetKey)?.chartColor || "#6f7771";
  const labels = candles.map((candle) =>
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
    `Utolsó ${formatIntervalLong(intraday.interval)} gyertya: ${new Intl.DateTimeFormat("hu-HU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(intraday.updatedAt)} · ${intraday.candles.length} gyertya`;
}

function renderTechnicalCharts(assetKey, intraday) {
  Object.values(state.technicalCharts).forEach((chart) => chart?.destroy());
  state.technicalCharts = {};
  const container = document.getElementById("technicalMiniCharts");
  container.hidden = !intraday;
  if (!intraday || typeof Chart === "undefined") return;

  const candles = intraday.candles.slice(-180);
  const closes = candles.map((candle) => candle.close);
  const labels = candles.map((candle) =>
    new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit" }).format(candle.time),
  );
  const rsiSeries = closes.map((_, index) => {
    if (index < 14) return null;
    return calculateRsi(closes.slice(index - 14, index + 1), 14);
  });
  const ema12Series = exponentialMovingAverageSeries(closes, 12);
  const ema26Series = exponentialMovingAverageSeries(closes, 26);
  const macdSeries = ema12Series.map((value, index) => {
    return value === null || ema26Series[index] === null ? null : value - ema26Series[index];
  });
  const volumes = candles.map((candle) => candle.volume || 0);
  const latestRsi = rsiSeries.at(-1);
  const latestMacd = macdSeries.at(-1);
  const latestVolume = volumes.at(-1);
  document.getElementById("miniRsiValue").textContent =
    latestRsi === null ? "–" : formatNumber(latestRsi, 1);
  document.getElementById("miniMacdValue").textContent =
    latestMacd === null ? "–" : formatNumber(latestMacd, assetKey === "bitcoin" ? 2 : 3);
  document.getElementById("miniVolumeValue").textContent =
    latestVolume > 0 ? formatCompactNumber(latestVolume) : "Nincs adat";

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { display: false },
      tooltip: { displayColors: false },
    },
    scales: {
      x: { display: false },
      y: {
        position: "right",
        grid: { color: "rgba(255, 255, 255, 0.06)" },
        ticks: { color: "rgba(255,255,255,0.45)", font: { size: 8 }, maxTicksLimit: 4 },
      },
    },
  };

  state.technicalCharts.rsi = new Chart(document.getElementById("rsiChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: rsiSeries,
        borderColor: "#5fd39a",
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        backgroundColor: "rgba(95, 211, 154, 0.08)",
        tension: 0.2,
      }],
    },
    options: {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: { ...baseOptions.scales.y, min: 0, max: 100 },
      },
    },
  });

  state.technicalCharts.macd = new Chart(document.getElementById("macdChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: macdSeries,
        backgroundColor: macdSeries.map((value) =>
          value !== null && value >= 0 ? "rgba(95, 211, 154, 0.7)" : "rgba(220, 103, 88, 0.7)",
        ),
        borderRadius: 2,
      }],
    },
    options: baseOptions,
  });

  state.technicalCharts.volume = new Chart(document.getElementById("volumeChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: volumes,
        backgroundColor: candles.map((candle) =>
          candle.close >= candle.open ? "rgba(95, 211, 154, 0.55)" : "rgba(226, 134, 59, 0.55)",
        ),
        borderRadius: 2,
      }],
    },
    options: baseOptions,
  });
}

async function refreshLiveIntraday() {
  const botConfig = state.botState?.config;
  const refreshKeys = new Set([
    "bitcoin",
    ...(botConfig?.marketWideMode
      ? window.AssetCatalog?.ALL_KEYS || []
      : botConfig?.assets || []),
  ]);
  await Promise.allSettled(
    [...refreshKeys].map(async (assetKey) => {
      try {
        const asset = await Catalog.fetchIntraday(
          assetKey,
          1,
          state.settings,
          formatIntervalShort,
          formatIntervalLong,
        );
        if (asset) state.intraday[assetKey] = asset;
        updatePaperPositions(assetKey);
      } catch {
        // Keep the last valid intraday series during a temporary source failure.
      }
    }),
  );
  renderTradingCenter();
  runVirtualBotTick();
  renderBotTrading();
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

function loadPaperAccount() {
  const fallback = createPaperAccount(10000);
  try {
    const saved = JSON.parse(localStorage.getItem("aurum-paper-account") || "null");
    if (
      !saved ||
      !Number.isFinite(saved.initialCapital) ||
      !Number.isFinite(saved.cash) ||
      !Array.isArray(saved.positions) ||
      !Array.isArray(saved.trades) ||
      !Array.isArray(saved.equityHistory)
    ) {
      return fallback;
    }
    return saved;
  } catch {
    return fallback;
  }
}

function createPaperAccount(initialCapital) {
  const now = Date.now();
  return {
    initialCapital,
    cash: initialCapital,
    positions: [],
    trades: [],
    equityHistory: [{ time: now, equity: initialCapital }],
  };
}

function savePaperAccount() {
  try {
    localStorage.setItem("aurum-paper-account", JSON.stringify(state.paperAccount));
  } catch {
    showToast("A böngésző nem tudta menteni a papírszámlát.");
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
  state.intradayTimer = setInterval(refreshLiveIntraday, 60000);
  scheduleBotTick();
}

function scheduleBotTick() {
  if (!state.botState?.config?.enabled) {
    clearInterval(state.botTickTimer);
    state.botTickTimer = null;
    state.botTickInterval = null;
    return;
  }
  const interval = window.VirtualBot?.getBotTickIntervalMs?.(state.botState.config) ?? 60000;
  if (state.botTickInterval === interval && state.botTickTimer) return;
  clearInterval(state.botTickTimer);
  state.botTickInterval = interval;
  state.botTickTimer = setInterval(() => {
    runVirtualBotTick();
    window.BotLab?.render?.();
  }, interval);
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
      getAssetName(entry.asset),
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

function getPaperCurrentPrice(assetKey) {
  return state.intraday[assetKey]?.currentPrice ?? state.assets[assetKey]?.currentPrice ?? null;
}

function useSignalForPaperOrder() {
  const assetKey = document.getElementById("paperAsset").value;
  const decision = analyzeIntraday(assetKey);
  if (decision?.className === "negative") {
    document.getElementById("paperDirection").value = "short";
  } else if (decision?.className === "positive") {
    document.getElementById("paperDirection").value = "long";
  }
  updatePaperOrderForm(true);
}

function updatePaperOrderForm(forceLevels = false) {
  const assetKey = document.getElementById("paperAsset").value;
  const direction = document.getElementById("paperDirection").value;
  const entry = getPaperCurrentPrice(assetKey);
  const entryInput = document.getElementById("paperEntry");
  entryInput.value = Number.isFinite(entry)
    ? entry.toFixed(getAssetDecimals(assetKey))
    : "";
  const intraday = state.intraday[assetKey];
  const atr = intraday ? calculateAtr(intraday.candles, 14) : null;
  const fallbackDistance = Number.isFinite(entry) ? entry * 0.01 : null;
  const distance = atr ? atr * 1.5 : fallbackDistance;
  const stopInput = document.getElementById("paperStop");
  const targetInput = document.getElementById("paperTarget");
  if (Number.isFinite(entry) && distance && (forceLevels || !(Number(stopInput.value) > 0))) {
    stopInput.value = (entry + (direction === "long" ? -distance : distance)).toFixed(
      getAssetDecimals(assetKey),
    );
  }
  if (Number.isFinite(entry) && distance && (forceLevels || !(Number(targetInput.value) > 0))) {
    targetInput.value = (entry + (direction === "long" ? distance * 2 : -distance * 2)).toFixed(
      getAssetDecimals(assetKey),
    );
  }
  updatePaperOrderPreview();
}

function calculatePaperOrder() {
  const entry = Number(document.getElementById("paperEntry").value);
  const stop = Number(document.getElementById("paperStop").value);
  const target = Number(document.getElementById("paperTarget").value);
  const riskPercent = Number(document.getElementById("paperRiskPercent").value);
  const direction = document.getElementById("paperDirection").value;
  if (!(entry > 0) || !(stop > 0) || !(target > 0) || !(riskPercent > 0)) return null;
  const levelsValid =
    direction === "long" ? stop < entry && target > entry : stop > entry && target < entry;
  if (!levelsValid) return { error: "A stop és célár nem megfelelő az irányhoz." };
  const desiredRiskAmount = state.paperAccount.cash * riskPercent / 100;
  const unitRisk = Math.abs(entry - stop);
  const estimatedRoundTripFeePerUnit = (entry + stop) * 0.001;
  const unitRiskWithFees = unitRisk + estimatedRoundTripFeePerUnit;
  const riskSizedQuantity = unitRiskWithFees ? desiredRiskAmount / unitRiskWithFees : 0;
  const cashLimitedQuantity = state.paperAccount.cash / entry;
  const quantity = Math.min(riskSizedQuantity, cashLimitedQuantity);
  if (!(quantity > 0)) return null;
  return {
    entry,
    stop,
    target,
    direction,
    riskPercent,
    riskAmount: quantity * unitRiskWithFees,
    desiredRiskAmount,
    quantity,
    notional: quantity * entry,
    riskReward: Math.abs(target - entry) / unitRisk,
  };
}

function updatePaperOrderPreview() {
  const preview = document.getElementById("paperOrderPreview");
  const order = calculatePaperOrder();
  if (!order) {
    preview.textContent = "Az adatok betöltése után számolható pozícióméret.";
    preview.className = "order-preview";
    return;
  }
  if (order.error) {
    preview.textContent = order.error;
    preview.className = "order-preview negative";
    return;
  }
  preview.className = "order-preview";
  preview.textContent =
    `Javasolt mennyiség: ${formatNumber(order.quantity, 6)} · ` +
    `becsült kockázat díjjal: $${formatNumber(order.riskAmount, 2)} · ` +
    `névérték: $${formatNumber(order.notional, 2)} · ` +
    `R/R: 1 : ${formatNumber(order.riskReward, 2)}`;
}

function openPaperPosition(event) {
  event.preventDefault();
  const order = calculatePaperOrder();
  if (!order || order.error) {
    showToast(order?.error || "A papírpozíció adatai hiányosak.");
    return;
  }
  const asset = document.getElementById("paperAsset").value;
  const now = Date.now();
  state.paperAccount.positions.push({
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    asset,
    direction: order.direction,
    quantity: order.quantity,
    entry: order.entry,
    stop: order.stop,
    target: order.target,
    riskPercent: order.riskPercent,
    openedAt: now,
    lastCheckedAt: now,
  });
  savePaperAccount();
  renderPaperTrading();
  showToast("Papírpozíció megnyitva – valódi megbízás nem történt.");
}

function updatePaperPositions(assetKey) {
  if (!state.paperAccount?.positions.length) {
    renderPaperTrading();
    updatePaperOrderForm();
    return;
  }
  const intraday = state.intraday[assetKey];
  const currentPrice = getPaperCurrentPrice(assetKey);
  if (!Number.isFinite(currentPrice)) return;
  const closures = [];
  state.paperAccount.positions
    .filter((position) => position.asset === assetKey)
    .forEach((position) => {
      const newCandles = (intraday?.candles || []).filter(
        (candle) => candle.time > position.lastCheckedAt,
      );
      for (const candle of newCandles) {
        const stopHit =
          position.direction === "long"
            ? candle.low <= position.stop
            : candle.high >= position.stop;
        const targetHit =
          position.direction === "long"
            ? candle.high >= position.target
            : candle.low <= position.target;
        if (stopHit) {
          closures.push({
            id: position.id,
            price: position.stop,
            reason: targetHit ? "Stop (azonos gyertyában a célárral)" : "Stop-loss",
            time: candle.time,
          });
          break;
        }
        if (targetHit) {
          closures.push({
            id: position.id,
            price: position.target,
            reason: "Célár",
            time: candle.time,
          });
          break;
        }
        position.lastCheckedAt = candle.time;
      }
    });
  closures.forEach((closure) => {
    closePaperPositionInternal(closure.id, closure.price, closure.reason, closure.time, false);
  });
  recordPaperEquity();
  savePaperAccount();
  renderPaperTrading();
  updatePaperOrderForm();
}

function closePaperPosition(id) {
  const position = state.paperAccount.positions.find((item) => item.id === id);
  const currentPrice = position ? getPaperCurrentPrice(position.asset) : null;
  if (!position || !Number.isFinite(currentPrice)) {
    showToast("A pozíció most nem zárható: nincs aktuális ár.");
    return;
  }
  closePaperPositionInternal(id, currentPrice, "Kézi zárás", Date.now(), true);
}

function closePaperPositionInternal(id, exitPrice, reason, closedAt, shouldRender) {
  const index = state.paperAccount.positions.findIndex((position) => position.id === id);
  if (index < 0) return;
  const [position] = state.paperAccount.positions.splice(index, 1);
  const directionMultiplier = position.direction === "long" ? 1 : -1;
  const grossPnl = (exitPrice - position.entry) * position.quantity * directionMultiplier;
  const fees = (position.entry + exitPrice) * position.quantity * 0.001;
  const pnl = grossPnl - fees;
  state.paperAccount.cash += pnl;
  state.paperAccount.trades.unshift({
    ...position,
    exit: exitPrice,
    reason,
    closedAt,
    fees,
    pnl,
  });
  state.paperAccount.trades = state.paperAccount.trades.slice(0, 250);
  recordPaperEquity(closedAt);
  savePaperAccount();
  if (shouldRender) {
    renderPaperTrading();
    updatePaperOrderForm();
    showToast(`Papírpozíció lezárva: ${pnl >= 0 ? "+" : ""}$${formatNumber(pnl, 2)}`);
  }
}

function getPaperMetrics() {
  const openPnl = state.paperAccount.positions.reduce((sum, position) => {
    const price = getPaperCurrentPrice(position.asset);
    if (!Number.isFinite(price)) return sum;
    const multiplier = position.direction === "long" ? 1 : -1;
    return sum + (price - position.entry) * position.quantity * multiplier;
  }, 0);
  const equity = state.paperAccount.cash + openPnl;
  const wins = state.paperAccount.trades.filter((trade) => trade.pnl > 0);
  const losses = state.paperAccount.trades.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  const winRate = state.paperAccount.trades.length
    ? (wins.length / state.paperAccount.trades.length) * 100
    : null;
  const profitFactor = grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;
  const equityValues = [...state.paperAccount.equityHistory.map((point) => point.equity), equity];
  return {
    equity,
    openPnl,
    realizedPnl: state.paperAccount.cash - state.paperAccount.initialCapital,
    winRate,
    profitFactor,
    maxDrawdown: calculateMaxDrawdown(equityValues),
  };
}

function calculateMaxDrawdown(values) {
  if (!values.length) return 0;
  let peak = values[0];
  let maxDrawdown = 0;
  values.forEach((value) => {
    peak = Math.max(peak, value);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, ((peak - value) / peak) * 100);
  });
  return maxDrawdown;
}

function recordPaperEquity(time = Date.now()) {
  const metrics = getPaperMetrics();
  const last = state.paperAccount.equityHistory.at(-1);
  const point = { time, equity: metrics.equity };
  if (last && time - last.time < 60000) {
    state.paperAccount.equityHistory[state.paperAccount.equityHistory.length - 1] = point;
  } else {
    state.paperAccount.equityHistory.push(point);
  }
  state.paperAccount.equityHistory = state.paperAccount.equityHistory.slice(-500);
}

function renderPaperTrading() {
  if (!state.paperAccount) return;
  const metrics = getPaperMetrics();
  document.getElementById("paperInitialCapital").value = state.paperAccount.initialCapital;
  setMetricValue("paperEquity", `$${formatNumber(metrics.equity, 2)}`, metrics.equity - state.paperAccount.initialCapital);
  setMetricValue("paperRealizedPnl", formatSignedUsd(metrics.realizedPnl), metrics.realizedPnl);
  setMetricValue("paperOpenPnl", formatSignedUsd(metrics.openPnl), metrics.openPnl);
  document.getElementById("paperWinRate").textContent =
    metrics.winRate === null ? "–" : `${formatNumber(metrics.winRate, 1)}%`;
  document.getElementById("paperProfitFactor").textContent =
    metrics.profitFactor === null
      ? "–"
      : metrics.profitFactor === Infinity
        ? "∞"
        : formatNumber(metrics.profitFactor, 2);
  document.getElementById("paperDrawdown").textContent =
    `${formatNumber(metrics.maxDrawdown, 2)}%`;
  document.getElementById("paperPositionCount").textContent =
    `${state.paperAccount.positions.length} pozíció`;
  renderPaperPositions();
  renderPaperTrades();
  renderPaperEquityChart();
}

function setMetricValue(id, text, value) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.className = valueClass(value);
}

function formatSignedUsd(value) {
  return `${value >= 0 ? "+" : ""}$${formatNumber(value, 2)}`;
}

function renderPaperPositions() {
  const table = document.getElementById("paperPositionsTable");
  table.replaceChildren();
  if (!state.paperAccount.positions.length) {
    appendEmptyTableRow(table, 9, "Nincs nyitott papírpozíció.");
    return;
  }
  state.paperAccount.positions.forEach((position) => {
    const currentPrice = getPaperCurrentPrice(position.asset);
    const multiplier = position.direction === "long" ? 1 : -1;
    const pnl = Number.isFinite(currentPrice)
      ? (currentPrice - position.entry) * position.quantity * multiplier
      : null;
    const row = document.createElement("tr");
    [
      getAssetName(position.asset),
      position.direction.toUpperCase(),
      formatNumber(position.quantity, 6),
      `$${formatNumber(position.entry, 2)}`,
      Number.isFinite(currentPrice) ? `$${formatNumber(currentPrice, 2)}` : "–",
      `$${formatNumber(position.stop, 2)}`,
      `$${formatNumber(position.target, 2)}`,
      pnl === null ? "–" : formatSignedUsd(pnl),
    ].forEach((text, index) => {
      const cell = document.createElement("td");
      cell.textContent = text;
      if (index === 7 && pnl !== null) cell.className = valueClass(pnl);
      row.append(cell);
    });
    const action = document.createElement("td");
    const button = document.createElement("button");
    button.className = "delete-button";
    button.type = "button";
    button.textContent = "Zárás";
    button.addEventListener("click", () => closePaperPosition(position.id));
    action.append(button);
    row.append(action);
    table.append(row);
  });
}

function renderPaperTrades() {
  const table = document.getElementById("paperTradesTable");
  table.replaceChildren();
  if (!state.paperAccount.trades.length) {
    appendEmptyTableRow(table, 7, "Még nincs lezárt papírügylet.");
    return;
  }
  state.paperAccount.trades.slice(0, 50).forEach((trade) => {
    const row = document.createElement("tr");
    [
      new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(trade.closedAt),
      getAssetName(trade.asset),
      trade.direction.toUpperCase(),
      `$${formatNumber(trade.entry, 2)}`,
      `$${formatNumber(trade.exit, 2)}`,
      trade.reason,
      formatSignedUsd(trade.pnl),
    ].forEach((text, index) => {
      const cell = document.createElement("td");
      cell.textContent = text;
      if (index === 6) cell.className = valueClass(trade.pnl);
      row.append(cell);
    });
    table.append(row);
  });
}

function appendEmptyTableRow(table, columnCount, text) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = columnCount;
  cell.className = "empty-table-cell";
  cell.textContent = text;
  row.append(cell);
  table.append(row);
}

function renderPaperEquityChart() {
  state.paperEquityChart?.destroy();
  if (typeof Chart === "undefined") return;
  const points = state.paperAccount.equityHistory;
  state.paperEquityChart = new Chart(document.getElementById("paperEquityChart"), {
    type: "line",
    data: {
      labels: points.map((point) =>
        new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(point.time),
      ),
      datasets: [{
        data: points.map((point) => point.equity),
        borderColor: "#286849",
        backgroundColor: "rgba(40, 104, 73, 0.10)",
        borderWidth: 2,
        pointRadius: points.length < 20 ? 2 : 0,
        fill: true,
        tension: 0.25,
      }],
    },
    options: paperChartOptions("$"),
  });
}

function paperChartOptions(prefix = "") {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 8 } } },
      y: {
        position: "right",
        grid: { color: "rgba(111, 119, 113, 0.12)" },
        ticks: { font: { size: 8 }, callback: (value) => `${prefix}${formatNumber(value, 0)}` },
      },
    },
  };
}

function getBotContext() {
  return {
    assets: state.assets,
    intraday: state.intraday,
    multiTimeframe: state.multiTimeframe,
    analyzeIntraday,
    getIntradaySeries,
    calculateTimeframeAlignment,
    indicators: {
      ema: exponentialMovingAverage,
      rsi: calculateRsi,
      atr: calculateAtr,
      average,
    },
  };
}

function runVirtualBotTick() {
  if (!state.botState || !window.VirtualBot) return;
  window.VirtualBot.tick(state.botState, getBotContext());
  renderBotTrading();
}

function initBotUi() {
  const { botSection: initialBotSection } = parseLocationHash();
  window.BotLab?.init?.({
    getState: () => state,
    getBotContext,
    runTick: runVirtualBotTick,
    scheduleBotTick,
    showToast,
    formatNumber,
    formatSignedUsd,
    valueClass,
    setMetricValue,
    appendEmptyTableRow,
    paperChartOptions,
    initialBotSection,
    updateBotHash: (section) => {
      if (state.activeView !== "bot") return;
      window.history.replaceState(null, "", `#${buildViewHash("bot", section)}`);
    },
    resizeBotCharts: () => {
      state.botEquityChart?.resize();
    },
  });
  scheduleBotTick();
}

function renderBotTrading() {
  window.BotLab?.render?.();
}

function resetPaperAccount() {
  const initialCapital = Number(document.getElementById("paperInitialCapital").value);
  if (!(initialCapital >= 100)) {
    showToast("A kezdőtőke legalább 100 USD legyen.");
    return;
  }
  if (!window.confirm("Biztosan törlöd az összes papírpozíciót és korábbi szimulált ügyletet?")) {
    return;
  }
  state.paperAccount = createPaperAccount(initialCapital);
  savePaperAccount();
  renderPaperTrading();
  updatePaperOrderForm(true);
  showToast("A papírszámla újraindult.");
}

function runBacktest(event) {
  event.preventDefault();
  const assetKey = document.getElementById("backtestAsset").value;
  const interval = Number(document.getElementById("backtestInterval").value);
  const config = readBacktestConfig();
  const candles = getIntradaySeries(assetKey, interval)?.candles || [];
  if (!config) return;
  if (candles.length < Math.max(120, config.slowEma * 4)) {
    showToast(`Ehhez az eszközhöz nincs elegendő ${formatIntervalLong(interval)} adat.`);
    return;
  }
  const splitIndex = Math.floor(candles.length * config.trainingSplit);
  const warmup = Math.max(config.slowEma * 3, 50);
  const validationOffset = Math.max(0, splitIndex - warmup);
  const trainingCandles = candles.slice(0, splitIndex + 1);
  const validationCandles = candles.slice(validationOffset);
  const training = executeBacktest(trainingCandles, config.initialCapital, {
    ...config,
    tradeStartIndex: Math.max(config.slowEma + 2, 31),
  });
  const validation = executeBacktest(validationCandles, config.initialCapital, {
    ...config,
    tradeStartIndex: splitIndex - validationOffset,
  });
  const benchmarkEntry = applyBacktestExecutionPrice(
    candles[splitIndex]?.open || candles[splitIndex]?.close,
    "long",
    true,
    config,
  );
  const benchmarkExit = applyBacktestExecutionPrice(
    candles.at(-1).close,
    "long",
    false,
    config,
  );
  const benchmarkQuantity = config.initialCapital / benchmarkEntry;
  const benchmarkFees =
    (benchmarkEntry + benchmarkExit) * benchmarkQuantity * config.feeRate;
  const benchmarkFinal =
    config.initialCapital +
    (benchmarkExit - benchmarkEntry) * benchmarkQuantity -
    benchmarkFees;
  const benchmarkReturn =
    ((benchmarkFinal - config.initialCapital) / config.initialCapital) * 100;
  const heatmap = buildStrategyHeatmap(
    trainingCandles,
    config,
    Math.max(config.slowEma + 2, 31),
  );
  const result = {
    assetKey,
    interval,
    config,
    training,
    validation,
    benchmarkReturn,
    heatmap,
    splitTime: candles[splitIndex].time,
  };
  state.strategyLabResult = result;
  renderStrategyLabResult(result);
}

function readBacktestConfig() {
  const config = {
    initialCapital: Number(document.getElementById("backtestCapital").value),
    feeRate: Number(document.getElementById("backtestFee").value) / 100,
    spreadRate: Number(document.getElementById("backtestSpread").value) / 100,
    slippageRate: Number(document.getElementById("backtestSlippage").value) / 100,
    riskRate: Number(document.getElementById("backtestRisk").value) / 100,
    trainingSplit: Number(document.getElementById("backtestSplit").value) / 100,
    fastEma: Number(document.getElementById("backtestFastEma").value),
    slowEma: Number(document.getElementById("backtestSlowEma").value),
    rsiMin: Number(document.getElementById("backtestRsiMin").value),
    rsiMax: Number(document.getElementById("backtestRsiMax").value),
    atrMultiplier: Number(document.getElementById("backtestAtrMultiplier").value),
    rewardRatio: Number(document.getElementById("backtestRewardRatio").value),
    momentumThreshold: Number(document.getElementById("backtestMomentum").value),
  };
  const values = Object.values(config);
  if (values.some((value) => !Number.isFinite(value)) || !(config.initialCapital > 0)) {
    showToast("Ellenőrizd a stratégia számszerű beállításait.");
    return null;
  }
  if (config.fastEma >= config.slowEma) {
    showToast("A gyors EMA periódusa legyen kisebb a lassú EMA periódusánál.");
    return null;
  }
  if (config.rsiMin >= config.rsiMax) {
    showToast("Az RSI minimum legyen kisebb az RSI maximumnál.");
    return null;
  }
  return config;
}

function executeBacktest(candles, initialCapital, config) {
  let capital = initialCapital;
  let position = null;
  const trades = [];
  const firstTradeIndex = Math.max(config.tradeStartIndex || 31, config.slowEma + 2, 31);
  const equity = [{ time: candles[firstTradeIndex].time, equity: capital }];

  for (let index = firstTradeIndex; index < candles.length; index += 1) {
    const candle = candles[index];
    if (position) {
      const stopHit =
        position.direction === "long" ? candle.low <= position.stop : candle.high >= position.stop;
      const targetHit =
        position.direction === "long"
          ? candle.high >= position.target
          : candle.low <= position.target;
      if (stopHit || targetHit) {
        const rawExit = stopHit ? position.stop : position.target;
        const exit = applyBacktestExecutionPrice(rawExit, position.direction, false, config);
        const multiplier = position.direction === "long" ? 1 : -1;
        const gross = (exit - position.entry) * position.quantity * multiplier;
        const fees = (position.entry + exit) * position.quantity * config.feeRate;
        const pnl = gross - fees;
        capital += pnl;
        trades.push({
          ...position,
          exit,
          gross,
          fees,
          pnl,
          exitReason: stopHit ? "Stop-loss" : "Célár",
          closedAt: candle.time,
        });
        equity.push({ time: candle.time, equity: capital });
        position = null;
        continue;
      }
    }
    if (position) continue;

    const history = candles.slice(0, index);
    const closes = history.map((item) => item.close);
    const fastEma = exponentialMovingAverage(closes, config.fastEma);
    const slowEma = exponentialMovingAverage(closes, config.slowEma);
    const rsi = calculateRsi(closes, 14);
    const momentumBase = closes.at(-16);
    const momentum = momentumBase ? ((closes.at(-1) - momentumBase) / momentumBase) * 100 : 0;
    const atr = calculateAtr(history, 14);
    if (fastEma === null || slowEma === null || rsi === null || atr === null || !(capital > 0)) {
      continue;
    }
    const gap = ((fastEma - slowEma) / slowEma) * 100;
    let direction = null;
    const shortRsiMin = 100 - config.rsiMax;
    const shortRsiMax = 100 - config.rsiMin;
    if (
      gap > 0.015 &&
      rsi >= config.rsiMin &&
      rsi <= config.rsiMax &&
      momentum > config.momentumThreshold
    ) {
      direction = "long";
    }
    if (
      gap < -0.015 &&
      rsi >= shortRsiMin &&
      rsi <= shortRsiMax &&
      momentum < -config.momentumThreshold
    ) {
      direction = "short";
    }
    if (!direction) continue;

    const entry = applyBacktestExecutionPrice(candle.open, direction, true, config);
    const stopDistance = atr * config.atrMultiplier;
    const riskAmount = capital * config.riskRate;
    const unitRiskWithFees =
      stopDistance +
      entry * (config.feeRate * 2 + config.spreadRate + config.slippageRate * 2);
    const quantity = Math.min(riskAmount / unitRiskWithFees, capital / entry);
    if (!(quantity > 0)) continue;
    position = {
      direction,
      entry,
      quantity,
      stop: entry + (direction === "long" ? -stopDistance : stopDistance),
      target:
        entry +
        (direction === "long"
          ? stopDistance * config.rewardRatio
          : -stopDistance * config.rewardRatio),
      entryReason:
        `EMA${config.fastEma}/EMA${config.slowEma}, RSI ${formatNumber(rsi, 1)}, ` +
        `momentum ${formatNumber(momentum, 2)}%`,
      openedAt: candle.time,
    };
  }

  if (position) {
    const last = candles.at(-1);
    const exit = applyBacktestExecutionPrice(last.close, position.direction, false, config);
    const multiplier = position.direction === "long" ? 1 : -1;
    const gross = (exit - position.entry) * position.quantity * multiplier;
    const fees = (position.entry + exit) * position.quantity * config.feeRate;
    const pnl = gross - fees;
    capital += pnl;
    trades.push({
      ...position,
      exit,
      gross,
      fees,
      pnl,
      exitReason: "Időszak vége",
      closedAt: last.time,
    });
    equity.push({ time: last.time, equity: capital });
  }

  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
  return {
    initialCapital,
    finalCapital: capital,
    trades,
    equity,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    maxDrawdown: calculateMaxDrawdown(equity.map((point) => point.equity)),
    returnPercent: ((capital - initialCapital) / initialCapital) * 100,
    expectancy: trades.length ? trades.reduce((sum, trade) => sum + trade.pnl, 0) / trades.length : 0,
    startTime: candles[firstTradeIndex].time,
    endTime: candles.at(-1).time,
    candleCount: candles.length - firstTradeIndex,
  };
}

function applyBacktestExecutionPrice(price, direction, isEntry, config) {
  const adverseDirection =
    direction === "long" ? (isEntry ? 1 : -1) : isEntry ? -1 : 1;
  const friction = config.spreadRate / 2 + config.slippageRate;
  return price * (1 + adverseDirection * friction);
}

function buildStrategyHeatmap(candles, config, tradeStartIndex) {
  const fastValues = [...new Set([
    Math.max(3, config.fastEma - 2),
    config.fastEma,
    config.fastEma + 2,
  ])];
  const slowValues = [...new Set([
    Math.max(config.fastEma + 2, config.slowEma - 5),
    config.slowEma,
    config.slowEma + 5,
  ])];
  return fastValues.flatMap((fastEma) =>
    slowValues.map((slowEma) => {
      const result = executeBacktest(candles, config.initialCapital, {
        ...config,
        fastEma,
        slowEma: Math.max(slowEma, fastEma + 2),
        tradeStartIndex,
      });
      return { fastEma, slowEma: Math.max(slowEma, fastEma + 2), result };
    }),
  );
}

function renderStrategyLabResult(result) {
  const validation = result.validation;
  const training = result.training;
  renderBacktestResult(validation, result.interval);
  renderStrategyMetric(
    "strategyTrainReturn",
    formatSignedPercent(training.returnPercent),
    training.returnPercent,
  );
  renderStrategyMetric(
    "strategyTestReturn",
    formatSignedPercent(validation.returnPercent),
    validation.returnPercent,
  );
  renderStrategyMetric(
    "strategyBenchmark",
    formatSignedPercent(result.benchmarkReturn),
    result.benchmarkReturn,
  );
  document.getElementById("strategyTrainDetails").textContent =
    `${training.trades.length} ügylet · PF ${formatProfitFactor(training.profitFactor)}`;
  document.getElementById("strategyTestDetails").textContent =
    `${validation.trades.length} ügylet · PF ${formatProfitFactor(validation.profitFactor)}`;
  document.getElementById("strategyBenchmarkDetails").textContent =
    `Stratégia eltérése: ${formatSignedPercent(validation.returnPercent - result.benchmarkReturn)}`;
  const overfit = assessOverfitting(result);
  const overfitElement = document.getElementById("strategyOverfit");
  overfitElement.textContent = overfit.label;
  overfitElement.className = overfit.className;
  document.getElementById("strategyOverfitDetails").textContent = overfit.details;
  const verdict = document.getElementById("strategyVerdict");
  verdict.textContent = overfit.verdict;
  verdict.className = `strategy-verdict ${overfit.verdictClass}`;
  renderStrategyHeatmap(result.heatmap);
  renderStrategyWarnings(result, overfit);
  renderBacktestTrades(validation.trades);
  document.getElementById("backtestExportButton").disabled = !validation.trades.length;
}

function renderBacktestResult(result, interval) {
  document.getElementById("backtestTrades").textContent = String(result.trades.length);
  document.getElementById("backtestWinRate").textContent = `${formatNumber(result.winRate, 1)}%`;
  const pnl = result.finalCapital - result.initialCapital;
  setMetricValue("backtestPnl", formatSignedUsd(pnl), pnl);
  document.getElementById("backtestProfitFactor").textContent =
    result.profitFactor === Infinity ? "∞" : formatNumber(result.profitFactor, 2);
  document.getElementById("backtestDrawdown").textContent =
    `${formatNumber(result.maxDrawdown, 2)}%`;
  const durationHours = (result.endTime - result.startTime) / 3600000;
  document.getElementById("backtestPeriod").textContent =
    `${formatNumber(durationHours, 1)} óra · ${result.candleCount} × ${formatIntervalShort(interval)}`;
  state.backtestChart?.destroy();
  if (typeof Chart === "undefined") return;
  state.backtestChart = new Chart(document.getElementById("backtestChart"), {
    type: "line",
    data: {
      labels: result.equity.map((point) =>
        new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit" }).format(point.time),
      ),
      datasets: [{
        data: result.equity.map((point) => point.equity),
        borderColor: pnl >= 0 ? "#286849" : "#a3473d",
        backgroundColor: pnl >= 0 ? "rgba(40, 104, 73, 0.10)" : "rgba(163, 71, 61, 0.10)",
        borderWidth: 2,
        pointRadius: result.equity.length < 30 ? 2 : 0,
        fill: true,
        tension: 0.2,
      }],
    },
    options: paperChartOptions("$"),
  });
}

function renderStrategyMetric(id, text, value) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.className = value > 0 ? "positive" : value < 0 ? "negative" : "";
}

function formatSignedPercent(value) {
  return `${value > 0 ? "+" : ""}${formatNumber(value, 2)}%`;
}

function formatProfitFactor(value) {
  return value === Infinity ? "∞" : formatNumber(value, 2);
}

function assessOverfitting(result) {
  const train = result.training.returnPercent;
  const test = result.validation.returnPercent;
  const gap = Math.abs(train - test);
  const tooFewTrades = result.validation.trades.length < 8;
  const reversal = train > 0 && test < 0;
  const highGap = gap > Math.max(5, Math.abs(train) * 0.75);
  if (tooFewTrades) {
    return {
      label: "NEM MÉRHETŐ",
      className: "neutral",
      details: "Túl kevés ellenőrző ügylet",
      verdict: "Az eredmény mintája túl kicsi. Hosszabb adatsor nélkül nem tekinthető megbízhatónak.",
      verdictClass: "neutral",
    };
  }
  if (reversal || highGap) {
    return {
      label: "MAGAS",
      className: "negative",
      details: `${formatNumber(gap, 2)} százalékpont eltérés`,
      verdict: "A tanuló és ellenőrző eredmény jelentősen eltér. A stratégia túlillesztett lehet.",
      verdictClass: "negative",
    };
  }
  return {
    label: "MÉRSÉKELT",
    className: test > 0 ? "positive" : "neutral",
    details: `${formatNumber(gap, 2)} százalékpont eltérés`,
    verdict:
      test > 0
        ? "Az ellenőrző szakasz pozitív, de további adatokon és eltérő piaci helyzetekben is tesztelni kell."
        : "Az eredmény konzisztens, de nem nyereséges. Éles kereskedésre nem ad megfelelő alapot.",
    verdictClass: test > 0 ? "positive" : "neutral",
  };
}

function renderStrategyHeatmap(heatmap) {
  const container = document.getElementById("strategyHeatmap");
  container.replaceChildren(
    ...heatmap.map((cell) => {
      const element = document.createElement("div");
      element.className =
        `heatmap-cell ${cell.result.returnPercent > 0 ? "positive" : cell.result.returnPercent < 0 ? "negative" : "neutral"}`;
      const value = document.createElement("strong");
      value.textContent = formatSignedPercent(cell.result.returnPercent);
      const label = document.createElement("span");
      label.textContent = `EMA ${cell.fastEma} / ${cell.slowEma} · ${cell.result.trades.length} ügylet`;
      element.append(value, label);
      return element;
    }),
  );
}

function renderStrategyWarnings(result, overfit) {
  const warnings = [];
  const validation = result.validation;
  if (validation.trades.length < 20) {
    warnings.push(["warning", `Mindössze ${validation.trades.length} ellenőrző ügylet áll rendelkezésre.`]);
  }
  if (validation.maxDrawdown > 10) {
    warnings.push(["warning", `A ${formatNumber(validation.maxDrawdown, 1)}%-os visszaesés magas.`]);
  }
  if (validation.returnPercent < result.benchmarkReturn) {
    warnings.push(["warning", "A stratégia elmaradt az egyszerű Buy & Hold benchmarktól."]);
  }
  const positiveVariants = result.heatmap.filter((cell) => cell.result.returnPercent > 0).length;
  if (positiveVariants < result.heatmap.length / 2) {
    warnings.push(["warning", "A tanuló szakaszon a közeli EMA-beállítások többsége veszteséges."]);
  } else {
    warnings.push(["success", "A tanuló szakaszon a közeli EMA-beállítások többsége pozitív lett."]);
  }
  if (overfit.className !== "negative" && validation.returnPercent > 0) {
    warnings.push(["success", "Az ellenőrző szakasz költségek után is pozitív lett."]);
  }
  const list = document.getElementById("strategyWarnings");
  list.replaceChildren(
    ...warnings.map(([className, text]) => {
      const item = document.createElement("li");
      item.className = className;
      item.textContent = text;
      return item;
    }),
  );
}

function renderBacktestTrades(trades) {
  const table = document.getElementById("backtestTradesTable");
  table.replaceChildren();
  if (!trades.length) {
    appendEmptyTableRow(table, 7, "Az ellenőrző szakaszon nem nyílt ügylet.");
    return;
  }
  trades.slice().reverse().slice(0, 100).forEach((trade) => {
    const row = document.createElement("tr");
    [
      new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(trade.openedAt),
      trade.direction === "long" ? "LONG" : "SHORT",
      `$${formatNumber(trade.entry, 2)}`,
      `$${formatNumber(trade.exit, 2)}`,
      trade.exitReason,
      `$${formatNumber(trade.fees, 2)}`,
      formatSignedUsd(trade.pnl),
    ].forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 6) cell.className = valueClass(trade.pnl);
      row.append(cell);
    });
    table.append(row);
  });
}

function exportBacktestCsv() {
  const result = state.strategyLabResult;
  if (!result?.validation?.trades?.length) return;
  const rows = [
    ["opened_at", "closed_at", "direction", "entry", "exit", "quantity", "exit_reason", "fees", "pnl", "entry_reason"],
    ...result.validation.trades.map((trade) => [
      new Date(trade.openedAt).toISOString(),
      new Date(trade.closedAt).toISOString(),
      trade.direction,
      trade.entry,
      trade.exit,
      trade.quantity,
      trade.exitReason,
      trade.fees,
      trade.pnl,
      trade.entryReason,
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `strategy-backtest-${result.assetKey}-${formatIntervalShort(result.interval)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
    const assetName = getAssetName(alert.asset);
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
  const signalButton = document.getElementById("signalNotificationButton");
  if (signalButton) {
    signalButton.textContent =
      permission === "granted" ? "Jelzésértesítések aktívak" : "Jelzésértesítések";
  }
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
    const assetName = getAssetName(alert.asset);
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
  const intradayLines = Catalog.ALL_KEYS.map((key) => {
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

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("hu-HU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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
