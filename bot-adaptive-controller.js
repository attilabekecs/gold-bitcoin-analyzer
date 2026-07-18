(function (root, factory) {
  "use strict";

  const controller = factory();
  if (typeof module === "object" && module.exports) module.exports = controller;
  if (root) root.BotAdaptiveController = controller;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const DEFAULTS = Object.freeze({
    reviewMinutes: 5,
    noTradeMinutes: 15,
    batchSize: 6,
    maxDailyAdjustments: 48,
    targetWinRate: 45,
  });

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, finite(value, min)));
  }

  function normalizeConfig(config = {}) {
    return {
      enabled: Boolean(config.autoLearnEnabled && config.aggressiveAdaptiveEnabled),
      reviewMinutes: clamp(config.aggressiveAdaptiveReviewMinutes, 1, 30) || DEFAULTS.reviewMinutes,
      noTradeMinutes:
        clamp(config.aggressiveAdaptiveNoTradeMinutes, 5, 120) || DEFAULTS.noTradeMinutes,
      batchSize: Math.round(
        clamp(config.aggressiveAdaptiveBatchSize, 2, 8) || DEFAULTS.batchSize,
      ),
      maxDailyAdjustments: Math.round(
        clamp(config.autoLearnMaxDailyAdjustments, 5, 100) || DEFAULTS.maxDailyAdjustments,
      ),
      targetWinRate: clamp(config.autoLearnTargetWinRate, 25, 80) || DEFAULTS.targetWinRate,
    };
  }

  function decideCycle(input = {}) {
    const now = finite(input.now, Date.now());
    const config = normalizeConfig(input.config);
    const runtime = input.runtime || {};
    const diagnostics = input.diagnostics || {};
    const rolling = input.rolling || {};
    const lastOpenAt = finite(diagnostics.lastOpenSuccessAt, 0);
    const inactivityStartedAt = finite(runtime.inactivityStartedAt, now);
    const inactivityReference = lastOpenAt || inactivityStartedAt;
    const inactivityMinutes = Math.max(0, (now - inactivityReference) / 60000);
    const elapsedSinceChangeMinutes = runtime.lastChangeAt
      ? Math.max(0, (now - finite(runtime.lastChangeAt)) / 60000)
      : Infinity;
    const dailyCount = finite(runtime.dailyCount, 0);
    const blockers = Array.isArray(diagnostics.lastTopReasons)
      ? diagnostics.lastTopReasons
      : [];
    const negativePerformance =
      finite(rolling.sampleSize, 0) >= 5 &&
      (finite(rolling.rollingPnl, 0) < 0 ||
        (rolling.winRate !== null &&
          rolling.winRate !== undefined &&
          finite(rolling.winRate, 100) < config.targetWinRate));

    if (!config.enabled) {
      return { shouldAdjust: false, mode: "disabled", config, inactivityMinutes };
    }
    if (dailyCount >= config.maxDailyAdjustments) {
      return { shouldAdjust: false, mode: "daily-limit", config, inactivityMinutes };
    }
    if (elapsedSinceChangeMinutes < config.reviewMinutes) {
      return {
        shouldAdjust: false,
        mode: "waiting",
        config,
        inactivityMinutes,
        nextReviewAt: finite(runtime.lastChangeAt) + config.reviewMinutes * 60000,
      };
    }
    if (negativePerformance) {
      return {
        shouldAdjust: true,
        mode: "quality-repair",
        config,
        inactivityMinutes,
        maxChanges: config.batchSize,
      };
    }
    if (inactivityMinutes >= config.noTradeMinutes && blockers.length) {
      return {
        shouldAdjust: true,
        mode: "activity-recovery",
        config,
        inactivityMinutes,
        maxChanges: config.batchSize,
      };
    }
    return {
      shouldAdjust: false,
      mode: "monitoring",
      config,
      inactivityMinutes,
      nextReviewAt: now + config.reviewMinutes * 60000,
    };
  }

  function selectBatch(changes = [], maxChanges = DEFAULTS.batchSize) {
    const unique = [];
    const seen = new Set();
    changes.forEach((change) => {
      if (!change?.key || seen.has(change.key)) return;
      seen.add(change.key);
      unique.push(change);
    });
    return unique.slice(0, Math.round(clamp(maxChanges, 1, 8)));
  }

  return Object.freeze({
    DEFAULTS,
    normalizeConfig,
    decideCycle,
    selectBatch,
  });
});
