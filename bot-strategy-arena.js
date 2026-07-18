(function (root, factory) {
  "use strict";

  const arena = factory();
  if (typeof module === "object" && module.exports) module.exports = arena;
  if (root) root.BotStrategyArena = arena;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const VERSION = 1;
  const PROFILE_DEFINITIONS = [
    { id: "champion", label: "Champion", role: "champion" },
    { id: "challenger-active", label: "Aktív kihívó", role: "challenger" },
    { id: "challenger-quality", label: "Minőségi kihívó", role: "challenger" },
    { id: "challenger-asymmetric", label: "Aszimmetrikus kihívó", role: "challenger" },
  ];

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function copyConfig(config) {
    return { ...(config || {}), assets: [...(config?.assets || [])] };
  }

  function deriveProfileConfigs(championConfig) {
    const base = copyConfig(championConfig);
    return {
      champion: base,
      "challenger-active": {
        ...base,
        minConfidence: clamp(finite(base.minConfidence, 52) - 4, 42, 90),
        minOpportunityScore: clamp(finite(base.minOpportunityScore, 58) - 4, 50, 120),
        minEntryQualityScore: clamp(finite(base.minEntryQualityScore, 55) - 3, 48, 95),
        signalScoreThreshold: clamp(finite(base.signalScoreThreshold, 2.25) - 0.25, 1.5, 4),
        cooldownMinutes: base.rapidDataCollectionMode
          ? 0
          : Math.max(5, finite(base.cooldownMinutes, 10) - 5),
        minEntryGapMinutes: Math.max(0, finite(base.minEntryGapMinutes, 5) - 5),
      },
      "challenger-quality": {
        ...base,
        minConfidence: clamp(finite(base.minConfidence, 52) + 5, 40, 90),
        minOpportunityScore: clamp(finite(base.minOpportunityScore, 58) + 7, 50, 120),
        minEntryQualityScore: clamp(finite(base.minEntryQualityScore, 55) + 6, 50, 95),
        requireAlignment: true,
        minAlignmentRatio: Math.max(finite(base.minAlignmentRatio, 0.6), 0.7),
        riskPercent: Math.min(finite(base.riskPercent, 1.5), 1.25),
      },
      "challenger-asymmetric": {
        ...base,
        rewardRatio: clamp(finite(base.rewardRatio, 2.5) + 0.5, 1, 5),
        atrStopMultiplierLong: clamp(finite(base.atrStopMultiplierLong, 2.5) - 0.25, 0.5, 5),
        atrStopMultiplierShort: clamp(finite(base.atrStopMultiplierShort, 2.75) + 0.25, 0.5, 5),
        trailingActivationR: clamp(finite(base.trailingActivationR, 0.75) + 0.25, 0.25, 2),
        partialTakeProfitR: clamp(finite(base.partialTakeProfitR, 1) + 0.25, 0.5, 3),
      },
    };
  }

  function createProfile(definition, config, capital, now) {
    return {
      ...definition,
      config: copyConfig(config),
      initialCapital: capital,
      equity: capital,
      positions: [],
      trades: [],
      equityHistory: [{ time: now, equity: capital }],
      lastActionAt: {},
    };
  }

  function createArena(championConfig = {}, capital = 10000, now = Date.now()) {
    const safeCapital = Math.max(1, finite(capital, 10000));
    const configs = deriveProfileConfigs(championConfig);
    return {
      version: VERSION,
      enabled: true,
      championId: "champion",
      createdAt: now,
      lastTickAt: 0,
      lastEvaluationAt: 0,
      lastPromotionDecision: null,
      promotionHistory: [],
      profiles: PROFILE_DEFINITIONS.map((definition) =>
        createProfile(definition, configs[definition.id], safeCapital, now),
      ),
    };
  }

  function ensureArena(arena, championConfig = {}, capital = 10000, now = Date.now()) {
    if (!arena || arena.version !== VERSION || !Array.isArray(arena.profiles)) {
      return createArena(championConfig, capital, now);
    }
    const configs = deriveProfileConfigs(championConfig);
    const existing = new Map(arena.profiles.map((profile) => [profile.id, profile]));
    arena.profiles = PROFILE_DEFINITIONS.map((definition) => {
      const profile = existing.get(definition.id);
      if (!profile) return createProfile(definition, configs[definition.id], capital, now);
      profile.label = definition.label;
      profile.role = definition.role;
      profile.config = definition.role === "champion"
        ? copyConfig(championConfig)
        : copyConfig(profile.config || configs[definition.id]);
      profile.positions = Array.isArray(profile.positions) ? profile.positions : [];
      profile.trades = Array.isArray(profile.trades) ? profile.trades : [];
      profile.equityHistory = Array.isArray(profile.equityHistory) && profile.equityHistory.length
        ? profile.equityHistory
        : [{ time: now, equity: finite(profile.equity, capital) }];
      profile.lastActionAt = profile.lastActionAt || {};
      profile.initialCapital = Math.max(1, finite(profile.initialCapital, capital));
      profile.equity = Math.max(0, finite(profile.equity, profile.initialCapital));
      return profile;
    });
    arena.promotionHistory = Array.isArray(arena.promotionHistory) ? arena.promotionHistory : [];
    return arena;
  }

  function canOpen(profile, candidate, now) {
    if (!profile || !candidate?.asset || !candidate?.direction) return false;
    if (profile.positions.some((position) => position.asset === candidate.asset)) return false;
    if (profile.positions.length >= Math.max(1, finite(profile.config.maxPositions, 1))) return false;
    const gap = Math.max(0, finite(profile.config.minEntryGapMinutes, 0)) * 60000;
    const latest = Math.max(0, ...Object.values(profile.lastActionAt || {}).map(Number).filter(Number.isFinite));
    return !latest || now - latest >= gap;
  }

  function openShadowPosition(profile, candidate, now = Date.now()) {
    if (!canOpen(profile, candidate, now)) return null;
    const entry = finite(candidate.entry);
    const stop = finite(candidate.stop);
    const target = finite(candidate.target);
    const stopDistance = Math.abs(entry - stop);
    if (!(entry > 0) || !(stopDistance > 0) || !(target > 0)) return null;
    const riskMoney = Math.max(0.01, profile.equity * finite(profile.config.riskPercent, 1) / 100);
    const quantity = riskMoney / stopDistance;
    const position = {
      id: `arena-${profile.id}-${now}-${candidate.asset}`,
      asset: candidate.asset,
      direction: candidate.direction,
      entry,
      stop,
      initialStop: stop,
      target,
      quantity,
      openedAt: now,
      confidence: finite(candidate.confidence),
      opportunityScore: finite(candidate.opportunityScore),
      signal: candidate.signal || "Árnyékjelzés",
      regime: candidate.regime || "unknown",
    };
    profile.positions.push(position);
    profile.lastActionAt[candidate.asset] = now;
    return position;
  }

  function executionCost(position, exit, config) {
    const fee = Math.max(0, finite(config.feePercent)) / 100;
    const spread = Math.max(0, finite(config.spreadPercent)) / 100;
    const slippage = Math.max(0, finite(config.slippagePercent)) / 100;
    return ((position.entry + exit) * fee + position.entry * spread + exit * slippage) * position.quantity;
  }

  function closeShadowPosition(profile, position, exit, reason, now) {
    const multiplier = position.direction === "long" ? 1 : -1;
    const grossPnl = (exit - position.entry) * position.quantity * multiplier;
    const costs = executionCost(position, exit, profile.config || {});
    const pnl = grossPnl - costs;
    const trade = {
      ...position,
      exit,
      reason,
      closedAt: now,
      fees: costs,
      pnl,
      outcome: pnl >= 0 ? "win" : "loss",
    };
    profile.equity = Math.max(0, profile.equity + pnl);
    profile.positions = profile.positions.filter((item) => item.id !== position.id);
    profile.trades.unshift(trade);
    profile.trades = profile.trades.slice(0, 300);
    profile.equityHistory.push({ time: now, equity: profile.equity });
    profile.equityHistory = profile.equityHistory.slice(-500);
    profile.lastActionAt[position.asset] = now;
    return trade;
  }

  function updateShadowPositions(profile, prices = {}, now = Date.now()) {
    const closed = [];
    [...(profile.positions || [])].forEach((position) => {
      const price = finite(prices[position.asset], NaN);
      if (!Number.isFinite(price) || price <= 0) return;
      const stopHit = position.direction === "long" ? price <= position.stop : price >= position.stop;
      const targetHit = position.direction === "long" ? price >= position.target : price <= position.target;
      const maxAge = Math.max(5, finite(profile.config.maxPositionAgeMinutes, 120)) * 60000;
      const stale = now - position.openedAt >= maxAge;
      if (stopHit) closed.push(closeShadowPosition(profile, position, position.stop, "Stop-loss", now));
      else if (targetHit) closed.push(closeShadowPosition(profile, position, position.target, "Célár", now));
      else if (stale) closed.push(closeShadowPosition(profile, position, price, "Időlimit", now));
    });
    return closed;
  }

  function maxDrawdownPercent(profile) {
    let peak = Math.max(1, finite(profile.initialCapital, 1));
    let maximum = 0;
    (profile.equityHistory || []).forEach((point) => {
      const equity = finite(point.equity, peak);
      peak = Math.max(peak, equity);
      maximum = Math.max(maximum, peak > 0 ? ((peak - equity) / peak) * 100 : 0);
    });
    return maximum;
  }

  function buildStats(profile) {
    const trades = profile?.trades || [];
    const sampleSize = trades.length;
    const wins = trades.filter((trade) => finite(trade.pnl) >= 0);
    const losses = trades.filter((trade) => finite(trade.pnl) < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + finite(trade.pnl), 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + finite(trade.pnl), 0));
    const netPnl = grossProfit - grossLoss;
    const regimes = new Set(trades.map((trade) => trade.regime).filter((value) => value && value !== "unknown"));
    return {
      sampleSize,
      wins: wins.length,
      losses: losses.length,
      winRate: sampleSize ? wins.length / sampleSize : 0,
      netPnl,
      expectancy: sampleSize ? netPnl / sampleSize : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      maxDrawdownPercent: maxDrawdownPercent(profile),
      regimeCount: regimes.size,
      equity: finite(profile?.equity, profile?.initialCapital),
    };
  }

  function validationStatus(profile, minimumTrades) {
    const chronological = [...(profile?.trades || [])].reverse();
    if (chronological.length < minimumTrades) {
      return { passed: false, status: "insufficient-data", reason: `${chronological.length}/${minimumTrades} ügylet` };
    }
    const split = Math.max(1, Math.floor(chronological.length * 0.7));
    const training = chronological.slice(0, split);
    const testing = chronological.slice(split);
    const average = (items) => items.reduce((sum, trade) => sum + finite(trade.pnl), 0) / Math.max(1, items.length);
    const trainExpectancy = average(training);
    const testExpectancy = average(testing);
    const passed = trainExpectancy > 0 && testExpectancy > 0;
    return {
      passed,
      status: passed ? "passed" : "failed",
      reason: passed ? "A tanuló és ellenőrző szakasz is pozitív." : "Az ellenőrző szakasz nem stabil.",
      trainExpectancy,
      testExpectancy,
    };
  }

  function buildLeaderboard(arena, minimumTrades = 50) {
    return (arena?.profiles || []).map((profile) => ({
      id: profile.id,
      label: profile.label,
      role: profile.role,
      stats: buildStats(profile),
      validation: validationStatus(profile, minimumTrades),
    })).sort((left, right) => {
      if (left.validation.passed !== right.validation.passed) return left.validation.passed ? -1 : 1;
      return right.stats.expectancy - left.stats.expectancy;
    });
  }

  function evaluatePromotion(arena, options = {}, now = Date.now()) {
    const minimumTrades = Math.max(20, finite(options.minimumTrades, 50));
    const minimumProfitFactor = Math.max(1, finite(options.minimumProfitFactor, 1.2));
    const maximumDrawdownPercent = Math.max(1, finite(options.maximumDrawdownPercent, 8));
    const leaderboard = buildLeaderboard(arena, minimumTrades);
    const champion = leaderboard.find((entry) => entry.id === arena?.championId);
    const candidates = leaderboard.filter((entry) => entry.role === "challenger");
    let winner = null;
    let reason = `Legalább ${minimumTrades} lezárt árnyékügylet szükséges kihívónként.`;

    if (options.blocked) {
      reason = options.blockedReason || "A biztonsági rendszer blokkolja az előléptetést.";
    } else {
      winner = candidates.find((candidate) => {
        const stats = candidate.stats;
        const championStats = champion?.stats || {};
        return candidate.validation.passed &&
          stats.sampleSize >= minimumTrades &&
          stats.expectancy > 0 &&
          stats.profitFactor >= minimumProfitFactor &&
          stats.maxDrawdownPercent <= maximumDrawdownPercent &&
          stats.regimeCount >= 2 &&
          stats.expectancy > finite(championStats.expectancy) * 1.1 &&
          stats.netPnl > finite(championStats.netPnl);
      }) || null;
      if (winner) reason = `${winner.label} minden előléptetési kaput teljesített.`;
      else if (candidates.some((candidate) => candidate.stats.sampleSize >= minimumTrades)) {
        reason = "Nincs olyan kihívó, amely stabilan és kockázatarányosan felülmúlja a Championt.";
      }
    }

    const decision = {
      time: now,
      eligible: Boolean(winner),
      challengerId: winner?.id || null,
      reason,
      minimumTrades,
      leaderboard,
    };
    if (arena) {
      arena.lastEvaluationAt = now;
      arena.lastPromotionDecision = decision;
    }
    return decision;
  }

  function promote(arena, challengerId, now = Date.now()) {
    const challenger = arena?.profiles?.find((profile) => profile.id === challengerId);
    const champion = arena?.profiles?.find((profile) => profile.id === arena.championId);
    if (!challenger || !champion || challenger.role !== "challenger") return null;
    const previousConfig = copyConfig(champion.config);
    const promotedConfig = copyConfig(challenger.config);
    const historyItem = {
      time: now,
      challengerId,
      challengerLabel: challenger.label,
      previousConfig,
      promotedConfig,
      stats: buildStats(challenger),
    };
    champion.config = promotedConfig;
    arena.profiles.forEach((profile) => {
      profile.positions = [];
      profile.trades = [];
      profile.initialCapital = profile.equity;
      profile.equityHistory = [{ time: now, equity: profile.equity }];
      profile.lastActionAt = {};
    });
    arena.promotionHistory.unshift(historyItem);
    arena.promotionHistory = arena.promotionHistory.slice(0, 20);
    arena.lastPromotionDecision = { ...arena.lastPromotionDecision, promotedAt: now };
    return historyItem;
  }

  return {
    VERSION,
    PROFILE_DEFINITIONS,
    deriveProfileConfigs,
    createArena,
    ensureArena,
    openShadowPosition,
    updateShadowPositions,
    buildStats,
    validationStatus,
    buildLeaderboard,
    evaluatePromotion,
    promote,
  };
});
