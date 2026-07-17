(function (root, factory) {
  "use strict";

  const Core =
    typeof module === "object" && module.exports
      ? require("./bot-intelligence-statistics.js")
      : root?.BotIntelligenceStatistics;
  const engine = factory(Core);
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.BotIntelligence = engine;
})(typeof window !== "undefined" ? window : globalThis, function (Core) {
  "use strict";

  if (!Core) throw new Error("BotIntelligenceStatistics module is required.");

  const { finite, clamp, buildTradeStats, calculateMaxDrawdown } = Core;
  const DEFAULTS = Object.freeze({
    minimumSetupSamples: 8,
    validationMinimumTrades: 20,
    validationTestSize: 5,
    maximumOpenRiskPercent: 4.5,
    maximumGroupRiskPercent: 3,
    maximumDrawdownPercent: 12,
    maximumDailyLossPercent: 5,
    maximumWeeklyLossPercent: 8,
    maximumConsecutiveLosses: 4,
    maximumDataAgeMs: 5 * 60000,
    rollbackMinimumTrades: 8,
    rollbackExpectancyDegradation: 0.35,
  });

  const ASSET_GROUPS = Object.freeze({
    bitcoin: "crypto",
    ethereum: "crypto",
    solana: "crypto",
    xrp: "crypto",
    bnb: "crypto",
    gold: "metals",
    silver: "metals",
    spy: "equities",
    qqq: "equities",
    dia: "equities",
    dax: "equities",
    nasdaq: "equities",
    sp500: "equities",
  });

  function resolveAssetGroup(assetKey, category = "") {
    if (ASSET_GROUPS[assetKey]) return ASSET_GROUPS[assetKey];
    const normalized = String(category).toLowerCase();
    if (normalized.includes("crypto")) return "crypto";
    if (normalized.includes("commodity") || normalized.includes("metal")) return "metals";
    if (normalized.includes("forex") || normalized.includes("currency")) return "fx";
    if (normalized.includes("stock") || normalized.includes("index") || normalized.includes("etf")) {
      return "equities";
    }
    return assetKey || "other";
  }

  function evaluatePortfolioRisk(positions = [], candidate = {}, options = {}) {
    const maximumOpenRiskPercent =
      options.maximumOpenRiskPercent ?? DEFAULTS.maximumOpenRiskPercent;
    const maximumGroupRiskPercent =
      options.maximumGroupRiskPercent ?? DEFAULTS.maximumGroupRiskPercent;
    const candidateRisk = finite(candidate.riskPercent, 1);
    const candidateGroup = resolveAssetGroup(candidate.asset || candidate.assetKey, candidate.category);
    const candidateDirection = candidate.direction || "long";
    const mapped = positions.map((position) => ({
      risk: finite(position.effectiveRiskPercent, finite(position.riskPercent, 1)),
      group: resolveAssetGroup(position.asset, position.category),
      direction: position.direction,
    }));
    const totalRisk = mapped.reduce((sum, position) => sum + position.risk, 0);
    const groupRisk = mapped
      .filter((position) => position.group === candidateGroup)
      .reduce((sum, position) => sum + position.risk, 0);
    const correlatedCount = mapped.filter(
      (position) => position.group === candidateGroup && position.direction === candidateDirection,
    ).length;
    const projectedTotal = totalRisk + candidateRisk;
    const projectedGroup = groupRisk + candidateRisk;
    const reasons = [];
    if (projectedTotal > maximumOpenRiskPercent) reasons.push("Teljes nyitott kockázati limit");
    if (projectedGroup > maximumGroupRiskPercent) reasons.push(`${candidateGroup} csoportkockázat`);
    if (correlatedCount >= 2) reasons.push("Korrelált, azonos irányú kitettség");
    const headroom = Math.min(
      maximumOpenRiskPercent - totalRisk,
      maximumGroupRiskPercent - groupRisk,
    );
    return {
      allowed: reasons.length === 0,
      reasons,
      totalRiskPercent: totalRisk,
      projectedTotalRiskPercent: projectedTotal,
      groupRiskPercent: groupRisk,
      projectedGroupRiskPercent: projectedGroup,
      correlatedCount,
      riskMultiplier: clamp(headroom / Math.max(candidateRisk, 0.1), 0.35, 1),
      group: candidateGroup,
    };
  }

  function getConsecutiveLosses(trades = []) {
    let losses = 0;
    for (const trade of trades) {
      if (trade.partial) continue;
      if (finite(trade.pnl) >= 0) break;
      losses += 1;
    }
    return losses;
  }

  function periodPnl(trades, since) {
    return trades
      .filter((trade) => !trade.partial && finite(trade.closedAt) >= since)
      .reduce((sum, trade) => sum + finite(trade.pnl), 0);
  }

  function evaluateKillSwitch(state = {}, now = Date.now(), options = {}) {
    const config = { ...DEFAULTS, ...options };
    const trades = state.trades || [];
    const initialCapital = Math.max(1, finite(state.initialCapital, 10000));
    const dailyPnl = periodPnl(trades, now - 86400000);
    const weeklyPnl = periodPnl(trades, now - 7 * 86400000);
    const drawdown = calculateMaxDrawdown(
      (state.equityHistory || []).map((point) => point.equity),
    );
    const consecutiveLosses = getConsecutiveLosses(trades);
    const dataAgeMs = state.lastMarketDataAt ? now - state.lastMarketDataAt : 0;
    const reasons = [];
    if ((dailyPnl / initialCapital) * 100 <= -config.maximumDailyLossPercent) {
      reasons.push("Napi veszteséglimit");
    }
    if ((weeklyPnl / initialCapital) * 100 <= -config.maximumWeeklyLossPercent) {
      reasons.push("Heti veszteséglimit");
    }
    if (drawdown >= config.maximumDrawdownPercent) reasons.push("Maximális drawdown");
    if (consecutiveLosses >= config.maximumConsecutiveLosses) {
      reasons.push(`${consecutiveLosses} egymást követő veszteség`);
    }
    if (dataAgeMs > config.maximumDataAgeMs) reasons.push("Elavult piaci adat");
    if (state.dataHealthy === false) reasons.push("Piaci adatforrás hiba");
    return {
      active: reasons.length > 0,
      reasons,
      dailyPnl,
      weeklyPnl,
      drawdownPercent: drawdown,
      consecutiveLosses,
      dataAgeMs,
    };
  }

  function dynamicRiskMultiplier(input = {}) {
    const setupMultiplier = finite(input.setupGate?.riskMultiplier, 0.7);
    const portfolioMultiplier = finite(input.portfolioRisk?.riskMultiplier, 1);
    const confidenceMultiplier = clamp(finite(input.confidence, 50) / 70, 0.6, 1.15);
    const drawdownMultiplier = clamp(1 - finite(input.drawdownPercent) / 15, 0.35, 1);
    const regimeMultiplier =
      input.regime === "volatile" ? 0.55 : input.regime === "quiet" ? 0.7 : 1;
    const validationMultiplier =
      input.validation?.status === "failed"
        ? 0.5
        : input.validation?.status === "passed"
          ? 1.05
          : 0.75;
    return clamp(
      setupMultiplier *
        portfolioMultiplier *
        confidenceMultiplier *
        drawdownMultiplier *
        regimeMultiplier *
        validationMultiplier,
      0.25,
      1.2,
    );
  }

  function createConfigCheckpoint(config, trades = [], meta = {}) {
    return {
      id: `cfg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      createdAt: Date.now(),
      tradeCount: trades.filter((trade) => !trade.partial).length,
      config: JSON.parse(JSON.stringify(config || {})),
      baseline: buildTradeStats(trades.slice(0, 20)),
      reason: meta.reason || "Automatikus konfiguráció-checkpoint",
    };
  }

  function evaluateCheckpointRollback(checkpoint, trades = [], options = {}) {
    if (!checkpoint) return { shouldRollback: false, reason: "Nincs checkpoint." };
    const completed = trades.filter((trade) => !trade.partial);
    const newTradeCount = completed.length - finite(checkpoint.tradeCount);
    const minimumTrades = options.minimumTrades ?? DEFAULTS.rollbackMinimumTrades;
    if (newTradeCount < minimumTrades) {
      return {
        shouldRollback: false,
        pending: true,
        newTradeCount,
        required: minimumTrades,
        reason: `Rollback értékelés: ${newTradeCount}/${minimumTrades} új ügylet.`,
      };
    }
    const current = buildTradeStats(completed.slice(0, newTradeCount));
    const baselineExpectancy = finite(checkpoint.baseline?.expectancy);
    const tolerance = options.expectancyDegradation ?? DEFAULTS.rollbackExpectancyDegradation;
    const expectancyFloor =
      baselineExpectancy >= 0 ? baselineExpectancy * (1 - tolerance) : baselineExpectancy;
    const shouldRollback =
      current.expectancy < expectancyFloor ||
      current.profitFactor < 0.85 ||
      current.maxDrawdownPercent > DEFAULTS.maximumDrawdownPercent;
    return {
      shouldRollback,
      pending: false,
      newTradeCount,
      baseline: checkpoint.baseline,
      current,
      reason: shouldRollback
        ? "Az új konfiguráció out-of-sample eredménye romlott."
        : "Az új konfiguráció a tolerancián belül teljesít.",
    };
  }

  function evaluateMissedOpportunity(item, currentPrice, now = Date.now()) {
    if (!item || item.outcome || !Number.isFinite(currentPrice)) return item;
    const direction = item.direction || "long";
    const targetHit =
      direction === "long"
        ? currentPrice >= finite(item.target, Infinity)
        : currentPrice <= finite(item.target, -Infinity);
    const stopHit =
      direction === "long"
        ? currentPrice <= finite(item.stop, -Infinity)
        : currentPrice >= finite(item.stop, Infinity);
    const expired = now - finite(item.time, now) >= finite(item.maxAgeMs, 6 * 3600000);
    if (!targetHit && !stopHit && !expired) return item;
    return {
      ...item,
      evaluatedAt: now,
      outcome: targetHit ? "would-win" : stopHit ? "would-lose" : "expired",
      evaluatedPrice: currentPrice,
    };
  }

  function buildIntelligenceReport(botState = {}, context = {}) {
    const trades = botState.trades || [];
    const validation = Core.walkForwardValidate(trades);
    const setupMemory = Core.buildSetupMemory(trades);
    const killSwitch = evaluateKillSwitch({
      ...botState,
      lastMarketDataAt: context.lastMarketDataAt,
      dataHealthy: context.dataHealthy,
    });
    const missed = botState.performanceStats?.missedLog || [];
    const missedWins = missed.filter((item) => item.outcome === "would-win").length;
    const missedLosses = missed.filter((item) => item.outcome === "would-lose").length;
    return {
      generatedAt: Date.now(),
      validation,
      overall: buildTradeStats(trades),
      setupMemory,
      topSetups: setupMemory.filter((setup) => setup.sampleSize >= 3).slice(0, 5),
      weakSetups: setupMemory
        .filter((setup) => setup.sampleSize >= 3)
        .slice()
        .sort((left, right) => left.expectancy - right.expectancy)
        .slice(0, 5),
      calibration: Core.confidenceCalibration(trades),
      killSwitch,
      rollback: evaluateCheckpointRollback(botState.intelligence?.activeCheckpoint, trades),
      missedOpportunity: {
        total: missed.length,
        evaluated: missedWins + missedLosses,
        wouldWin: missedWins,
        wouldLose: missedLosses,
        protectionRate:
          missedWins + missedLosses > 0 ? missedLosses / (missedWins + missedLosses) : null,
      },
    };
  }

  return Object.freeze({
    ...Core,
    DEFAULTS,
    resolveAssetGroup,
    evaluatePortfolioRisk,
    evaluateKillSwitch,
    dynamicRiskMultiplier,
    createConfigCheckpoint,
    evaluateCheckpointRollback,
    evaluateMissedOpportunity,
    buildIntelligenceReport,
  });
});
