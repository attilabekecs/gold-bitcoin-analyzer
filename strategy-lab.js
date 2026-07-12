(function () {
  "use strict";

  const Engine = window.StrategyEngine;
  if (!Engine) return;

  const PRESETS = {
    conservative: {
      direction: "both",
      fastEma: 12,
      slowEma: 34,
      rsiPeriod: 14,
      rsiMin: 52,
      rsiMax: 65,
      useMacd: true,
      momentumLookback: 20,
      momentumThreshold: 0.1,
      useVolume: true,
      volumeMultiplier: 1.15,
      useHigherTimeframe: true,
      atrPeriod: 14,
      atrMultiplier: 2,
      rewardRatio: 2,
      useTrailingStop: true,
      trailingAtrMultiplier: 1.5,
      useBreakEven: true,
      breakEvenR: 1.2,
      cooldownBars: 3,
      riskRate: 0.005,
    },
    balanced: {
      ...Engine.DEFAULTS,
      useMacd: true,
      useHigherTimeframe: false,
      useBreakEven: true,
      breakEvenR: 1,
    },
    active: {
      direction: "both",
      fastEma: 7,
      slowEma: 18,
      rsiPeriod: 12,
      rsiMin: 48,
      rsiMax: 72,
      useMacd: false,
      momentumLookback: 10,
      momentumThreshold: 0.03,
      useVolume: false,
      volumeMultiplier: 1,
      useHigherTimeframe: false,
      atrPeriod: 10,
      atrMultiplier: 1.2,
      rewardRatio: 1.6,
      useTrailingStop: false,
      trailingAtrMultiplier: 1,
      useBreakEven: false,
      breakEvenR: 1,
      cooldownBars: 0,
      riskRate: 0.015,
    },
  };

  const AI_FIELDS = [
    "fastEma",
    "slowEma",
    "rsiPeriod",
    "rsiMin",
    "rsiMax",
    "momentumLookback",
    "momentumThreshold",
    "useMacd",
    "useVolume",
    "volumeMultiplier",
    "useHigherTimeframe",
    "atrPeriod",
    "atrMultiplier",
    "rewardRatio",
    "useTrailingStop",
    "trailingAtrMultiplier",
    "useBreakEven",
    "breakEvenR",
    "cooldownBars",
    "direction",
  ];

  const lab = {
    csvCandles: [],
    csvName: "",
    result: null,
    optimized: [],
    pendingAiSuggestion: null,
    equityChart: null,
    drawdownChart: null,
    saved: [],
  };

  const FIELD_IDS = {
    direction: "backtestDirection",
    fastEma: "backtestFastEma",
    slowEma: "backtestSlowEma",
    rsiPeriod: "backtestRsiPeriod",
    rsiMin: "backtestRsiMin",
    rsiMax: "backtestRsiMax",
    useMacd: "backtestUseMacd",
    momentumLookback: "backtestMomentumLookback",
    momentumThreshold: "backtestMomentum",
    useVolume: "backtestUseVolume",
    volumeMultiplier: "backtestVolumeMultiplier",
    useHigherTimeframe: "backtestUseHigherTf",
    atrPeriod: "backtestAtrPeriod",
    atrMultiplier: "backtestAtrMultiplier",
    rewardRatio: "backtestRewardRatio",
    useTrailingStop: "backtestUseTrailing",
    trailingAtrMultiplier: "backtestTrailingAtr",
    useBreakEven: "backtestUseBreakEven",
    breakEvenR: "backtestBreakEvenR",
    cooldownBars: "backtestCooldown",
    initialCapital: "backtestCapital",
    riskRate: "backtestRisk",
    feeRate: "backtestFee",
    spreadRate: "backtestSpread",
    slippageRate: "backtestSlippage",
    trainingSplit: "backtestSplit",
    objective: "backtestObjective",
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const form = document.getElementById("backtestForm");
    if (!form) return;
    lab.saved = loadSavedStrategies();
    form.addEventListener("submit", runStrategy);
    document.getElementById("strategyOptimizeButton").addEventListener("click", optimizeStrategy);
    document.getElementById("strategyApplyBest").addEventListener("click", applyBestStrategy);
    document.getElementById("strategyApplyPreset").addEventListener("click", applySelectedPreset);
    document.getElementById("strategySaveButton").addEventListener("click", saveCurrentStrategy);
    document.getElementById("strategyLoadSaved").addEventListener("click", loadSelectedStrategy);
    document.getElementById("strategyCsvInput").addEventListener("change", importCsv);
    document.getElementById("strategyClearCsv").addEventListener("click", clearCsv);
    document.getElementById("backtestAsset").addEventListener("change", updateDataStatus);
    document.getElementById("backtestInterval").addEventListener("change", updateDataStatus);
    document.getElementById("backtestExportButton").addEventListener("click", exportTradesCsv);
    document.getElementById("strategyJsonExport").addEventListener("click", exportResultJson);
    document.getElementById("strategyAiRequest").addEventListener("click", requestAiSuggestion);
    document.getElementById("strategyAiApply").addEventListener("click", applyAiSuggestion);
    document.getElementById("strategyAiDismiss").addEventListener("click", dismissAiSuggestion);
    renderSavedOptions();
    applyConfigToForm(Engine.normalizeConfig(PRESETS.balanced));
    updateDataStatus();
    window.setInterval(updateDataStatus, 5000);
  }

  function readFormConfig() {
    const raw = {};
    Object.entries(FIELD_IDS).forEach(([key, id]) => {
      const element = document.getElementById(id);
      if (!element) return;
      if (element.type === "checkbox") raw[key] = element.checked;
      else if (["direction", "objective"].includes(key)) raw[key] = element.value;
      else raw[key] = Number(element.value);
    });
    raw.riskRate /= 100;
    raw.feeRate /= 100;
    raw.spreadRate /= 100;
    raw.slippageRate /= 100;
    raw.trainingSplit /= 100;
    return Engine.normalizeConfig(raw);
  }

  function applyConfigToForm(inputConfig, allowedFields = null) {
    const config = Engine.normalizeConfig(inputConfig);
    Object.entries(FIELD_IDS).forEach(([key, id]) => {
      if (allowedFields && !allowedFields.includes(key)) return;
      const element = document.getElementById(id);
      if (!element || config[key] === undefined) return;
      if (element.type === "checkbox") {
        element.checked = Boolean(config[key]);
      } else {
        let value = config[key];
        if (["riskRate", "feeRate", "spreadRate", "slippageRate", "trainingSplit"].includes(key)) {
          value *= 100;
        }
        element.value = String(value);
      }
    });
  }

  function getSelectedCandles() {
    const asset = document.getElementById("backtestAsset").value;
    if (asset === "csv") return lab.csvCandles;
    const interval = Number(document.getElementById("backtestInterval").value);
    return getIntradaySeries(asset, interval)?.candles || [];
  }

  function getConfirmationCandles() {
    const asset = document.getElementById("backtestAsset").value;
    if (asset === "csv") return [];
    const interval = Number(document.getElementById("backtestInterval").value);
    const higher = { 1: 5, 5: 15, 15: 60, 60: 60 }[interval];
    return getIntradaySeries(asset, higher)?.candles || [];
  }

  function splitDataset(candles, config) {
    const splitIndex = Math.floor(candles.length * config.trainingSplit);
    const warmup = Math.max(config.slowEma * 3, config.atrPeriod * 3, 50);
    const validationOffset = Math.max(0, splitIndex - warmup);
    return {
      splitIndex,
      training: candles.slice(0, splitIndex + 1),
      validation: candles.slice(validationOffset),
      validationTradeStart: splitIndex - validationOffset,
    };
  }

  function runStrategy(event) {
    event?.preventDefault?.();
    const candles = Engine.validateCandles(getSelectedCandles());
    const config = readFormConfig();
    if (candles.length < Math.max(120, config.slowEma * 4)) {
      showToast("Nincs elegendő adat ehhez a konfigurációhoz.");
      updateDataStatus();
      return;
    }
    const split = splitDataset(candles, config);
    const confirmationCandles = getConfirmationCandles();
    const training = Engine.run(split.training, config, {
      confirmationCandles,
    });
    const validation = Engine.run(split.validation, config, {
      tradeStartIndex: split.validationTradeStart,
      confirmationCandles,
    });
    const benchmarkReturn = Engine.benchmark(
      split.validation,
      config,
      split.validationTradeStart,
    );
    const foldCount = Number(document.getElementById("backtestFolds").value);
    const walkForward =
      foldCount > 0
        ? Engine.walkForward(candles, config, {
            folds: foldCount,
            confirmationCandles,
          })
        : null;
    lab.result = {
      asset: document.getElementById("backtestAsset").value,
      interval: Number(document.getElementById("backtestInterval").value),
      generatedAt: Date.now(),
      config,
      candleCount: candles.length,
      splitIndex: split.splitIndex,
      training,
      validation,
      benchmarkReturn,
      walkForward,
    };
    state.strategyLabResult = lab.result;
    renderResult(lab.result);
    showToast("A Stratégialabor futtatása elkészült.");
  }

  function optimizeStrategy() {
    const candles = Engine.validateCandles(getSelectedCandles());
    const config = readFormConfig();
    if (candles.length < Math.max(120, config.slowEma * 4)) {
      showToast("Az optimalizáláshoz nincs elegendő adat.");
      return;
    }
    const { training } = splitDataset(candles, config);
    const button = document.getElementById("strategyOptimizeButton");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Optimalizálás…";
    window.setTimeout(() => {
      lab.optimized = Engine.optimize(training, config, {}, {
        confirmationCandles: getConfirmationCandles(),
      }).slice(0, 12);
      renderOptimizer();
      renderHeatmap(lab.optimized);
      button.disabled = false;
      button.textContent = original;
      document.getElementById("strategyApplyBest").disabled = !lab.optimized.length;
      showToast(`${lab.optimized.length} legjobb konfiguráció elkészült.`);
    }, 20);
  }

  function applyBestStrategy() {
    const best = lab.optimized[0]?.config;
    if (!best) return;
    applyConfigToForm(best, [
      "fastEma",
      "slowEma",
      "atrMultiplier",
      "rewardRatio",
    ]);
    showToast("A legjobb tanuló konfiguráció betöltve. Futtasd az ellenőrző tesztet.");
  }

  function renderResult(result) {
    const { training, validation } = result;
    setMetric("strategyTrainReturn", signedPercent(training.returnPercent), training.returnPercent);
    setMetric(
      "strategyValidationReturn",
      signedPercent(validation.returnPercent),
      validation.returnPercent,
    );
    setMetric("strategyTestReturn", signedPercent(validation.returnPercent), validation.returnPercent);
    setMetric("strategyBenchmark", signedPercent(result.benchmarkReturn), result.benchmarkReturn);
    document.getElementById("backtestProfitFactor").textContent = profitFactor(validation.profitFactor);
    document.getElementById("backtestDrawdown").textContent =
      `${formatNumber(validation.maxDrawdown, 2)}%`;
    document.getElementById("strategySharpe").textContent = formatNumber(validation.sharpe, 2);
    document.getElementById("strategyExposure").textContent =
      `${formatNumber(validation.exposure, 1)}%`;
    document.getElementById("strategyCosts").textContent =
      `$${formatNumber(validation.totalCosts, 2)}`;
    document.getElementById("strategyExpectancy").textContent =
      `$${formatNumber(validation.expectancy, 2)}`;
    document.getElementById("strategyTrainDetails").textContent =
      `${training.trades.length} ügylet · PF ${profitFactor(training.profitFactor)}`;
    document.getElementById("strategyTestDetails").textContent =
      `${validation.trades.length} ügylet · benchmark ${signedPercent(result.benchmarkReturn)}`;

    if (result.walkForward) {
      const wf = result.walkForward;
      setMetric("strategyWalkForward", signedPercent(wf.averageReturn), wf.averageReturn);
      document.getElementById("strategyWalkForwardDetails").textContent =
        `${wf.profitableFolds}/${wf.folds.length} nyereséges fold · ${formatNumber(wf.consistency, 0)}% konzisztencia`;
    } else {
      document.getElementById("strategyWalkForward").textContent = "Kikapcsolva";
      document.getElementById("strategyWalkForwardDetails").textContent = "Nincs gördülő validáció";
    }
    const overfit = assessOverfit(result);
    const overfitElement = document.getElementById("strategyOverfit");
    overfitElement.textContent = overfit.label;
    overfitElement.className = overfit.className;
    document.getElementById("strategyOverfitDetails").textContent = overfit.details;
    const verdict = document.getElementById("strategyVerdict");
    verdict.textContent = overfit.verdict;
    verdict.className = `strategy-verdict ${overfit.verdictClass}`;
    renderWarnings(result, overfit);
    renderTrades(validation.trades);
    renderCharts(result);
    renderSensitivityFromCurrent(result);
    document.getElementById("backtestExportButton").disabled = !validation.trades.length;
    document.getElementById("strategyJsonExport").disabled = false;
  }

  function assessOverfit(result) {
    const train = result.training.returnPercent;
    const test = result.validation.returnPercent;
    const gap = Math.abs(train - test);
    if (result.validation.trades.length < 8) {
      return {
        label: "NEM MÉRHETŐ",
        className: "neutral",
        details: "Túl kevés ellenőrző ügylet",
        verdict: "A minta túl kicsi. Hosszabb adatsor vagy magasabb idősík szükséges.",
        verdictClass: "neutral",
      };
    }
    if ((train > 0 && test < 0) || gap > Math.max(5, Math.abs(train) * 0.75)) {
      return {
        label: "MAGAS",
        className: "negative",
        details: `${formatNumber(gap, 2)} százalékpont eltérés`,
        verdict: "A stratégia tanuló és ellenőrző teljesítménye jelentősen eltér.",
        verdictClass: "negative",
      };
    }
    return {
      label: "MÉRSÉKELT",
      className: test > 0 ? "positive" : "neutral",
      details: `${formatNumber(gap, 2)} százalékpont eltérés`,
      verdict:
        test > 0
          ? "Az ellenőrző eredmény pozitív, de további piaci rezsimeken is tesztelendő."
          : "Az eredmény stabilabbnak tűnik, de költségek után nem nyereséges.",
      verdictClass: test > 0 ? "positive" : "neutral",
    };
  }

  function renderWarnings(result, overfit) {
    const warnings = [];
    const validation = result.validation;
    if (result.candleCount <= 720) {
      warnings.push(["warning", "A forrás legfeljebb 720 gyertyás mintát biztosít."]);
    }
    if (validation.trades.length < 20) {
      warnings.push(["warning", `Csak ${validation.trades.length} ellenőrző ügylet áll rendelkezésre.`]);
    }
    if (validation.returnPercent < result.benchmarkReturn) {
      warnings.push(["warning", "A stratégia elmaradt a költségekkel korrigált Buy & Hold benchmarktól."]);
    }
    if (validation.maxDrawdown > 10) {
      warnings.push(["warning", `A ${formatNumber(validation.maxDrawdown, 1)}%-os drawdown magas.`]);
    }
    if (overfit.className !== "negative" && validation.returnPercent > 0) {
      warnings.push(["success", "Az out-of-sample szakasz költségek után is pozitív."]);
    }
    if (result.walkForward?.consistency >= 60) {
      warnings.push(["success", "A walk-forward foldok többsége nyereséges."]);
    }
    const list = document.getElementById("strategyWarnings");
    list.replaceChildren(
      ...warnings.map(([className, text]) => {
        const item = document.createElement("li");
        item.className = className;
        item.textContent = text;
        return item;
      }),
    );
  }

  function renderCharts(result) {
    if (typeof Chart === "undefined") return;
    lab.equityChart?.destroy();
    lab.drawdownChart?.destroy();
    const equity = result.validation.equity;
    const initial = result.config.initialCapital;
    const benchmarkFinal = initial * (1 + result.benchmarkReturn / 100);
    const benchmark = equity.map((_, index) =>
      initial + (benchmarkFinal - initial) * (index / Math.max(1, equity.length - 1)),
    );
    const labels = equity.map((point) =>
      new Intl.DateTimeFormat("hu-HU", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(point.time),
    );
    lab.equityChart = new Chart(document.getElementById("strategyEquityChart"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Stratégia",
            data: equity.map((point) => point.equity),
            borderColor: "#286849",
            backgroundColor: "rgba(40,104,73,.08)",
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
          },
          {
            label: "Buy & Hold",
            data: benchmark,
            borderColor: "#b98a35",
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
          },
        ],
      },
      options: labChartOptions("$"),
    });
    lab.drawdownChart = new Chart(document.getElementById("strategyDrawdownChart"), {
      type: "line",
      data: {
        labels: result.validation.drawdown.map((point) =>
          new Intl.DateTimeFormat("hu-HU", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(point.time),
        ),
        datasets: [{
          label: "Drawdown",
          data: result.validation.drawdown.map((point) => -point.value),
          borderColor: "#a3473d",
          backgroundColor: "rgba(163,71,61,.10)",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
        }],
      },
      options: labChartOptions("%"),
    });
  }

  function labChartOptions(prefix) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { labels: { boxWidth: 10, font: { size: 9 } } },
        tooltip: {
          callbacks: {
            label: (context) =>
              prefix === "$"
                ? `${context.dataset.label}: $${formatNumber(context.raw, 2)}`
                : `${context.dataset.label}: ${formatNumber(context.raw, 2)}%`,
          },
        },
      },
      scales: {
        x: { display: false },
        y: { ticks: { font: { size: 8 } }, grid: { color: "rgba(23,33,28,.06)" } },
      },
    };
  }

  function renderSensitivityFromCurrent(result) {
    const config = result.config;
    const candles = Engine.validateCandles(getSelectedCandles());
    const { training } = splitDataset(candles, config);
    const candidates = Engine.optimize(
      training,
      config,
      {
        atrMultiplier: [config.atrMultiplier],
        rewardRatio: [config.rewardRatio],
      },
      { confirmationCandles: getConfirmationCandles() },
    ).slice(0, 9);
    renderHeatmap(candidates);
  }

  function renderHeatmap(candidates) {
    const container = document.getElementById("strategyHeatmap");
    if (!candidates.length) {
      container.innerHTML = "<span>Nincs megjeleníthető eredmény.</span>";
      return;
    }
    container.replaceChildren(
      ...candidates.map((candidate) => {
        const cell = document.createElement("div");
        const value = candidate.result.returnPercent;
        cell.className = `heatmap-cell ${value > 0 ? "positive" : value < 0 ? "negative" : "neutral"}`;
        const strong = document.createElement("strong");
        strong.textContent = signedPercent(value);
        const label = document.createElement("span");
        label.textContent =
          `EMA ${candidate.config.fastEma}/${candidate.config.slowEma} · ` +
          `${candidate.result.trades.length} ügylet`;
        cell.append(strong, label);
        return cell;
      }),
    );
  }

  function renderOptimizer() {
    const table = document.getElementById("strategyOptimizerTable");
    table.replaceChildren();
    if (!lab.optimized.length) {
      emptyRow(table, 8, "Nincs optimalizálási eredmény.");
      return;
    }
    lab.optimized.forEach((candidate, index) => {
      const row = document.createElement("tr");
      [
        index + 1,
        `${candidate.config.fastEma}/${candidate.config.slowEma}`,
        formatNumber(candidate.config.atrMultiplier, 1),
        formatNumber(candidate.config.rewardRatio, 1),
        signedPercent(candidate.result.returnPercent),
        profitFactor(candidate.result.profitFactor),
        `${formatNumber(candidate.result.maxDrawdown, 2)}%`,
        formatNumber(candidate.score, 2),
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      table.append(row);
    });
  }

  function renderTrades(trades) {
    const table = document.getElementById("backtestTradesTable");
    table.replaceChildren();
    if (!trades.length) {
      emptyRow(table, 8, "Az ellenőrző időszakon nem nyílt ügylet.");
      return;
    }
    trades.slice().reverse().slice(0, 150).forEach((trade) => {
      const row = document.createElement("tr");
      [
        new Intl.DateTimeFormat("hu-HU", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(trade.openedAt),
        trade.direction.toUpperCase(),
        `$${formatNumber(trade.entry, 2)}`,
        `$${formatNumber(trade.exit, 2)}`,
        `${trade.barsHeld} gyertya`,
        trade.exitReason,
        `$${formatNumber(trade.fees + trade.friction, 2)}`,
        `${trade.pnl > 0 ? "+" : ""}$${formatNumber(trade.pnl, 2)}`,
      ].forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 7) cell.className = trade.pnl > 0 ? "positive" : trade.pnl < 0 ? "negative" : "";
        row.append(cell);
      });
      table.append(row);
    });
  }

  function updateDataStatus() {
    const element = document.getElementById("strategyDataStatus");
    const details = document.getElementById("strategyDataDetails");
    if (!element || !details) return;
    const asset = document.getElementById("backtestAsset")?.value || "bitcoin";
    const candles = Engine.validateCandles(getSelectedCandles());
    if (!candles.length) {
      element.textContent = asset === "csv" ? "Nincs importált adat" : "Adatok betöltése…";
      element.className = "negative";
      details.textContent =
        asset === "csv"
          ? "Importálj time, open, high, low, close, volume oszlopokat."
          : "Várd meg az intraday adatforrást.";
      return;
    }
    const hours = (candles.at(-1).time - candles[0].time) / 3600000;
    element.textContent = `${candles.length} gyertya · ${formatNumber(hours, 1)} óra`;
    element.className = candles.length >= 500 ? "positive" : "neutral";
    details.textContent =
      asset === "csv"
        ? `${lab.csvName} · helyi adat, nem kerül feltöltésre`
        : "Kraken/Twelve Data · legfeljebb 720 gyertya";
  }

  function applySelectedPreset() {
    const key = document.getElementById("strategyPreset").value;
    applyConfigToForm({ ...readFormConfig(), ...PRESETS[key] });
    showToast("A preset betöltve.");
  }

  function saveCurrentStrategy() {
    const name = window.prompt("A stratégia neve:");
    if (!name?.trim()) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim().slice(0, 60),
      config: readFormConfig(),
      savedAt: Date.now(),
    };
    lab.saved.unshift(entry);
    lab.saved = lab.saved.slice(0, 30);
    localStorage.setItem("aurum-strategies", JSON.stringify(lab.saved));
    renderSavedOptions();
    document.getElementById("strategySavedSelect").value = entry.id;
    showToast("A stratégia helyben elmentve.");
  }

  function loadSavedStrategies() {
    try {
      const saved = JSON.parse(localStorage.getItem("aurum-strategies") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function renderSavedOptions() {
    const select = document.getElementById("strategySavedSelect");
    select.replaceChildren(new Option("Válassz…", ""));
    lab.saved.forEach((entry) => select.append(new Option(entry.name, entry.id)));
  }

  function loadSelectedStrategy() {
    const id = document.getElementById("strategySavedSelect").value;
    const entry = lab.saved.find((item) => item.id === id);
    if (!entry) {
      showToast("Válassz mentett stratégiát.");
      return;
    }
    applyConfigToForm(entry.config);
    showToast(`${entry.name} betöltve.`);
  }

  async function importCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast("A CSV legfeljebb 15 MB lehet.");
      event.target.value = "";
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 100) throw new Error("Legalább 100 érvényes gyertya szükséges.");
      lab.csvCandles = parsed;
      lab.csvName = file.name;
      document.getElementById("backtestAsset").value = "csv";
      document.getElementById("strategyClearCsv").hidden = false;
      updateDataStatus();
      showToast(`${parsed.length} CSV-gyertya betöltve.`);
    } catch (error) {
      showToast(error.message || "A CSV nem olvasható.");
    }
  }

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const separator = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(separator).map((value) => value.trim().toLowerCase());
    const indexOf = (names) => headers.findIndex((header) => names.includes(header));
    const indices = {
      time: indexOf(["time", "timestamp", "date", "datetime"]),
      open: indexOf(["open", "o"]),
      high: indexOf(["high", "h"]),
      low: indexOf(["low", "l"]),
      close: indexOf(["close", "c"]),
      volume: indexOf(["volume", "vol", "v"]),
    };
    if ([indices.time, indices.open, indices.high, indices.low, indices.close].some((i) => i < 0)) {
      throw new Error("Hiányzó kötelező oszlop: time, open, high, low vagy close.");
    }
    const candles = lines.slice(1).map((line) => {
      const columns = line.split(separator).map((value) => value.trim().replace(/^"|"$/g, ""));
      const rawTime = columns[indices.time];
      let time = Number(rawTime);
      if (!Number.isFinite(time)) time = Date.parse(rawTime);
      else if (time < 100000000000) time *= 1000;
      return {
        time,
        open: Number(columns[indices.open]),
        high: Number(columns[indices.high]),
        low: Number(columns[indices.low]),
        close: Number(columns[indices.close]),
        volume: indices.volume >= 0 ? Number(columns[indices.volume]) || 0 : 0,
      };
    });
    return Engine.validateCandles(candles);
  }

  function clearCsv() {
    lab.csvCandles = [];
    lab.csvName = "";
    document.getElementById("strategyCsvInput").value = "";
    document.getElementById("strategyClearCsv").hidden = true;
    document.getElementById("backtestAsset").value = "bitcoin";
    updateDataStatus();
    showToast("Az importált adat törölve.");
  }

  async function requestAiSuggestion() {
    const endpoint = state.settings?.aiEndpoint;
    const accessToken = state.settings?.aiAccessToken;
    if (!endpoint || !accessToken) {
      showToast("Állítsd be az AI backend URL-t és tokent.");
      openSettings();
      return;
    }
    if (!isSafeHttpUrl(endpoint)) {
      showToast("Az AI backend URL érvénytelen.");
      return;
    }
    const candles = Engine.validateCandles(getSelectedCandles());
    if (candles.length < 120) {
      showToast("Az AI-javaslathoz legalább 120 gyertya szükséges.");
      return;
    }
    const button = document.getElementById("strategyAiRequest");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "AI elemzés…";
    try {
      const url = new URL(endpoint);
      url.pathname = url.pathname.replace(/\/analyze\/?$/, "/strategy");
      if (!url.pathname.endsWith("/strategy")) url.pathname = `${url.pathname.replace(/\/$/, "")}/strategy`;
      const current = readFormConfig();
      const latest = candles.at(-1);
      const closes = candles.map((candle) => candle.close);
      const fast = Engine.emaSeries(closes, current.fastEma).at(-1);
      const slow = Engine.emaSeries(closes, current.slowEma).at(-1);
      const rsi = Engine.rsiSeries(closes, current.rsiPeriod).at(-1);
      const atr = Engine.atrSeries(candles, current.atrPeriod).at(-1);
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          asset: document.getElementById("backtestAsset").value,
          interval: Number(document.getElementById("backtestInterval").value),
          candleCount: candles.length,
          riskProfile: document.getElementById("strategyAiRiskProfile").value,
          goal: document.getElementById("strategyAiGoal").value,
          currentConfig: pickFields(current, AI_FIELDS),
          marketSnapshot: {
            price: latest.close,
            emaGapPercent: fast && slow ? ((fast - slow) / slow) * 100 : null,
            rsi,
            atrPercent: atr ? (atr / latest.close) * 100 : null,
            recentChangePercent:
              closes.length > 15
                ? ((closes.at(-1) - closes.at(-16)) / closes.at(-16)) * 100
                : null,
          },
          lastResult: lab.result
            ? {
                trainReturn: lab.result.training.returnPercent,
                testReturn: lab.result.validation.returnPercent,
                maxDrawdown: lab.result.validation.maxDrawdown,
                trades: lab.result.validation.trades.length,
                benchmarkReturn: lab.result.benchmarkReturn,
              }
            : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `AI backend hiba (${response.status})`);
      const suggestion = validateAiSuggestion(payload.suggestion);
      lab.pendingAiSuggestion = {
        suggestion,
        rationale: String(payload.rationale || ""),
        confidence: payload.confidence || "low",
        warnings: Array.isArray(payload.warnings) ? payload.warnings.slice(0, 5) : [],
      };
      renderAiPreview(lab.pendingAiSuggestion, current);
      showToast("Az AI-javaslat elkészült. Ellenőrizd alkalmazás előtt.");
    } catch (error) {
      showToast(error.message || "Az AI-javaslat nem készült el.");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function validateAiSuggestion(input) {
    const current = readFormConfig();
    const filtered = {};
    AI_FIELDS.forEach((key) => {
      if (input && Object.prototype.hasOwnProperty.call(input, key)) filtered[key] = input[key];
    });
    return pickFields(Engine.normalizeConfig({ ...current, ...filtered }), AI_FIELDS);
  }

  function renderAiPreview(proposal, current) {
    document.getElementById("strategyAiPreview").hidden = false;
    document.getElementById("strategyAiTitle").textContent =
      `Javaslat · ${proposal.confidence === "high" ? "magas" : proposal.confidence === "medium" ? "közepes" : "alacsony"} bizonyosság`;
    document.getElementById("strategyAiRationale").textContent =
      proposal.rationale || "Az AI nem adott részletes indoklást.";
    const diff = document.getElementById("strategyAiDiff");
    diff.replaceChildren(
      ...AI_FIELDS.filter((key) => proposal.suggestion[key] !== current[key]).map((key) => {
        const row = document.createElement("div");
        const label = document.createElement("span");
        label.textContent = configLabel(key);
        const value = document.createElement("strong");
        value.textContent = `${displayConfigValue(current[key])} → ${displayConfigValue(proposal.suggestion[key])}`;
        row.append(label, value);
        return row;
      }),
    );
    const warnings = document.getElementById("strategyAiWarnings");
    warnings.replaceChildren(
      ...proposal.warnings.map((warning) => {
        const item = document.createElement("li");
        item.textContent = warning;
        return item;
      }),
    );
  }

  function applyAiSuggestion() {
    if (!lab.pendingAiSuggestion) return;
    applyConfigToForm(lab.pendingAiSuggestion.suggestion, AI_FIELDS);
    dismissAiSuggestion();
    showToast("Az AI-paraméterek betöltve. A backtest még nem indult el.");
  }

  function dismissAiSuggestion() {
    lab.pendingAiSuggestion = null;
    document.getElementById("strategyAiPreview").hidden = true;
  }

  function exportTradesCsv() {
    const trades = lab.result?.validation?.trades;
    if (!trades?.length) return;
    const rows = [
      ["opened_at", "closed_at", "direction", "entry", "exit", "quantity", "bars", "reason", "fees", "friction", "pnl", "entry_reason"],
      ...trades.map((trade) => [
        new Date(trade.openedAt).toISOString(),
        new Date(trade.closedAt).toISOString(),
        trade.direction,
        trade.entry,
        trade.exit,
        trade.quantity,
        trade.barsHeld,
        trade.exitReason,
        trade.fees,
        trade.friction,
        trade.pnl,
        trade.entryReason,
      ]),
    ];
    downloadFile(
      `strategy-trades-${lab.result.asset}-${lab.result.interval}m.csv`,
      rows.map((row) => row.map(csvEscape).join(",")).join("\n"),
      "text/csv;charset=utf-8",
    );
  }

  function exportResultJson() {
    if (!lab.result) return;
    downloadFile(
      `strategy-result-${lab.result.asset}-${lab.result.interval}m.json`,
      JSON.stringify(lab.result, null, 2),
      "application/json",
    );
  }

  function downloadFile(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function pickFields(object, fields) {
    return Object.fromEntries(fields.filter((key) => key in object).map((key) => [key, object[key]]));
  }

  function configLabel(key) {
    const labels = {
      fastEma: "Gyors EMA",
      slowEma: "Lassú EMA",
      rsiPeriod: "RSI periódus",
      rsiMin: "RSI minimum",
      rsiMax: "RSI maximum",
      momentumLookback: "Momentum ablak",
      momentumThreshold: "Momentum küszöb",
      useMacd: "MACD",
      useVolume: "Volumen",
      volumeMultiplier: "Volumen szorzó",
      useHigherTimeframe: "Magasabb idősík",
      atrPeriod: "ATR periódus",
      atrMultiplier: "ATR stop",
      rewardRatio: "Célár R",
      useTrailingStop: "Követő stop",
      trailingAtrMultiplier: "Követő ATR",
      useBreakEven: "Break-even",
      breakEvenR: "Break-even R",
      cooldownBars: "Cooldown",
      direction: "Irány",
    };
    return labels[key] || key;
  }

  function displayConfigValue(value) {
    if (typeof value === "boolean") return value ? "igen" : "nem";
    return typeof value === "number" ? formatNumber(value, 2) : String(value);
  }

  function setMetric(id, text, value) {
    const element = document.getElementById(id);
    element.textContent = text;
    element.className = value > 0 ? "positive" : value < 0 ? "negative" : "";
  }

  function signedPercent(value) {
    return `${value > 0 ? "+" : ""}${formatNumber(value, 2)}%`;
  }

  function profitFactor(value) {
    return value === Infinity ? "∞" : formatNumber(value, 2);
  }

  function emptyRow(table, columns, text) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columns;
    cell.className = "empty-table-cell";
    cell.textContent = text;
    row.append(cell);
    table.append(row);
  }

  window.StrategyLab = {
    resize() {
      lab.equityChart?.resize();
      lab.drawdownChart?.resize();
    },
    run: runStrategy,
  };
})();
