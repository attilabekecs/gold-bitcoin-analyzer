(function () {
  "use strict";

  const YAHOO_INTERVALS = { 1: "1m", 5: "5m", 15: "15m", 60: "1h" };
  const TWELVE_INTERVALS = { 1: "1min", 5: "5min", 15: "15min", 60: "1h" };

  function cryptoAsset(key, name, shortName, icon, coingeckoId, krakenPair, chartColor, iconClass = "eth-icon") {
    return {
      key,
      featured: false,
      category: "crypto",
      name,
      shortName,
      pair: `${shortName} / USD`,
      icon,
      iconClass,
      cardClass: iconClass.replace("-icon", "-card"),
      chartColor,
      priceDecimals: shortName === "DOGE" ? 4 : 2,
      sentimentKeywords: [name.toLowerCase(), shortName.toLowerCase(), "crypto"],
      sourceLabel: `${name} árfolyam`,
      dataType: "crypto",
      coingeckoId,
      krakenPair,
    };
  }

  function yahooAsset(key, name, shortName, icon, yahooSymbol, chartColor, options = {}) {
    const category = options.category || "stock";
    const iconClass =
      options.iconClass ||
      (category === "forex" ? "fx-icon" : category === "commodity" ? "oil-icon" : "spy-icon");
    return {
      key,
      featured: false,
      category,
      name,
      shortName,
      pair: options.pair || `${shortName} / USD`,
      icon,
      iconClass,
      cardClass: iconClass.replace("-icon", "-card"),
      chartColor,
      priceDecimals: options.priceDecimals ?? (category === "forex" ? 5 : 2),
      unitSuffix: options.unitSuffix,
      sentimentKeywords: options.sentimentKeywords || [name.toLowerCase(), shortName.toLowerCase()],
      sourceLabel: options.sourceLabel || name,
      dataType: "yahoo",
      yahooSymbol,
    };
  }

  const CATALOG = {
    bitcoin: {
      key: "bitcoin",
      featured: true,
      category: "crypto",
      name: "Bitcoin",
      shortName: "BTC",
      pair: "BTC / USD",
      icon: "₿",
      iconClass: "bitcoin-icon",
      cardClass: "bitcoin-card",
      chartColor: "#e2863b",
      priceDecimals: 2,
      sentimentKeywords: ["bitcoin", "crypto", "btc"],
      sourceLabel: "Bitcoin árfolyam",
      dataType: "crypto",
      coingeckoId: "bitcoin",
      krakenPair: "XBTUSD",
    },
    gold: {
      key: "gold",
      featured: true,
      category: "commodity",
      name: "Arany",
      shortName: "Au",
      pair: "GOLD / USD",
      icon: "Au",
      iconClass: "gold-icon",
      cardClass: "gold-card",
      chartColor: "#b98a35",
      priceDecimals: 2,
      unitSuffix: " / uncia",
      sentimentKeywords: ["gold", "bullion", "xau"],
      sourceLabel: "Arany spot ár",
      dataType: "gold",
    },
    ethereum: cryptoAsset("ethereum", "Ethereum", "ETH", "Ξ", "ethereum", "ETHUSD", "#627eea", "eth-icon"),
    solana: cryptoAsset("solana", "Solana", "SOL", "◎", "solana", "SOLUSD", "#14f195", "sol-icon"),
    cardano: cryptoAsset("cardano", "Cardano", "ADA", "A", "cardano", "ADAUSD", "#0033ad"),
    ripple: cryptoAsset("ripple", "Ripple (XRP)", "XRP", "X", "ripple", "XRPUSD", "#0085c3"),
    polkadot: cryptoAsset("polkadot", "Polkadot", "DOT", "D", "polkadot", "DOTUSD", "#e6007a"),
    avalanche: cryptoAsset("avalanche", "Avalanche", "AVAX", "A", "avalanche-2", "AVAXUSD", "#e84142"),
    chainlink: cryptoAsset("chainlink", "Chainlink", "LINK", "L", "chainlink", "LINKUSD", "#375bd2"),
    litecoin: cryptoAsset("litecoin", "Litecoin", "LTC", "Ł", "litecoin", "LTCUSD", "#bfbbbb"),
    dogecoin: cryptoAsset("dogecoin", "Dogecoin", "DOGE", "Ð", "dogecoin", "DOGEUSD", "#c2a633"),
    uniswap: cryptoAsset("uniswap", "Uniswap", "UNI", "U", "uniswap", "UNIUSD", "#ff007a"),
    stellar: cryptoAsset("stellar", "Stellar", "XLM", "★", "stellar", "XLMUSD", "#7d00ff"),
    cosmos: cryptoAsset("cosmos", "Cosmos", "ATOM", "C", "cosmos", "ATOMUSD", "#2e3148"),
    polygon: cryptoAsset("polygon", "Polygon", "MATIC", "M", "matic-network", "MATICUSD", "#8247e5"),
    bitcoincash: cryptoAsset("bitcoincash", "Bitcoin Cash", "BCH", "B", "bitcoin-cash", "BCHUSD", "#8dc351"),
    aave: cryptoAsset("aave", "Aave", "AAVE", "Å", "aave", "AAVEUSD", "#b6509e"),
    near: cryptoAsset("near", "NEAR Protocol", "NEAR", "N", "near", "NEARUSD", "#00c08b"),
    filecoin: cryptoAsset("filecoin", "Filecoin", "FIL", "F", "filecoin", "FILUSD", "#0090ff"),
    eurusd: yahooAsset("eurusd", "EUR/USD", "EUR", "€", "EURUSD=X", "#3d6f8f", {
      category: "forex",
      sentimentKeywords: ["euro", "eur", "ecb", "forex"],
      sourceLabel: "EUR/USD deviza",
    }),
    gbpusd: yahooAsset("gbpusd", "GBP/USD", "GBP", "£", "GBPUSD=X", "#4a6f8f", {
      category: "forex",
      sentimentKeywords: ["pound", "gbp", "boe", "forex"],
      sourceLabel: "GBP/USD deviza",
    }),
    usdjpy: yahooAsset("usdjpy", "USD/JPY", "JPY", "¥", "USDJPY=X", "#6b4f3f", {
      category: "forex",
      pair: "USD / JPY",
      sentimentKeywords: ["yen", "jpy", "boj", "forex"],
      sourceLabel: "USD/JPY deviza",
    }),
    usdchf: yahooAsset("usdchf", "USD/CHF", "CHF", "₣", "USDCHF=X", "#5a6b72", {
      category: "forex",
      pair: "USD / CHF",
      sentimentKeywords: ["franc", "chf", "snb", "forex"],
      sourceLabel: "USD/CHF deviza",
    }),
    audusd: yahooAsset("audusd", "AUD/USD", "AUD", "A$", "AUDUSD=X", "#8f6b3d", {
      category: "forex",
      sentimentKeywords: ["aussie", "aud", "rba", "forex"],
      sourceLabel: "AUD/USD deviza",
    }),
    usdcad: yahooAsset("usdcad", "USD/CAD", "CAD", "C$", "USDCAD=X", "#7a5a45", {
      category: "forex",
      pair: "USD / CAD",
      sentimentKeywords: ["loonie", "cad", "boc", "forex"],
      sourceLabel: "USD/CAD deviza",
    }),
    nzdusd: yahooAsset("nzdusd", "NZD/USD", "NZD", "N$", "NZDUSD=X", "#6f7a4a", {
      category: "forex",
      sentimentKeywords: ["kiwi", "nzd", "rbnz", "forex"],
      sourceLabel: "NZD/USD deviza",
    }),
    eurgbp: yahooAsset("eurgbp", "EUR/GBP", "EURGBP", "€£", "EURGBP=X", "#4f6d82", {
      category: "forex",
      pair: "EUR / GBP",
      sentimentKeywords: ["euro", "pound", "forex"],
      sourceLabel: "EUR/GBP deviza",
    }),
    eurjpy: yahooAsset("eurjpy", "EUR/JPY", "EURJPY", "€¥", "EURJPY=X", "#5d6f7a", {
      category: "forex",
      pair: "EUR / JPY",
      sentimentKeywords: ["euro", "yen", "forex"],
      sourceLabel: "EUR/JPY deviza",
    }),
    oil: yahooAsset("oil", "Olaj (WTI)", "OIL", "🛢", "CL=F", "#5c4a32", {
      category: "commodity",
      unitSuffix: " / hordó",
      sentimentKeywords: ["oil", "crude", "wti", "opec", "energy"],
      sourceLabel: "WTI olaj",
    }),
    brent: yahooAsset("brent", "Brent olaj", "BRENT", "🛢", "BZ=F", "#4a3d2a", {
      category: "commodity",
      unitSuffix: " / hordó",
      sentimentKeywords: ["brent", "oil", "crude", "energy"],
      sourceLabel: "Brent olaj",
    }),
    silver: yahooAsset("silver", "Ezüst", "Ag", "Ag", "SI=F", "#9aa3ad", {
      category: "commodity",
      unitSuffix: " / uncia",
      sentimentKeywords: ["silver", "xag", "precious", "metal"],
      sourceLabel: "Ezüst spot",
    }),
    naturalgas: yahooAsset("naturalgas", "Földgáz", "NG", "⛽", "NG=F", "#6f8f5d", {
      category: "commodity",
      sentimentKeywords: ["natural gas", "energy", "ng"],
      sourceLabel: "Henry Hub földgáz",
    }),
    copper: yahooAsset("copper", "Réz", "Cu", "Cu", "HG=F", "#b87333", {
      category: "commodity",
      sentimentKeywords: ["copper", "metal", "commodity"],
      sourceLabel: "Réz határidős",
    }),
    platinum: yahooAsset("platinum", "Platina", "Pt", "Pt", "PL=F", "#7f8c8d", {
      category: "commodity",
      unitSuffix: " / uncia",
      sentimentKeywords: ["platinum", "precious", "metal"],
      sourceLabel: "Platina spot",
    }),
    spy: yahooAsset("spy", "S&P 500 (SPY)", "SPY", "S", "SPY", "#2f5d50", {
      category: "index",
      sentimentKeywords: ["s&p", "spy", "stocks", "equity"],
      sourceLabel: "S&P 500 proxy",
    }),
    qqq: yahooAsset("qqq", "Nasdaq 100 (QQQ)", "QQQ", "Q", "QQQ", "#1f4f7a", {
      category: "index",
      sentimentKeywords: ["nasdaq", "qqq", "tech", "stocks"],
      sourceLabel: "Nasdaq 100 proxy",
    }),
    dia: yahooAsset("dia", "Dow Jones (DIA)", "DIA", "D", "DIA", "#3d5a4a", {
      category: "index",
      sentimentKeywords: ["dow", "dia", "stocks", "equity"],
      sourceLabel: "Dow Jones proxy",
    }),
    iwm: yahooAsset("iwm", "Russell 2000 (IWM)", "IWM", "R", "IWM", "#5a4a3d", {
      category: "index",
      sentimentKeywords: ["russell", "small cap", "iwm", "stocks"],
      sourceLabel: "Russell 2000 proxy",
    }),
    gld: yahooAsset("gld", "Arany ETF (GLD)", "GLD", "G", "GLD", "#b98a35", {
      category: "etf",
      sentimentKeywords: ["gold", "gld", "etf", "bullion"],
      sourceLabel: "Arany ETF",
    }),
    slv: yahooAsset("slv", "Ezüst ETF (SLV)", "SLV", "Ag", "SLV", "#8f9aa8", {
      category: "etf",
      sentimentKeywords: ["silver", "slv", "etf"],
      sourceLabel: "Ezüst ETF",
    }),
    uso: yahooAsset("uso", "Olaj ETF (USO)", "USO", "O", "USO", "#6b4f32", {
      category: "etf",
      sentimentKeywords: ["oil", "uso", "energy", "etf"],
      sourceLabel: "Olaj ETF",
    }),
    tlt: yahooAsset("tlt", "Kötvény ETF (TLT)", "TLT", "B", "TLT", "#4a5d6f", {
      category: "etf",
      sentimentKeywords: ["bonds", "treasury", "tlt", "rates"],
      sourceLabel: "USA kötvény ETF",
    }),
    xle: yahooAsset("xle", "Energia ETF (XLE)", "XLE", "E", "XLE", "#6f5a32", {
      category: "etf",
      sentimentKeywords: ["energy", "xle", "oil", "etf"],
      sourceLabel: "Energia szektor ETF",
    }),
    xlk: yahooAsset("xlk", "Tech ETF (XLK)", "XLK", "T", "XLK", "#2f4f7a", {
      category: "etf",
      sentimentKeywords: ["tech", "xlk", "nasdaq", "etf"],
      sourceLabel: "Technológia szektor ETF",
    }),
    xlf: yahooAsset("xlf", "Pénzügy ETF (XLF)", "XLF", "F", "XLF", "#3d5a50", {
      category: "etf",
      sentimentKeywords: ["financials", "xlf", "banks", "etf"],
      sourceLabel: "Pénzügyi szektor ETF",
    }),
    eem: yahooAsset("eem", "Emerging ETF (EEM)", "EEM", "EM", "EEM", "#5a6f4a", {
      category: "etf",
      sentimentKeywords: ["emerging", "eem", "global", "etf"],
      sourceLabel: "Fejlődő piacok ETF",
    }),
    vti: yahooAsset("vti", "USA részvény (VTI)", "VTI", "V", "VTI", "#3f5d4f", {
      category: "etf",
      sentimentKeywords: ["vti", "stocks", "usa", "etf"],
      sourceLabel: "Teljes USA piac ETF",
    }),
    aapl: yahooAsset("aapl", "Apple", "AAPL", "A", "AAPL", "#6f6f6f", {
      category: "stock",
      sentimentKeywords: ["apple", "aapl", "tech", "stocks"],
      sourceLabel: "Apple részvény",
    }),
    msft: yahooAsset("msft", "Microsoft", "MSFT", "M", "MSFT", "#4f8fd1", {
      category: "stock",
      sentimentKeywords: ["microsoft", "msft", "tech", "stocks"],
      sourceLabel: "Microsoft részvény",
    }),
    nvda: yahooAsset("nvda", "NVIDIA", "NVDA", "N", "NVDA", "#76b900", {
      category: "stock",
      sentimentKeywords: ["nvidia", "nvda", "ai", "stocks"],
      sourceLabel: "NVIDIA részvény",
    }),
    tsla: yahooAsset("tsla", "Tesla", "TSLA", "T", "TSLA", "#cc0000", {
      category: "stock",
      sentimentKeywords: ["tesla", "tsla", "ev", "stocks"],
      sourceLabel: "Tesla részvény",
    }),
    amzn: yahooAsset("amzn", "Amazon", "AMZN", "Z", "AMZN", "#ff9900", {
      category: "stock",
      sentimentKeywords: ["amazon", "amzn", "retail", "stocks"],
      sourceLabel: "Amazon részvény",
    }),
    goog: yahooAsset("goog", "Alphabet", "GOOG", "G", "GOOGL", "#4285f4", {
      category: "stock",
      sentimentKeywords: ["google", "alphabet", "goog", "stocks"],
      sourceLabel: "Alphabet részvény",
    }),
    meta: yahooAsset("meta", "Meta", "META", "M", "META", "#1877f2", {
      category: "stock",
      sentimentKeywords: ["meta", "facebook", "social", "stocks"],
      sourceLabel: "Meta részvény",
    }),
    jpm: yahooAsset("jpm", "JPMorgan", "JPM", "J", "JPM", "#005eb8", {
      category: "stock",
      sentimentKeywords: ["jpmorgan", "jpm", "bank", "stocks"],
      sourceLabel: "JPMorgan részvény",
    }),
  };

  const FEATURED_KEYS = ["bitcoin", "gold"];
  const EXTENDED_KEYS = [
    "ethereum",
    "solana",
    "eurusd",
    "oil",
    "spy",
    "qqq",
    "silver",
    "gbpusd",
    "nvda",
    "aapl",
  ];
  const ALL_KEYS = Object.keys(CATALOG);
  const PRIORITY_KEYS = [...new Set([...FEATURED_KEYS, ...EXTENDED_KEYS])];
  const SCAN_ONLY_KEYS = ALL_KEYS.filter((key) => !PRIORITY_KEYS.includes(key));
  const SCAN_BATCH_SIZE = 5;
  const SCAN_BATCH_DELAY_MS = 300;

  function getAsset(key) {
    return CATALOG[key] || null;
  }

  function getName(key) {
    return CATALOG[key]?.name || key;
  }

  function isFeatured(key) {
    return Boolean(CATALOG[key]?.featured);
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

  function buildIntradayAsset(meta, candles, source, interval = 1) {
    const fetchedAt = Date.now();
    return {
      name: meta.name,
      candles,
      source,
      interval,
      currentPrice: candles.at(-1).close,
      updatedAt: candles.at(-1).time,
      fetchedAt,
    };
  }

  function buildAssetFromPoints(meta, points, currentPrice) {
    const previousPoint = points.at(-2);
    const change = previousPoint
      ? ((currentPrice - previousPoint.price) / previousPoint.price) * 100
      : null;
    return {
      name: meta.name,
      points,
      prices: points.map((point) => point.price),
      currentPrice,
      change,
    };
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

  async function fetchJsonWithRetry(url, options = {}) {
    const {
      timeout = 12000,
      headers = {},
      retries = 2,
      retryDelayMs = 800,
      retryStatuses = [408, 425, 429, 500, 502, 503, 504],
    } = options;
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fetchJson(url, timeout, headers);
      } catch (error) {
        lastError = error;
        const status = Number(String(error?.message || "").replace("HTTP ", ""));
        const shouldRetry = retryStatuses.includes(status) || /abort/i.test(String(error?.message || ""));
        if (!shouldRetry || attempt >= retries) break;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
      }
    }
    throw lastError || new Error("Fetch failed");
  }

  async function fetchYahooChart(yahooSymbol, interval, range) {
    const chartUrl =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
      `?interval=${interval}&range=${range}`;
    try {
      return await fetchJsonWithRetry(chartUrl, { timeout: 15000, retries: 1 });
    } catch {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(chartUrl)}`;
      return fetchJsonWithRetry(proxyUrl, { timeout: 20000, retries: 2 });
    }
  }

  async function fetchCryptoDaily(meta, timeframe, settings) {
    const url =
      `https://api.coingecko.com/api/v3/coins/${meta.coingeckoId}/market_chart` +
      `?vs_currency=usd&days=${timeframe}&interval=daily`;
    const headers = settings.coinGeckoKey
      ? { "x-cg-demo-api-key": settings.coinGeckoKey }
      : {};
    const data = await fetchJsonWithRetry(url, { timeout: 12000, headers, retries: 2 });
    const points = (data.prices || [])
      .map(([time, price]) => ({ time: Number(time), price: Number(price) }))
      .filter((point) => Number.isFinite(point.price));
    if (points.length < Math.min(7, timeframe)) {
      throw new Error(`Nincs elegendő ${meta.name}-adat`);
    }
    return buildAssetFromPoints(meta, points, points.at(-1).price);
  }

  async function fetchKrakenIntraday(meta, interval, formatIntervalShort, formatIntervalLong) {
    const data = await fetchJsonWithRetry(
      `https://api.kraken.com/0/public/OHLC?pair=${meta.krakenPair}&interval=${interval}`,
      { timeout: 12000, retries: 2 },
    );
    if (data.error?.length) throw new Error(data.error.join(", "));
    const series = Object.entries(data.result || {}).find(([key, value]) => {
      return key !== "last" && Array.isArray(value);
    })?.[1];
    const candles = (series || [])
      .slice(-720)
      .map((item) => ({
        time: Number(item[0]) * 1000,
        open: Number(item[1]),
        high: Number(item[2]),
        low: Number(item[3]),
        close: Number(item[4]),
        volume: Number(item[6]),
      }))
      .filter(isValidCandle);
    if (candles.length < 30) {
      throw new Error(`Nincs elegendő ${formatIntervalLong(interval)} ${meta.name}-adat`);
    }
    return buildIntradayAsset(
      meta,
      candles,
      `Kraken · ${formatIntervalShort(interval)}`,
      interval,
    );
  }

  async function fetchYahooIntraday(meta, interval, formatIntervalShort, formatIntervalLong) {
    const yahooInterval = YAHOO_INTERVALS[interval] || "1m";
    const range = interval === 60 ? "5d" : "1d";
    const data = await fetchYahooChart(meta.yahooSymbol, yahooInterval, range);
    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const candles = timestamps
      .map((time, index) => ({
        time: Number(time) * 1000,
        open: Number(quote.open?.[index]),
        high: Number(quote.high?.[index]),
        low: Number(quote.low?.[index]),
        close: Number(quote.close?.[index]),
        volume: Number(quote.volume?.[index] || 0),
      }))
      .filter(isValidCandle)
      .sort((left, right) => left.time - right.time);
    if (candles.length < 20) {
      throw new Error(`Nincs elegendő ${formatIntervalLong(interval)} ${meta.name}-adat`);
    }
    return buildIntradayAsset(
      meta,
      candles,
      `Yahoo · ${formatIntervalShort(interval)}`,
      interval,
    );
  }

  async function fetchYahooDaily(meta, timeframe) {
    const range = timeframe <= 7 ? "7d" : timeframe <= 30 ? "1mo" : timeframe <= 90 ? "3mo" : "1y";
    const data = await fetchYahooChart(meta.yahooSymbol, "1d", range);
    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const points = timestamps
      .map((time, index) => ({
        time: Number(time) * 1000,
        price: Number(closes[index]),
      }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price))
      .sort((left, right) => left.time - right.time)
      .slice(-timeframe);
    if (points.length < 7) throw new Error(`Nincs elegendő ${meta.name}-adat`);
    return buildAssetFromPoints(meta, points, points.at(-1).price);
  }

  async function fetchGoldDaily(timeframe, settings, endpoints) {
    if (settings.twelveDataKey) {
      try {
        const outputSize = Math.min(timeframe, 365);
        const url =
          `https://api.twelvedata.com/time_series?symbol=XAU%2FUSD&interval=1day` +
          `&outputsize=${outputSize}&apikey=${encodeURIComponent(settings.twelveDataKey)}`;
        const data = await fetchJson(url, 15000);
        if (data.status === "error") throw new Error(data.message);
        const points = (data.values || [])
          .map((item) => ({ time: new Date(item.datetime).getTime(), price: Number(item.close) }))
          .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price))
          .sort((left, right) => left.time - right.time);
        if (points.length >= 7) {
          return buildAssetFromPoints(CATALOG.gold, points, points.at(-1).price);
        }
      } catch {
        // Fall through to free sources.
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
        .sort((left, right) => left.time - right.time)
        .slice(-timeframe);
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
    const asset = buildAssetFromPoints(
      CATALOG.gold,
      points,
      Number.isFinite(spotPrice) ? spotPrice : points.at(-1).price,
    );
    asset.warning = !historyIsFresh;
    return asset;
  }

  async function fetchGoldIntraday(interval, settings, formatIntervalShort, formatIntervalLong) {
    if (!settings.twelveDataKey) return null;
    const params = new URLSearchParams({
      symbol: "XAU/USD",
      interval: TWELVE_INTERVALS[interval] || "1min",
      outputsize: "500",
      apikey: settings.twelveDataKey,
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
    return buildIntradayAsset(
      CATALOG.gold,
      candles,
      `Twelve Data · ${formatIntervalShort(interval)}`,
      interval,
    );
  }

  async function fetchDaily(assetKey, timeframe, settings, endpoints) {
    const meta = getAsset(assetKey);
    if (!meta) throw new Error("Ismeretlen eszköz");
    if (meta.dataType === "crypto") return fetchCryptoDaily(meta, timeframe, settings);
    if (meta.dataType === "gold") return fetchGoldDaily(timeframe, settings, endpoints);
    if (meta.dataType === "yahoo") return fetchYahooDaily(meta, timeframe);
    throw new Error(`Nincs napi adatforrás: ${meta.name}`);
  }

  async function fetchIntraday(assetKey, interval, settings, formatIntervalShort, formatIntervalLong) {
    const meta = getAsset(assetKey);
    if (!meta) throw new Error("Ismeretlen eszköz");
    if (meta.dataType === "crypto") {
      return fetchKrakenIntraday(meta, interval, formatIntervalShort, formatIntervalLong);
    }
    if (meta.dataType === "gold") {
      return fetchGoldIntraday(interval, settings, formatIntervalShort, formatIntervalLong);
    }
    if (meta.dataType === "yahoo") {
      return fetchYahooIntraday(meta, interval, formatIntervalShort, formatIntervalLong);
    }
    throw new Error(`Nincs intraday adatforrás: ${meta.name}`);
  }

  async function fetchAdditionalTimeframes(
    assetKey,
    settings,
    formatIntervalShort,
    formatIntervalLong,
    endpoints,
  ) {
    const intervals = [5, 15, 60];
    const results = await Promise.allSettled(
      intervals.map((interval) =>
        fetchIntraday(assetKey, interval, settings, formatIntervalShort, formatIntervalLong),
      ),
    );
    return Object.fromEntries(
      results
        .map((result, index) => [intervals[index], result.status === "fulfilled" ? result.value : null])
        .filter(([, value]) => value),
    );
  }

  async function runInBatches(items, worker, batchSize = SCAN_BATCH_SIZE, delayMs = SCAN_BATCH_DELAY_MS) {
    const results = [];
    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);
      const batchResults = await Promise.allSettled(batch.map((item) => worker(item)));
      results.push(...batchResults);
      if (index + batchSize < items.length && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return results;
  }

  window.AssetCatalog = {
    CATALOG,
    FEATURED_KEYS,
    EXTENDED_KEYS,
    ALL_KEYS,
    PRIORITY_KEYS,
    SCAN_ONLY_KEYS,
    SCAN_BATCH_SIZE,
    SCAN_BATCH_DELAY_MS,
    getAsset,
    getName,
    isFeatured,
    fetchDaily,
    fetchIntraday,
    fetchAdditionalTimeframes,
    buildIntradayAsset,
    isValidCandle,
    runInBatches,
  };
})();
