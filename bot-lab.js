(function () {
  "use strict";

  const Catalog = window.AssetCatalog;
  const Bot = window.VirtualBot;
  if (!Bot || !Catalog) return;

  let bridge = null;
  let equityChart = null;
  let lastLearnPreview = null;

  const CONFIG_FIELDS = [
    { id: "botInitialCapital", key: "initialCapital", type: "number" },
    { id: "botRiskPercent", key: "riskPercent", type: "number" },
    { id: "botMinConfidence", key: "minConfidence", type: "number" },
    { id: "botMaxPositions", key: "maxPositions", type: "number" },
    { id: "botCooldown", key: "cooldownMinutes", type: "number" },
    { id: "botPrimaryInterval", key: "primaryInterval", type: "number" },
    { id: "botDirection", key: "direction", type: "select" },
    { id: "botFastEma", key: "fastEma", type: "number" },
    { id: "botSlowEma", key: "slowEma", type: "number" },
    { id: "botRsiPeriod", key: "rsiPeriod", type: "number" },
    { id: "botRsiLongMin", key: "rsiLongMin", type: "number" },
    { id: "botRsiLongMax", key: "rsiLongMax", type: "number" },
    { id: "botRsiShortMin", key: "rsiShortMin", type: "number" },
    { id: "botRsiShortMax", key: "rsiShortMax", type: "number" },
    { id: "botRsiOverbought", key: "rsiOverbought", type: "number" },
    { id: "botRsiOversold", key: "rsiOversold", type: "number" },
    { id: "botMomentumLookback", key: "momentumLookback", type: "number" },
    { id: "botMomentumThreshold", key: "momentumThreshold", type: "number" },
    { id: "botSignalScore", key: "signalScoreThreshold", type: "number" },
    { id: "botMinAlignmentRatio", key: "minAlignmentRatio", type: "number" },
    { id: "botMinAlignedTimeframes", key: "minAlignedTimeframes", type: "number" },
    { id: "botAtrPeriod", key: "atrPeriod", type: "number" },
    { id: "botAtrStopMultiplier", key: "atrStopMultiplier", type: "number" },
    { id: "botRewardRatio", key: "rewardRatio", type: "number" },
    { id: "botFeePercent", key: "feePercent", type: "number" },
    { id: "botSpreadPercent", key: "spreadPercent", type: "number" },
    { id: "botSlippagePercent", key: "slippagePercent", type: "number" },
    { id: "botTradingHoursStart", key: "tradingHoursStart", type: "number" },
    { id: "botTradingHoursEnd", key: "tradingHoursEnd", type: "number" },
  ];

  const CHECKBOX_FIELDS = [
    { id: "botEnabled", key: "enabled" },
    { id: "botAutoLearn", key: "autoLearnEnabled" },
    { id: "botAutoClose", key: "autoCloseOnReversal" },
    { id: "botUseMacd", key: "useMacd" },
    { id: "botUseVolume", key: "useVolume" },
    { id: "botRequireAlignment", key: "requireAlignment" },
    { id: "botUseTradingHours", key: "useTradingHours" },
  ];

  const PARAM_LABELS = {
    minConfidence: "Min. megbízhatóság",
    riskPercent: "Kockázat / ügylet",
    cooldownMinutes: "Cooldown (perc)",
    maxPositions: "Max. pozíció",
    rewardRatio: "Cél R arány",
    atrStopMultiplier: "ATR stop szorzó",
    signalScoreThreshold: "Jelzésküszöb",
    requireAlignment: "Idősík-egyezés kötelező",
    momentumThreshold: "Momentum küszöb",
  };

  function getState() {
    return bridge?.getState?.();
  }

  function getBotState() {
    return getState()?.botState;
  }

  function getContext() {
    return bridge?.getBotContext?.() || {};
  }

  function bindEvents() {
    const checks = document.getElementById("botAssetChecks");
    if (checks) {
      checks.replaceChildren(
        ...Catalog.ALL_KEYS.map((assetKey) => {
          const meta = Catalog.getAsset(assetKey);
          const label = document.createElement("label");
          label.className = `check-label${meta.featured ? " featured-asset-check" : ""}`;
          const input = document.createElement("input");
          input.type = "checkbox";
          input.value = assetKey;
          label.append(input, document.createTextNode(` ${meta.name}`));
          return label;
        }),
      );
    }

    document.getElementById("botEnabled")?.addEventListener("change", (event) => {
      const botState = getBotState();
      if (!botState) return;
      botState.config.enabled = event.target.checked;
      Bot.saveBotState(botState);
      render();
      if (botState.config.enabled) bridge?.runTick?.();
    });

    document.getElementById("botAutoLearn")?.addEventListener("change", (event) => {
      const botState = getBotState();
      if (!botState) return;
      botState.config.autoLearnEnabled = event.target.checked;
      Bot.saveBotState(botState);
      renderLearnPanel();
      bridge?.showToast?.(
        event.target.checked
          ? "Auto-tanulás bekapcsolva – a bot a lezárt ügyletek alapján finomhangol."
          : "Auto-tanulás kikapcsolva – csak kézi beállítás.",
      );
    });

    document.getElementById("botSaveConfig")?.addEventListener("click", saveConfig);
    document.getElementById("botResetButton")?.addEventListener("click", resetAccount);
    document.getElementById("botRunLearnButton")?.addEventListener("click", runLearnPreview);
    document.getElementById("botApplyLearnButton")?.addEventListener("click", applyLearnPreview);

    document.querySelectorAll("[data-bot-config-tab]").forEach((button) => {
      button.addEventListener("click", () => switchConfigTab(button.dataset.botConfigTab));
    });
  }

  function switchConfigTab(tab) {
    document.querySelectorAll("[data-bot-config-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.botConfigTab === tab);
    });
    document.querySelectorAll("[data-bot-config-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.botConfigPanel !== tab;
    });
  }

  function syncConfigForm() {
    const botState = getBotState();
    if (!botState) return;
    const config = botState.config;

    CONFIG_FIELDS.forEach(({ id, key, type }) => {
      const element = document.getElementById(id);
      if (!element) return;
      if (type === "number") element.value = config[key];
      else element.value = config[key];
    });

    CHECKBOX_FIELDS.forEach(({ id, key }) => {
      const element = document.getElementById(id);
      if (element) element.checked = Boolean(config[key]);
    });

    document.querySelectorAll("#botAssetChecks input").forEach((input) => {
      input.checked = config.assets.includes(input.value);
    });
  }

  function readConfigFromForm() {
    const botState = getBotState();
    const base = botState?.config || Bot.DEFAULT_CONFIG;
    const next = { ...base };

    CONFIG_FIELDS.forEach(({ id, key, type }) => {
      const element = document.getElementById(id);
      if (!element) return;
      next[key] = type === "number" ? Number(element.value) : element.value;
    });

    CHECKBOX_FIELDS.forEach(({ id, key }) => {
      const element = document.getElementById(id);
      if (element) next[key] = element.checked;
    });

    const selectedAssets = [...document.querySelectorAll("#botAssetChecks input:checked")].map(
      (input) => input.value,
    );
    next.assets = selectedAssets.length ? selectedAssets : ["bitcoin"];
    return next;
  }

  function saveConfig() {
    const botState = getBotState();
    if (!botState) return;
    botState.config = readConfigFromForm();
    Bot.saveBotState(botState);
    render();
    bridge?.showToast?.("Bot beállítások elmentve.");
    if (botState.config.enabled) bridge?.runTick?.();
  }

  function resetAccount() {
    if (!window.confirm("Biztosan törlöd a bot összes pozícióját és ügyletét?")) return;
    const config = readConfigFromForm();
    const state = getState();
    if (!state) return;
    state.botState = Bot.resetBot(config);
    syncConfigForm();
    render();
    bridge?.showToast?.("A virtuális bot újraindult.");
  }

  function runLearnPreview() {
    const botState = getBotState();
    if (!botState) return;
    lastLearnPreview = Bot.runAutoLearn(botState, getContext(), { dryRun: true, trigger: "manual-preview" });
    renderLearnPanel();
    if (!lastLearnPreview?.changes?.length) {
      bridge?.showToast?.(lastLearnPreview?.reason || "Nincs javasolt módosítás.");
    }
  }

  function applyLearnPreview() {
    const botState = getBotState();
    if (!botState) return;
    if (!botState.config.autoLearnEnabled) {
      bridge?.showToast?.("Kapcsold be az Auto-tanulást a módosítások alkalmazásához.");
      return;
    }
    const result = Bot.runAutoLearn(botState, getContext(), { trigger: "manual-apply" });
    if (result?.applied) {
      syncConfigForm();
      render();
      bridge?.showToast?.(`${result.changes.length} paraméter frissítve auto-tanulással.`);
    } else {
      bridge?.showToast?.(result?.reason || "Nincs alkalmazható módosítás.");
    }
    lastLearnPreview = result;
    renderLearnPanel();
  }

  function renderLearnPanel() {
    const panel = document.getElementById("botLearnDiff");
    const history = document.getElementById("botLearnHistory");
    const botState = getBotState();
    if (!panel) return;

    panel.replaceChildren();
    const preview = lastLearnPreview;
    if (!preview?.changes?.length) {
      panel.append(
        Object.assign(document.createElement("p"), {
          className: "helper-text",
          textContent: preview?.reason || "Futtasd az elemzést a javasolt paraméter-változások megtekintéséhez.",
        }),
      );
    } else {
      const title = document.createElement("strong");
      title.textContent = botState?.config.autoLearnEnabled
        ? "Javasolt módosítások (auto-tanulás aktív)"
        : "Előnézet – alkalmazás csak Auto-tanulás mellett";
      panel.append(title);

      const list = document.createElement("ul");
      list.className = "bot-learn-changes";
      preview.changes.forEach((change) => {
        const li = document.createElement("li");
        const label = PARAM_LABELS[change.key] || change.key;
        li.innerHTML = `<span>${label}</span><strong>${formatParamValue(change.key, change.from)} → ${formatParamValue(change.key, change.to)}</strong><small>${change.reason}</small>`;
        list.append(li);
      });
      panel.append(list);
    }

    if (history && botState) {
      history.replaceChildren();
      if (!botState.learningHistory?.length) {
        history.append(
          Object.assign(document.createElement("span"), {
            className: "helper-text",
            textContent: "Még nem futott auto-tanulás.",
          }),
        );
        return;
      }
      botState.learningHistory.slice(0, 8).forEach((entry) => {
        const item = document.createElement("div");
        item.className = "bot-learn-history-item";
        const time = new Intl.DateTimeFormat("hu-HU", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(entry.time);
        const summary = entry.changes
          .map((c) => `${PARAM_LABELS[c.key] || c.key}: ${formatParamValue(c.key, c.from)}→${formatParamValue(c.key, c.to)}`)
          .join(" · ");
        item.innerHTML = `<time>${time}</time><span>${summary}</span>`;
        history.append(item);
      });
    }
  }

  function formatParamValue(key, value) {
    if (typeof value === "boolean") return value ? "igen" : "nem";
    if (key === "minAlignmentRatio") return `${Math.round(value * 100)}%`;
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
    return String(value);
  }

  function render() {
    const botState = getBotState();
    if (!botState) return;
    const metrics = Bot.getMetrics(botState, getContext());
    const { formatNumber, formatSignedUsd, setMetricValue, valueClass, appendEmptyTableRow } = bridge;

    setMetricValue(
      "botEquity",
      `$${formatNumber(metrics.equity, 2)}`,
      metrics.equity - botState.initialCapital,
    );
    setMetricValue("botRealizedPnl", formatSignedUsd(metrics.realizedPnl), metrics.realizedPnl);
    setMetricValue("botOpenPnl", formatSignedUsd(metrics.openPnl), metrics.openPnl);
    document.getElementById("botWinRate").textContent =
      metrics.winRate === null ? "–" : `${formatNumber(metrics.winRate, 1)}%`;
    document.getElementById("botProfitFactor").textContent =
      metrics.profitFactor === null
        ? "–"
        : metrics.profitFactor === Infinity
          ? "∞"
          : formatNumber(metrics.profitFactor, 2);
    document.getElementById("botDrawdown").textContent = `${formatNumber(metrics.maxDrawdown, 2)}%`;
    document.getElementById("botTradeCount").textContent = String(metrics.tradeCount);
    document.getElementById("botOpenCount").textContent = `${metrics.openCount} pozíció`;

    const status = document.getElementById("botStatus");
    if (status) {
      const hoursOk = Bot.isWithinTradingHours(botState.config);
      const hoursNote = botState.config.useTradingHours
        ? hoursOk
          ? " · kereskedési ablak aktív"
          : " · kereskedési ablakon kívül"
        : "";
      status.textContent = botState.config.enabled
        ? `Bot aktív · ${metrics.tradeCount} lezárt ügylet · utolsó tick: ${
            botState.lastTickAt
              ? new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit" }).format(
                  botState.lastTickAt,
                )
              : "most"
          }${hoursNote}`
        : "Bot kikapcsolva – kapcsold be az automatikus papírkereskedéshez.";
      status.className = `bot-status ${botState.config.enabled ? "live" : ""}`;
    }

    const modeBadge = document.getElementById("botModeBadge");
    if (modeBadge) {
      modeBadge.textContent = botState.config.autoLearnEnabled ? "Auto-tanulás BE" : "Kézi mód";
      modeBadge.className = `local-badge ${botState.config.autoLearnEnabled ? "learn-active" : ""}`;
    }

    renderPositions(appendEmptyTableRow, formatNumber, formatSignedUsd, valueClass);
    renderTrades(appendEmptyTableRow, formatNumber, formatSignedUsd, valueClass);
    renderSuggestions();
    renderActivity();
    renderEquityChart();
    renderLiveSignals(formatNumber);
    renderLearnPanel();
  }

  function renderPositions(appendEmptyTableRow, formatNumber, formatSignedUsd, valueClass) {
    const botState = getBotState();
    const table = document.getElementById("botPositionsTable");
    if (!table || !botState) return;
    table.replaceChildren();
    if (!botState.positions.length) {
      appendEmptyTableRow(table, 8, "Nincs nyitott bot-pozíció.");
      return;
    }
    botState.positions.forEach((position) => {
      const price = Bot.getCurrentPrice(position.asset, getContext());
      const multiplier = position.direction === "long" ? 1 : -1;
      const pnl = Number.isFinite(price)
        ? (price - position.entry) * position.quantity * multiplier
        : null;
      const row = document.createElement("tr");
      [
        Catalog.getName(position.asset),
        position.direction.toUpperCase(),
        `$${formatNumber(position.entry, Catalog.getAsset(position.asset)?.priceDecimals ?? 2)}`,
        `$${formatNumber(position.stop, Catalog.getAsset(position.asset)?.priceDecimals ?? 2)}`,
        `$${formatNumber(position.target, Catalog.getAsset(position.asset)?.priceDecimals ?? 2)}`,
        pnl === null ? "–" : formatSignedUsd(pnl),
        position.signal || "–",
        (position.reasons || []).join(" · ") || "–",
      ].forEach((text, index) => {
        const cell = document.createElement("td");
        cell.textContent = text;
        if (index === 5 && pnl !== null) cell.className = valueClass(pnl);
        row.append(cell);
      });
      table.append(row);
    });
  }

  function renderTrades(appendEmptyTableRow, formatNumber, formatSignedUsd, valueClass) {
    const botState = getBotState();
    const table = document.getElementById("botTradesTable");
    if (!table || !botState) return;
    table.replaceChildren();
    if (!botState.trades.length) {
      appendEmptyTableRow(table, 8, "Még nincs bot-ügylet.");
      return;
    }
    botState.trades.slice(0, 50).forEach((trade) => {
      const row = document.createElement("tr");
      const why = (trade.analysis || []).join(" ");
      const decimals = Catalog.getAsset(trade.asset)?.priceDecimals ?? 2;
      [
        new Intl.DateTimeFormat("hu-HU", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(trade.closedAt),
        Catalog.getName(trade.asset),
        trade.direction.toUpperCase(),
        `$${formatNumber(trade.entry, decimals)}`,
        `$${formatNumber(trade.exit, decimals)}`,
        trade.reason,
        why || "–",
        formatSignedUsd(trade.pnl),
      ].forEach((text, index) => {
        const cell = document.createElement("td");
        cell.textContent = text;
        if (index === 7) cell.className = valueClass(trade.pnl);
        row.append(cell);
      });
      table.append(row);
    });
  }

  function renderSuggestions() {
    const botState = getBotState();
    const list = document.getElementById("botSuggestions");
    if (!list || !botState) return;
    const suggestions = Bot.buildSuggestions(botState, getContext());
    list.replaceChildren(
      ...suggestions.map((item) => {
        const li = document.createElement("li");
        li.className = `bot-suggestion ${item.severity}`;
        li.innerHTML = `<strong>${item.title}</strong><span>${item.detail}</span>`;
        return li;
      }),
    );
  }

  function renderActivity() {
    const botState = getBotState();
    const log = document.getElementById("botActivityLog");
    if (!log || !botState) return;
    log.replaceChildren();
    if (!botState.activityLog.length) {
      log.append(Object.assign(document.createElement("span"), { textContent: "Még nincs esemény." }));
      return;
    }
    botState.activityLog.slice(0, 25).forEach((entry) => {
      const item = document.createElement("div");
      item.className = "bot-activity-item";
      item.innerHTML =
        `<time>${new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(entry.time)}</time>` +
        `<span>${entry.message}</span>`;
      log.append(item);
    });
  }

  function renderEquityChart() {
    const botState = getBotState();
    equityChart?.destroy();
    if (typeof Chart === "undefined" || !botState) return;
    const canvas = document.getElementById("botEquityChart");
    if (!canvas) return;
    const points = botState.equityHistory;
    equityChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: points.map((point) =>
          new Intl.DateTimeFormat("hu-HU", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(point.time),
        ),
        datasets: [{
          data: points.map((point) => point.equity),
          borderColor: "#2f5d50",
          backgroundColor: "rgba(47, 93, 80, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        }],
      },
      options: bridge?.paperChartOptions?.() || { responsive: true, maintainAspectRatio: false },
    });
    const state = getState();
    if (state) state.botEquityChart = equityChart;
  }

  function renderLiveSignals(formatNumber) {
    const botState = getBotState();
    const grid = document.getElementById("botSignalGrid");
    if (!grid || !botState) return;
    grid.replaceChildren();
    const context = getContext();
    context.botConfig = botState.config;

    botState.config.assets.forEach((assetKey) => {
      const decision = Bot.analyzeSignal(assetKey, botState.config, context);
      const meta = Catalog.getAsset(assetKey);
      const card = document.createElement("article");
      card.className = `bot-signal-card ${decision?.className || "neutral"}`;
      const signal = decision?.signal || "Nincs adat";
      const conf = decision?.confidence ?? "–";
      const rsi = decision?.rsi !== null && decision?.rsi !== undefined ? formatNumber(decision.rsi, 1) : "–";
      card.innerHTML = `
        <div class="bot-signal-heading">
          <span>${meta?.name || assetKey}</span>
          <strong class="${decision?.className || "neutral"}">${signal}</strong>
        </div>
        <div class="bot-signal-metrics">
          <div><span>Bizalom</span><strong>${conf}%</strong></div>
          <div><span>RSI</span><strong>${rsi}</strong></div>
          <div><span>Idősík</span><strong>${decision?.interval || botState.config.primaryInterval}p</strong></div>
        </div>`;
      grid.append(card);
    });
  }

  function resize() {
    equityChart?.resize();
  }

  function init(appBridge) {
    bridge = appBridge;
    bindEvents();
    syncConfigForm();
    switchConfigTab("general");
    render();
  }

  window.BotLab = {
    init,
    render,
    syncConfigForm,
    resize,
  };
})();
