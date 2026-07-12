(function () {
  "use strict";

  const YAHOO_INTERVALS = { 1: "1m", 5: "5m", 15: "15m", 60: "1h" };
  const TWELVE_INTERVALS = { 1: "1min", 5: "5min", 15: "15min", 60: "1h" };

  const CATALOG = {
    bitcoin: {
      key: "bitcoin",
      featured: true,
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
    ethereum: {
      key: "ethereum",
      featured: false,
      name: "Ethereum",
      shortName: "ETH",
      pair: "ETH / USD",
      icon: "Ξ",
      iconClass: "eth-icon",
      cardClass: "eth-card",
      chartColor: "#627eea",
      priceDecimals: 2,
      sentimentKeywords: ["ethereum", "eth", "crypto"],
      sourceLabel: "Ethereum árfolyam",
      dataType: "crypto",
      coingeckoId: "ethereum",
      krakenPair: "ETHUSD",
    },
    solana: {
      key: "solana",
      featured: false,
      name: "Solana",
      shortName: "SOL",
      pair: "SOL / USD",
      icon: "◎",
      iconClass: "sol-icon",
      cardClass: "sol-card",
      chartColor: "#14f195",
      priceDecimals: 2,
      sentimentKeywords: ["solana", "sol", "crypto"],
      sourceLabel: "Solana árfolyam",
      dataType: "crypto",
      coingeckoId: "solana",
      krakenPair: "SOLUSD",
    },
    eurusd: {
      key: "eurusd",
      featured: false,
      name: "EUR/USD",
      shortName: "EUR",
      pair: "EUR / USD",
      icon: "€",
      iconClass: "fx-icon",
      cardClass: "fx-card",
      chartColor: "#3d6f8f",
      priceDecimals: 5,
      sentimentKeywords: ["euro", "eur", "ecb", "forex"],
      sourceLabel: "EUR/USD deviza",
      dataType: "yahoo",
      yahooSymbol: "EURUSD=X",
    },
    oil: {
      key: "oil",
      featured: false,
      name: "Olaj (WTI)",
      shortName: "OIL",
      pair: "WTI / USD",
      icon: "🛢",
      iconClass: "oil-icon",
      cardClass: "oil-card",
      chartColor: "#5c4a32",
      priceDecimals: 2,
      unitSuffix: " / hordó",
      sentimentKeywords: ["oil", "crude", "wti", "opec", "energy"],
      sourceLabel: "WTI olaj",
      dataType: "yahoo",
      yahooSymbol: "CL=F",
    },
    spy: {
      key: "spy",
      featured: false,
      name: "S&P 500 (SPY)",
      shortName: "SPY",
      pair: "SPY / USD",
      icon: "S",
      iconClass: "spy-icon",
      cardClass: "spy-card",
      chartColor: "#2f5d50",
      priceDecimals: 2,
      sentimentKeywords: ["s&p", "spy", "stocks", "equity", "nasdaq"],
      sourceLabel: "S&P 500 proxy",
      dataType: "yahoo",
      yahooSymbol: "SPY",
    },
  };

  const FEATURED_KEYS = ["bitcoin", "gold"];
  const EXTENDED_KEYS = ["ethereum", "solana", "eurusd", "oil", "spy"];
  const ALL_KEYS = [...FEATURED_KEYS, ...EXTENDED_KEYS];

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
    return {
      name: meta.name,
      candles,
      source,
      interval,
      currentPrice: candles.at(-1).close,
      updatedAt: candles.at(-1).time,
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

  async function fetchCryptoDaily(meta, timeframe, settings) {
    const url =
      `https://api.coingecko.com/api/v3/coins/${meta.coingeckoId}/market_chart` +
      `?vs_currency=usd&days=${timeframe}&interval=daily`;
    const headers = settings.coinGeckoKey
      ? { "x-cg-demo-api-key": settings.coinGeckoKey }
      : {};
    const data = await fetchJson(url, 12000, headers);
    const points = (data.prices || [])
      .map(([time, price]) => ({ time: Number(time), price: Number(price) }))
      .filter((point) => Number.isFinite(point.price));
    if (points.length < Math.min(7, timeframe)) {
      throw new Error(`Nincs elegendő ${meta.name}-adat`);
    }
    return buildAssetFromPoints(meta, points, points.at(-1).price);
  }

  async function fetchKrakenIntraday(meta, interval, formatIntervalShort, formatIntervalLong) {
    const data = await fetchJson(
      `https://api.kraken.com/0/public/OHLC?pair=${meta.krakenPair}&interval=${interval}`,
      12000,
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
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.yahooSymbol)}` +
      `?interval=${yahooInterval}&range=${range}`;
    const data = await fetchJson(url, 15000);
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
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.yahooSymbol)}` +
      `?interval=1d&range=${range}`;
    const data = await fetchJson(url, 15000);
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

  window.AssetCatalog = {
    CATALOG,
    FEATURED_KEYS,
    EXTENDED_KEYS,
    ALL_KEYS,
    getAsset,
    getName,
    isFeatured,
    fetchDaily,
    fetchIntraday,
    fetchAdditionalTimeframes,
    buildIntradayAsset,
    isValidCandle,
  };
})();
