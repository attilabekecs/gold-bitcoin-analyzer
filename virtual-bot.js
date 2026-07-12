(function () {
  "use strict";

  const STORAGE_KEY = "aurum-virtual-bot";

  const PARAM_BOUNDS = {
    minConfidence: { min: 40, max: 90, step: 5 },
    riskPercent: { min: 0.1, max: 5, step: 0.25 },
    cooldownMinutes: { min: 5, max: 120, step: 5 },
    maxPositions: { min: 1, max: 10, step: 1 },
    rewardRatio: { min: 1, max: 5, step: 0.25 },
    atrStopMultiplier: { min: 0.5, max: 5, step: 0.25 },
    signalScoreThreshold: { min: 1.5, max: 4, step: 0.25 },
    momentumThreshold: { min: 0.03, max: 0.5, step: 0.02 },
  };

  const DEFAULT_CONFIG = {
    enabled: false,
    autoLearnEnabled: false,
    professionalMode: true,
    marketWideMode: true,
    assets: ["bitcoin", "ethereum", "spy"],
    currency: "sync",
    initialCapital: 10000,
    riskPercent: 1,
    maxPositions: 4,
    cooldownMinutes: 20,
    proMinConfidenceFloor: 45,
    proHighScoreThreshold: 75,
    proWinCooldownMinutes: 2,
    primaryInterval: 1,
    direction: "both",
    fastEma: 9,
    slowEma: 21,
    rsiPeriod: 14,
    rsiLongMin: 52,
    rsiLongMax: 68,
    rsiShortMin: 32,
    rsiShortMax: 48,
    rsiOverbought: 72,
    rsiOversold: 28,
    useMacd: true,
    momentumLookback: 15,
    momentumThreshold: 0.12,
    useVolume: true,
    volumeMultiplier: 1.3,
    signalScoreThreshold: 2.5,
    minConfidence: 55,
    requireAlignment: false,
    minAlignmentRatio: 0.75,
    minAlignedTimeframes: 2,
    atrPeriod: 14,
    atrStopMultiplier: 1.5,
    rewardRatio: 2,
    autoCloseOnReversal: true,
    feePercent: 0.1,
    spreadPercent: 0.02,
    slippagePercent: 0.01,
    useTradingHours: false,
    tradingHoursStart: 8,
    tradingHoursEnd: 20,
  };

  const LEARNABLE_KEYS = [
    "minConfidence",
    "riskPercent",
    "cooldownMinutes",
    "maxPositions",
    "rewardRatio",
    "atrStopMultiplier",
    "signalScoreThreshold",
    "requireAlignment",
    "momentumThreshold",
  ];

  const CONFIG_LABELS = {
    enabled: "Bot bekapcsolva",
    autoLearnEnabled: "Auto-tanulás",
    professionalMode: "Professzionális mód",
    marketWideMode: "Piaci mód (összes eszköz)",
    currency: "Pénznem",
    assets: "Követett eszközök",
    initialCapital: "Kezdőtőke",
    accountReset: "Számla újraindítás",
    riskPercent: "Kockázat / ügylet",
    maxPositions: "Max. pozíció",
    cooldownMinutes: "Cooldown (perc)",
    proMinConfidenceFloor: "Pro: min. bizalom padló",
    proHighScoreThreshold: "Pro: magas pontszám küszöb",
    proWinCooldownMinutes: "Pro: pihenő nyertes után",
    primaryInterval: "Primér idősík",
    direction: "Kereskedési irány",
    fastEma: "Gyors EMA",
    slowEma: "Lassú EMA",
    rsiPeriod: "RSI periódus",
    rsiLongMin: "LONG RSI min",
    rsiLongMax: "LONG RSI max",
    rsiShortMin: "SHORT RSI min",
    rsiShortMax: "SHORT RSI max",
    rsiOverbought: "RSI túlvett",
    rsiOversold: "RSI túladott",
    useMacd: "MACD megerősítés",
    momentumLookback: "Momentum ablak",
    momentumThreshold: "Momentum küszöb",
    useVolume: "Volumen megerősítés",
    signalScoreThreshold: "Jelzésküszöb",
    minConfidence: "Min. megbízhatóság",
    requireAlignment: "Idősík-egyezés kötelező",
    minAlignmentRatio: "Min. egyezési arány",
    minAlignedTimeframes: "Min. egyező idősíkok",
    atrPeriod: "ATR periódus",
    atrStopMultiplier: "ATR stop szorzó",
    rewardRatio: "Cél R arány",
    autoCloseOnReversal: "Zárás ellentétes jelzésnél",
    feePercent: "Díj oldalanként",
    spreadPercent: "Spread",
    slippagePercent: "Slippage",
    useTradingHours: "Kereskedési óra szűrő",
    tradingHoursStart: "Kezdő óra",
    tradingHoursEnd: "Záró óra",
  };

  const DIRECTION_LABELS = {
    both: "LONG és SHORT",
    long: "Csak LONG",
    short: "Csak SHORT",
  };

  const INTERVAL_LABELS = {
    1: "1 perc",
    5: "5 perc",
    15: "15 perc",
    60: "1 óra",
  };

  const CURRENCY_LABELS = {
    sync: "Szinkron (globális)",
    USD: "USD",
    EUR: "EUR",
    HUF: "HUF",
  };

  const SOURCE_LABELS = {
    "auto-tanulás": "Auto-tanulás",
    kézi: "Kézi mentés",
    "pro mód": "Pro mód",
    beállítás: "Gyors beállítás",
  };

  const MAX_TOTAL_EXPOSURE_RATIO = 0.95;
  const MAX_BALANCE_MULTIPLIER = 50;
  const COMMON_HUF_CAPITAL_INPUTS = [10000, 50000, 100000, 200000, 500000, 1000000];

  function clampParam(key, value) {
    const bounds = PARAM_BOUNDS[key];
    if (!bounds) return value;
    const stepped =
      bounds.step > 0
        ? Math.round(value / bounds.step) * bounds.step
        : value;
    return Math.min(bounds.max, Math.max(bounds.min, stepped));
  }

  function createBotState(config = DEFAULT_CONFIG) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    const now = Date.now();
    return {
      config: merged,
      cash: merged.initialCapital,
      initialCapital: merged.initialCapital,
      positions: [],
      trades: [],
      equityHistory: [{ time: now, equity: merged.initialCapital }],
      lastActionAt: {},
      lastActionOutcome: {},
      lastTickAt: null,
      lastScan: null,
      activityLog: [],
      learningHistory: [],
      configChangeLog: [],
      performanceStats: {
        eligibleTicks: 0,
        capturedCount: 0,
        missedLog: [],
      },
    };
  }

  function loadBotState(fxContext = null) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (
        !saved ||
        !Number.isFinite(saved.initialCapital) ||
        !Number.isFinite(saved.cash) ||
        !Array.isArray(saved.positions) ||
        !Array.isArray(saved.trades)
      ) {
        return createBotState();
      }
      saved.config = { ...DEFAULT_CONFIG, ...saved.config };
      saved.equityHistory = Array.isArray(saved.equityHistory) ? saved.equityHistory : [];
      saved.activityLog = Array.isArray(saved.activityLog) ? saved.activityLog : [];
      saved.learningHistory = Array.isArray(saved.learningHistory) ? saved.learningHistory : [];
      saved.configChangeLog = Array.isArray(saved.configChangeLog) ? saved.configChangeLog : [];
      saved.lastActionAt = saved.lastActionAt || {};
      saved.lastActionOutcome = saved.lastActionOutcome || {};
      saved.performanceStats = saved.performanceStats || {
        eligibleTicks: 0,
        capturedCount: 0,
        missedLog: [],
      };
      return reconcileBalanceOnLoad(saved, fxContext);
    } catch {
      return createBotState();
    }
  }

  function applyCapitalFromConfig(botState, options = {}) {
    if (!botState?.config) return false;
    const newCapital = botState.config.initialCapital;
    if (!Number.isFinite(newCapital) || newCapital < 100) return false;

    const oldCapital = botState.initialCapital;
    const now = Date.now();
    botState.initialCapital = newCapital;
    botState.cash = newCapital;
    botState.positions = [];
    botState.trades = [];
    botState.equityHistory = [{ time: now, equity: newCapital }];
    botState.lastActionAt = {};
    botState.lastActionOutcome = {};

    if (!options.skipLog) {
      logConfigChanges(
        botState,
        options.source || "kézi",
        [
          {
            key: "accountReset",
            from: oldCapital,
            to: newCapital,
            reason: options.reason || "Kezdőtőke mentése – számla újraindítva",
          },
        ],
      );
    } else {
      saveBotState(botState);
    }
    return true;
  }

  function reconcileCapitalOnLoad(botState) {
    if (!botState?.config) return botState;
    const configCapital = botState.config.initialCapital;
    if (!Number.isFinite(configCapital) || configCapital < 100) return botState;
    if (botState.initialCapital === configCapital) return botState;

    applyCapitalFromConfig(botState, {
      source: "beállítás",
      reason: "Kezdőtőke szinkronizálva a mentett beállítással",
    });
    return botState;
  }

  function detectUnconvertedHufCapital(storedUsd, currency, hufRate) {
    if (currency !== "HUF" || !(hufRate > 50) || !(storedUsd >= 1000)) return null;
    for (const hufInput of COMMON_HUF_CAPITAL_INPUTS) {
      if (Math.abs(storedUsd - hufInput) < 1) {
        const corrected = hufInput / hufRate;
        if (corrected >= 100 && corrected < storedUsd / 10) return corrected;
      }
    }
    return null;
  }

  function hasRunawayBalance(botState) {
    const initial = botState.initialCapital;
    if (!(initial > 0)) return false;
    return botState.cash > initial * MAX_BALANCE_MULTIPLIER;
  }

  function reconcileBalanceOnLoad(botState, fxContext = null) {
    if (!botState?.config) return botState;

    const currency = fxContext?.resolveCurrency?.(botState.config) ?? "USD";
    const hufRate = fxContext?.getRate?.("HUF");
    const correctedCapital = detectUnconvertedHufCapital(
      botState.config.initialCapital,
      currency,
      hufRate,
    );

    if (correctedCapital !== null) {
      botState.config.initialCapital = correctedCapital;
      applyCapitalFromConfig(botState, {
        source: "beállítás",
        reason:
          "Javítva: a kezdőtőke valószínűleg HUF-ként került USD-ként mentésre (hiányzó árfolyam)",
      });
      logActivity(
        botState,
        `Egyenleg helyreállítva: ${Math.round(correctedCapital)} USD belső tőke (≈ ${Math.round(correctedCapital * hufRate).toLocaleString("hu-HU")} HUF)`,
      );
      return botState;
    }

    reconcileCapitalOnLoad(botState);

    if (hasRunawayBalance(botState)) {
      applyCapitalFromConfig(botState, {
        source: "beállítás",
        reason: "Javítva: szokatlanul magas egyenleg – számla visszaállítva a kezdőtőkére",
      });
      logActivity(botState, "Egyenleg helyreállítva a mentett kezdőtőkére (inflált állapot észlelve).");
    }

    return botState;
  }

  function getTotalExposure(botState) {
    return botState.positions.reduce((sum, position) => {
      if (!(position.entry > 0) || !(position.quantity > 0)) return sum;
      return sum + position.entry * position.quantity;
    }, 0);
  }

  function getAvailableBuyingPower(botState, config, context) {
    const metrics = getMetrics(botState, context);
    const equity = Math.max(0, metrics.equity);
    const maxTotalExposure = equity * MAX_TOTAL_EXPOSURE_RATIO;
    const usedExposure = getTotalExposure(botState);
    return Math.max(0, maxTotalExposure - usedExposure);
  }

  function saveBotState(botState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(botState));
    } catch {
      // Ignore storage failures.
    }
  }

  function getCurrentPrice(assetKey, context) {
    return (
      context.intraday?.[assetKey]?.currentPrice ??
      context.assets?.[assetKey]?.currentPrice ??
      null
    );
  }

  function getSeries(context, assetKey, interval) {
    if (context.getIntradaySeries) {
      return context.getIntradaySeries(assetKey, interval);
    }
    if (interval === undefined || interval === null) {
      return context.intraday?.[assetKey] || null;
    }
    return context.multiTimeframe?.[assetKey]?.[interval] || context.intraday?.[assetKey] || null;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "–";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }

  function analyzeSignal(assetKey, config, context) {
    const interval = config.primaryInterval || 1;
    let intraday = getSeries(context, assetKey, interval);
    if (!intraday?.candles?.length && interval !== 1) {
      intraday = getSeries(context, assetKey, 1);
    }
    if (!intraday?.candles?.length) {
      return context.analyzeIntraday?.(assetKey) || null;
    }

    const indicators = context.indicators || {};
    const emaFn = indicators.ema;
    const rsiFn = indicators.rsi;
    const atrFn = indicators.atr;
    const avgFn = indicators.average;
    if (!emaFn || !rsiFn || !atrFn) {
      return context.analyzeIntraday?.(assetKey) || null;
    }

    const candles = intraday.candles.slice(-180);
    const closes = candles.map((candle) => candle.close);
    const currentPrice = closes.at(-1);
    const emaFast = emaFn(closes, config.fastEma);
    const emaSlow = emaFn(closes, config.slowEma);
    const ema12 = emaFn(closes, 12);
    const ema26 = emaFn(closes, 26);
    const macd = ema12 !== null && ema26 !== null ? ema12 - ema26 : null;
    const rsi = rsiFn(closes, config.rsiPeriod);
    const atr = atrFn(candles, config.atrPeriod);
    const lookback = Math.max(2, config.momentumLookback || 15);
    const momentumBase = closes.at(-(lookback + 1));
    const momentum = momentumBase ? ((currentPrice - momentumBase) / momentumBase) * 100 : null;
    const volumes = candles.map((candle) => candle.volume).filter((volume) => volume > 0);
    const averageVolume = avgFn ? avgFn(volumes.slice(-31, -1)) : null;
    const volumeRatio =
      averageVolume && candles.at(-1).volume > 0 ? candles.at(-1).volume / averageVolume : null;
    const dailyClass = context.assets?.[assetKey]?.analysis?.className;
    const alignment = context.calculateTimeframeAlignment
      ? context.calculateTimeframeAlignment(assetKey)
      : { available: 0, bullish: 0, bearish: 0, bullishRatio: 0, bearishRatio: 0 };

    let score = 0;
    const reasons = [];

    if (emaFast !== null && emaSlow !== null) {
      if (emaFast > emaSlow) {
        score += 1.5;
        reasons.push(`EMA ${config.fastEma} a ${config.slowEma} felett`);
      } else {
        score -= 1.5;
        reasons.push(`EMA ${config.fastEma} a ${config.slowEma} alatt`);
      }
    }

    if (rsi !== null) {
      if (rsi > config.rsiOverbought) {
        score -= 1;
        reasons.push(`RSI túlvett (>${config.rsiOverbought})`);
      } else if (rsi < config.rsiOversold) {
        score += 0.5;
        reasons.push(`RSI túladott (<${config.rsiOversold})`);
      } else if (rsi >= config.rsiLongMin && rsi <= config.rsiLongMax) {
        score += 0.75;
        reasons.push("RSI támogatja a LONG irányt");
      } else if (rsi >= config.rsiShortMin && rsi <= config.rsiShortMax) {
        score -= 0.75;
        reasons.push("RSI támogatja a SHORT irányt");
      } else if (rsi < config.rsiShortMax) {
        score -= 0.5;
        reasons.push("RSI gyenge");
      }
    }

    if (config.useMacd && macd !== null) {
      score += macd >= 0 ? 1 : -1;
      reasons.push(macd >= 0 ? "Pozitív MACD" : "Negatív MACD");
    }

    if (momentum !== null) {
      const threshold = config.momentumThreshold || 0.12;
      if (momentum > threshold) score += 1;
      else if (momentum < -threshold) score -= 1;
      reasons.push(`${lookback} perces lendület: ${formatPercent(momentum)}`);
    }

    if (dailyClass === "positive") {
      score += 1;
      reasons.push("A napi trend pozitív");
    } else if (dailyClass === "negative") {
      score -= 1;
      reasons.push("A napi trend negatív");
    }

    if (alignment.available >= config.minAlignedTimeframes) {
      if (alignment.bullishRatio >= config.minAlignmentRatio) {
        score += 1.25;
        reasons.push(`${alignment.available} idősíkból ${alignment.bullish} emelkedő`);
      } else if (alignment.bearishRatio >= config.minAlignmentRatio) {
        score -= 1.25;
        reasons.push(`${alignment.available} idősíkból ${alignment.bearish} csökkenő`);
      } else {
        reasons.push("Az idősíkok nem mutatnak egységes irányt");
      }
    }

    if (config.useVolume && volumeRatio !== null && volumeRatio > config.volumeMultiplier) {
      score += momentum !== null && momentum >= 0 ? 0.5 : -0.5;
      reasons.push("Átlag feletti forgalom");
    }

    const threshold = config.signalScoreThreshold || 2.5;
    let signal = "KIVÁRÁS";
    let className = "neutral";
    if (score >= threshold) {
      signal = "VÉTELI JEL";
      className = "positive";
    } else if (score <= -threshold) {
      signal = "ELADÁSI JEL";
      className = "negative";
    }

    const ageMinutes = Math.max(0, (Date.now() - intraday.updatedAt) / 60000);
    let confidence = Math.round(Math.min(88, 46 + Math.abs(score) * 7));
    if (ageMinutes > 5) confidence = Math.min(confidence, 45);

    const hasPlan = className !== "neutral" && atr !== null;
    const isBuy = className === "positive";
    const stopDistance = atr * (config.atrStopMultiplier || 1.5);
    const targetDistance = stopDistance * (config.rewardRatio || 2);
    const stop = hasPlan ? currentPrice + (isBuy ? -stopDistance : stopDistance) : null;
    const target = hasPlan ? currentPrice + (isBuy ? targetDistance : -targetDistance) : null;

    return {
      signal,
      className,
      confidence,
      currentPrice,
      momentum15: momentum,
      ema9: emaFast,
      ema21: emaSlow,
      rsi,
      atr,
      stop,
      target,
      riskReward: hasPlan ? config.rewardRatio : null,
      reasons,
      interval,
      alignment,
      score,
      hasIntraday: true,
    };
  }

  function formatPrice(value, context) {
    if (context?.formatBotPrice) return context.formatBotPrice(value);
    return `$${value.toFixed(2)}`;
  }

  function isWithinTradingHours(config) {
    if (!config.useTradingHours) return true;
    const hour = new Date().getHours();
    const start = config.tradingHoursStart ?? 8;
    const end = config.tradingHoursEnd ?? 20;
    if (start <= end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  function calcExecutionCosts(entry, exit, quantity, config) {
    const feeRate = (config.feePercent || 0.1) / 100;
    const spreadRate = (config.spreadPercent || 0.02) / 100;
    const slipRate = (config.slippagePercent || 0.01) / 100;
    const notional = (entry + exit) * quantity;
    return notional * (feeRate * 2 + spreadRate + slipRate * 2);
  }

  function applySlippage(price, direction, isEntry, config) {
    const slip = (config.slippagePercent || 0.01) / 100;
    if (isEntry) {
      return direction === "long" ? price * (1 + slip) : price * (1 - slip);
    }
    return direction === "long" ? price * (1 - slip) : price * (1 + slip);
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

  function getMetrics(botState, context) {
    const openPnl = botState.positions.reduce((sum, position) => {
      const price = getCurrentPrice(position.asset, context);
      if (!Number.isFinite(price)) return sum;
      const multiplier = position.direction === "long" ? 1 : -1;
      return sum + (price - position.entry) * position.quantity * multiplier;
    }, 0);
    const equity = botState.cash + openPnl;
    const wins = botState.trades.filter((trade) => trade.pnl > 0);
    const losses = botState.trades.filter((trade) => trade.pnl < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const winRate = botState.trades.length ? (wins.length / botState.trades.length) * 100 : null;
    const profitFactor = grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;
    const equityValues = [...botState.equityHistory.map((point) => point.equity), equity];
    const avgWin = wins.length ? grossProfit / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;
    const performance = getPerformanceMetrics(botState);
    return {
      equity,
      openPnl,
      realizedPnl: botState.cash - botState.initialCapital,
      winRate,
      profitFactor,
      maxDrawdown: calculateMaxDrawdown(equityValues),
      tradeCount: botState.trades.length,
      openCount: botState.positions.length,
      avgWin,
      avgLoss,
      wins: wins.length,
      losses: losses.length,
      tradesPerHour: performance.tradesPerHour,
      opportunityCaptureRate: performance.opportunityCaptureRate,
      missedOpportunities: performance.missedOpportunities,
    };
  }

  function recordEquity(botState, context, time = Date.now()) {
    const metrics = getMetrics(botState, context);
    const last = botState.equityHistory.at(-1);
    const point = { time, equity: metrics.equity };
    if (last && time - last.time < 60000) {
      botState.equityHistory[botState.equityHistory.length - 1] = point;
    } else {
      botState.equityHistory.push(point);
    }
    botState.equityHistory = botState.equityHistory.slice(-500);
  }

  function logActivity(botState, message) {
    botState.activityLog.unshift({ time: Date.now(), message });
    botState.activityLog = botState.activityLog.slice(0, 80);
  }

  function getEffectiveThresholds(config) {
    if (!config.professionalMode) {
      return {
        minConfidence: config.minConfidence,
        signalScoreThreshold: config.signalScoreThreshold,
      };
    }
    return {
      minConfidence: Math.max(config.proMinConfidenceFloor || 45, config.minConfidence - 5),
      signalScoreThreshold: Math.max(1.5, config.signalScoreThreshold - 0.25),
    };
  }

  function getBotTickIntervalMs(config) {
    if (!config.enabled) return 60000;
    if (!config.professionalMode) return 60000;
    if (config.marketWideMode) return 15000;
    return 30000;
  }

  function getCooldownStatus(config, botState, assetKey, now, opportunityScore = 0) {
    const lastAction = botState.lastActionAt[assetKey] || 0;
    const lastOutcome = botState.lastActionOutcome?.[assetKey];

    if (!config.professionalMode) {
      const cooldownMs = config.cooldownMinutes * 60000;
      const remaining = cooldownMs - (now - lastAction);
      if (remaining > 0) {
        return {
          blocked: true,
          remainingMs: remaining,
          reason: "cooldown",
          detail: `Cooldown: ${Math.ceil(remaining / 60000)} perc hátra`,
        };
      }
      return { blocked: false, reason: "ready" };
    }

    if (lastOutcome?.outcome === "loss") {
      const cooldownMs = config.cooldownMinutes * 60000;
      const remaining = cooldownMs - (now - lastOutcome.time);
      if (remaining > 0) {
        return {
          blocked: true,
          remainingMs: remaining,
          reason: "loss-cooldown",
          detail: `Vesztes ügylet után pihenő: ${Math.ceil(remaining / 60000)} perc hátra`,
        };
      }
    }

    if (lastOutcome?.outcome === "win") {
      if (opportunityScore >= (config.proHighScoreThreshold || 75)) {
        return {
          blocked: false,
          reason: "pro-immediate",
          detail: "Magas pontszámú lehetőség – azonnali belépés nyertes után",
        };
      }
      const winCooldownMs = (config.proWinCooldownMinutes || 2) * 60000;
      const remaining = winCooldownMs - (now - lastOutcome.time);
      if (remaining > 0) {
        return {
          blocked: true,
          remainingMs: remaining,
          reason: "win-short-cooldown",
          detail: `Rövid pihenő nyertes után: ${Math.ceil(remaining / 1000)} mp hátra`,
        };
      }
      return { blocked: false, reason: "pro-win-cleared", detail: "Nyertes után – kész új belépésre" };
    }

    if (now - lastAction < 30000 && lastAction > 0) {
      const remaining = 30000 - (now - lastAction);
      return {
        blocked: true,
        remainingMs: remaining,
        reason: "min-gap",
        detail: "Minimális várakozás az utolsó művelet után",
      };
    }

    return { blocked: false, reason: "pro-ready", detail: "Pro mód – kész kereskedésre" };
  }

  function recordMissedOpportunity(botState, opportunity, reason, detail) {
    if (!botState.performanceStats) {
      botState.performanceStats = { eligibleTicks: 0, capturedCount: 0, missedLog: [] };
    }
    const entry = {
      time: Date.now(),
      assetKey: opportunity.assetKey,
      assetName: opportunity.assetName,
      opportunityScore: opportunity.opportunityScore,
      signal: opportunity.signal,
      confidence: opportunity.confidence,
      reason,
      detail,
    };
    botState.performanceStats.missedLog = [entry, ...(botState.performanceStats.missedLog || [])].slice(0, 25);
  }

  function getPerformanceMetrics(botState) {
    const hourAgo = Date.now() - 3600000;
    const tradesLastHour = botState.trades.filter((trade) => trade.closedAt > hourAgo).length;
    const stats = botState.performanceStats || { eligibleTicks: 0, capturedCount: 0, missedLog: [] };
    const captureRate =
      stats.eligibleTicks > 0 ? (stats.capturedCount / stats.eligibleTicks) * 100 : null;
    return {
      tradesPerHour: tradesLastHour,
      opportunityCaptureRate: captureRate,
      missedOpportunities: stats.missedLog || [],
      eligibleTicks: stats.eligibleTicks,
      capturedCount: stats.capturedCount,
    };
  }

  function canOpen(assetKey, botState, now, opportunityScore = 0) {
    if (botState.positions.length >= botState.config.maxPositions) return false;
    if (botState.positions.some((position) => position.asset === assetKey)) return false;
    const status = getCooldownStatus(botState.config, botState, assetKey, now, opportunityScore);
    return !status.blocked;
  }

  function calculatePositionSize(botState, entry, stop, config, context) {
    const unitRisk = Math.abs(entry - stop);
    if (!(unitRisk > 0) || !(entry > 0)) return 0;

    const metrics = getMetrics(botState, context);
    const equity = Math.max(0, metrics.equity);
    if (!(equity > 0)) return 0;

    const desiredRisk = equity * (config.riskPercent / 100);
    const feeBuffer = entry * ((config.feePercent || 0.1) / 100);
    let quantity = desiredRisk / (unitRisk + feeBuffer);

    const maxPositions = Math.max(1, config.maxPositions || 1);
    const maxSingleNotional = (equity * MAX_TOTAL_EXPOSURE_RATIO) / maxPositions;
    quantity = Math.min(quantity, maxSingleNotional / entry);

    const availableNotional = getAvailableBuyingPower(botState, config, context);
    quantity = Math.min(quantity, availableNotional / entry);

    quantity = Math.min(quantity, equity / entry);

    return Math.max(0, quantity);
  }

  function passesAlignment(direction, decision, config) {
    if (!config.requireAlignment) return true;
    const alignment = decision.alignment;
    if (!alignment || alignment.available < config.minAlignedTimeframes) return false;
    if (direction === "long") return alignment.bullishRatio >= config.minAlignmentRatio;
    return alignment.bearishRatio >= config.minAlignmentRatio;
  }

  function passesDirection(direction, config) {
    if (config.direction === "both") return true;
    return config.direction === direction;
  }

  function getScanAssetKeys(config, botState) {
    const positionAssets = botState.positions.map((position) => position.asset);
    if (config.marketWideMode) {
      const allKeys = window.AssetCatalog?.ALL_KEYS || config.assets;
      return [...new Set([...allKeys, ...positionAssets])];
    }
    return [...new Set([...config.assets, ...positionAssets])];
  }

  function getTradeableAssetKeys(config) {
    if (config.marketWideMode) {
      return window.AssetCatalog?.ALL_KEYS || config.assets;
    }
    return config.assets;
  }

  function compareOpportunityResults(a, b) {
    if (b.opportunityScore !== a.opportunityScore) {
      return b.opportunityScore - a.opportunityScore;
    }
    if (a.eligible !== b.eligible) {
      return a.eligible ? -1 : 1;
    }
    const confidenceDiff = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (confidenceDiff !== 0) return confidenceDiff;
    return Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0);
  }

  function computeOpportunityScore(decision, config) {
    if (!decision || decision.className === "neutral") {
      return {
        total: 0,
        confidence: 0,
        signalStrength: 0,
        alignmentBonus: 0,
        momentumBonus: 0,
        rsiBonus: 0,
      };
    }

    const confidence = decision.confidence || 0;
    const signalStrength = Math.abs(decision.score || 0) * 5;
    let alignmentBonus = 0;
    if (decision.alignment?.available >= config.minAlignedTimeframes) {
      const ratio =
        decision.className === "positive"
          ? decision.alignment.bullishRatio
          : decision.alignment.bearishRatio;
      alignmentBonus = ratio * 15;
    }
    let momentumBonus = 0;
    if (decision.momentum15 !== null) {
      momentumBonus = Math.min(10, Math.abs(decision.momentum15) * 2);
    }
    let rsiBonus = 0;
    if (decision.rsi !== null) {
      if (
        decision.className === "positive" &&
        decision.rsi >= config.rsiLongMin &&
        decision.rsi <= config.rsiLongMax
      ) {
        rsiBonus = 5;
      } else if (
        decision.className === "negative" &&
        decision.rsi >= config.rsiShortMin &&
        decision.rsi <= config.rsiShortMax
      ) {
        rsiBonus = 5;
      }
    }
    const total = confidence + signalStrength + alignmentBonus + momentumBonus + rsiBonus;
    return { total, confidence, signalStrength, alignmentBonus, momentumBonus, rsiBonus };
  }

  function evaluateOpportunity(assetKey, decision, config, botState, now) {
    const assetName = window.AssetCatalog?.getName(assetKey) || assetKey;
    const scoreBreakdown = computeOpportunityScore(decision, config);
    const thresholds = getEffectiveThresholds(config);
    const filterReasons = [];

    if (!decision) {
      filterReasons.push("Nincs elérhető piaci adat");
    } else if (decision.className === "neutral") {
      filterReasons.push("Semleges jelzés – küszöb alatt");
    } else if (decision.confidence < thresholds.minConfidence) {
      filterReasons.push(
        `Alacsony bizalom (${decision.confidence}% < ${thresholds.minConfidence}%)`,
      );
    } else if (
      Math.abs(decision.score || 0) < thresholds.signalScoreThreshold &&
      decision.className !== "neutral"
    ) {
      filterReasons.push(
        `Jelzéserősség alacsony (${Math.abs(decision.score || 0).toFixed(2)} < ${thresholds.signalScoreThreshold})`,
      );
    }

    if (decision && decision.className !== "neutral") {
      const direction = decision.className === "positive" ? "long" : "short";
      if (!passesDirection(direction, config)) {
        filterReasons.push(`Irány szűrő (${config.direction}) kizárja a ${direction.toUpperCase()} setupot`);
      }
      if (!passesAlignment(direction, decision, config)) {
        filterReasons.push("Idősík-egyezés nem teljesül");
      }
      if (!(decision.stop > 0) || !(decision.target > 0) || !(decision.currentPrice > 0)) {
        filterReasons.push("Hiányzó stop/cél/ár adat");
      }
    }

    if (!config.enabled) filterReasons.push("Bot kikapcsolva");
    if (!isWithinTradingHours(config)) filterReasons.push("Kereskedési ablakon kívül");
    const cooldownStatus = getCooldownStatus(
      config,
      botState,
      assetKey,
      now,
      scoreBreakdown.total,
    );
    if (!canOpen(assetKey, botState, now, scoreBreakdown.total)) {
      if (botState.positions.some((position) => position.asset === assetKey)) {
        filterReasons.push("Már van nyitott pozíció");
      } else if (botState.positions.length >= config.maxPositions) {
        filterReasons.push("Max. pozíció elérve");
      } else {
        filterReasons.push(cooldownStatus.detail || "Cooldown aktív");
      }
    }

    const eligible = filterReasons.length === 0 && decision && decision.className !== "neutral";
    const direction = decision?.className === "positive" ? "long" : decision?.className === "negative" ? "short" : null;

    return {
      assetKey,
      assetName,
      decision,
      direction,
      signal: decision?.signal || "Nincs adat",
      className: decision?.className || "neutral",
      confidence: decision?.confidence ?? null,
      score: decision?.score ?? null,
      opportunityScore: scoreBreakdown.total,
      scoreBreakdown,
      eligible,
      filterReasons,
      topReasons: (decision?.reasons || []).slice(0, 3),
    };
  }

  function scanMarketOpportunities(botState, context, now) {
    const config = botState.config;
    context.botConfig = config;
    const scanKeys = getScanAssetKeys(config, botState);
    const results = scanKeys.map((assetKey) => {
      const decision = analyzeSignal(assetKey, config, context);
      return evaluateOpportunity(assetKey, decision, config, botState, now);
    });
    results.sort(compareOpportunityResults);
    return results;
  }

  function closePosition(botState, id, exitPrice, reason, closedAt, context) {
    context.botConfig = botState.config;
    const index = botState.positions.findIndex((position) => position.id === id);
    if (index < 0) return null;
    const [position] = botState.positions.splice(index, 1);
    const config = botState.config;
    const adjustedExit = applySlippage(exitPrice, position.direction, false, config);
    const directionMultiplier = position.direction === "long" ? 1 : -1;
    const grossPnl = (adjustedExit - position.entry) * position.quantity * directionMultiplier;
    const fees = calcExecutionCosts(position.entry, adjustedExit, position.quantity, config);
    const pnl = grossPnl - fees;
    botState.cash += pnl;
    if (botState.cash < 0) botState.cash = 0;
    const trade = {
      ...position,
      exit: adjustedExit,
      reason,
      closedAt,
      fees,
      pnl,
      outcome: pnl >= 0 ? "win" : "loss",
      analysis: buildTradeAnalysis(position, pnl, reason, context),
    };
    botState.trades.unshift(trade);
    botState.trades = botState.trades.slice(0, 300);
    botState.lastActionAt[position.asset] = closedAt;
    botState.lastActionOutcome = botState.lastActionOutcome || {};
    botState.lastActionOutcome[position.asset] = {
      time: closedAt,
      outcome: trade.outcome,
    };
    recordEquity(botState, context, closedAt);
    const assetName = window.AssetCatalog?.getName(position.asset) || position.asset;
    logActivity(
      botState,
      `${assetName} ${position.direction.toUpperCase()} lezárva (${reason}): ${formatPrice(pnl, context)}`,
    );
    if (config.autoLearnEnabled) {
      runAutoLearn(botState, context, { trigger: "trade-close", trade });
    }
    return trade;
  }

  function buildTradeAnalysis(position, pnl, reason, context) {
    const decision = analyzeSignal(position.asset, context.botConfig || {}, context);
    const reasons = [];
    if (reason === "Stop-loss") {
      reasons.push("A stop szint teljesült – a piac ellen fordult.");
      if (decision?.alignment?.available >= 2 && decision.alignment.bullishRatio < 0.5) {
        reasons.push("Több idősík csökkenő trendet mutatott a belépéskor.");
      }
    } else if (reason === "Célár") {
      reasons.push("A célár elérése – a terv szerinti kimenetel.");
    } else if (reason === "Jelzésfordulás") {
      reasons.push("Az ellentétes jelzés miatt zártuk a pozíciót.");
    } else {
      reasons.push(`Kilépési ok: ${reason}`);
    }
    if (position.confidence < 60) {
      reasons.push("Alacsony megbízhatóságú jelzésből nyitottunk – óvatosabb küszöb segíthet.");
    }
    if (position.riskReward !== null && position.riskReward < 1.5) {
      reasons.push("Gyenge kockázat/hozam arány (< 1.5) csökkentette az edge-et.");
    }
    if (pnl < 0 && decision?.rsi !== null && decision.rsi > 70 && position.direction === "long") {
      reasons.push("LONG pozíció túlvett RSI mellett – késői belépés.");
    }
    if (pnl < 0 && decision?.rsi !== null && decision.rsi < 30 && position.direction === "short") {
      reasons.push("SHORT pozíció túladott RSI mellett – késői belépés.");
    }
    return reasons;
  }

  function updateOpenPositions(botState, assetKey, context) {
    const intraday = getSeries(context, assetKey, botState.config.primaryInterval);
    const currentPrice = getCurrentPrice(assetKey, context);
    if (!Number.isFinite(currentPrice)) return;
    const closures = [];
    botState.positions
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
      closePosition(botState, closure.id, closure.price, closure.reason, closure.time, context);
    });
  }

  function maybeOpenPosition(botState, assetKey, decision, context, now, options = {}) {
    const config = botState.config;
    const thresholds = getEffectiveThresholds(config);
    const opportunityScore = options.opportunityScore ?? computeOpportunityScore(decision, config).total;
    if (!config.enabled) return null;
    if (!options.skipAssetCheck && !getTradeableAssetKeys(config).includes(assetKey)) return null;
    if (!isWithinTradingHours(config)) return null;
    if (!decision || decision.className === "neutral") return null;
    if (decision.confidence < thresholds.minConfidence) return null;
    if (Math.abs(decision.score || 0) < thresholds.signalScoreThreshold) return null;
    if (!canOpen(assetKey, botState, now, opportunityScore)) return null;
    if (!(decision.stop > 0) || !(decision.target > 0) || !(decision.currentPrice > 0)) return null;

    const direction = decision.className === "positive" ? "long" : "short";
    if (!passesDirection(direction, config)) return null;
    if (!passesAlignment(direction, decision, config)) return null;

    const rawEntry = decision.currentPrice;
    const entry = applySlippage(rawEntry, direction, true, config);
    const quantity = calculatePositionSize(botState, entry, decision.stop, config, context);
    if (!(quantity > 0)) return null;

    const notional = entry * quantity;
    const availableNotional = getAvailableBuyingPower(botState, config, context);
    if (notional > availableNotional + 0.01) return null;

    const cooldownStatus = getCooldownStatus(config, botState, assetKey, now, opportunityScore);
    const position = {
      id: `${now}-${Math.random().toString(16).slice(2)}`,
      asset: assetKey,
      direction,
      quantity,
      entry,
      stop: decision.stop,
      target: decision.target,
      riskPercent: config.riskPercent,
      confidence: decision.confidence,
      riskReward: decision.riskReward,
      interval: decision.interval,
      signal: decision.signal,
      reasons: decision.reasons.slice(0, 4),
      openedAt: now,
      lastCheckedAt: now,
      opportunityScore,
    };
    botState.positions.push(position);
    botState.lastActionAt[assetKey] = now;
    const assetName = window.AssetCatalog?.getName(assetKey) || assetKey;
    const proNote =
      config.professionalMode && cooldownStatus.reason === "pro-immediate"
        ? " · Pro: azonnali belépés magas pontszám miatt"
        : config.professionalMode
          ? " · Pro mód"
          : "";
    logActivity(
      botState,
      `${assetName} ${direction.toUpperCase()} nyitva @ ${formatPrice(entry, context)} · ${decision.signal} (${decision.confidence}%, ${opportunityScore.toFixed(0)} pont)${proNote}`,
    );
    return position;
  }

  function maybeCloseOnReversal(botState, assetKey, decision, context, now) {
    const config = botState.config;
    if (!config.autoCloseOnReversal || !decision) return;
    const currentPrice = getCurrentPrice(assetKey, context);
    if (!Number.isFinite(currentPrice)) return;
    botState.positions
      .filter((position) => position.asset === assetKey)
      .forEach((position) => {
        const shouldClose =
          (position.direction === "long" && decision.className === "negative") ||
          (position.direction === "short" && decision.className === "positive");
        if (shouldClose && decision.confidence >= config.minConfidence) {
          closePosition(botState, position.id, currentPrice, "Jelzésfordulás", now, context);
        }
      });
  }

  function tick(botState, context) {
    if (!botState.config.enabled) return { opened: 0, closed: 0 };
    const now = Date.now();
    let opened = 0;
    const beforeTrades = botState.trades.length;
    const config = botState.config;
    context.botConfig = config;

    const scanKeys = getScanAssetKeys(config, botState);
    const positionAssets = [...new Set(botState.positions.map((position) => position.asset))];

    positionAssets.forEach((assetKey) => {
      updateOpenPositions(botState, assetKey, context);
    });

    const scanResults = scanKeys.map((assetKey) => {
      const decision = analyzeSignal(assetKey, config, context);
      maybeCloseOnReversal(botState, assetKey, decision, context, now);
      return evaluateOpportunity(assetKey, decision, config, botState, now);
    });
    scanResults.sort(compareOpportunityResults);

    const eligible = scanResults.filter((result) => result.eligible);
    let chosen = null;

    if (eligible.length) {
      botState.performanceStats = botState.performanceStats || {
        eligibleTicks: 0,
        capturedCount: 0,
        missedLog: [],
      };
      botState.performanceStats.eligibleTicks += 1;
    }

    if (config.marketWideMode) {
      if (eligible.length) {
        chosen = eligible[0];
        const position = maybeOpenPosition(
          botState,
          chosen.assetKey,
          chosen.decision,
          context,
          now,
          {
            skipAssetCheck: true,
            opportunityScore: chosen.opportunityScore,
          },
        );
        if (position) {
          opened += 1;
          botState.performanceStats.capturedCount += 1;
          logActivity(
            botState,
            `Piaci mód: ${chosen.assetName} választva (${chosen.opportunityScore.toFixed(0)} pont) – ${chosen.signal} (${chosen.confidence}%)`,
          );
        } else {
          const cooldownStatus = getCooldownStatus(
            config,
            botState,
            chosen.assetKey,
            now,
            chosen.opportunityScore,
          );
          recordMissedOpportunity(
            botState,
            chosen,
            cooldownStatus.reason,
            cooldownStatus.detail,
          );
          logActivity(
            botState,
            `Kihagyott lehetőség: ${chosen.assetName} (${chosen.opportunityScore.toFixed(0)} pont) – ${cooldownStatus.detail}`,
          );
        }
      }
    } else {
      config.assets.forEach((assetKey) => {
        const result = scanResults.find((entry) => entry.assetKey === assetKey);
        if (!result || !result.eligible) return;
        const position = maybeOpenPosition(botState, assetKey, result.decision, context, now, {
          opportunityScore: result.opportunityScore,
        });
        if (position) {
          opened += 1;
          botState.performanceStats.capturedCount += 1;
        } else {
          const cooldownStatus = getCooldownStatus(
            config,
            botState,
            assetKey,
            now,
            result.opportunityScore,
          );
          recordMissedOpportunity(
            botState,
            result,
            cooldownStatus.reason,
            cooldownStatus.detail,
          );
          logActivity(
            botState,
            `Kihagyott lehetőség: ${result.assetName} (${result.opportunityScore.toFixed(0)} pont) – ${cooldownStatus.detail}`,
          );
        }
      });
    }

    botState.lastScan = {
      time: now,
      marketWideMode: config.marketWideMode,
      results: scanResults,
      chosen: chosen
        ? {
            assetKey: chosen.assetKey,
            assetName: chosen.assetName,
            opportunityScore: chosen.opportunityScore,
            signal: chosen.signal,
            confidence: chosen.confidence,
            direction: chosen.direction,
            scoreBreakdown: chosen.scoreBreakdown,
            topReasons: chosen.topReasons,
            filterReasons: [],
          }
        : eligible.length
          ? null
          : {
              assetKey: null,
              reason:
                scanResults.length === 0
                  ? "Nincs szkennelhető eszköz."
                  : "Egyetlen eszköz sem teljesíti a szűrőket.",
            },
    };

    const closed = botState.trades.length - beforeTrades;
    recordEquity(botState, context, now);
    botState.lastTickAt = now;
    saveBotState(botState);
    return { opened, closed };
  }

  function formatConfigValue(key, value) {
    if (value === null || value === undefined) return "–";
    if (typeof value === "boolean") return value ? "bekapcsolva" : "kikapcsolva";
    if (key === "assets" && Array.isArray(value)) {
      return value.map((assetKey) => window.AssetCatalog?.getName(assetKey) || assetKey).join(", ");
    }
    if (key === "direction") return DIRECTION_LABELS[value] || String(value);
    if (key === "primaryInterval") return INTERVAL_LABELS[value] || `${value} perc`;
    if (key === "currency") return CURRENCY_LABELS[value] || String(value);
    if (key === "minAlignmentRatio") return `${Math.round(value * 100)}%`;
    if (key === "initialCapital" || key === "accountReset") {
      return `$${Number(value).toLocaleString("hu-HU", { maximumFractionDigits: 0 })} (belső USD)`;
    }
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
    return String(value);
  }

  function configValuesEqual(key, left, right) {
    if (key === "assets") {
      return [...(left || [])].sort().join() === [...(right || [])].sort().join();
    }
    return left === right;
  }

  function diffConfigs(before, after) {
    const changes = [];
    Object.keys(DEFAULT_CONFIG).forEach((key) => {
      const from = before?.[key];
      const to = after?.[key];
      if (!configValuesEqual(key, from, to)) {
        changes.push({ key, from, to });
      }
    });
    return changes;
  }

  function logConfigChanges(botState, source, changes, defaultReason = "") {
    if (!changes?.length || !botState) return;
    botState.configChangeLog = botState.configChangeLog || [];
    const time = Date.now();
    changes.forEach((change) => {
      botState.configChangeLog.unshift({
        time,
        source,
        key: change.key,
        label: CONFIG_LABELS[change.key] || change.key,
        from: change.from,
        to: change.to,
        reason: change.reason || defaultReason,
      });
    });
    botState.configChangeLog = botState.configChangeLog.slice(0, 200);
    saveBotState(botState);
  }

  function clearConfigChangeLog(botState) {
    if (!botState) return;
    botState.configChangeLog = [];
    saveBotState(botState);
  }

  function exportConfigChangeLogCsv(botState) {
    const rows = [["Idő", "Mező", "Régi érték", "Új érték", "Forrás", "Indok"]];
    (botState?.configChangeLog || []).forEach((entry) => {
      rows.push([
        new Date(entry.time).toISOString(),
        entry.label,
        formatConfigValue(entry.key, entry.from),
        formatConfigValue(entry.key, entry.to),
        SOURCE_LABELS[entry.source] || entry.source,
        entry.reason || "",
      ]);
    });
    return rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
  }

  function pickLearnable(config) {
    const picked = {};
    LEARNABLE_KEYS.forEach((key) => {
      picked[key] = config[key];
    });
    return picked;
  }

  function runAutoLearn(botState, context, options = {}) {
    const { dryRun = false, trigger = "manual" } = options;
    if (!dryRun && !botState.config.autoLearnEnabled) return null;
    if (botState.trades.length < 5) {
      return {
        applied: false,
        reason: "Legalább 5 lezárt ügylet kell az auto-tanuláshoz.",
        changes: [],
      };
    }

    const metrics = getMetrics(botState, context);
    const before = pickLearnable(botState.config);
    const next = { ...botState.config };
    const changes = [];

    function propose(key, newValue, reason) {
      if (typeof next[key] === "boolean") {
        if (next[key] !== newValue) {
          changes.push({ key, from: next[key], to: newValue, reason });
          next[key] = newValue;
        }
        return;
      }
      const clamped = clampParam(key, newValue);
      if (clamped !== next[key]) {
        changes.push({ key, from: next[key], to: clamped, reason });
        next[key] = clamped;
      }
    }

    if (metrics.winRate !== null && metrics.winRate < 45) {
      propose(
        "minConfidence",
        next.minConfidence + 5,
        `Alacsony találati arány (${metrics.winRate.toFixed(1)}%) – szigorúbb belépő.`,
      );
    } else if (metrics.winRate !== null && metrics.winRate > 62 && metrics.profitFactor > 1.3) {
      propose(
        "minConfidence",
        next.minConfidence - 5,
        `Erős találati arány (${metrics.winRate.toFixed(1)}%) – enyhébb küszöb lehetséges.`,
      );
    }

    if (metrics.profitFactor !== null && metrics.profitFactor < 1 && metrics.profitFactor !== Infinity) {
      propose(
        "riskPercent",
        next.riskPercent - 0.25,
        `Profit factor ${metrics.profitFactor.toFixed(2)} – kockázat csökkentése.`,
      );
      propose(
        "rewardRatio",
        next.rewardRatio + 0.25,
        "Magasabb cél R arány a vesztes ügyletek kompenzálásához.",
      );
    }

    if (metrics.maxDrawdown > 12) {
      propose(
        "maxPositions",
        next.maxPositions - 1,
        `Magas drawdown (${metrics.maxDrawdown.toFixed(1)}%) – kevesebb párhuzamos pozíció.`,
      );
      propose(
        "riskPercent",
        next.riskPercent - 0.25,
        "Drawdown miatt csökkentett kockázat.",
      );
    }

    const tradesPerDay = botState.trades.filter((trade) => trade.closedAt > Date.now() - 86400000).length;
    if (tradesPerDay > 8 && !next.professionalMode) {
      propose(
        "cooldownMinutes",
        next.cooldownMinutes + 10,
        `${tradesPerDay} ügylet / 24 óra – hosszabb cooldown.`,
      );
    }

    const stopLosses = botState.trades.filter((trade) => trade.reason === "Stop-loss").length;
    const stopRatio = botState.trades.length ? stopLosses / botState.trades.length : 0;
    if (stopRatio > 0.55 && botState.trades.length >= 8) {
      propose(
        "atrStopMultiplier",
        next.atrStopMultiplier + 0.25,
        "Sok stop-loss – szélesebb ATR stop.",
      );
      propose(
        "signalScoreThreshold",
        next.signalScoreThreshold + 0.25,
        "Szigorúbb jelzésküszöb a gyengébb setupok kiszűréséhez.",
      );
    }

    const mixedAlignmentLosses = botState.trades.filter(
      (trade) =>
        trade.outcome === "loss" &&
        trade.analysis?.some((line) => line.includes("idősík")),
    ).length;
    if (mixedAlignmentLosses >= 3 && !next.requireAlignment) {
      propose(
        "requireAlignment",
        true,
        "Vegyes idősíkos veszteségek – idősík-egyezés kötelezővé tétele.",
      );
    }

    const weakMomentumLosses = botState.trades.filter(
      (trade) => trade.outcome === "loss" && trade.confidence < 58,
    ).length;
    if (weakMomentumLosses >= 4) {
      propose(
        "momentumThreshold",
        next.momentumThreshold + 0.02,
        "Gyenge momentumú vesztes ügyletek – magasabb lendület-küszöb.",
      );
    }

    if (!changes.length) {
      return { applied: false, reason: "Nincs szükség módosításra.", changes: [], before, after: before };
    }

    const after = pickLearnable(next);
    const entry = {
      time: Date.now(),
      trigger,
      before,
      after,
      changes,
    };

    if (!dryRun && botState.config.autoLearnEnabled) {
      botState.config = { ...botState.config, ...next };
      botState.learningHistory = [entry, ...(botState.learningHistory || [])].slice(0, 30);
      logConfigChanges(botState, "auto-tanulás", changes);
      logActivity(
        botState,
        `Auto-tanulás: ${changes.length} paraméter módosítva (${changes.map((c) => c.key).join(", ")}).`,
      );
      saveBotState(botState);
      return { applied: true, ...entry };
    }

    return { applied: false, preview: true, ...entry };
  }

  function buildSuggestions(botState, context) {
    const metrics = getMetrics(botState, context);
    const suggestions = [];
    if (!botState.trades.length) {
      return [
        {
          severity: "info",
          title: "Még nincs bot-tapasztalat",
          detail: "Kapcsold be a botot és várj néhány jelzésváltást. A javaslatok az első lezárt ügyletek után jelennek meg.",
        },
      ];
    }

    if (metrics.winRate !== null && metrics.winRate < 45) {
      suggestions.push({
        severity: "warning",
        title: "Alacsony találati arány",
        detail: `Win rate: ${metrics.winRate.toFixed(1)}%. Emeld a minimum megbízhatóságot vagy kapcsold be az auto-tanulást.`,
      });
    }

    if (metrics.profitFactor !== null && metrics.profitFactor < 1 && metrics.profitFactor !== Infinity) {
      suggestions.push({
        severity: "critical",
        title: "Negatív profit factor",
        detail: `PF: ${metrics.profitFactor.toFixed(2)}. Csökkentsd a kockázatot vagy növeld a cél R arányt.`,
      });
    }

    if (metrics.maxDrawdown > 12) {
      suggestions.push({
        severity: "warning",
        title: "Magas visszaesés",
        detail: `Max. drawdown: ${metrics.maxDrawdown.toFixed(1)}%. Csökkentsd a max. pozíciók számát vagy a kockázat %-ot.`,
      });
    }

    const tradesPerDay = botState.trades.filter(
      (trade) => trade.closedAt > Date.now() - 86400000,
    ).length;
    if (tradesPerDay > 8 && !botState.config.professionalMode) {
      suggestions.push({
        severity: "warning",
        title: "Túl sok ügylet",
        detail: `${tradesPerDay} ügylet az elmúlt 24 órában. Növeld a cooldown időt vagy kapcsold ki a profi módot.`,
      });
    }

    if (botState.config.professionalMode) {
      const perf = getPerformanceMetrics(botState);
      if (perf.opportunityCaptureRate !== null && perf.opportunityCaptureRate < 40 && perf.eligibleTicks >= 5) {
        suggestions.push({
          severity: "info",
          title: "Alacsony lehetőség-kihasználás",
          detail: `Capture rate: ${perf.opportunityCaptureRate.toFixed(0)}%. Ellenőrizd a max. pozíciót vagy a cooldown beállításokat.`,
        });
      }
    }

    const intervalStats = {};
    botState.trades.forEach((trade) => {
      const key = trade.interval ? `${trade.interval}p` : "ismeretlen";
      if (!intervalStats[key]) intervalStats[key] = { wins: 0, losses: 0, pnl: 0 };
      if (trade.pnl >= 0) intervalStats[key].wins += 1;
      else intervalStats[key].losses += 1;
      intervalStats[key].pnl += trade.pnl;
    });
    Object.entries(intervalStats).forEach(([interval, stats]) => {
      const total = stats.wins + stats.losses;
      if (total >= 3 && stats.pnl < 0) {
        suggestions.push({
          severity: "warning",
          title: `Gyenge idősík: ${interval}`,
          detail: `${total} ügyletből ${context.formatBotPrice ? context.formatBotPrice(stats.pnl) : `${stats.pnl.toFixed(2)} USD`} nettó.`,
        });
      }
    });

    const assetStats = {};
    botState.trades.forEach((trade) => {
      if (!assetStats[trade.asset]) assetStats[trade.asset] = { pnl: 0, count: 0 };
      assetStats[trade.asset].pnl += trade.pnl;
      assetStats[trade.asset].count += 1;
    });
    Object.entries(assetStats).forEach(([assetKey, stats]) => {
      if (stats.count >= 3 && stats.pnl < -50) {
        const name = window.AssetCatalog?.getName(assetKey) || assetKey;
        suggestions.push({
          severity: "warning",
          title: `Gyenge eszköz: ${name}`,
          detail: `${stats.count} ügylet, ${context.formatBotPrice ? context.formatBotPrice(stats.pnl) : `${stats.pnl.toFixed(2)} USD`}.`,
        });
      }
    });

    const learnPreview = runAutoLearn(botState, context, { dryRun: true });
    if (learnPreview?.changes?.length) {
      suggestions.push({
        severity: "info",
        title: "Auto-tanulás javaslat",
        detail: learnPreview.changes.map((c) => `${c.key}: ${c.from} → ${c.to}`).join("; "),
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        severity: "positive",
        title: "Stabil működés",
        detail: "Nincs kritikus probléma. Folytasd a megfigyelést.",
      });
    }

    return suggestions;
  }

  function resetBot(config) {
    const botState = createBotState(config);
    saveBotState(botState);
    return botState;
  }

  window.VirtualBot = {
    STORAGE_KEY,
    DEFAULT_CONFIG,
    PARAM_BOUNDS,
    LEARNABLE_KEYS,
    CONFIG_LABELS,
    SOURCE_LABELS,
    formatConfigValue,
    diffConfigs,
    logConfigChanges,
    clearConfigChangeLog,
    exportConfigChangeLogCsv,
    loadBotState,
    saveBotState,
    createBotState,
    getMetrics,
    getPerformanceMetrics,
    getEffectiveThresholds,
    getBotTickIntervalMs,
    tick,
    analyzeSignal,
    scanMarketOpportunities,
    evaluateOpportunity,
    getScanAssetKeys,
    getTradeableAssetKeys,
    computeOpportunityScore,
    compareOpportunityResults,
    buildSuggestions,
    runAutoLearn,
    resetBot,
    applyCapitalFromConfig,
    reconcileCapitalOnLoad,
    reconcileBalanceOnLoad,
    closePosition,
    getCurrentPrice,
    isWithinTradingHours,
  };
})();
