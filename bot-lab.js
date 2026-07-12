(function () {
  "use strict";

  const Catalog = window.AssetCatalog;
  const Bot = window.VirtualBot;
  if (!Bot || !Catalog) return;

  let bridge = null;
  let equityChart = null;
  let lastLearnPreview = null;
  let activeSection = "summary";

  const BOT_SECTIONS = ["summary", "settings", "trades", "experiences"];

  const CONFIG_FIELDS = [
    { id: "botInitialCapital", key: "initialCapital", type: "number" },
    { id: "botRiskPercent", key: "riskPercent", type: "range", decimals: 1 },
    { id: "botMinConfidence", key: "minConfidence", type: "range", decimals: 0 },
    { id: "botMaxPositions", key: "maxPositions", type: "range", decimals: 0 },
    { id: "botCooldown", key: "cooldownMinutes", type: "range", decimals: 0 },
    { id: "botProHighScore", key: "proHighScoreThreshold", type: "range", decimals: 0 },
    { id: "botProWinCooldown", key: "proWinCooldownMinutes", type: "range", decimals: 0 },
    { id: "botProConfidenceFloor", key: "proMinConfidenceFloor", type: "range", decimals: 0 },
    { id: "botPrimaryInterval", key: "primaryInterval", type: "select" },
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
    { id: "botMomentumThreshold", key: "momentumThreshold", type: "range", decimals: 2 },
    { id: "botSignalScore", key: "signalScoreThreshold", type: "range", decimals: 2 },
    { id: "botMinAlignmentRatio", key: "minAlignmentRatio", type: "range", decimals: 0, displayScale: 100 },
    { id: "botMinAlignedTimeframes", key: "minAlignedTimeframes", type: "number" },
    { id: "botAtrPeriod", key: "atrPeriod", type: "number" },
    { id: "botAtrStopMultiplier", key: "atrStopMultiplier", type: "range", decimals: 2 },
    { id: "botRewardRatio", key: "rewardRatio", type: "range", decimals: 2 },
    { id: "botFeePercent", key: "feePercent", type: "number" },
    { id: "botSpreadPercent", key: "spreadPercent", type: "number" },
    { id: "botSlippagePercent", key: "slippagePercent", type: "number" },
    { id: "botTradingHoursStart", key: "tradingHoursStart", type: "number" },
    { id: "botTradingHoursEnd", key: "tradingHoursEnd", type: "number" },
  ];

  const CHECKBOX_FIELDS = [
    { id: "botEnabled", key: "enabled" },
    { id: "botProfessionalMode", key: "professionalMode" },
    { id: "botAutoLearn", key: "autoLearnEnabled" },
    { id: "botMarketWideMode", key: "marketWideMode" },
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

  function formatSliderDisplay(field, value) {
    const scale = field.displayScale || 1;
    const scaled = value * scale;
    if (field.decimals === 0) return String(Math.round(scaled));
    return scaled.toFixed(field.decimals ?? 2);
  }

  function updateSliderOutput(field) {
    const element = document.getElementById(field.id);
    const output = document.getElementById(`${field.id}Out`);
    if (!element || !output) return;
    output.textContent = formatSliderDisplay(field, Number(element.value));
  }

  function bindSliderOutputs() {
    CONFIG_FIELDS.filter((field) => field.type === "range").forEach((field) => {
      const element = document.getElementById(field.id);
      if (!element || element.dataset.sliderBound) return;
      element.dataset.sliderBound = "1";
      element.addEventListener("input", () => updateSliderOutput(field));
    });
  }

  function bindEvents() {
    const checks = document.getElementById("botAssetChecks");
    if (checks) {
      checks.replaceChildren(
        ...Catalog.ALL_KEYS.map((assetKey) => {
          const meta = Catalog.getAsset(assetKey);
          const label = document.createElement("label");
          label.className = `toggle-chip${meta.featured ? " featured-asset-check" : ""}`;
          const input = document.createElement("input");
          input.type = "checkbox";
          input.value = assetKey;
          const text = document.createElement("span");
          text.textContent = meta.name;
          label.append(input, text);
          return label;
        }),
      );
    }

    bindSliderOutputs();

    document.getElementById("botEnabled")?.addEventListener("change", (event) => {
      const botState = getBotState();
      if (!botState) return;
      botState.config.enabled = event.target.checked;
      Bot.saveBotState(botState);
      render();
      bridge?.scheduleBotTick?.();
      if (botState.config.enabled) bridge?.runTick?.();
    });

    document.getElementById("botProfessionalMode")?.addEventListener("change", (event) => {
      const botState = getBotState();
      if (!botState) return;
      botState.config.professionalMode = event.target.checked;
      Bot.saveBotState(botState);
      render();
      bridge?.scheduleBotTick?.();
      bridge?.showToast?.(
        event.target.checked
          ? "Professzionális mód be – gyorsabb szkennelés, intelligens cooldown."
          : "Professzionális mód ki – klasszikus cooldown minden ügylet után.",
      );
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

    document.getElementById("botMarketWideMode")?.addEventListener("change", (event) => {
      const botState = getBotState();
      if (!botState) return;
      botState.config.marketWideMode = event.target.checked;
      Bot.saveBotState(botState);
      syncConfigForm();
      render();
      bridge?.scheduleBotTick?.();
      bridge?.showToast?.(
        event.target.checked
          ? "Összes eszköz mód – a bot minden ciklusnál a legjobb lehetőséget keresi."
          : "Kézi eszközválasztás – csak a kijelölt eszközökön kereskedik.",
      );
      if (botState.config.enabled) bridge?.runTick?.();
    });

    document.getElementById("botSaveConfig")?.addEventListener("click", saveConfig);
    document.getElementById("botResetButton")?.addEventListener("click", resetAccount);
    document.getElementById("botRunLearnButton")?.addEventListener("click", runLearnPreview);
    document.getElementById("botApplyLearnButton")?.addEventListener("click", applyLearnPreview);

    document.querySelectorAll("[data-bot-config-tab]").forEach((button) => {
      button.addEventListener("click", () => switchConfigTab(button.dataset.botConfigTab));
    });

    document.querySelectorAll("[data-bot-section]").forEach((button) => {
      button.addEventListener("click", () => switchSection(button.dataset.botSection));
    });
  }

  function switchSection(section, updateHash = true) {
    if (!BOT_SECTIONS.includes(section)) section = "summary";
    activeSection = section;

    document.querySelectorAll("[data-bot-section]").forEach((button) => {
      const isActive = button.dataset.botSection === section;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });
    document.querySelectorAll("[data-bot-section-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.botSectionPanel !== section;
    });

    if (updateHash && bridge?.updateBotHash) {
      bridge.updateBotHash(section);
    }

    if (section === "summary") {
      requestAnimationFrame(() => {
        equityChart?.resize();
        bridge?.resizeBotCharts?.();
      });
    }
  }

  function getActiveSection() {
    return activeSection;
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
      if (type === "number" || type === "range") element.value = config[key];
      else element.value = config[key];
    });

    CONFIG_FIELDS.filter((field) => field.type === "range").forEach(updateSliderOutput);

    CHECKBOX_FIELDS.forEach(({ id, key }) => {
      const element = document.getElementById(id);
      if (element) element.checked = Boolean(config[key]);
    });

    document.querySelectorAll("#botAssetChecks input").forEach((input) => {
      input.checked = config.assets.includes(input.value);
      input.disabled = Boolean(config.marketWideMode);
    });

    const assetFieldset = document.querySelector(".bot-asset-fieldset");
    if (assetFieldset) {
      assetFieldset.classList.toggle("market-wide-active", Boolean(config.marketWideMode));
    }
  }

  function readConfigFromForm() {
    const botState = getBotState();
    const base = botState?.config || Bot.DEFAULT_CONFIG;
    const next = { ...base };

    CONFIG_FIELDS.forEach(({ id, key, type }) => {
      const element = document.getElementById(id);
      if (!element) return;
      if (type === "number" || type === "range" || key === "primaryInterval") {
        next[key] = Number(element.value);
      } else {
        next[key] = element.value;
      }
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
    bridge?.scheduleBotTick?.();
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

    const tradesPerHour = document.getElementById("botTradesPerHour");
    if (tradesPerHour) {
      tradesPerHour.textContent = String(metrics.tradesPerHour ?? 0);
    }
    const captureRate = document.getElementById("botCaptureRate");
    if (captureRate) {
      captureRate.textContent =
        metrics.opportunityCaptureRate === null
          ? "–"
          : `${formatNumber(metrics.opportunityCaptureRate, 0)}%`;
    }

    const status = document.getElementById("botStatus");
    if (status) {
      const hoursOk = Bot.isWithinTradingHours(botState.config);
      const hoursNote = botState.config.useTradingHours
        ? hoursOk
          ? " · kereskedési ablak aktív"
          : " · kereskedési ablakon kívül"
        : "";
      const proNote = botState.config.professionalMode ? " · Pro mód aktív" : "";
      status.textContent = botState.config.enabled
        ? `Bot aktív · ${metrics.tradeCount} lezárt ügylet · utolsó tick: ${
            botState.lastTickAt
              ? new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit" }).format(
                  botState.lastTickAt,
                )
              : "most"
          }${hoursNote}${proNote}`
        : "Bot kikapcsolva – kapcsold be az automatikus papírkereskedéshez.";
      status.className = `bot-status ${botState.config.enabled ? "live" : ""}`;
    }

    const modeBadge = document.getElementById("botModeBadge");
    if (modeBadge) {
      const parts = [];
      if (botState.config.professionalMode) parts.push("Pro mód");
      if (botState.config.marketWideMode) parts.push("Összes eszköz");
      if (botState.config.autoLearnEnabled) parts.push("Auto-tanulás");
      modeBadge.textContent = parts.length ? parts.join(" · ") : "Kézi mód";
      modeBadge.className = `local-badge ${botState.config.professionalMode ? "pro-active" : ""} ${botState.config.autoLearnEnabled ? "learn-active" : ""} ${botState.config.marketWideMode ? "market-wide-active" : ""}`;
    }

    renderPositions(appendEmptyTableRow, formatNumber, formatSignedUsd, valueClass);
    renderTrades(appendEmptyTableRow, formatNumber, formatSignedUsd, valueClass);
    renderMissedOpportunities(formatNumber);
    renderSuggestions();
    renderActivity();
    renderEquityChart();
    renderMarketScan(formatNumber);
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

  function renderMissedOpportunities(formatNumber) {
    const botState = getBotState();
    const list = document.getElementById("botMissedLog");
    if (!list || !botState) return;
    const missed = botState.performanceStats?.missedLog || [];
    list.replaceChildren();
    if (!missed.length) {
      list.append(
        Object.assign(document.createElement("span"), {
          className: "helper-text",
          textContent: "Nincs kihagyott lehetőség – a bot minden érvényes jelet kihasznált.",
        }),
      );
      return;
    }
    missed.slice(0, 12).forEach((entry) => {
      const item = document.createElement("div");
      item.className = "bot-missed-item";
      const time = new Intl.DateTimeFormat("hu-HU", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(entry.time);
      item.innerHTML =
        `<time>${time}</time>` +
        `<strong>${entry.assetName}</strong>` +
        `<span>${entry.signal} · ${formatNumber(entry.opportunityScore, 0)} pont · ${entry.confidence ?? "–"}%</span>` +
        `<small>${entry.detail || entry.reason}</small>`;
      list.append(item);
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

  function renderMarketScan(formatNumber) {
    const botState = getBotState();
    const grid = document.getElementById("botSignalGrid");
    const summary = document.getElementById("botScanSummary");
    const heading = document.getElementById("botScanHeading");
    if (!grid || !botState) return;

    const context = getContext();
    context.botConfig = botState.config;
    const marketWide = botState.config.marketWideMode;

    if (heading) {
      heading.textContent = marketWide ? "Piaci szkenner – összes eszköz" : "Követett eszközök";
    }

    let results = botState.lastScan?.results;
    if (!results?.length) {
      const scanKeys = Bot.getScanAssetKeys(botState.config, botState);
      results = scanKeys.map((assetKey) => {
        const decision = Bot.analyzeSignal(assetKey, botState.config, context);
        return Bot.evaluateOpportunity(assetKey, decision, botState.config, botState, Date.now());
      });
      results.sort((a, b) => b.opportunityScore - a.opportunityScore);
    }

    grid.replaceChildren();
    if (!results.length) {
      grid.append(
        Object.assign(document.createElement("span"), {
          className: "helper-text",
          textContent: marketWide
            ? "Várakozás az első piaci szkennelésre…"
            : "Válassz eszközöket a beállításoknál.",
        }),
      );
    } else {
      results.forEach((result, index) => {
        const isChosen = botState.lastScan?.chosen?.assetKey === result.assetKey;
        const card = document.createElement("article");
        card.className = `bot-scan-card ${result.className}${result.eligible ? " eligible" : ""}${isChosen ? " chosen" : ""}`;
        const rank = document.createElement("span");
        rank.className = "bot-scan-rank";
        rank.textContent = `#${index + 1}`;
        const headingRow = document.createElement("div");
        headingRow.className = "bot-scan-heading";
        headingRow.innerHTML = `
          <span>${result.assetName}</span>
          <strong class="${result.className}">${result.signal}</strong>`;
        headingRow.prepend(rank);

        const metrics = document.createElement("div");
        metrics.className = "bot-scan-metrics";
        metrics.innerHTML = `
          <div><span>Pontszám</span><strong>${formatNumber(result.opportunityScore, 0)}</strong></div>
          <div><span>Bizalom</span><strong>${result.confidence ?? "–"}%</strong></div>
          <div><span>Jel</span><strong>${result.score !== null ? formatNumber(result.score, 2) : "–"}</strong></div>`;

        const breakdown = document.createElement("div");
        breakdown.className = "bot-scan-breakdown";
        const bd = result.scoreBreakdown;
        breakdown.textContent = `Bizalom ${formatNumber(bd.confidence, 0)} + jel ${formatNumber(bd.signalStrength, 1)} + egyezés ${formatNumber(bd.alignmentBonus, 1)} + momentum ${formatNumber(bd.momentumBonus, 1)} + RSI ${formatNumber(bd.rsiBonus, 0)}`;

        const reasons = document.createElement("div");
        reasons.className = "bot-scan-reasons";
        if (result.eligible) {
          reasons.textContent = (result.topReasons || []).join(" · ") || "Minden szűrő teljesül.";
        } else {
          reasons.textContent = result.filterReasons.join(" · ") || "Nem kereskedhető.";
        }

        card.append(headingRow, metrics, breakdown, reasons);
        grid.append(card);
      });
    }

    if (summary) {
      summary.replaceChildren();
      const chosen = botState.lastScan?.chosen;
      if (chosen?.assetKey) {
        const box = document.createElement("div");
        box.className = "bot-scan-chosen";
        const bd = chosen.scoreBreakdown || {};
        box.innerHTML = `
          <strong>Választott: ${chosen.assetName}</strong>
          <span>${chosen.signal} · ${chosen.confidence}% bizalom · ${chosen.opportunityScore.toFixed(0)} pont · ${chosen.direction?.toUpperCase() || "–"}</span>
          <small>${(chosen.topReasons || []).join(" · ")}</small>
          <small class="bot-scan-breakdown">Pontszám: bizalom ${Math.round(bd.confidence || 0)} + jel ${(bd.signalStrength || 0).toFixed(1)} + egyezés ${(bd.alignmentBonus || 0).toFixed(1)} + momentum ${(bd.momentumBonus || 0).toFixed(1)} + RSI ${Math.round(bd.rsiBonus || 0)}</small>`;
        summary.append(box);
      } else if (chosen?.reason) {
        summary.append(
          Object.assign(document.createElement("p"), {
            className: "helper-text",
            textContent: chosen.reason,
          }),
        );
      } else if (marketWide && results.length) {
        const eligibleCount = results.filter((result) => result.eligible).length;
        summary.append(
          Object.assign(document.createElement("p"), {
            className: "helper-text",
            textContent: eligibleCount
              ? `${eligibleCount} kereskedhető lehetőség – a legmagasabb pontszámú nyitható pozíciót választja a bot.`
              : "Egyetlen eszköz sem teljesíti a szűrőket ebben a ciklusban.",
          }),
        );
      } else if (!marketWide) {
        summary.append(
          Object.assign(document.createElement("p"), {
            className: "helper-text",
            textContent: "Kézi mód – minden kijelölt eszközön külön értékel és nyithat.",
          }),
        );
      }
    }
  }

  function resize() {
    equityChart?.resize();
  }

  function init(appBridge) {
    bridge = appBridge;
    bindEvents();
    syncConfigForm();
    switchConfigTab("general");
    switchSection(appBridge?.initialBotSection || "summary", false);
    render();
  }

  window.BotLab = {
    init,
    render,
    syncConfigForm,
    resize,
    switchSection,
    getActiveSection,
  };
})();
