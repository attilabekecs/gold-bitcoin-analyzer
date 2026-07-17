"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../bot-intelligence-engine.js");

function trade(index, pnl, overrides = {}) {
  return {
    id: `trade-${index}`,
    asset: "bitcoin",
    direction: "long",
    interval: 5,
    openedAt: index * 60000,
    closedAt: index * 60000 + 30000,
    pnl,
    confidence: 70,
    entryQuality: { regime: "trending", structure: "breakout" },
    ...overrides,
  };
}

test("trade statistics calculate expectancy and profit factor", () => {
  const stats = Engine.buildTradeStats([
    trade(1, 120),
    trade(2, 80),
    trade(3, -50),
    trade(4, -50),
  ]);

  assert.equal(stats.sampleSize, 4);
  assert.equal(stats.winRate, 0.5);
  assert.equal(stats.expectancy, 25);
  assert.equal(stats.profitFactor, 2);
});

test("setup memory separates asset, direction, interval and regime", () => {
  const trades = [
    trade(1, 30),
    trade(2, -10),
    trade(3, 20, { direction: "short" }),
  ];
  const memory = Engine.buildSetupMemory(trades);

  assert.equal(memory.length, 2);
  assert.ok(memory.some((entry) => entry.key.includes("bitcoin|long|5m|trending")));
  assert.ok(memory.some((entry) => entry.key.includes("bitcoin|short|5m|trending")));
});

test("unknown setup is allowed only with reduced exploration risk", () => {
  const gate = Engine.evaluateSetupGate([], {
    asset: "gold",
    direction: "long",
    interval: 15,
    regime: "ranging",
  });

  assert.equal(gate.allowed, true);
  assert.equal(gate.exploration, true);
  assert.ok(gate.riskMultiplier <= 0.5);
});

test("proven negative setup is blocked", () => {
  const trades = Array.from({ length: 10 }, (_, index) => trade(index, index < 3 ? 20 : -30));
  const gate = Engine.evaluateSetupGate(trades, {
    asset: "bitcoin",
    direction: "long",
    interval: 5,
    regime: "trending",
    structure: "breakout",
    time: 0,
  });

  assert.equal(gate.exploration, false);
  assert.equal(gate.allowed, false);
});

test("walk-forward validation recognizes consistent out-of-sample performance", () => {
  const trades = Array.from({ length: 30 }, (_, index) =>
    trade(index, index % 3 === 0 ? -20 : 35),
  );
  const result = Engine.walkForwardValidate(trades);

  assert.equal(result.status, "passed");
  assert.ok(result.consistency >= 0.6);
  assert.ok(result.outOfSample.expectancy > 0);
});

test("portfolio gate blocks excessive correlated exposure", () => {
  const positions = [
    { asset: "bitcoin", direction: "long", riskPercent: 1.5 },
    { asset: "ethereum", direction: "long", riskPercent: 1.5 },
  ];
  const result = Engine.evaluatePortfolioRisk(positions, {
    asset: "solana",
    direction: "long",
    riskPercent: 1.5,
  });

  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((reason) => reason.includes("csoportkockázat")));
  assert.ok(result.reasons.some((reason) => reason.includes("Korrelált")));
});

test("kill switch activates after consecutive losses", () => {
  const trades = [trade(5, -10), trade(4, -10), trade(3, -10), trade(2, -10)];
  const result = Engine.evaluateKillSwitch({
    initialCapital: 10000,
    trades,
    equityHistory: [{ equity: 10000 }, { equity: 9960 }],
  });

  assert.equal(result.active, true);
  assert.ok(result.reasons.some((reason) => reason.includes("egymást követő")));
});

test("dynamic sizing reduces risk in volatile unvalidated exploration", () => {
  const multiplier = Engine.dynamicRiskMultiplier({
    confidence: 58,
    regime: "volatile",
    drawdownPercent: 6,
    setupGate: { riskMultiplier: 0.5 },
    portfolioRisk: { riskMultiplier: 0.8 },
    validation: { status: "insufficient-data" },
  });

  assert.ok(multiplier >= 0.25);
  assert.ok(multiplier < 0.5);
});

test("checkpoint requests rollback when new results materially deteriorate", () => {
  const baselineTrades = Array.from({ length: 12 }, (_, index) =>
    trade(index, index % 3 === 0 ? -10 : 25),
  );
  const checkpoint = Engine.createConfigCheckpoint({ minConfidence: 60 }, baselineTrades);
  const newLosses = Array.from({ length: 8 }, (_, index) => trade(20 + index, -40));
  const result = Engine.evaluateCheckpointRollback(
    checkpoint,
    [...newLosses, ...baselineTrades],
  );

  assert.equal(result.shouldRollback, true);
});

test("missed opportunity follow-up records hypothetical outcome", () => {
  const candidate = {
    time: 1000,
    direction: "long",
    entry: 100,
    stop: 95,
    target: 110,
  };
  const result = Engine.evaluateMissedOpportunity(candidate, 111, 2000);

  assert.equal(result.outcome, "would-win");
});
