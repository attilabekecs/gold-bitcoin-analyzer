"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const storage = new Map();
global.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};
global.window = {
  BotIntelligence: require("../bot-intelligence-engine.js"),
  BotAdaptiveController: require("../bot-adaptive-controller.js"),
};

require("../virtual-bot.js");

test("legacy saved configuration migrates to the aggressive adaptive profile once", () => {
  storage.set(
    window.VirtualBot.STORAGE_KEY,
    JSON.stringify({
      initialCapital: 10000,
      cash: 10000,
      config: {
        minConfidence: 58,
        signalScoreThreshold: 2.75,
        cooldownMinutes: 30,
        maxPositions: 2,
        maxTradesPerDay: 10,
        maxTradesPerHour: 4,
        autoLearnMaxDailyAdjustments: 20,
        autoLearnMinChangeMinutes: 15,
        autoLearnTargetTradesPer6h: 1,
      },
    }),
  );

  const state = window.VirtualBot.loadBotState();

  assert.equal(state.config.aggressiveAdaptiveEnabled, true);
  assert.equal(state.config.aggressiveAdaptiveReviewMinutes, 5);
  assert.equal(state.config.aggressiveAdaptiveNoTradeMinutes, 15);
  assert.equal(state.config.aggressiveAdaptiveBatchSize, 6);
  assert.equal(state.config.autoLearnMaxDailyAdjustments, 48);
  assert.equal(state.config.autoLearnMinChangeMinutes, 5);
  assert.equal(state.config.autoLearnTargetTradesPer6h, 4);
  assert.equal(state.config.cooldownMinutes, 10);
  assert.equal(state.config.maxPositions, 3);
  assert.equal(state.config.maxTradesPerHour, 8);
  assert.equal(state.config.aggressiveAdaptiveProfileRevision, 1);
});

test("aggressive preset keeps risk controlled while increasing activity", () => {
  const preset = window.VirtualBot.CONFIG_PRESETS.aggressive.config;

  assert.equal(preset.aggressiveAdaptiveEnabled, true);
  assert.equal(preset.maxTradesPerHour, 8);
  assert.equal(preset.minEntryGapMinutes, 0);
  assert.ok(preset.riskPercent <= 2);
});

test("enabled aggressive mode reasserts its activity envelope on load", () => {
  storage.set(
    window.VirtualBot.STORAGE_KEY,
    JSON.stringify({
      initialCapital: 10000,
      cash: 10000,
      config: {
        aggressiveAdaptiveEnabled: true,
        aggressiveAdaptiveProfileRevision: 1,
        autoLearnMaxDailyAdjustments: 20,
        autoLearnMinChangeMinutes: 15,
        autoLearnTargetTradesPer6h: 1,
        cooldownMinutes: 30,
        maxPositions: 2,
        maxTradesPerHour: 4,
      },
    }),
  );

  const state = window.VirtualBot.loadBotState();

  assert.equal(state.config.autoLearnMaxDailyAdjustments, 48);
  assert.equal(state.config.autoLearnMinChangeMinutes, 5);
  assert.equal(state.config.autoLearnTargetTradesPer6h, 4);
  assert.equal(state.config.cooldownMinutes, 10);
  assert.equal(state.config.maxPositions, 3);
  assert.equal(state.config.maxTradesPerHour, 8);
});

test("trade-rate blocker can raise both hourly and daily activity limits", () => {
  const state = window.VirtualBot.createBotState({
    maxTradesPerDay: 10,
    maxTradesPerHour: 4,
    aggressiveAdaptiveBatchSize: 6,
  });
  state.tradeDiagnostics.lastTopReasons = [
    { key: "trade-rate", label: "Ügylet-limit (nap/óra)" },
  ];
  state.autoLearnRuntime.inactivityStartedAt = Date.now() - 20 * 60000;

  const preview = window.VirtualBot.runAutoLearn(state, {}, {
    dryRun: true,
    trigger: "no-trade-timeout",
  });
  const byKey = Object.fromEntries(preview.changes.map((change) => [change.key, change]));

  assert.equal(byKey.maxTradesPerDay.to, 12);
  assert.equal(byKey.maxTradesPerHour.to, 5);
});
