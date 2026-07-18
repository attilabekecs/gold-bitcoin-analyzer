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
  BotStrategyArena: require("../bot-strategy-arena.js"),
};

require("../virtual-bot.js");

function createCandles(count) {
  return Array.from({ length: count }, (_, index) => ({
    time: 1700000000000 + index * 60000,
    open: 100 + index,
    high: 102 + index,
    low: 99 + index,
    close: 101 + index,
    volume: 1000 + index,
  }));
}

test("a teljes elemzési export tartalmazza a bot, az aréna és a piaci adatokat", () => {
  const now = 1800000000000;
  const state = window.VirtualBot.createBotState({ initialCapital: 10000 });
  state.config.enabled = true;
  state.lastTickAt = now - 3 * 60000;
  state.tradeDiagnostics.lastOpenSuccessAt = now - 6 * 3600000;
  state.trades = [
    { id: "loss-4", pnl: -40, closedAt: now - 1000, asset: "bitcoin" },
    { id: "loss-3", pnl: -30, closedAt: now - 2000, asset: "bitcoin" },
    { id: "loss-2", pnl: -20, closedAt: now - 3000, asset: "ethereum" },
    { id: "loss-1", pnl: -10, closedAt: now - 4000, asset: "ethereum" },
    { id: "win", pnl: 50, closedAt: now - 5000, asset: "bitcoin" },
  ];
  state.intelligence.killSwitch = {
    active: true,
    reasons: ["4 egymást követő veszteség"],
  };
  state.activityLog.push({ time: now - 5000, message: "teszt" });
  state.learningHistory.push({ time: now - 4000, trigger: "teszt" });
  state.configChangeLog.push({ time: now - 3000, key: "minConfidence" });
  state.strategyArena.profiles[0].trades.push({
    id: "shadow-1",
    pnl: 25,
    closedAt: now - 2000,
    asset: "bitcoin",
  });

  const payload = window.VirtualBot.buildAnalysisExport(
    state,
    {
      botCurrency: "HUF",
      assets: {
        bitcoin: { currentPrice: 65000, updatedAt: now - 1000 },
      },
      intraday: {
        bitcoin: {
          currentPrice: 65000,
          candles: createCandles(620),
          updatedAt: now - 1000,
        },
      },
      multiTimeframe: {
        bitcoin: {
          5: { currentPrice: 65000, candles: createCandles(120) },
        },
      },
    },
    { exportedAt: now, runtime: { visibilityState: "hidden" } },
  );

  assert.equal(payload.schema, "aurum-virtual-bot-analysis");
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.summary.consecutiveLosses, 4);
  assert.equal(payload.summary.killSwitchActive, true);
  assert.equal(payload.summary.closedTradeCount, 5);
  assert.equal(payload.summary.arenaProfileCount, 4);
  assert.equal(payload.summary.arenaTradeCounts[0].closedTrades, 1);
  assert.equal(payload.botState.trades.length, 5);
  assert.equal(payload.botState.activityLog.length, 1);
  assert.equal(payload.botState.learningHistory.length, 1);
  assert.equal(payload.botState.configChangeLog.length, 1);
  assert.equal(payload.market.assetCount, 1);
  assert.equal(payload.market.assets.bitcoin.intraday.originalCandleCount, 620);
  assert.equal(payload.market.assets.bitcoin.intraday.exportedCandleCount, 500);
  assert.equal(payload.market.assets.bitcoin.timeframes[5].candles.length, 120);
  assert.equal(payload.runtime.visibilityState, "hidden");
  assert.ok(payload.diagnostics.detectedIssues.some((issue) => issue.code === "kill-switch-active"));
  assert.ok(payload.diagnostics.detectedIssues.some((issue) => issue.code === "tick-stale-or-page-suspended"));
});

test("az elemzési export rekurzívan kiszűri a hitelesítési adatokat és függvényeket", () => {
  const state = window.VirtualBot.createBotState();
  state.config.apiKey = "TOP-SECRET-API-KEY";
  state.config.nested = {
    accessToken: "TOP-SECRET-TOKEN",
    password: "TOP-SECRET-PASSWORD",
    safeValue: "megmarad",
  };
  const stateBeforeExport = JSON.stringify(state);

  const payload = window.VirtualBot.buildAnalysisExport(
    state,
    {
      assets: {
        bitcoin: {
          currentPrice: 65000,
          authorization: "Bearer TOP-SECRET-AUTH",
          helper() {},
        },
      },
    },
    { exportedAt: 1800000000000 },
  );
  const json = JSON.stringify(payload);

  assert.equal(payload.botState.config.apiKey, undefined);
  assert.equal(payload.botState.config.nested.accessToken, undefined);
  assert.equal(payload.botState.config.nested.password, undefined);
  assert.equal(payload.botState.config.nested.safeValue, "megmarad");
  assert.equal(payload.market.assets.bitcoin.daily.authorization, undefined);
  assert.equal(payload.cloudSync.userId, undefined);
  assert.equal(JSON.stringify(state), stateBeforeExport);
  assert.doesNotMatch(json, /TOP-SECRET/);
});
