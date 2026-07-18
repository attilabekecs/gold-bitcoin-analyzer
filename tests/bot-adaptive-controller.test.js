"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Adaptive = require("../bot-adaptive-controller.js");

const NOW = 2_000_000_000_000;

function config(overrides = {}) {
  return {
    autoLearnEnabled: true,
    aggressiveAdaptiveEnabled: true,
    aggressiveAdaptiveReviewMinutes: 5,
    aggressiveAdaptiveNoTradeMinutes: 15,
    aggressiveAdaptiveBatchSize: 6,
    autoLearnMaxDailyAdjustments: 48,
    autoLearnTargetWinRate: 45,
    ...overrides,
  };
}

test("activity recovery starts after fifteen minutes without a trade", () => {
  const decision = Adaptive.decideCycle({
    now: NOW,
    config: config(),
    runtime: { inactivityStartedAt: NOW - 16 * 60000, dailyCount: 0 },
    diagnostics: { lastTopReasons: [{ key: "low-confidence" }] },
    rolling: { sampleSize: 0, rollingPnl: 0, winRate: null },
  });

  assert.equal(decision.shouldAdjust, true);
  assert.equal(decision.mode, "activity-recovery");
  assert.equal(decision.maxChanges, 6);
});

test("review interval prevents configuration churn on every tick", () => {
  const decision = Adaptive.decideCycle({
    now: NOW,
    config: config(),
    runtime: {
      inactivityStartedAt: NOW - 60 * 60000,
      lastChangeAt: NOW - 2 * 60000,
      dailyCount: 3,
    },
    diagnostics: { lastTopReasons: [{ key: "low-signal" }] },
    rolling: { sampleSize: 0, rollingPnl: 0, winRate: null },
  });

  assert.equal(decision.shouldAdjust, false);
  assert.equal(decision.mode, "waiting");
  assert.equal(decision.nextReviewAt, NOW + 3 * 60000);
});

test("negative rolling performance prioritizes quality repair over more trades", () => {
  const decision = Adaptive.decideCycle({
    now: NOW,
    config: config(),
    runtime: { inactivityStartedAt: NOW - 40 * 60000, dailyCount: 2 },
    diagnostics: { lastTopReasons: [{ key: "low-confidence" }] },
    rolling: { sampleSize: 8, rollingPnl: -120, winRate: 25 },
  });

  assert.equal(decision.shouldAdjust, true);
  assert.equal(decision.mode, "quality-repair");
});

test("adaptive batch can change six unique parameters in one cycle", () => {
  const changes = [
    "minConfidence",
    "minOpportunityScore",
    "minEntryQualityScore",
    "signalScoreThreshold",
    "cooldownMinutes",
    "maxTradesPerHour",
    "maxTradesPerDay",
  ].map((key) => ({ key }));

  const selected = Adaptive.selectBatch(changes, 6);
  assert.equal(selected.length, 6);
  assert.deepEqual(
    selected.map((change) => change.key),
    changes.slice(0, 6).map((change) => change.key),
  );
});

test("daily limit stops further adaptive changes", () => {
  const decision = Adaptive.decideCycle({
    now: NOW,
    config: config({ autoLearnMaxDailyAdjustments: 48 }),
    runtime: { inactivityStartedAt: NOW - 60 * 60000, dailyCount: 48 },
    diagnostics: { lastTopReasons: [{ key: "low-signal" }] },
    rolling: { sampleSize: 0, rollingPnl: 0, winRate: null },
  });

  assert.equal(decision.shouldAdjust, false);
  assert.equal(decision.mode, "daily-limit");
});
