const test = require("node:test");
const assert = require("node:assert/strict");
const Arena = require("../bot-strategy-arena.js");

const baseConfig = {
  assets: ["bitcoin", "gold"],
  riskPercent: 1,
  maxPositions: 2,
  minEntryGapMinutes: 0,
  maxPositionAgeMinutes: 120,
  feePercent: 0,
  spreadPercent: 0,
  slippagePercent: 0,
  minConfidence: 52,
  minOpportunityScore: 58,
  minEntryQualityScore: 55,
  signalScoreThreshold: 2.25,
  rewardRatio: 2.5,
};

test("négy elkülönített Champion–Challenger profilt hoz létre", () => {
  const arena = Arena.createArena(baseConfig, 10000, 1000);
  assert.equal(arena.profiles.length, 4);
  assert.equal(arena.profiles.filter((profile) => profile.role === "challenger").length, 3);
  assert.notEqual(
    arena.profiles.find((profile) => profile.id === "challenger-active").config.minConfidence,
    arena.profiles.find((profile) => profile.id === "champion").config.minConfidence,
  );
});

test("kockázatarányosan nyit és céláron zár árnyékügyletet", () => {
  const arena = Arena.createArena(baseConfig, 10000, 1000);
  const profile = arena.profiles[0];
  const position = Arena.openShadowPosition(profile, {
    asset: "bitcoin",
    direction: "long",
    entry: 100,
    stop: 95,
    target: 110,
    regime: "trending",
  }, 2000);
  assert.equal(position.quantity, 20);
  const closed = Arena.updateShadowPositions(profile, { bitcoin: 111 }, 3000);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].pnl, 200);
  assert.equal(profile.equity, 10200);
});

test("elégtelen mintánál nem enged előléptetést", () => {
  const arena = Arena.createArena(baseConfig, 10000, 1000);
  const decision = Arena.evaluatePromotion(arena, { minimumTrades: 50 }, 2000);
  assert.equal(decision.eligible, false);
  assert.match(decision.reason, /50/);
});

test("csak több rezsimben stabil, jobb kihívót jelöl előléptetésre", () => {
  const arena = Arena.createArena(baseConfig, 10000, 1000);
  const champion = arena.profiles.find((profile) => profile.id === "champion");
  const challenger = arena.profiles.find((profile) => profile.id === "challenger-quality");
  const makeTrades = (count, pnl) => Array.from({ length: count }, (_, index) => ({
    id: `${pnl}-${index}`,
    pnl,
    regime: index % 2 ? "trending" : "ranging",
    closedAt: index,
  }));
  champion.trades = makeTrades(50, 1);
  challenger.trades = makeTrades(50, 2);
  champion.equity = 10050;
  challenger.equity = 10100;
  champion.equityHistory = [{ time: 1, equity: 10000 }, { time: 2, equity: 10050 }];
  challenger.equityHistory = [{ time: 1, equity: 10000 }, { time: 2, equity: 10100 }];

  const decision = Arena.evaluatePromotion(arena, {
    minimumTrades: 50,
    minimumProfitFactor: 1.2,
    maximumDrawdownPercent: 8,
  }, 3000);
  assert.equal(decision.eligible, true);
  assert.equal(decision.challengerId, "challenger-quality");
});
