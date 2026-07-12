(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.StrategyEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULTS = {
    direction: "both",
    fastEma: 9,
    slowEma: 21,
    rsiPeriod: 14,
    rsiMin: 50,
    rsiMax: 68,
    useMacd: true,
    momentumLookback: 15,
    momentumThreshold: 0.06,
    useVolume: false,
    volumeMultiplier: 1.1,
    useHigherTimeframe: false,
    atrPeriod: 14,
    atrMultiplier: 1.5,
    rewardRatio: 2,
    useTrailingStop: false,
    trailingAtrMultiplier: 1.2,
    useBreakEven: false,
    breakEvenR: 1,
    cooldownBars: 0,
    initialCapital: 10000,
    riskRate: 0.01,
    feeRate: 0.001,
    spreadRate: 0.0002,
    slippageRate: 0.0001,
    trainingSplit: 0.7,
    objective: "returnDrawdown",
  };

  const BOUNDS = {
    fastEma: [3, 50],
    slowEma: [5, 120],
    rsiPeriod: [5, 30],
    rsiMin: [20, 70],
    rsiMax: [30, 90],
    momentumLookback: [3, 60],
    momentumThreshold: [0, 5],
    volumeMultiplier: [0.5, 5],
    atrPeriod: [5, 50],
    atrMultiplier: [0.5, 5],
    rewardRatio: [0.5, 10],
    trailingAtrMultiplier: [0.5, 5],
    breakEvenR: [0.5, 5],
    cooldownBars: [0, 100],
    initialCapital: [100, 1000000000],
    riskRate: [0.001, 0.1],
    feeRate: [0, 0.02],
    spreadRate: [0, 0.02],
    slippageRate: [0, 0.02],
    trainingSplit: [0.5, 0.85],
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeConfig(input = {}) {
    const config = { ...DEFAULTS, ...input };
    Object.entries(BOUNDS).forEach(([key, [min, max]]) => {
      const value = Number(config[key]);
      config[key] = clamp(Number.isFinite(value) ? value : DEFAULTS[key], min, max);
    });
    config.fastEma = Math.round(config.fastEma);
    config.slowEma = Math.max(Math.round(config.slowEma), config.fastEma + 2);
    config.rsiPeriod = Math.round(config.rsiPeriod);
    config.rsiMax = Math.max(config.rsiMax, config.rsiMin + 1);
    config.momentumLookback = Math.round(config.momentumLookback);
    config.atrPeriod = Math.round(config.atrPeriod);
    config.cooldownBars = Math.round(config.cooldownBars);
    config.direction = ["long", "short", "both"].includes(config.direction)
      ? config.direction
      : DEFAULTS.direction;
    config.objective = ["return", "profitFactor", "returnDrawdown"].includes(config.objective)
      ? config.objective
      : DEFAULTS.objective;
    [
      "useMacd",
      "useVolume",
      "useHigherTimeframe",
      "useTrailingStop",
      "useBreakEven",
    ].forEach((key) => {
      config[key] = Boolean(config[key]);
    });
    return config;
  }

  function validateCandles(candles) {
    if (!Array.isArray(candles)) return [];
    return candles
      .map((candle) => ({
        time: Number(candle.time),
        open: Number(candle.open),
        high: Number(candle.high),
        low: Number(candle.low),
        close: Number(candle.close),
        volume: Number(candle.volume || 0),
      }))
      .filter(
        (candle) =>
          Number.isFinite(candle.time) &&
          [candle.open, candle.high, candle.low, candle.close].every(
            (value) => Number.isFinite(value) && value > 0,
          ) &&
          candle.high >= candle.low,
      )
      .sort((left, right) => left.time - right.time);
  }

  function emaSeries(values, period) {
    const result = Array(values.length).fill(null);
    if (values.length < period) return result;
    const multiplier = 2 / (period + 1);
    let previous = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    result[period - 1] = previous;
    for (let index = period; index < values.length; index += 1) {
      previous = (values[index] - previous) * multiplier + previous;
      result[index] = previous;
    }
    return result;
  }

  function rsiSeries(values, period) {
    const result = Array(values.length).fill(null);
    if (values.length <= period) return result;
    let gains = 0;
    let losses = 0;
    for (let index = 1; index <= period; index += 1) {
      const change = values[index] - values[index - 1];
      gains += Math.max(change, 0);
      losses += Math.max(-change, 0);
    }
    let averageGain = gains / period;
    let averageLoss = losses / period;
    result[period] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
    for (let index = period + 1; index < values.length; index += 1) {
      const change = values[index] - values[index - 1];
      averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
      averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
      result[index] =
        averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
    }
    return result;
  }

  function atrSeries(candles, period) {
    const ranges = candles.map((candle, index) => {
      if (!index) return candle.high - candle.low;
      const previous = candles[index - 1].close;
      return Math.max(
        candle.high - candle.low,
        Math.abs(candle.high - previous),
        Math.abs(candle.low - previous),
      );
    });
    return emaSeries(ranges, period);
  }

  function simpleAverage(values, endIndex, period) {
    if (endIndex < period - 1) return null;
    let sum = 0;
    for (let index = endIndex - period + 1; index <= endIndex; index += 1) {
      sum += values[index];
    }
    return sum / period;
  }

  function prepareIndicators(candles, config) {
    const closes = candles.map((candle) => candle.close);
    const volumes = candles.map((candle) => candle.volume);
    const fast = emaSeries(closes, config.fastEma);
    const slow = emaSeries(closes, config.slowEma);
    const rsi = rsiSeries(closes, config.rsiPeriod);
    const atr = atrSeries(candles, config.atrPeriod);
    const macdFast = emaSeries(closes, 12);
    const macdSlow = emaSeries(closes, 26);
    const macd = closes.map((_, index) =>
      macdFast[index] === null || macdSlow[index] === null
        ? null
        : macdFast[index] - macdSlow[index],
    );
    return { closes, volumes, fast, slow, rsi, atr, macd };
  }

  function higherTimeframeDirection(candles, time) {
    if (!Array.isArray(candles) || candles.length < 21) return null;
    const eligible = candles.filter((candle) => candle.time <= time);
    if (eligible.length < 21) return null;
    const closes = eligible.map((candle) => candle.close);
    const fast = emaSeries(closes, 9).at(-1);
    const slow = emaSeries(closes, 21).at(-1);
    if (fast === null || slow === null) return null;
    return fast >= slow ? "long" : "short";
  }

  function executionPrice(price, direction, isEntry, config) {
    const adverseDirection =
      direction === "long" ? (isEntry ? 1 : -1) : isEntry ? -1 : 1;
    const friction = config.spreadRate / 2 + config.slippageRate;
    return price * (1 + adverseDirection * friction);
  }

  function calculateMaxDrawdown(values) {
    let peak = values[0] || 0;
    let maximum = 0;
    values.forEach((value) => {
      peak = Math.max(peak, value);
      if (peak > 0) maximum = Math.max(maximum, ((peak - value) / peak) * 100);
    });
    return maximum;
  }

  function calculateSharpe(equity) {
    if (equity.length < 3) return 0;
    const returns = [];
    for (let index = 1; index < equity.length; index += 1) {
      const previous = equity[index - 1].equity;
      if (previous > 0) returns.push((equity[index].equity - previous) / previous);
    }
    if (returns.length < 2) return 0;
    const average = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance =
      returns.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (returns.length - 1);
    const deviation = Math.sqrt(variance);
    return deviation ? (average / deviation) * Math.sqrt(returns.length) : 0;
  }

  function run(rawCandles, inputConfig = {}, options = {}) {
    const candles = validateCandles(rawCandles);
    const config = normalizeConfig(inputConfig);
    const minimum = Math.max(config.slowEma, config.atrPeriod, 26) + 5;
    if (candles.length < minimum + 10) {
      return emptyResult(candles, config, "Nincs elegendő gyertya.");
    }
    const indicators = prepareIndicators(candles, config);
    const firstTradeIndex = Math.max(options.tradeStartIndex || minimum, minimum);
    let capital = config.initialCapital;
    let position = null;
    let cooldownUntil = -1;
    let exposedBars = 0;
    let totalFees = 0;
    let totalFriction = 0;
    const trades = [];
    const equity = [{ time: candles[firstTradeIndex].time, equity: capital }];
    const drawdown = [{ time: candles[firstTradeIndex].time, value: 0 }];

    function closePosition(rawExit, candle, index, reason) {
      const exit = executionPrice(rawExit, position.direction, false, config);
      const multiplier = position.direction === "long" ? 1 : -1;
      const gross = (exit - position.entry) * position.quantity * multiplier;
      const fees = (position.entry + exit) * position.quantity * config.feeRate;
      const friction =
        (Math.abs(position.rawEntry - position.entry) + Math.abs(rawExit - exit)) *
        position.quantity;
      const pnl = gross - fees;
      capital += pnl;
      totalFees += fees;
      totalFriction += friction;
      trades.push({
        ...position,
        exit,
        rawExit,
        gross,
        fees,
        friction,
        pnl,
        exitReason: reason,
        closedAt: candle.time,
        barsHeld: index - position.openIndex,
      });
      equity.push({ time: candle.time, equity: capital });
      const peak = Math.max(...equity.map((point) => point.equity));
      drawdown.push({
        time: candle.time,
        value: peak > 0 ? ((peak - capital) / peak) * 100 : 0,
      });
      position = null;
      cooldownUntil = index + config.cooldownBars;
    }

    for (let index = firstTradeIndex; index < candles.length; index += 1) {
      const candle = candles[index];
      if (position) {
        exposedBars += 1;
        const multiplier = position.direction === "long" ? 1 : -1;
        const adverseExtreme = position.direction === "long" ? candle.low : candle.high;
        const favorableExtreme = position.direction === "long" ? candle.high : candle.low;
        const favorableMove = (favorableExtreme - position.entry) * multiplier;

        if (config.useBreakEven && favorableMove >= position.initialRisk * config.breakEvenR) {
          position.stop =
            position.direction === "long"
              ? Math.max(position.stop, position.entry)
              : Math.min(position.stop, position.entry);
        }
        if (config.useTrailingStop && indicators.atr[index] !== null) {
          const trailingDistance = indicators.atr[index] * config.trailingAtrMultiplier;
          const trailingStop =
            position.direction === "long"
              ? favorableExtreme - trailingDistance
              : favorableExtreme + trailingDistance;
          position.stop =
            position.direction === "long"
              ? Math.max(position.stop, trailingStop)
              : Math.min(position.stop, trailingStop);
        }

        const stopHit =
          position.direction === "long"
            ? adverseExtreme <= position.stop
            : adverseExtreme >= position.stop;
        const targetHit =
          position.direction === "long"
            ? favorableExtreme >= position.target
            : favorableExtreme <= position.target;
        if (stopHit || targetHit) {
          closePosition(
            stopHit ? position.stop : position.target,
            candle,
            index,
            stopHit ? "Stop-loss" : "Célár",
          );
          continue;
        }
      }
      if (position || index <= cooldownUntil) continue;

      const fast = indicators.fast[index - 1];
      const slow = indicators.slow[index - 1];
      const rsi = indicators.rsi[index - 1];
      const atr = indicators.atr[index - 1];
      const macd = indicators.macd[index - 1];
      const momentumBaseIndex = index - 1 - config.momentumLookback;
      if (
        fast === null ||
        slow === null ||
        rsi === null ||
        atr === null ||
        momentumBaseIndex < 0 ||
        !(capital > 0)
      ) {
        continue;
      }
      const previousClose = indicators.closes[index - 1];
      const momentum =
        ((previousClose - indicators.closes[momentumBaseIndex]) /
          indicators.closes[momentumBaseIndex]) *
        100;
      const volumeAverage = simpleAverage(indicators.volumes, index - 1, 20);
      const volumeOk =
        !config.useVolume ||
        (volumeAverage > 0 &&
          indicators.volumes[index - 1] >= volumeAverage * config.volumeMultiplier);
      const higherDirection = config.useHigherTimeframe
        ? higherTimeframeDirection(options.confirmationCandles, candle.time)
        : null;
      const longAllowed = config.direction === "long" || config.direction === "both";
      const shortAllowed = config.direction === "short" || config.direction === "both";
      const shortMin = 100 - config.rsiMax;
      const shortMax = 100 - config.rsiMin;
      const longSignal =
        longAllowed &&
        fast > slow &&
        rsi >= config.rsiMin &&
        rsi <= config.rsiMax &&
        momentum >= config.momentumThreshold &&
        (!config.useMacd || macd > 0) &&
        volumeOk &&
        (!config.useHigherTimeframe || higherDirection === "long");
      const shortSignal =
        shortAllowed &&
        fast < slow &&
        rsi >= shortMin &&
        rsi <= shortMax &&
        momentum <= -config.momentumThreshold &&
        (!config.useMacd || macd < 0) &&
        volumeOk &&
        (!config.useHigherTimeframe || higherDirection === "short");
      const direction = longSignal ? "long" : shortSignal ? "short" : null;
      if (!direction) continue;

      const rawEntry = candle.open;
      const entry = executionPrice(rawEntry, direction, true, config);
      const stopDistance = atr * config.atrMultiplier;
      const riskAmount = capital * config.riskRate;
      const unitRisk =
        stopDistance +
        entry * (config.feeRate * 2 + config.spreadRate + config.slippageRate * 2);
      const quantity = Math.min(riskAmount / unitRisk, capital / entry);
      if (!(quantity > 0)) continue;
      position = {
        direction,
        entry,
        rawEntry,
        quantity,
        stop: entry + (direction === "long" ? -stopDistance : stopDistance),
        target:
          entry +
          (direction === "long"
            ? stopDistance * config.rewardRatio
            : -stopDistance * config.rewardRatio),
        initialRisk: stopDistance,
        openedAt: candle.time,
        openIndex: index,
        entryReason:
          `EMA${config.fastEma}/${config.slowEma}, RSI ${rsi.toFixed(1)}, ` +
          `momentum ${momentum.toFixed(2)}%`,
      };
    }

    if (position) {
      closePosition(candles.at(-1).close, candles.at(-1), candles.length - 1, "Időszak vége");
    }

    const wins = trades.filter((trade) => trade.pnl > 0);
    const losses = trades.filter((trade) => trade.pnl < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const result = {
      config,
      initialCapital: config.initialCapital,
      finalCapital: capital,
      returnPercent: ((capital - config.initialCapital) / config.initialCapital) * 100,
      trades,
      equity,
      drawdown,
      winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
      profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      maxDrawdown: calculateMaxDrawdown(equity.map((point) => point.equity)),
      expectancy: trades.length
        ? trades.reduce((sum, trade) => sum + trade.pnl, 0) / trades.length
        : 0,
      sharpe: calculateSharpe(equity),
      exposure: ((exposedBars / Math.max(1, candles.length - firstTradeIndex)) * 100),
      totalFees,
      totalFriction,
      totalCosts: totalFees + totalFriction,
      startTime: candles[firstTradeIndex].time,
      endTime: candles.at(-1).time,
      candleCount: candles.length - firstTradeIndex,
      error: "",
    };
    return result;
  }

  function emptyResult(candles, config, error) {
    const time = candles[0]?.time || Date.now();
    return {
      config,
      initialCapital: config.initialCapital,
      finalCapital: config.initialCapital,
      returnPercent: 0,
      trades: [],
      equity: [{ time, equity: config.initialCapital }],
      drawdown: [{ time, value: 0 }],
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      expectancy: 0,
      sharpe: 0,
      exposure: 0,
      totalFees: 0,
      totalFriction: 0,
      totalCosts: 0,
      startTime: time,
      endTime: candles.at(-1)?.time || time,
      candleCount: 0,
      error,
    };
  }

  function benchmark(rawCandles, configInput, startIndex = 0) {
    const candles = validateCandles(rawCandles);
    const config = normalizeConfig(configInput);
    if (candles.length < 2 || startIndex >= candles.length - 1) return 0;
    const entry = executionPrice(candles[startIndex].open, "long", true, config);
    const exit = executionPrice(candles.at(-1).close, "long", false, config);
    const quantity = config.initialCapital / entry;
    const fees = (entry + exit) * quantity * config.feeRate;
    const finalCapital = config.initialCapital + (exit - entry) * quantity - fees;
    return ((finalCapital - config.initialCapital) / config.initialCapital) * 100;
  }

  function scoreResult(result, objective) {
    if (!result.trades.length) return -Infinity;
    if (objective === "profitFactor") {
      return result.profitFactor === Infinity ? 100 : result.profitFactor;
    }
    if (objective === "return") return result.returnPercent;
    return result.returnPercent / Math.max(1, result.maxDrawdown);
  }

  function optimize(rawCandles, configInput, ranges = {}, options = {}) {
    const config = normalizeConfig(configInput);
    const candles = validateCandles(rawCandles);
    const candidates = [];
    const fastValues = ranges.fastEma || [
      Math.max(3, config.fastEma - 2),
      config.fastEma,
      Math.min(50, config.fastEma + 2),
    ];
    const slowValues = ranges.slowEma || [
      Math.max(config.fastEma + 2, config.slowEma - 5),
      config.slowEma,
      Math.min(120, config.slowEma + 5),
    ];
    const atrValues = ranges.atrMultiplier || [
      Math.max(0.5, config.atrMultiplier - 0.3),
      config.atrMultiplier,
      Math.min(5, config.atrMultiplier + 0.3),
    ];
    const rewardValues = ranges.rewardRatio || [
      Math.max(0.5, config.rewardRatio - 0.5),
      config.rewardRatio,
      Math.min(10, config.rewardRatio + 0.5),
    ];
    fastValues.forEach((fastEma) => {
      slowValues.forEach((slowEma) => {
        if (fastEma >= slowEma) return;
        atrValues.forEach((atrMultiplier) => {
          rewardValues.forEach((rewardRatio) => {
            const candidateConfig = normalizeConfig({
              ...config,
              fastEma,
              slowEma,
              atrMultiplier,
              rewardRatio,
            });
            const result = run(candles, candidateConfig, options);
            candidates.push({
              config: candidateConfig,
              result,
              score: scoreResult(result, config.objective),
            });
          });
        });
      });
    });
    return candidates.sort((left, right) => right.score - left.score);
  }

  function walkForward(rawCandles, configInput, options = {}) {
    const candles = validateCandles(rawCandles);
    const config = normalizeConfig(configInput);
    const folds = clamp(Math.round(options.folds || 3), 2, 6);
    const windowSize = Math.floor(candles.length / (folds + 1));
    const results = [];
    for (let fold = 0; fold < folds; fold += 1) {
      const trainEnd = windowSize * (fold + 1);
      const testEnd = Math.min(candles.length, trainEnd + windowSize);
      const training = candles.slice(0, trainEnd);
      const testWarmup = Math.max(config.slowEma * 3, 50);
      const validation = candles.slice(Math.max(0, trainEnd - testWarmup), testEnd);
      if (training.length < 100 || validation.length < 60) continue;
      const optimized = optimize(training, config, options.ranges, {
        confirmationCandles: options.confirmationCandles,
      });
      const selected = optimized[0]?.config || config;
      const validationResult = run(validation, selected, {
        tradeStartIndex: Math.min(testWarmup, validation.length - 2),
        confirmationCandles: options.confirmationCandles,
      });
      results.push({
        fold: fold + 1,
        trainStart: training[0].time,
        trainEnd: training.at(-1).time,
        testStart: candles[trainEnd]?.time,
        testEnd: candles[testEnd - 1]?.time,
        selected,
        result: validationResult,
      });
    }
    const averageReturn = results.length
      ? results.reduce((sum, fold) => sum + fold.result.returnPercent, 0) / results.length
      : 0;
    const profitableFolds = results.filter((fold) => fold.result.returnPercent > 0).length;
    return {
      folds: results,
      averageReturn,
      profitableFolds,
      consistency: results.length ? (profitableFolds / results.length) * 100 : 0,
    };
  }

  return {
    DEFAULTS,
    BOUNDS,
    normalizeConfig,
    validateCandles,
    run,
    benchmark,
    optimize,
    walkForward,
    emaSeries,
    rsiSeries,
    atrSeries,
  };
});
