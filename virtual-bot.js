(function () {
  "use strict";

  const STORAGE_KEY = "aurum-virtual-bot";

  const DEFAULT_CONFIG = {
    enabled: false,
    assets: ["bitcoin", "ethereum", "spy"],
    riskPercent: 1,
    minConfidence: 55,
    maxPositions: 4,
    cooldownMinutes: 20,
    autoCloseOnReversal: true,
    initialCapital: 10000,
  };

  function createBotState(config = DEFAULT_CONFIG) {
    const now = Date.now();
    return {
      config: { ...DEFAULT_CONFIG, ...config },
      cash: config.initialCapital || DEFAULT_CONFIG.initialCapital,
      initialCapital: config.initialCapital || DEFAULT_CONFIG.initialCapital,
      positions: [],
      trades: [],
      equityHistory: [{ time: now, equity: config.initialCapital || DEFAULT_CONFIG.initialCapital }],
      lastActionAt: {},
      lastTickAt: null,
      activityLog: [],
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
    botState.activityLog.unshift({
      time: Date.now(),
      message,
    });
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

  function calculatePositionSize(botState, entry, stop) {
    const unitRisk = Math.abs(entry - stop);
    if (!(unitRisk > 0)) return 0;
    const desiredRisk = botState.cash * (botState.config.riskPercent / 100);
    const feeBuffer = (entry + stop) * 0.001;
    const quantity = desiredRisk / (unitRisk + feeBuffer);
    const cashLimited = botState.cash / entry;
    return Math.max(0, Math.min(quantity, cashLimited));
  }

  function closePosition(botState, id, exitPrice, reason, closedAt, context) {
    const index = botState.positions.findIndex((position) => position.id === id);
    if (index < 0) return null;
    const [position] = botState.positions.splice(index, 1);
    const directionMultiplier = position.direction === "long" ? 1 : -1;
    const grossPnl = (exitPrice - position.entry) * position.quantity * directionMultiplier;
    const fees = (position.entry + exitPrice) * position.quantity * 0.001;
    const pnl = grossPnl - fees;
    botState.cash += pnl;
    const trade = {
      ...position,
      exit: exitPrice,
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
    return trade;
  }

  function buildTradeAnalysis(position, pnl, reason, context) {
    const decision = context.analyzeIntraday(position.asset);
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
    const intraday = context.intraday?.[assetKey];
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
    if (!botState.config.enabled) return null;
    if (!botState.config.assets.includes(assetKey)) return null;
    if (!decision || decision.className === "neutral") return null;
    if (decision.confidence < botState.config.minConfidence) return null;
    if (!canOpen(assetKey, botState, now)) return null;
    if (!(decision.stop > 0) || !(decision.target > 0) || !(decision.currentPrice > 0)) return null;

    const direction = decision.className === "positive" ? "long" : "short";
    const entry = decision.currentPrice;
    const quantity = calculatePositionSize(botState, entry, decision.stop);
    if (!(quantity > 0)) return null;

    const position = {
      id: `${now}-${Math.random().toString(16).slice(2)}`,
      asset: assetKey,
      direction,
      quantity,
      entry,
      stop: decision.stop,
      target: decision.target,
      riskPercent: botState.config.riskPercent,
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
    if (!botState.config.autoCloseOnReversal || !decision) return;
    const currentPrice = getCurrentPrice(assetKey, context);
    if (!Number.isFinite(currentPrice)) return;
    botState.positions
      .filter((position) => position.asset === assetKey)
      .forEach((position) => {
        const shouldClose =
          (position.direction === "long" && decision.className === "negative") ||
          (position.direction === "short" && decision.className === "positive");
        if (shouldClose && decision.confidence >= botState.config.minConfidence) {
          closePosition(botState, position.id, currentPrice, "Jelzésfordulás", now, context);
        }
      });
  }

  function tick(botState, context) {
    if (!botState.config.enabled) return { opened: 0, closed: 0 };
    const now = Date.now();
    let opened = 0;
    let closed = 0;
    const beforeTrades = botState.trades.length;

    botState.config.assets.forEach((assetKey) => {
      updateOpenPositions(botState, assetKey, context);
      const decision = context.analyzeIntraday(assetKey);
      maybeCloseOnReversal(botState, assetKey, decision, context, now);
      const position = maybeOpenPosition(botState, assetKey, decision, context, now);
      if (position) opened += 1;
    });

    closed = botState.trades.length - beforeTrades;
    recordEquity(botState, context, now);
    botState.lastTickAt = now;
    saveBotState(botState);
    return { opened, closed };
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
        detail: `A win rate ${metrics.winRate.toFixed(1)}%. Emeld a minimum megbízhatóságot (pl. 65%) vagy szűkítsd az eszközlistát.`,
      });
    }

    if (metrics.profitFactor !== null && metrics.profitFactor < 1 && metrics.profitFactor !== Infinity) {
      suggestions.push({
        severity: "critical",
        title: "Negatív profit factor",
        detail: `PF: ${metrics.profitFactor.toFixed(2)}. A vesztes ügyletek összesen nagyobbak – csökkentsd a kockázatot vagy növeld a cél R arányt.`,
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
        detail: `${tradesPerDay} ügylet az elmúlt 24 órában. Növeld a cooldown időt (pl. 30–45 perc).`,
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
          detail: `${total} ügyletből ${stats.pnl.toFixed(2)} USD nettó. Fontold meg ennek az idősíknak a kizárását.`,
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
          detail: `${stats.count} ügylet, ${stats.pnl.toFixed(2)} USD. Ideiglenesen vedd ki a bot listájából.`,
        });
      }
    });

    const poorRr = botState.trades.filter((trade) => trade.riskReward !== null && trade.riskReward < 1.5);
    if (poorRr.length >= 3) {
      suggestions.push({
        severity: "info",
        title: "Rossz R/R arány",
        detail: `${poorRr.length} ügylet 1.5 alatti tervezett R/R-rel. A Stratégialaborban emeld a cél R értékét.`,
      });
    }

    if (metrics.avgLoss > 0 && metrics.avgWin > 0 && metrics.avgWin / metrics.avgLoss < 1.2) {
      suggestions.push({
        severity: "info",
        title: "Kicsi átlagos nyereség vs. veszteség",
        detail: `Átlag nyerő: $${metrics.avgWin.toFixed(2)}, vesztes: $${metrics.avgLoss.toFixed(2)}. Szűkebb stop vagy magasabb cél javíthat.`,
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        severity: "positive",
        title: "Stabil működés",
        detail: "Nincs kritikus probléma. Folytasd a megfigyelést és hasonlítsd össze a Stratégialabor backtest eredményeivel.",
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
    loadBotState,
    saveBotState,
    createBotState,
    getMetrics,
    tick,
    buildSuggestions,
    resetBot,
    closePosition,
    getCurrentPrice,
  };
})();
