(function (root, factory) {
  "use strict";

  const statistics = factory();
  if (typeof module === "object" && module.exports) module.exports = statistics;
  if (root) root.BotIntelligenceStatistics = statistics;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, finite(value, min)));
  }

  function mean(values) {
    const clean = values.filter(Number.isFinite);
    return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
  }

  function standardDeviation(values) {
    if (values.length < 2) return 0;
    const average = mean(values);
    return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
  }

  function wilsonLowerBound(wins, total, z = 1.645) {
    if (!(total > 0)) return 0;
    const p = wins / total;
    const denominator = 1 + (z * z) / total;
    const centre = p + (z * z) / (2 * total);
    const margin =
      z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
    return clamp((centre - margin) / denominator, 0, 1);
  }

  function calculateMaxDrawdown(equityPoints) {
    let peak = null;
    let maximum = 0;
    equityPoints.forEach((value) => {
      const equity = finite(value, NaN);
      if (!Number.isFinite(equity)) return;
      peak = peak === null ? equity : Math.max(peak, equity);
      if (peak > 0) maximum = Math.max(maximum, ((peak - equity) / peak) * 100);
    });
    return maximum;
  }

  function buildTradeStats(trades = []) {
    const completed = trades.filter((trade) => !trade.partial && Number.isFinite(trade.pnl));
    const wins = completed.filter((trade) => trade.pnl > 0);
    const losses = completed.filter((trade) => trade.pnl < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const averageWin = wins.length ? grossProfit / wins.length : 0;
    const averageLoss = losses.length ? grossLoss / losses.length : 0;
    const winRate = completed.length ? wins.length / completed.length : 0;
    const expectancy = winRate * averageWin - (1 - winRate) * averageLoss;
    const pnlValues = completed.map((trade) => trade.pnl);
    let running = 10000;
    const equity = [running];
    completed
      .slice()
      .sort((left, right) => finite(left.closedAt) - finite(right.closedAt))
      .forEach((trade) => {
        running += trade.pnl;
        equity.push(running);
      });
    return {
      sampleSize: completed.length,
      wins: wins.length,
      losses: losses.length,
      winRate,
      winRateLowerBound: wilsonLowerBound(wins.length, completed.length),
      averageWin,
      averageLoss,
      expectancy,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      netPnl: pnlValues.reduce((sum, value) => sum + value, 0),
      pnlDeviation: standardDeviation(pnlValues),
      maxDrawdownPercent: calculateMaxDrawdown(equity),
    };
  }

  function classifyRegime(decision = {}, entryQuality = null) {
    const declared = entryQuality?.regime;
    if (["trending", "ranging", "volatile", "quiet"].includes(declared)) return declared;
    if (declared === "choppy") return "volatile";
    const price = Math.abs(finite(decision.currentPrice));
    const atrPercent = price > 0 ? (Math.abs(finite(decision.atr)) / price) * 100 : 0;
    const emaGapPercent =
      price > 0
        ? (Math.abs(finite(decision.ema9) - finite(decision.ema21)) / price) * 100
        : 0;
    const momentum = Math.abs(finite(decision.momentum));
    const alignment = finite(decision.alignment?.ratio, finite(decision.alignmentRatio));
    if (atrPercent >= 2.5) return "volatile";
    if (atrPercent > 0 && atrPercent <= 0.25 && momentum < 0.08) return "quiet";
    if (emaGapPercent >= 0.18 && (alignment >= 0.66 || momentum >= 0.18)) return "trending";
    if (emaGapPercent < 0.12 && momentum < 0.14) return "ranging";
    return "mixed";
  }

  function hourBucket(timestamp) {
    const hour = new Date(timestamp ?? Date.now()).getHours();
    if (hour < 6) return "night";
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  }

  function buildSetupKey(candidate = {}) {
    const asset = candidate.asset || candidate.assetKey || "unknown";
    const direction = candidate.direction || "neutral";
    const interval = candidate.interval || candidate.primaryInterval || "?";
    const regime = candidate.regime || classifyRegime(candidate.decision, candidate.entryQuality);
    const entryMode = candidate.entryMode || candidate.structure || "both";
    const session = candidate.session || hourBucket(candidate.time ?? candidate.openedAt);
    return [asset, direction, `${interval}m`, regime, entryMode, session].join("|");
  }

  function enrichTradeSetup(trade = {}) {
    if (trade.setupKey) return trade.setupKey;
    return buildSetupKey({
      asset: trade.asset,
      direction: trade.direction,
      interval: trade.interval,
      regime: trade.entryQuality?.regime,
      structure: trade.entryQuality?.structure,
      openedAt: trade.openedAt,
    });
  }

  function buildSetupMemory(trades = []) {
    const groups = new Map();
    trades
      .filter((trade) => !trade.partial && Number.isFinite(trade.pnl))
      .forEach((trade) => {
        const key = enrichTradeSetup(trade);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(trade);
      });
    return [...groups.entries()]
      .map(([key, setupTrades]) => ({ key, ...buildTradeStats(setupTrades) }))
      .sort((left, right) => right.expectancy - left.expectancy);
  }

  function evaluateSetupGate(trades, candidate, options = {}) {
    const minimumSamples = options.minimumSetupSamples ?? 8;
    const key = buildSetupKey(candidate);
    const matching = (trades || []).filter((trade) => enrichTradeSetup(trade) === key);
    const stats = buildTradeStats(matching);
    if (stats.sampleSize < minimumSamples) {
      return {
        allowed: true,
        exploration: true,
        key,
        stats,
        riskMultiplier: stats.sampleSize < 3 ? 0.5 : 0.7,
        reason: `Felderítési minta: ${stats.sampleSize}/${minimumSamples}`,
      };
    }
    const allowed =
      stats.expectancy > 0 && stats.profitFactor >= 1.05 && stats.winRateLowerBound >= 0.22;
    return {
      allowed,
      exploration: false,
      key,
      stats,
      riskMultiplier: allowed ? clamp(0.75 + stats.winRateLowerBound, 0.8, 1.2) : 0,
      reason: allowed
        ? `Pozitív setup EV: ${stats.expectancy.toFixed(2)}`
        : `Setup tiltva: EV ${stats.expectancy.toFixed(2)}, PF ${stats.profitFactor.toFixed(2)}`,
    };
  }

  function walkForwardValidate(trades = [], options = {}) {
    const ordered = trades
      .filter((trade) => !trade.partial && Number.isFinite(trade.pnl))
      .slice()
      .sort((left, right) => finite(left.closedAt) - finite(right.closedAt));
    const minimumTrades = options.minimumTrades ?? 20;
    const testSize = options.testSize ?? 5;
    if (ordered.length < minimumTrades) {
      return {
        status: "insufficient-data",
        passed: false,
        sampleSize: ordered.length,
        required: minimumTrades,
        folds: [],
        reason: `Legalább ${minimumTrades} lezárt ügylet szükséges.`,
      };
    }
    const initialTrainSize = Math.max(10, ordered.length - testSize * 4);
    const folds = [];
    for (let start = initialTrainSize; start < ordered.length; start += testSize) {
      const train = ordered.slice(0, start);
      const test = ordered.slice(start, Math.min(start + testSize, ordered.length));
      if (!test.length) break;
      const trainStats = buildTradeStats(train);
      const testStats = buildTradeStats(test);
      folds.push({
        trainSize: train.length,
        testSize: test.length,
        trainExpectancy: trainStats.expectancy,
        testExpectancy: testStats.expectancy,
        testNetPnl: testStats.netPnl,
        testProfitFactor: testStats.profitFactor,
        passed: testStats.expectancy > 0 && testStats.netPnl > 0,
      });
    }
    const positiveFolds = folds.filter((fold) => fold.passed).length;
    const consistency = folds.length ? positiveFolds / folds.length : 0;
    const outOfSample = buildTradeStats(ordered.slice(initialTrainSize));
    const passed =
      folds.length >= 2 &&
      consistency >= 0.6 &&
      outOfSample.expectancy > 0 &&
      outOfSample.maxDrawdownPercent <= 12;
    return {
      status: passed ? "passed" : "failed",
      passed,
      sampleSize: ordered.length,
      folds,
      consistency,
      outOfSample,
      reason: passed
        ? `${positiveFolds}/${folds.length} pozitív out-of-sample szakasz.`
        : `${positiveFolds}/${folds.length} pozitív szakasz; további validáció szükséges.`,
    };
  }

  function confidenceCalibration(trades = []) {
    const bins = [
      { min: 0, max: 54, label: "<55%" },
      { min: 55, max: 64, label: "55–64%" },
      { min: 65, max: 74, label: "65–74%" },
      { min: 75, max: 100, label: "75%+" },
    ];
    return bins.map((bin) => {
      const subset = trades.filter(
        (trade) => !trade.partial && trade.confidence >= bin.min && trade.confidence <= bin.max,
      );
      const stats = buildTradeStats(subset);
      const declared = mean(subset.map((trade) => finite(trade.confidence) / 100));
      return {
        ...bin,
        sampleSize: stats.sampleSize,
        actualWinRate: stats.winRate,
        averageDeclaredConfidence: declared,
        calibrationError: stats.sampleSize ? Math.abs(stats.winRate - declared) : null,
      };
    });
  }

  return Object.freeze({
    finite,
    clamp,
    wilsonLowerBound,
    calculateMaxDrawdown,
    buildTradeStats,
    classifyRegime,
    buildSetupKey,
    buildSetupMemory,
    evaluateSetupGate,
    walkForwardValidate,
    confidenceCalibration,
  });
});
