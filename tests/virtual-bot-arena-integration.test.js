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

test("az új botállapot létrehozza és a szinkron payload megőrzi az arénát", () => {
  const state = window.VirtualBot.createBotState({ initialCapital: 25000 });
  assert.equal(state.strategyArena.profiles.length, 4);
  assert.equal(state.strategyArena.profiles[0].initialCapital, 25000);

  const payload = window.VirtualBot.buildSyncPayload(state);
  assert.equal(payload.state.strategyArena.version, 1);
  assert.equal(payload.state.strategyArena.profiles.length, 4);
});

test("régi mentés betöltésekor automatikusan létrejön az aréna", () => {
  storage.set(window.VirtualBot.STORAGE_KEY, JSON.stringify({
    initialCapital: 10000,
    cash: 10000,
    config: { strategyArenaEnabled: true },
  }));
  const state = window.VirtualBot.loadBotState();
  assert.equal(state.config.strategyArenaEnabled, true);
  assert.equal(state.strategyArena.profiles.length, 4);
});
