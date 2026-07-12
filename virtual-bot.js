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
    assets: ["bitcoin", "ethereum", "spy"],
    initialCapital: 10000,
    riskPercent: 1,
    maxPositions: 4,
    cooldownMinutes: 20,
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
      lastTickAt: null,
      activityLog: [],
      learningHistory: [],
    };
  }

  function loadBotState() {
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
      saved.lastActionAt = saved.lastActionAt || {};
      return saved;
    } catch {
      return createBotState();
    }
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
    const intraday = getSeries(context, assetKey, interval);
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

  function canOpen(assetKey, botState, now) {
    const cooldownMs = botState.config.cooldownMinutes * 60000;
    const lastAction = botState.lastActionAt[assetKey] || 0;
    if (now - lastAction < cooldownMs) return false;
    if (botState.positions.length >= botState.config.maxPositions) return false;
    if (botState.positions.some((position) => position.asset === assetKey)) return false;
    return true;
  }

  function calculatePositionSize(botState, entry, stop, config) {
    const unitRisk = Math.abs(entry - stop);
    if (!(unitRisk > 0)) return 0;
    const desiredRisk = botState.cash * (config.riskPercent / 100);
    const feeBuffer = entry * ((config.feePercent || 0.1) / 100);
    const quantity = desiredRisk / (unitRisk + feeBuffer);
    const cashLimited = botState.cash / entry;
    return Math.max(0, Math.min(quantity, cashLimited));
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
    recordEquity(botState, context, closedAt);
    const assetName = window.AssetCatalog?.getName(position.asset) || position.asset;
    logActivity(
      botState,
      `${assetName} ${position.direction.toUpperCase()} lezárva (${reason}): ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
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

  function maybeOpenPosition(botState, assetKey, decision, context, now) {
    const config = botState.config;
    if (!config.enabled) return null;
    if (!config.assets.includes(assetKey)) return null;
    if (!isWithinTradingHours(config)) return null;
    if (!decision || decision.className === "neutral") return null;
    if (decision.confidence < config.minConfidence) return null;
    if (!canOpen(assetKey, botState, now)) return null;
    if (!(decision.stop > 0) || !(decision.target > 0) || !(decision.currentPrice > 0)) return null;

    const direction = decision.className === "positive" ? "long" : "short";
    if (!passesDirection(direction, config)) return null;
    if (!passesAlignment(direction, decision, config)) return null;

    const rawEntry = decision.currentPrice;
    const entry = applySlippage(rawEntry, direction, true, config);
    const quantity = calculatePositionSize(botState, entry, decision.stop, config);
    if (!(quantity > 0)) return null;

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
    };
    botState.positions.push(position);
    botState.lastActionAt[assetKey] = now;
    const assetName = window.AssetCatalog?.getName(assetKey) || assetKey;
    logActivity(
      botState,
      `${assetName} ${direction.toUpperCase()} nyitva @ $${entry.toFixed(2)} · ${decision.signal} (${decision.confidence}%)`,
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
    context.botConfig = botState.config;

    botState.config.assets.forEach((assetKey) => {
      updateOpenPositions(botState, assetKey, context);
      const decision = analyzeSignal(assetKey, botState.config, context);
      maybeCloseOnReversal(botState, assetKey, decision, context, now);
      const position = maybeOpenPosition(botState, assetKey, decision, context, now);
      if (position) opened += 1;
    });

    const closed = botState.trades.length - beforeTrades;
    recordEquity(botState, context, now);
    botState.lastTickAt = now;
    saveBotState(botState);
    return { opened, closed };
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
    if (tradesPerDay > 8) {
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
    if (tradesPerDay > 8) {
      suggestions.push({
        severity: "warning",
        title: "Túl sok ügylet",
        detail: `${tradesPerDay} ügylet az elmúlt 24 órában. Növeld a cooldown időt.`,
      });
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
          detail: `${total} ügyletből ${stats.pnl.toFixed(2)} USD nettó.`,
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
          detail: `${stats.count} ügylet, ${stats.pnl.toFixed(2)} USD.`,
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
    loadBotState,
    saveBotState,
    createBotState,
    getMetrics,
    tick,
    analyzeSignal,
    buildSuggestions,
    runAutoLearn,
    resetBot,
    closePosition,
    getCurrentPrice,
    isWithinTradingHours,
  };
})();
