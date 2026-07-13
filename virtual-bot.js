(function () {
  "use strict";

  const STORAGE_KEY = "aurum-virtual-bot";
  const STORAGE_KEY_TRADES_BACKUP = "aurum-virtual-bot-trades-backup";
  const STORAGE_KEY_LEARNING_BACKUP = "aurum-virtual-bot-learning-backup";
  const BOT_USER_ID_KEY = "aurum-bot-user-id";
  const BOT_LOCAL_UPDATED_KEY = "aurum-bot-local-updated";
  const CLOUD_SYNC_DEBOUNCE_MS = 2500;

  let cloudSyncRuntime = {
    endpoint: "",
    pushTimer: null,
    status: "idle",
    lastError: "",
    lastSyncedAt: null,
    onStatusChange: null,
  };

  const PARAM_BOUNDS = {
    minConfidence: { min: 40, max: 90, step: 5 },
    riskPercent: { min: 0.1, max: 5, step: 0.25 },
    cooldownMinutes: { min: 5, max: 120, step: 5 },
    maxPositions: { min: 1, max: 10, step: 1 },
    rewardRatio: { min: 1, max: 5, step: 0.25 },
    atrStopMultiplier: { min: 0.5, max: 5, step: 0.25 },
    atrStopMultiplierLong: { min: 0.5, max: 5, step: 0.25 },
    atrStopMultiplierShort: { min: 0.5, max: 5, step: 0.25 },
    signalScoreThreshold: { min: 1.5, max: 4, step: 0.25 },
    momentumThreshold: { min: 0.03, max: 0.5, step: 0.02 },
    longMomentumMin: { min: 0.03, max: 0.5, step: 0.02 },
    shortMomentumMin: { min: 0.03, max: 0.5, step: 0.02 },
    reversalMinConfidence: { min: 55, max: 90, step: 5 },
    reversalMinScore: { min: 2, max: 4, step: 0.25 },
    minOpportunityScore: { min: 60, max: 120, step: 5 },
    maxDailyLossPercent: { min: 1, max: 15, step: 0.5 },
    maxPositionAgeMinutes: { min: 30, max: 480, step: 15 },
    trailingAtrMultiplier: { min: 0.5, max: 4, step: 0.25 },
    trailingActivationR: { min: 0.25, max: 2, step: 0.25 },
    partialTakeProfitR: { min: 0.5, max: 3, step: 0.25 },
    partialTakeProfitPercent: { min: 25, max: 75, step: 5 },
    minEntryQualityScore: { min: 50, max: 95, step: 5 },
    entryQualityReadyThreshold: { min: 60, max: 90, step: 5 },
    entryQualityWaitThreshold: { min: 35, max: 70, step: 5 },
    minHoldMinutes: { min: 5, max: 120, step: 5 },
    minSellUrgencyScore: { min: 40, max: 90, step: 5 },
  };

  const DEFAULT_CONFIG = {
    enabled: false,
    autoLearnEnabled: true,
    professionalMode: true,
    marketWideMode: true,
    assets: ["bitcoin", "ethereum", "spy"],
    currency: "sync",
    initialCapital: 10000,
    riskPercent: 1.5,
    maxPositions: 2,
    cooldownMinutes: 30,
    proMinConfidenceFloor: 55,
    proHighScoreThreshold: 75,
    proWinCooldownMinutes: 5,
    primaryInterval: 5,
    direction: "both",
    fastEma: 9,
    slowEma: 21,
    rsiPeriod: 14,
    rsiLongMin: 54,
    rsiLongMax: 65,
    rsiShortMin: 35,
    rsiShortMax: 46,
    rsiOverbought: 70,
    rsiOversold: 30,
    useMacd: true,
    momentumLookback: 15,
    momentumThreshold: 0.12,
    longMomentumMin: 0.1,
    shortMomentumMin: 0.1,
    useVolume: true,
    volumeMultiplier: 1.4,
    signalScoreThreshold: 2.75,
    minConfidence: 58,
    requireAlignment: true,
    minAlignmentRatio: 0.7,
    minAlignedTimeframes: 2,
    blockAgainstDailyTrend: true,
    atrPeriod: 14,
    atrStopMultiplier: 2.5,
    atrStopMultiplierLong: 2.5,
    atrStopMultiplierShort: 2.75,
    rewardRatio: 2.5,
    useTrailingStop: true,
    trailingAtrMultiplier: 1.5,
    trailingActivationR: 0.75,
    partialTakeProfitEnabled: true,
    partialTakeProfitR: 1,
    partialTakeProfitPercent: 50,
    autoCloseOnReversal: true,
    reversalMinConfidence: 72,
    reversalMinScore: 3,
    maxPositionAgeMinutes: 120,
    maxDailyLossPercent: 5,
    minOpportunityScore: 65,
    minEntryQualityScore: 62,
    entryQualityReadyThreshold: 62,
    entryQualityWaitThreshold: 42,
    minHoldMinutes: 15,
    minSellUrgencyScore: 55,
    minRegimeAtrPercentile: 12,
    maxRegimeAtrPercentile: 90,
    srProximityBlockPercent: 0.35,
    breakevenAfterR: 1,
    staleExitRequiresTrendBreak: true,
    marketWideTopN: 1,
    feePercent: 0.1,
    spreadPercent: 0.02,
    slippagePercent: 0.01,
    useTradingHours: false,
    tradingHoursStart: 8,
    tradingHoursEnd: 20,
  };

  const LEARNABLE_KEYS = [
    "minConfidence",
    "riskPercent",
    "cooldownMinutes",
    "maxPositions",
    "rewardRatio",
    "atrStopMultiplier",
    "atrStopMultiplierLong",
    "atrStopMultiplierShort",
    "signalScoreThreshold",
    "requireAlignment",
    "momentumThreshold",
    "longMomentumMin",
    "shortMomentumMin",
    "minOpportunityScore",
    "maxDailyLossPercent",
  ];

  const CONFIG_LABELS = {
    enabled: "Bot bekapcsolva",
    autoLearnEnabled: "Auto-tanulás",
    professionalMode: "Professzionális mód",
    marketWideMode: "Piaci mód (összes eszköz)",
    currency: "Pénznem",
    assets: "Követett eszközök",
    initialCapital: "Kezdőtőke",
    accountReset: "Számla újraindítás",
    riskPercent: "Kockázat / ügylet",
    maxPositions: "Max. pozíció",
    cooldownMinutes: "Cooldown (perc)",
    proMinConfidenceFloor: "Pro: min. bizalom padló",
    proHighScoreThreshold: "Pro: magas pontszám küszöb",
    proWinCooldownMinutes: "Pro: pihenő nyertes után",
    primaryInterval: "Primér idősík",
    direction: "Kereskedési irány",
    fastEma: "Gyors EMA",
    slowEma: "Lassú EMA",
    rsiPeriod: "RSI periódus",
    rsiLongMin: "LONG RSI min",
    rsiLongMax: "LONG RSI max",
    rsiShortMin: "SHORT RSI min",
    rsiShortMax: "SHORT RSI max",
    rsiOverbought: "RSI túlvett",
    rsiOversold: "RSI túladott",
    useMacd: "MACD megerősítés",
    momentumLookback: "Momentum ablak",
    momentumThreshold: "Momentum küszöb",
    longMomentumMin: "LONG momentum min",
    shortMomentumMin: "SHORT momentum min",
    useVolume: "Volumen megerősítés",
    signalScoreThreshold: "Jelzésküszöb",
    minConfidence: "Min. megbízhatóság",
    requireAlignment: "Idősík-egyezés kötelező",
    minAlignmentRatio: "Min. egyezési arány",
    minAlignedTimeframes: "Min. egyező idősíkok",
    blockAgainstDailyTrend: "Napi trend ellen tiltás",
    atrPeriod: "ATR periódus",
    atrStopMultiplier: "ATR stop szorzó",
    atrStopMultiplierLong: "ATR stop LONG",
    atrStopMultiplierShort: "ATR stop SHORT",
    rewardRatio: "Cél R arány",
    useTrailingStop: "Követő stop",
    trailingAtrMultiplier: "Követő ATR szorzó",
    trailingActivationR: "Követő aktiválás (R)",
    partialTakeProfitEnabled: "Részleges profitvétel",
    partialTakeProfitR: "Részleges TP (R)",
    partialTakeProfitPercent: "Részleges TP %",
    autoCloseOnReversal: "Zárás ellentétes jelzésnél",
    reversalMinConfidence: "Fordulás min. bizalom",
    reversalMinScore: "Fordulás min. pontszám",
    maxPositionAgeMinutes: "Max. pozíció életkor (perc)",
    maxDailyLossPercent: "Max. napi veszteség %",
    minOpportunityScore: "Min. lehetőség pontszám",
    minEntryQualityScore: "Min. belépési minőség",
    entryQualityReadyThreshold: "Belépés KÉSZ küszöb",
    entryQualityWaitThreshold: "Belépés VÁR küszöb",
    minHoldMinutes: "Min. tartási idő (perc)",
    minSellUrgencyScore: "Min. eladási sürgősség",
    staleExitRequiresTrendBreak: "Elavult zárás trendtörésnél",
    marketWideTopN: "Piaci mód top N",
    feePercent: "Díj oldalanként",
    spreadPercent: "Spread",
    slippagePercent: "Slippage",
    useTradingHours: "Kereskedési óra szűrő",
    tradingHoursStart: "Kezdő óra",
    tradingHoursEnd: "Záró óra",
  };

  const DIRECTION_LABELS = {
    both: "LONG és SHORT",
    long: "Csak LONG",
    short: "Csak SHORT",
  };

  const INTERVAL_LABELS = {
    1: "1 perc",
    5: "5 perc",
    15: "15 perc",
    60: "1 óra",
  };

  const CURRENCY_LABELS = {
    sync: "Szinkron (globális)",
    USD: "USD",
    EUR: "EUR",
    HUF: "HUF",
  };

  const SOURCE_LABELS = {
    "auto-tanulás": "Auto-tanulás",
    kézi: "Kézi mentés",
    "pro mód": "Pro mód",
    beállítás: "Gyors beállítás",
  };

  const MAX_TOTAL_EXPOSURE_RATIO = 0.95;
  const MAX_EQUITY_MULTIPLIER_IDLE = 2;
  const MAX_EQUITY_MULTIPLIER_ABSOLUTE = 10;
  const COMMON_HUF_CAPITAL_INPUTS = [10000, 50000, 100000, 200000, 500000, 1000000];

  function clampParam(key, value) {
    const bounds = PARAM_BOUNDS[key];
    if (!bounds) return value;
    const stepped =
      bounds.step > 0
        ? Math.round(value / bounds.step) * bounds.step
        : value;
    return Math.min(bounds.max, Math.max(bounds.min, stepped));
  }

  function createBotUserId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, "");
    return `bot${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }

  function getOrCreateBotUserId() {
    try {
      const existing = localStorage.getItem(BOT_USER_ID_KEY);
      if (existing && /^[a-z0-9-]{16,64}$/i.test(existing)) return existing;
      const created = createBotUserId();
      localStorage.setItem(BOT_USER_ID_KEY, created);
      return created;
    } catch {
      return createBotUserId();
    }
  }

  function getLocalUpdatedAt() {
    try {
      const value = Number(localStorage.getItem(BOT_LOCAL_UPDATED_KEY));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function setLocalUpdatedAt(timestamp = Date.now()) {
    try {
      localStorage.setItem(BOT_LOCAL_UPDATED_KEY, String(timestamp));
    } catch {
      // Ignore storage failures.
    }
  }

  function setCloudSyncStatus(status, error = "") {
    cloudSyncRuntime.status = status;
    cloudSyncRuntime.lastError = error || "";
    if (status === "synced") cloudSyncRuntime.lastSyncedAt = Date.now();
    cloudSyncRuntime.onStatusChange?.({
      status: cloudSyncRuntime.status,
      error: cloudSyncRuntime.lastError,
      lastSyncedAt: cloudSyncRuntime.lastSyncedAt,
      userId: getOrCreateBotUserId(),
    });
  }

  function buildSyncPayload(botState) {
    if (!botState) return null;
    return {
      updatedAt: Date.now(),
      state: {
        config: botState.config,
        trades: botState.trades || [],
        positions: botState.positions || [],
        equityHistory: botState.equityHistory || [],
        learningHistory: botState.learningHistory || [],
        configChangeLog: botState.configChangeLog || [],
        activityLog: botState.activityLog || [],
        performanceStats: botState.performanceStats || {
          eligibleTicks: 0,
          capturedCount: 0,
          missedLog: [],
        },
        initialCapital: botState.initialCapital,
        cash: botState.cash,
        lastActionAt: botState.lastActionAt || {},
        lastActionOutcome: botState.lastActionOutcome || {},
      },
    };
  }

  function applySyncPayload(botState, payload, fxContext = null) {
    if (!botState || !payload?.state) return botState;
    const incoming = payload.state;
    botState.config = { ...DEFAULT_CONFIG, ...incoming.config };
    botState.trades = Array.isArray(incoming.trades) ? incoming.trades : [];
    botState.positions = Array.isArray(incoming.positions) ? incoming.positions : [];
    botState.equityHistory = Array.isArray(incoming.equityHistory) ? incoming.equityHistory : [];
    botState.learningHistory = Array.isArray(incoming.learningHistory) ? incoming.learningHistory : [];
    botState.configChangeLog = Array.isArray(incoming.configChangeLog) ? incoming.configChangeLog : [];
    botState.activityLog = Array.isArray(incoming.activityLog) ? incoming.activityLog : [];
    botState.performanceStats = incoming.performanceStats || botState.performanceStats;
    botState.initialCapital = incoming.initialCapital;
    botState.cash = incoming.cash;
    botState.lastActionAt = incoming.lastActionAt || {};
    botState.lastActionOutcome = incoming.lastActionOutcome || {};
    return reconcileBalanceOnLoad(botState, fxContext);
  }

  function mergeBotStateWithCloud(localState, cloudPayload, fxContext = null) {
    const localUpdatedAt = getLocalUpdatedAt();
    const cloudUpdatedAt = Number(cloudPayload?.updatedAt) || 0;
    if (!cloudPayload?.state) {
      return { state: localState, source: "local", updatedAt: localUpdatedAt };
    }
    if (cloudUpdatedAt > localUpdatedAt) {
      return {
        state: applySyncPayload({ ...localState }, cloudPayload, fxContext),
        source: "cloud",
        updatedAt: cloudUpdatedAt,
      };
    }
    if (localUpdatedAt > cloudUpdatedAt) {
      return { state: localState, source: "local", updatedAt: localUpdatedAt, shouldPush: true };
    }
    const localTradeCount = localState.trades?.length || 0;
    const cloudTradeCount = cloudPayload.state.trades?.length || 0;
    if (cloudTradeCount > localTradeCount) {
      return {
        state: applySyncPayload({ ...localState }, cloudPayload, fxContext),
        source: "cloud",
        updatedAt: cloudUpdatedAt,
      };
    }
    return { state: localState, source: "local", updatedAt: localUpdatedAt, shouldPush: true };
  }

  async function fetchCloudBotState(endpoint, userId) {
    if (!endpoint || !userId) return null;
    try {
      const url = new URL(endpoint);
      url.searchParams.set("userId", userId);
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data?.found) return null;
      return data;
    } catch {
      return null;
    }
  }

  async function pushCloudBotState(endpoint, userId, botState) {
    if (!endpoint || !userId || !botState) return { ok: false };
    const payload = buildSyncPayload(botState);
    if (!payload) return { ok: false };
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, ...payload }),
      });
      if (response.status === 409) {
        const conflict = await response.json().catch(() => ({}));
        return { ok: false, conflict: true, updatedAt: conflict.updatedAt };
      }
      if (!response.ok) return { ok: false };
      const data = await response.json();
      setLocalUpdatedAt(payload.updatedAt);
      return { ok: true, updatedAt: data.updatedAt || payload.updatedAt };
    } catch {
      return { ok: false };
    }
  }

  function scheduleCloudPush(endpoint, botState) {
    if (!endpoint || !botState) return;
    cloudSyncRuntime.endpoint = endpoint;
    if (cloudSyncRuntime.pushTimer) clearTimeout(cloudSyncRuntime.pushTimer);
    cloudSyncRuntime.pushTimer = setTimeout(async () => {
      cloudSyncRuntime.pushTimer = null;
      setCloudSyncStatus("syncing");
      const userId = getOrCreateBotUserId();
      const result = await pushCloudBotState(endpoint, userId, botState);
      if (result.ok) {
        setCloudSyncStatus("synced");
        return;
      }
      if (result.conflict) {
        setCloudSyncStatus("conflict", "A felhőben újabb állapot van.");
        return;
      }
      setCloudSyncStatus("offline", "Nincs kapcsolat – helyi mentés aktív.");
    }, CLOUD_SYNC_DEBOUNCE_MS);
  }

  async function initCloudSync(options = {}) {
    const endpoint = options.endpoint || "";
    const fxContext = options.fxContext || null;
    const onMerged = options.onMerged;
    cloudSyncRuntime.endpoint = endpoint;
    cloudSyncRuntime.onStatusChange = options.onStatusChange || null;

    if (!endpoint || !navigator.onLine) {
      setCloudSyncStatus("offline");
      return { merged: false, source: "local" };
    }

    const userId = getOrCreateBotUserId();
    setCloudSyncStatus("syncing");
    const cloudPayload = await fetchCloudBotState(endpoint, userId);
    const localRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const localState =
      localRaw && typeof localRaw === "object"
        ? restorePersistentDataFallback(localRaw)
        : createBotState();

    const mergeResult = mergeBotStateWithCloud(localState, cloudPayload, fxContext);
    saveBotState(mergeResult.state, { skipCloudPush: true });
    setLocalUpdatedAt(mergeResult.updatedAt || Date.now());

    if (mergeResult.shouldPush || mergeResult.source === "local") {
      const pushResult = await pushCloudBotState(endpoint, userId, mergeResult.state);
      if (pushResult.ok) {
        setCloudSyncStatus("synced");
      } else if (pushResult.conflict) {
        setCloudSyncStatus("conflict", "A felhőben újabb állapot van.");
      } else {
        setCloudSyncStatus("offline", "Nem sikerült feltölteni – helyi mentés aktív.");
      }
    } else {
      setCloudSyncStatus("synced");
    }

    onMerged?.(mergeResult.state, mergeResult);
    return mergeResult;
  }

  function resolveBotSyncEndpoint(aiEndpoint) {
    if (!aiEndpoint || typeof aiEndpoint !== "string") {
      return "https://aurum-satoshi-ai.attila-bekecs.workers.dev/bot-state";
    }
    try {
      const url = new URL(aiEndpoint);
      url.pathname = "/bot-state";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return "https://aurum-satoshi-ai.attila-bekecs.workers.dev/bot-state";
    }
  }

  function createBotState(config = DEFAULT_CONFIG) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    const now = Date.now();
    return {
      config: merged,
      cash: merged.initialCapital,
      initialCapital: merged.initialCapital,
      positions: [],
      trades: [],
      equityHistory: [{ time: now, equity: merged.initialCapital }],
      lastActionAt: {},
      lastActionOutcome: {},
      lastTickAt: null,
      lastScan: null,
      activityLog: [],
      learningHistory: [],
      configChangeLog: [],
      performanceStats: {
        eligibleTicks: 0,
        capturedCount: 0,
        missedLog: [],
      },
    };
  }

  function backupPersistentData(botState) {
    if (!botState) return;
    try {
      if (Array.isArray(botState.trades) && botState.trades.length) {
        localStorage.setItem(STORAGE_KEY_TRADES_BACKUP, JSON.stringify(botState.trades));
      }
      const learningPayload = {
        learningHistory: botState.learningHistory || [],
        configChangeLog: botState.configChangeLog || [],
        activityLog: botState.activityLog || [],
        equityHistory: botState.equityHistory || [],
      };
      if (
        learningPayload.learningHistory.length ||
        learningPayload.configChangeLog.length ||
        learningPayload.equityHistory.length > 1
      ) {
        localStorage.setItem(STORAGE_KEY_LEARNING_BACKUP, JSON.stringify(learningPayload));
      }
    } catch {
      // Ignore storage failures.
    }
  }

  function restorePersistentDataFallback(saved) {
    if (!saved || typeof saved !== "object") return saved;
    try {
      if (!Array.isArray(saved.trades) || !saved.trades.length) {
        const backupTrades = JSON.parse(localStorage.getItem(STORAGE_KEY_TRADES_BACKUP) || "[]");
        if (Array.isArray(backupTrades) && backupTrades.length) {
          saved.trades = backupTrades;
        }
      }
      const backupLearning = JSON.parse(localStorage.getItem(STORAGE_KEY_LEARNING_BACKUP) || "null");
      if (backupLearning && typeof backupLearning === "object") {
        if (!saved.learningHistory?.length && backupLearning.learningHistory?.length) {
          saved.learningHistory = backupLearning.learningHistory;
        }
        if (!saved.configChangeLog?.length && backupLearning.configChangeLog?.length) {
          saved.configChangeLog = backupLearning.configChangeLog;
        }
        if (!saved.activityLog?.length && backupLearning.activityLog?.length) {
          saved.activityLog = backupLearning.activityLog;
        }
        if (
          (!Array.isArray(saved.equityHistory) || saved.equityHistory.length <= 1) &&
          backupLearning.equityHistory?.length > 1
        ) {
          saved.equityHistory = backupLearning.equityHistory;
        }
      }
    } catch {
      // Ignore restore failures.
    }
    return saved;
  }

  function loadBotState(fxContext = null) {
    try {
      let saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") {
        return createBotState();
      }
      saved = restorePersistentDataFallback(saved);
      if (!Number.isFinite(saved.initialCapital) || !Number.isFinite(saved.cash)) {
        return createBotState();
      }
      saved.config = { ...DEFAULT_CONFIG, ...saved.config };
      saved.positions = Array.isArray(saved.positions) ? saved.positions : [];
      saved.trades = Array.isArray(saved.trades) ? saved.trades : [];
      saved.equityHistory = Array.isArray(saved.equityHistory) ? saved.equityHistory : [];
      saved.activityLog = Array.isArray(saved.activityLog) ? saved.activityLog : [];
      saved.learningHistory = Array.isArray(saved.learningHistory) ? saved.learningHistory : [];
      saved.configChangeLog = Array.isArray(saved.configChangeLog) ? saved.configChangeLog : [];
      saved.lastActionAt = saved.lastActionAt || {};
      saved.lastActionOutcome = saved.lastActionOutcome || {};
      saved.performanceStats = saved.performanceStats || {
        eligibleTicks: 0,
        capturedCount: 0,
        missedLog: [],
      };
      return reconcileBalanceOnLoad(saved, fxContext);
    } catch {
      return createBotState();
    }
  }

  function recalculateCashFromTrades(botState) {
    if (!botState) return false;
    const tradePnl = (botState.trades || []).reduce(
      (sum, trade) => sum + (Number.isFinite(trade.pnl) ? trade.pnl : 0),
      0,
    );
    botState.cash = botState.initialCapital + tradePnl;
    if (botState.cash < 0) botState.cash = 0;
    return true;
  }

  function syncCapitalBalanceOnly(botState, options = {}) {
    if (!botState?.config) return false;
    const newCapital = options.newCapital ?? botState.config.initialCapital;
    if (!Number.isFinite(newCapital) || newCapital < 100) return false;

    const fromCapital = botState.cash;
    botState.initialCapital = newCapital;
    if (botState.config) botState.config.initialCapital = newCapital;

    const hasHistory = botState.trades.length > 0 || botState.positions.length > 0;
    if (hasHistory) {
      recalculateCashFromTrades(botState);
    } else {
      botState.cash = newCapital;
      const now = Date.now();
      botState.equityHistory = [{ time: now, equity: newCapital }];
    }

    if (!options.skipLog) {
      logConfigChanges(
        botState,
        options.source || "beállítás",
        [
          {
            key: "initialCapital",
            from: fromCapital,
            to: botState.cash,
            reason: options.reason || "Egyenleg szinkronizálva – ügylet- és tanulási előzmények megmaradtak",
          },
        ],
      );
    } else {
      saveBotState(botState);
    }
    return true;
  }

  function applyCapitalFromConfig(botState, options = {}) {
    if (!botState?.config) return false;
    const newCapital = botState.config.initialCapital;
    if (!Number.isFinite(newCapital) || newCapital < 100) return false;

    const oldCapital = botState.initialCapital;
    const now = Date.now();
    botState.initialCapital = newCapital;
    botState.cash = newCapital;
    botState.positions = [];
    botState.trades = [];
    botState.equityHistory = [{ time: now, equity: newCapital }];
    botState.lastActionAt = {};
    botState.lastActionOutcome = {};

    if (!options.skipLog) {
      logConfigChanges(
        botState,
        options.source || "kézi",
        [
          {
            key: "accountReset",
            from: oldCapital,
            to: newCapital,
            reason: options.reason || "Kezdőtőke mentése – számla újraindítva",
          },
        ],
      );
    } else {
      saveBotState(botState);
    }
    return true;
  }

  function resetCapitalAccount(botState, options = {}) {
    return applyCapitalFromConfig(botState, options);
  }

  function needsFxForCurrency(currency) {
    return currency !== "USD";
  }

  function isFxReadyForCurrency(fxContext, currency) {
    if (!needsFxForCurrency(currency)) return true;
    return Boolean(fxContext?.ratesReady);
  }

  function reconcileCapitalOnLoad(botState) {
    if (!botState?.config) return botState;
    const configCapital = botState.config.initialCapital;
    if (!Number.isFinite(configCapital) || configCapital < 100) return botState;
    if (Math.abs(botState.initialCapital - configCapital) <= 0.01) return botState;

    const idle = botState.positions.length === 0 && botState.trades.length === 0;
    if (idle) {
      botState.initialCapital = configCapital;
      botState.cash = configCapital;
      const now = Date.now();
      botState.equityHistory = [{ time: now, equity: configCapital }];
      return botState;
    }

    botState.initialCapital = configCapital;
    return botState;
  }

  function detectUnconvertedHufCapital(storedUsd, currency, hufRate) {
    if (currency !== "HUF" || !(hufRate > 50) || !(storedUsd >= 1000)) return null;
    for (const hufInput of COMMON_HUF_CAPITAL_INPUTS) {
      if (Math.abs(storedUsd - hufInput) < 1) {
        const corrected = hufInput / hufRate;
        if (corrected >= 50 && corrected < storedUsd / 10) return corrected;
      }
    }
    if (storedUsd >= 50000 && storedUsd % 1000 === 0) {
      const corrected = storedUsd / hufRate;
      if (corrected >= 50 && corrected <= 10000) return corrected;
    }
    return null;
  }

  function scanUnconvertedHufFields(botState, currency, hufRate) {
    if (currency !== "HUF" || !(hufRate > 50)) return null;
    const candidates = [
      { field: "config", value: botState.config?.initialCapital },
      { field: "cash", value: botState.cash },
      { field: "initialCapital", value: botState.initialCapital },
    ];
    for (const candidate of candidates) {
      const corrected = detectUnconvertedHufCapital(candidate.value, currency, hufRate);
      if (corrected !== null) {
        return { field: candidate.field, from: candidate.value, corrected };
      }
    }
    return null;
  }

  function hasMeaningfulClosedGains(botState) {
    const grossWins = botState.trades
      .filter((trade) => trade.pnl > 0)
      .reduce((sum, trade) => sum + trade.pnl, 0);
    return grossWins > botState.initialCapital * 0.05;
  }

  function getMaxAllowedEquity(botState) {
    const initial = botState.initialCapital;
    if (!(initial > 0)) return 0;
    if (!hasMeaningfulClosedGains(botState)) {
      return initial * MAX_EQUITY_MULTIPLIER_IDLE;
    }
    const grossWins = botState.trades
      .filter((trade) => trade.pnl > 0)
      .reduce((sum, trade) => sum + trade.pnl, 0);
    return Math.min(initial * MAX_EQUITY_MULTIPLIER_ABSOLUTE, initial + grossWins * 2);
  }

  function hasRunawayBalance(botState) {
    const initial = botState.initialCapital;
    if (!(initial > 0)) return false;
    const maxCash = getMaxAllowedEquity(botState);
    return botState.cash > maxCash + 0.01;
  }

  function logAutoBalanceFix(botState, reason, fromCapital, toCapital) {
    logConfigChanges(
      botState,
      "beállítás",
      [
        {
          key: "accountReset",
          from: fromCapital,
          to: toCapital,
          reason: `[Auto-javítás] ${reason}`,
        },
      ],
      reason,
    );
    logActivity(botState, `[Auto-javítás] ${reason}`);
  }

  function syncIdleBalanceToConfig(botState) {
    const configCapital = botState.config.initialCapital;
    if (!Number.isFinite(configCapital) || configCapital < 100) return false;
    if (botState.positions.length > 0 || botState.trades.length > 0) return false;
    const cashDrift = Math.abs(botState.cash - configCapital) > 0.01;
    const initialDrift = Math.abs(botState.initialCapital - configCapital) > 0.01;
    if (!cashDrift && !initialDrift) return false;

    const fromCapital = botState.cash;
    botState.initialCapital = configCapital;
    botState.cash = configCapital;
    const now = Date.now();
    if (!botState.equityHistory?.length) {
      botState.equityHistory = [{ time: now, equity: configCapital }];
    } else {
      botState.equityHistory.push({ time: now, equity: configCapital });
      botState.equityHistory = botState.equityHistory.slice(-500);
    }
    logAutoBalanceFix(
      botState,
      "Tétlen számla egyenlege visszaállítva a mentett kezdőtőkére",
      fromCapital,
      configCapital,
    );
    return true;
  }

  function fixHufConversionIssue(botState, hufIssue) {
    const fromCapital = botState.cash;
    if (hufIssue.field === "config") {
      botState.config.initialCapital = hufIssue.corrected;
    }
    if (hufIssue.field === "initialCapital" || hufIssue.field === "config") {
      botState.initialCapital = hufIssue.corrected;
    }
    if (hufIssue.field === "cash") {
      botState.cash = hufIssue.corrected;
    }

    const hasHistory = botState.trades.length > 0 || botState.positions.length > 0;
    if (hasHistory) {
      if (hufIssue.field !== "cash") {
        botState.initialCapital = botState.config.initialCapital;
        recalculateCashFromTrades(botState);
      }
    } else {
      botState.initialCapital = botState.config.initialCapital;
      botState.cash = botState.config.initialCapital;
    }

    logAutoBalanceFix(
      botState,
      `HUF/USD átváltási hiba javítva (${Math.round(hufIssue.from).toLocaleString("hu-HU")} → belső ${Math.round(hufIssue.corrected)} USD) – ügylet-előzmények megmaradtak`,
      fromCapital,
      botState.cash,
    );
    return true;
  }

  function fixRunawayBalance(botState) {
    const fromCapital = botState.cash;
    recalculateCashFromTrades(botState);
    const maxCash = getMaxAllowedEquity(botState);
    if (botState.cash > maxCash + 0.01) {
      botState.cash = maxCash;
    }
    logAutoBalanceFix(
      botState,
      "Inflált készpénz egyenleg korrigálva – ügylet- és tanulási előzmények megmaradtak",
      fromCapital,
      botState.cash,
    );
    return true;
  }

  function validateBalanceState(botState, context = null, fxContext = null) {
    if (!botState?.config) return { repaired: false, botState };

    const currency = fxContext?.resolveCurrency?.(botState.config) ?? "USD";
    if (!isFxReadyForCurrency(fxContext, currency)) {
      botState._balanceReconcilePending = true;
      return { repaired: false, pending: true, botState };
    }
    delete botState._balanceReconcilePending;

    const hufRate = fxContext?.getRate?.("HUF");
    const hufIssue = scanUnconvertedHufFields(botState, currency, hufRate);

    if (hufIssue) {
      fixHufConversionIssue(botState, hufIssue);
      return { repaired: true, botState };
    }

    reconcileCapitalOnLoad(botState);

    if (syncIdleBalanceToConfig(botState)) {
      return { repaired: true, botState };
    }

    if (hasRunawayBalance(botState)) {
      fixRunawayBalance(botState);
      return { repaired: true, botState };
    }

    return { repaired: false, botState };
  }

  function reconcileBalanceOnLoad(botState, fxContext = null) {
    return validateBalanceState(botState, null, fxContext).botState;
  }

  function getTotalExposure(botState) {
    return botState.positions.reduce((sum, position) => {
      if (!(position.entry > 0) || !(position.quantity > 0)) return sum;
      return sum + position.entry * position.quantity;
    }, 0);
  }

  function getAvailableBuyingPower(botState, config, context) {
    const metrics = getMetrics(botState, context);
    const equity = Math.max(0, metrics.equity);
    const maxTotalExposure = equity * MAX_TOTAL_EXPOSURE_RATIO;
    const usedExposure = getTotalExposure(botState);
    return Math.max(0, maxTotalExposure - usedExposure);
  }

  function saveBotState(botState, options = {}) {
    try {
      backupPersistentData(botState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(botState));
      setLocalUpdatedAt(Date.now());
      if (!options.skipCloudPush && cloudSyncRuntime.endpoint) {
        scheduleCloudPush(cloudSyncRuntime.endpoint, botState);
      }
    } catch {
      // Ignore storage failures.
    }
  }

  function getCurrentPrice(assetKey, context) {
    return (
      context.intraday?.[assetKey]?.currentPrice ??
      context.assets?.[assetKey]?.currentPrice ??
      null
    );
  }

  function getSeries(context, assetKey, interval) {
    if (context.getIntradaySeries) {
      return context.getIntradaySeries(assetKey, interval);
    }
    if (interval === undefined || interval === null) {
      return context.intraday?.[assetKey] || null;
    }
    return context.multiTimeframe?.[assetKey]?.[interval] || context.intraday?.[assetKey] || null;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "–";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }

  function analyzeSignal(assetKey, config, context) {
    const interval = config.primaryInterval || 1;
    let intraday = getSeries(context, assetKey, interval);
    if (!intraday?.candles?.length && interval !== 1) {
      intraday = getSeries(context, assetKey, 1);
    }
    if (!intraday?.candles?.length) {
      return context.analyzeIntraday?.(assetKey) || null;
    }

    const indicators = context.indicators || {};
    const emaFn = indicators.ema;
    const rsiFn = indicators.rsi;
    const atrFn = indicators.atr;
    const avgFn = indicators.average;
    if (!emaFn || !rsiFn || !atrFn) {
      return context.analyzeIntraday?.(assetKey) || null;
    }

    const candles = intraday.candles.slice(-180);
    const closes = candles.map((candle) => candle.close);
    const currentPrice = closes.at(-1);
    const emaFast = emaFn(closes, config.fastEma);
    const emaSlow = emaFn(closes, config.slowEma);
    const ema12 = emaFn(closes, 12);
    const ema26 = emaFn(closes, 26);
    const macd = ema12 !== null && ema26 !== null ? ema12 - ema26 : null;
    const rsi = rsiFn(closes, config.rsiPeriod);
    const atr = atrFn(candles, config.atrPeriod);
    const lookback = Math.max(2, config.momentumLookback || 15);
    const momentumBase = closes.at(-(lookback + 1));
    const momentum = momentumBase ? ((currentPrice - momentumBase) / momentumBase) * 100 : null;
    const volumes = candles.map((candle) => candle.volume).filter((volume) => volume > 0);
    const averageVolume = avgFn ? avgFn(volumes.slice(-31, -1)) : null;
    const volumeRatio =
      averageVolume && candles.at(-1).volume > 0 ? candles.at(-1).volume / averageVolume : null;
    const dailyClass = context.assets?.[assetKey]?.analysis?.className;
    const alignment = context.calculateTimeframeAlignment
      ? context.calculateTimeframeAlignment(assetKey)
      : { available: 0, bullish: 0, bearish: 0, bullishRatio: 0, bearishRatio: 0 };

    let score = 0;
    const reasons = [];

    if (emaFast !== null && emaSlow !== null) {
      if (emaFast > emaSlow) {
        score += 1.5;
        reasons.push(`EMA ${config.fastEma} a ${config.slowEma} felett`);
      } else {
        score -= 1.5;
        reasons.push(`EMA ${config.fastEma} a ${config.slowEma} alatt`);
      }
    }

    if (rsi !== null) {
      if (rsi > config.rsiOverbought) {
        score -= 1;
        reasons.push(`RSI túlvett (>${config.rsiOverbought})`);
      } else if (rsi < config.rsiOversold) {
        score += 0.5;
        reasons.push(`RSI túladott (<${config.rsiOversold})`);
      } else if (rsi >= config.rsiLongMin && rsi <= config.rsiLongMax) {
        score += 0.75;
        reasons.push("RSI támogatja a LONG irányt");
      } else if (rsi >= config.rsiShortMin && rsi <= config.rsiShortMax) {
        score -= 0.75;
        reasons.push("RSI támogatja a SHORT irányt");
      } else if (rsi < config.rsiShortMax) {
        score -= 0.5;
        reasons.push("RSI gyenge");
      }
    }

    if (config.useMacd && macd !== null) {
      score += macd >= 0 ? 1 : -1;
      reasons.push(macd >= 0 ? "Pozitív MACD" : "Negatív MACD");
    }

    if (momentum !== null) {
      const threshold = config.momentumThreshold || 0.12;
      if (momentum > threshold) score += 1;
      else if (momentum < -threshold) score -= 1;
      reasons.push(`${lookback} perces lendület: ${formatPercent(momentum)}`);
    }

    if (dailyClass === "positive") {
      score += 1;
      reasons.push("A napi trend pozitív");
    } else if (dailyClass === "negative") {
      score -= 1;
      reasons.push("A napi trend negatív");
    }

    if (alignment.available >= config.minAlignedTimeframes) {
      if (alignment.bullishRatio >= config.minAlignmentRatio) {
        score += 1.25;
        reasons.push(`${alignment.available} idősíkból ${alignment.bullish} emelkedő`);
      } else if (alignment.bearishRatio >= config.minAlignmentRatio) {
        score -= 1.25;
        reasons.push(`${alignment.available} idősíkból ${alignment.bearish} csökkenő`);
      } else {
        reasons.push("Az idősíkok nem mutatnak egységes irányt");
      }
    }

    if (config.useVolume && volumeRatio !== null && volumeRatio > config.volumeMultiplier) {
      const volumeDirection = momentum !== null && momentum >= 0 ? 0.75 : -0.75;
      score += volumeDirection;
      reasons.push(`Átlag feletti forgalom (${volumeRatio.toFixed(2)}×)`);
    } else if (config.useVolume && volumeRatio !== null && volumeRatio < 0.85) {
      score *= 0.85;
      reasons.push("Alacsony forgalom – gyengébb jel");
    }

    const threshold = config.signalScoreThreshold || 3;
    let signal = "KIVÁRÁS";
    let className = "neutral";
    if (score >= threshold) {
      signal = "VÉTELI JEL";
      className = "positive";
    } else if (score <= -threshold) {
      signal = "ELADÁSI JEL";
      className = "negative";
    }

    const ageMinutes = Math.max(0, (Date.now() - intraday.updatedAt) / 60000);
    let confidence = Math.round(Math.min(92, 50 + Math.abs(score) * 8));
    if (ageMinutes > 5) confidence = Math.min(confidence, 42);
    if (config.requireAlignment && alignment.available >= config.minAlignedTimeframes) {
      const alignedRatio =
        className === "positive" ? alignment.bullishRatio : alignment.bearishRatio;
      if (alignedRatio >= config.minAlignmentRatio) confidence = Math.min(92, confidence + 4);
    }

    const hasPlan = className !== "neutral" && atr !== null;
    const isBuy = className === "positive";
    const stopMultiplier = isBuy
      ? config.atrStopMultiplierLong ?? config.atrStopMultiplier ?? 2.5
      : config.atrStopMultiplierShort ?? config.atrStopMultiplier ?? 2.75;
    const stopDistance = atr * stopMultiplier;
    const targetDistance = stopDistance * (config.rewardRatio || 2.5);
    const stop = hasPlan ? currentPrice + (isBuy ? -stopDistance : stopDistance) : null;
    const target = hasPlan ? currentPrice + (isBuy ? targetDistance : -targetDistance) : null;

    return {
      signal,
      className,
      confidence,
      currentPrice,
      momentum15: momentum,
      ema9: emaFast,
      ema21: emaSlow,
      rsi,
      atr,
      stop,
      target,
      riskReward: hasPlan ? config.rewardRatio : null,
      reasons,
      interval,
      alignment,
      score,
      hasIntraday: true,
      dailyClass,
      volumeRatio,
    };
  }

  function detectMarketStructure(candles, lookback = 24) {
    const slice = candles.slice(-lookback);
    if (slice.length < 10) return { structure: "neutral", longBonus: 0, shortBonus: 0 };

    const swingHighs = [];
    const swingLows = [];
    for (let index = 2; index < slice.length - 2; index += 1) {
      const candle = slice[index];
      if (
        candle.high >= slice[index - 1].high &&
        candle.high >= slice[index + 1].high &&
        candle.high >= slice[index - 2].high
      ) {
        swingHighs.push(candle.high);
      }
      if (
        candle.low <= slice[index - 1].low &&
        candle.low <= slice[index + 1].low &&
        candle.low <= slice[index - 2].low
      ) {
        swingLows.push(candle.low);
      }
    }

    if (swingHighs.length < 2 || swingLows.length < 2) {
      return { structure: "neutral", longBonus: 0, shortBonus: 0 };
    }

    const higherHigh = swingHighs.at(-1) > swingHighs.at(-2);
    const higherLow = swingLows.at(-1) > swingLows.at(-2);
    const lowerHigh = swingHighs.at(-1) < swingHighs.at(-2);
    const lowerLow = swingLows.at(-1) < swingLows.at(-2);

    if (higherHigh && higherLow) {
      return { structure: "bullish", longBonus: 14, shortBonus: -8 };
    }
    if (lowerHigh && lowerLow) {
      return { structure: "bearish", longBonus: -8, shortBonus: 14 };
    }
    if (higherHigh || higherLow) {
      return { structure: "bullish-weak", longBonus: 7, shortBonus: -3 };
    }
    if (lowerHigh || lowerLow) {
      return { structure: "bearish-weak", longBonus: -3, shortBonus: 7 };
    }
    return { structure: "neutral", longBonus: 0, shortBonus: 0 };
  }

  function computeAtrPercentile(candles, atr, period, context) {
    if (!candles?.length || !(atr > 0)) return null;
    const atrFn = context?.indicators?.atr;
    if (!atrFn) return null;
    const values = [];
    for (let index = period + 5; index <= candles.length; index += 1) {
      const slice = candles.slice(0, index);
      const value = atrFn(slice, period);
      if (value > 0) values.push(value);
    }
    if (!values.length) return 50;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = sorted.findIndex((value) => value >= atr);
    const percentile = rank < 0 ? 100 : (rank / sorted.length) * 100;
    return Math.round(percentile);
  }

  function findNearestSupportResistance(candles, currentPrice, lookback = 40) {
    const slice = candles.slice(-lookback);
    if (!slice.length || !(currentPrice > 0)) {
      return { support: null, resistance: null, supportDist: null, resistanceDist: null };
    }
    const highs = slice.map((candle) => candle.high);
    const lows = slice.map((candle) => candle.low);
    const resistance = Math.max(...highs);
    const support = Math.min(...lows);
    return {
      support,
      resistance,
      supportDist: ((currentPrice - support) / currentPrice) * 100,
      resistanceDist: ((resistance - currentPrice) / currentPrice) * 100,
    };
  }

  function detectRegime(candles, atr, config, context) {
    if (!candles?.length || !(atr > 0)) return { regime: "unknown", longAdjust: 0, shortAdjust: 0 };
    const closes = candles.map((candle) => candle.close);
    const emaFn = context?.indicators?.ema;
    const fast = emaFn ? emaFn(closes, 9) : null;
    const slow = emaFn ? emaFn(closes, 21) : null;
    const atrPercentile = computeAtrPercentile(candles, atr, config.atrPeriod || 14, context);
    const emaSpread =
      fast !== null && slow !== null && closes.at(-1) > 0
        ? (Math.abs(fast - slow) / closes.at(-1)) * 100
        : 0;

    const deadMarket =
      atrPercentile !== null && atrPercentile < (config.minRegimeAtrPercentile ?? 12);
    const extremeChop =
      atrPercentile !== null && atrPercentile > (config.maxRegimeAtrPercentile ?? 90);

    if (deadMarket) {
      return { regime: "dead", longAdjust: -18, shortAdjust: -18, atrPercentile, emaSpread };
    }
    if (extremeChop) {
      return { regime: "choppy", longAdjust: -10, shortAdjust: -10, atrPercentile, emaSpread };
    }
    if (emaSpread >= 0.35) {
      return { regime: "trending", longAdjust: 6, shortAdjust: 6, atrPercentile, emaSpread };
    }
    return { regime: "ranging", longAdjust: -4, shortAdjust: -4, atrPercentile, emaSpread };
  }

  function getHigherTimeframeBias(assetKey, direction, context, config) {
    const higherIntervals = [15, 60];
    let aligned = 0;
    let available = 0;
    const indicators = context.indicators || {};
    const emaFn = indicators.ema;
    if (!emaFn) return { aligned: false, ratio: 0, bonus: 0 };

    higherIntervals.forEach((interval) => {
      const series = getSeries(context, assetKey, interval);
      if (!series?.candles?.length) return;
      const closes = series.candles.map((candle) => candle.close);
      const fast = emaFn(closes, config.fastEma);
      const slow = emaFn(closes, config.slowEma);
      if (fast === null || slow === null) return;
      available += 1;
      const bullish = fast > slow;
      if ((direction === "long" && bullish) || (direction === "short" && !bullish)) {
        aligned += 1;
      }
    });

    const ratio = available ? aligned / available : 0;
    const bonus = ratio >= 1 ? 12 : ratio >= 0.5 ? 5 : -10;
    return { aligned: ratio >= 0.5, ratio, bonus, available };
  }

  function getDirectionLearningAdjustment(botState, assetKey, direction) {
    if (!botState?.trades?.length) return 0;
    const recent = botState.trades
      .filter((trade) => trade.asset === assetKey && trade.direction === direction)
      .slice(0, 6);
    if (recent.length < 2) return 0;
    const wins = recent.filter((trade) => trade.pnl > 0).length;
    const winRate = wins / recent.length;
    if (winRate >= 0.67) return 6;
    if (winRate <= 0.33) return -10;
    return 0;
  }

  function resolveEntryReadiness(score, config) {
    const ready = config.entryQualityReadyThreshold ?? 62;
    const wait = config.entryQualityWaitThreshold ?? 42;
    if (score >= ready) return "KÉSZ";
    if (score >= wait) return "VÁR";
    return "ROSSZ";
  }

  function passesEntryQualityGate(entryQuality, direction, config, opportunityScore = 0) {
    if (!entryQuality) return { pass: false, reason: "Nincs belépési minőség elemzés" };
    const minQuality = config.minEntryQualityScore ?? 62;
    const minOpportunity = config.minOpportunityScore || 65;
    const activeReadiness =
      direction === "short" ? entryQuality.shortReadiness : entryQuality.longReadiness;
    const activeScore = direction === "short" ? entryQuality.shortScore : entryQuality.longScore;
    const blocks = entryQuality.blocks?.[direction] || [];

    if (blocks.length) {
      return { pass: false, reason: blocks[0] };
    }
    if (activeScore < minQuality) {
      return {
        pass: false,
        reason: `Belépési minőség alacsony (${activeScore} < ${minQuality})`,
      };
    }
    if (activeReadiness === "KÉSZ") {
      return { pass: true, readiness: activeReadiness, score: activeScore };
    }
    if (activeReadiness === "VÁR") {
      const strongWait =
        activeScore >= minQuality + 3 &&
        opportunityScore >= minOpportunity + 8 &&
        blocks.length === 0;
      if (strongWait) {
        return {
          pass: true,
          readiness: activeReadiness,
          score: activeScore,
          waitOverride: true,
        };
      }
      return { pass: false, reason: `Setup kialakul – várakozás (${activeScore} pt)` };
    }
    return { pass: false, reason: `Belépési minőség rossz (${activeScore} pt)` };
  }

  function analyzeEntryQuality(assetKey, direction, decision, config, context, botState = null) {
    const interval = config.primaryInterval || 5;
    let intraday = getSeries(context, assetKey, interval);
    if (!intraday?.candles?.length && interval !== 1) {
      intraday = getSeries(context, assetKey, 1);
    }
    const candles = intraday?.candles?.slice(-120) || [];
    const currentPrice = decision?.currentPrice ?? candles.at(-1)?.close ?? null;
    const reasons = { long: [], short: [] };
    const blocks = { long: [], short: [] };

    let longScore = 50;
    let shortScore = 50;

    if (!decision || !candles.length || !(currentPrice > 0)) {
      return {
        longScore: 0,
        shortScore: 0,
        readiness: "ROSSZ",
        longReadiness: "ROSSZ",
        shortReadiness: "ROSSZ",
        regime: "unknown",
        reasons: { long: ["Nincs elég adat"], short: ["Nincs elég adat"] },
        blocks: { long: [], short: [] },
        direction,
      };
    }

    const structure = detectMarketStructure(candles);
    longScore += structure.longBonus;
    shortScore += structure.shortBonus;
    if (structure.structure === "bullish") reasons.long.push("Emelkedő piaci struktúra (HH/HL)");
    if (structure.structure === "bearish") reasons.short.push("Csökkenő piaci struktúra (LH/LL)");

    const regime = detectRegime(candles, decision.atr, config, context);
    longScore += regime.longAdjust;
    shortScore += regime.shortAdjust;
    if (regime.regime === "trending") {
      reasons.long.push("Trendelő piac");
      reasons.short.push("Trendelő piac");
    } else if (regime.regime === "ranging") {
      reasons.long.push("Oldalazó piac – óvatosabb belépés");
      reasons.short.push("Oldalazó piac – óvatosabb belépés");
    } else if (regime.regime === "dead") {
      blocks.long.push("Halott piac – alacsony volatilitás");
      blocks.short.push("Halott piac – alacsony volatilitás");
    } else if (regime.regime === "choppy") {
      blocks.long.push("Extrém zajos piac");
      blocks.short.push("Extrém zajos piac");
    }

    const longHtf = getHigherTimeframeBias(assetKey, "long", context, config);
    const shortHtf = getHigherTimeframeBias(assetKey, "short", context, config);
    longScore += longHtf.bonus;
    shortScore += shortHtf.bonus;
    if (longHtf.aligned) reasons.long.push("Magasabb idősíkok LONG irányban");
    else if (longHtf.available) blocks.long.push("Magasabb idősík ellen LONG-nak");
    if (shortHtf.aligned) reasons.short.push("Magasabb idősíkok SHORT irányban");
    else if (shortHtf.available) blocks.short.push("Magasabb idősík ellen SHORT-nak");

    if (decision.alignment?.available >= config.minAlignedTimeframes) {
      if (decision.alignment.bullishRatio >= config.minAlignmentRatio) {
        longScore += 10;
        reasons.long.push(`${decision.alignment.bullish} idősík emelkedő`);
      }
      if (decision.alignment.bearishRatio >= config.minAlignmentRatio) {
        shortScore += 10;
        reasons.short.push(`${decision.alignment.bearish} idősík csökkenő`);
      }
    }

    if (config.useVolume && decision.volumeRatio !== null) {
      if (decision.volumeRatio >= config.volumeMultiplier) {
        if (decision.momentum15 > 0) {
          longScore += 8;
          reasons.long.push(`Átlag feletti volumen (${decision.volumeRatio.toFixed(2)}×)`);
        }
        if (decision.momentum15 < 0) {
          shortScore += 8;
          reasons.short.push(`Átlag feletti volumen (${decision.volumeRatio.toFixed(2)}×)`);
        }
      } else if (decision.volumeRatio < 0.85) {
        longScore -= 6;
        shortScore -= 6;
        reasons.long.push("Gyenge volumen");
        reasons.short.push("Gyenge volumen");
      }
    }

    if (decision.rsi !== null) {
      if (decision.rsi >= config.rsiLongMin && decision.rsi <= config.rsiLongMax) {
        longScore += 8;
        reasons.long.push(`RSI lendület zóna (${decision.rsi.toFixed(0)})`);
      } else if (decision.rsi > config.rsiOverbought) {
        longScore -= 14;
        blocks.long.push("RSI túlvett – kifulladt LONG momentum");
      } else if (decision.rsi < config.rsiOversold) {
        shortScore -= 14;
        blocks.short.push("RSI túladott – kifulladt SHORT momentum");
      }
      if (decision.rsi >= config.rsiShortMin && decision.rsi <= config.rsiShortMax) {
        shortScore += 8;
        reasons.short.push(`RSI lendület zóna (${decision.rsi.toFixed(0)})`);
      }
    }

    const sr = findNearestSupportResistance(candles, currentPrice);
    const srBlock = (config.srProximityBlockPercent ?? 0.35) / 100 * currentPrice;
    if (sr.resistance !== null && sr.resistance - currentPrice < srBlock) {
      longScore -= 12;
      blocks.long.push("Ellenállás közelében – LONG kockázatos");
    } else if (sr.resistanceDist !== null && sr.resistanceDist > 0.8) {
      longScore += 4;
      reasons.long.push("Távol az ellenállástól");
    }
    if (sr.support !== null && currentPrice - sr.support < srBlock) {
      shortScore -= 12;
      blocks.short.push("Támasz közelében – SHORT kockázatos");
    } else if (sr.supportDist !== null && sr.supportDist > 0.8) {
      shortScore += 4;
      reasons.short.push("Távol a támasztól");
    }

    if (decision.momentum15 !== null) {
      const longMomMin = config.longMomentumMin ?? config.momentumThreshold;
      const shortMomMin = config.shortMomentumMin ?? config.momentumThreshold;
      if (decision.momentum15 >= longMomMin) {
        longScore += 6;
        reasons.long.push(`Pozitív momentum (${formatPercent(decision.momentum15)})`);
      } else if (decision.momentum15 < longMomMin * 0.5) {
        longScore -= 5;
      }
      if (decision.momentum15 <= -shortMomMin) {
        shortScore += 6;
        reasons.short.push(`Negatív momentum (${formatPercent(decision.momentum15)})`);
      } else if (decision.momentum15 > -shortMomMin * 0.5) {
        shortScore -= 5;
      }
    }

    if (botState) {
      const longLearn = getDirectionLearningAdjustment(botState, assetKey, "long");
      const shortLearn = getDirectionLearningAdjustment(botState, assetKey, "short");
      longScore += longLearn;
      shortScore += shortLearn;
      if (longLearn < 0) blocks.long.push("Korábbi LONG veszteségek az eszközön");
      if (shortLearn < 0) blocks.short.push("Korábbi SHORT veszteségek az eszközön");
      if (longLearn > 0) reasons.long.push("Jó LONG előzmények");
      if (shortLearn > 0) reasons.short.push("Jó SHORT előzmények");
    }

    longScore = Math.round(Math.min(100, Math.max(0, longScore)));
    shortScore = Math.round(Math.min(100, Math.max(0, shortScore)));

    const longReadiness = resolveEntryReadiness(longScore, config);
    const shortReadiness = resolveEntryReadiness(shortScore, config);
    const activeScore = direction === "short" ? shortScore : longScore;
    const readiness = direction === "short" ? shortReadiness : longReadiness;

    return {
      longScore,
      shortScore,
      readiness,
      longReadiness,
      shortReadiness,
      regime: regime.regime,
      atrPercentile: regime.atrPercentile,
      structure: structure.structure,
      reasons,
      blocks,
      direction,
      activeScore,
      sr,
    };
  }

  function logHoldSellDecision(botState, position, analysis, trigger) {
    if (!botState || !position || !analysis) return;
    const assetName = window.AssetCatalog?.getName(position.asset) || position.asset;
    const verdict = analysis.shouldClose ? "ELADÁS" : "TARTÁS";
    const message = `${assetName} ${position.direction.toUpperCase()}: ${verdict} (${trigger}) – tartás ${analysis.holdScore} vs eladás ${analysis.sellScore}`;
    logActivity(botState, message);
    botState.configChangeLog = botState.configChangeLog || [];
    botState.configChangeLog.unshift({
      time: Date.now(),
      source: "pro mód",
      key: "holdVsExit",
      label: "Tartás vs eladás",
      from: analysis.holdScore,
      to: analysis.sellScore,
      reason: `${verdict}: ${message} · ${[...(analysis.holdReasons || []), ...(analysis.sellReasons || [])].slice(0, 4).join(" · ")}`,
    });
    botState.configChangeLog = botState.configChangeLog.slice(0, 200);
  }

  function analyzeHoldVsExit(position, decision, config, context, currentPrice, options = {}) {
    const holdReasons = [];
    const sellReasons = [];
    let holdScore = 0;
    let sellScore = 0;
    const now = Date.now();
    const minHoldMs = (config.minHoldMinutes ?? 15) * 60000;
    const timeInTrade = now - (position.openedAt || now);
    const riskUnit = getPositionRiskUnit(position);
    const unrealizedR =
      riskUnit > 0
        ? position.direction === "long"
          ? (currentPrice - position.entry) / riskUnit
          : (position.entry - currentPrice) / riskUnit
        : 0;
    const rewardR = config.rewardRatio ?? 2.5;
    const minSell = config.minSellUrgencyScore ?? 55;

    if (timeInTrade < minHoldMs) {
      holdScore += 22;
      holdReasons.push(`Min. tartási idő (${Math.ceil((minHoldMs - timeInTrade) / 60000)} perc hátra)`);
    }

    const htfBias = getHigherTimeframeBias(
      position.asset,
      position.direction,
      context,
      config,
    );
    if (htfBias.aligned) {
      holdScore += 18;
      holdReasons.push("Magasabb idősík trend érintetlen");
    } else if (htfBias.available) {
      sellScore += 14;
      sellReasons.push("Magasabb idősík trend megtört");
    }

    if (unrealizedR > 0 && unrealizedR < rewardR * 0.85) {
      holdScore += 16;
      holdReasons.push(`Cél R még nem teljesült (${unrealizedR.toFixed(2)}R / ${rewardR}R)`);
    }
    if (unrealizedR >= rewardR * 0.85) {
      sellScore += 12;
      sellReasons.push("Közel a cél R-hez – profitvédelem");
    }

    if (position.trailingActive) {
      holdScore += 10;
      holdReasons.push("Követő stop aktív – trend védve");
    }

    if (unrealizedR >= (config.breakevenAfterR ?? 1) && position.stop >= position.entry && position.direction === "long") {
      holdScore += 8;
      holdReasons.push("Breakeven stop – kockázat nullázva");
    }
    if (unrealizedR >= (config.breakevenAfterR ?? 1) && position.stop <= position.entry && position.direction === "short") {
      holdScore += 8;
      holdReasons.push("Breakeven stop – kockázat nullázva");
    }

    if (decision) {
      const oppositeSignal =
        (position.direction === "long" && decision.className === "negative") ||
        (position.direction === "short" && decision.className === "positive");
      if (oppositeSignal) {
        const reversalConfidence = config.reversalMinConfidence ?? 72;
        const reversalScore = config.reversalMinScore ?? 3;
        const signalStrength = Math.abs(decision.score || 0);
        if (decision.confidence >= reversalConfidence && signalStrength >= reversalScore) {
          sellScore += 20;
          sellReasons.push(`Erős ellentétes jel (${decision.confidence}%, ${signalStrength.toFixed(1)})`);
        } else {
          holdScore += 14;
          holdReasons.push("Gyenge ellentétes jel – egy gyertya nem elég");
        }
      } else if (decision.className === (position.direction === "long" ? "positive" : "negative")) {
        holdScore += 12;
        holdReasons.push("Az irány továbbra is támogatott");
      }
    }

    if (options.staleCheck) {
      if (htfBias.aligned && unrealizedR >= 0) {
        holdScore += 10;
        holdReasons.push("Elavult pozíció, de trend él – várakozás");
      } else if (!htfBias.aligned || unrealizedR < 0) {
        sellScore += 18;
        sellReasons.push("Elavult pozíció trendtöréssel");
      }
    }

    if (unrealizedR < -0.5 && !position.trailingActive) {
      sellScore += 8;
      sellReasons.push("Mélyebb veszteség – stop közelít");
    }

    const shouldClose =
      sellScore > holdScore && sellScore >= minSell && (options.forceClose || sellScore - holdScore >= 8);
    let closeReason = "Jelzésfordulás";
    if (options.staleCheck) closeReason = "Trend megszakadt (időlimit)";
    if (unrealizedR >= rewardR) closeReason = "Cél R elérve (pro)";
    if (sellReasons.some((reason) => reason.includes("Erős ellentétes"))) closeReason = "Jelzésfordulás (pro)";

    return {
      holdScore: Math.round(holdScore),
      sellScore: Math.round(sellScore),
      shouldClose,
      holdReasons,
      sellReasons,
      unrealizedR,
      closeReason,
      timeInTradeMinutes: Math.round(timeInTrade / 60000),
    };
  }

  function formatPrice(value, context) {
    if (context?.formatBotPrice) return context.formatBotPrice(value);
    return `$${value.toFixed(2)}`;
  }

  function isWithinTradingHours(config) {
    if (!config.useTradingHours) return true;
    const hour = new Date().getHours();
    const start = config.tradingHoursStart ?? 8;
    const end = config.tradingHoursEnd ?? 20;
    if (start <= end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  function calcExecutionCosts(entry, exit, quantity, config) {
    const feeRate = (config.feePercent || 0.1) / 100;
    const spreadRate = (config.spreadPercent || 0.02) / 100;
    const slipRate = (config.slippagePercent || 0.01) / 100;
    const notional = (entry + exit) * quantity;
    return notional * (feeRate * 2 + spreadRate + slipRate * 2);
  }

  function applySlippage(price, direction, isEntry, config) {
    const slip = (config.slippagePercent || 0.01) / 100;
    if (isEntry) {
      return direction === "long" ? price * (1 + slip) : price * (1 - slip);
    }
    return direction === "long" ? price * (1 - slip) : price * (1 + slip);
  }

  function calculateMaxDrawdown(values) {
    if (!values.length) return 0;
    let peak = values[0];
    let maxDrawdown = 0;
    values.forEach((value) => {
      peak = Math.max(peak, value);
      if (peak > 0) maxDrawdown = Math.max(maxDrawdown, ((peak - value) / peak) * 100);
    });
    return maxDrawdown;
  }

  function getMetrics(botState, context) {
    const openPnl = botState.positions.reduce((sum, position) => {
      const price = getCurrentPrice(position.asset, context);
      if (!Number.isFinite(price)) return sum;
      const multiplier = position.direction === "long" ? 1 : -1;
      return sum + (price - position.entry) * position.quantity * multiplier;
    }, 0);
    const equity = botState.cash + openPnl;
    const wins = botState.trades.filter((trade) => trade.pnl > 0);
    const losses = botState.trades.filter((trade) => trade.pnl < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    const winRate = botState.trades.length ? (wins.length / botState.trades.length) * 100 : null;
    const profitFactor = grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;
    const equityValues = [...botState.equityHistory.map((point) => point.equity), equity];
    const avgWin = wins.length ? grossProfit / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;
    const performance = getPerformanceMetrics(botState);
    return {
      equity,
      openPnl,
      realizedPnl: botState.cash - botState.initialCapital,
      winRate,
      profitFactor,
      maxDrawdown: calculateMaxDrawdown(equityValues),
      tradeCount: botState.trades.length,
      openCount: botState.positions.length,
      avgWin,
      avgLoss,
      wins: wins.length,
      losses: losses.length,
      tradesPerHour: performance.tradesPerHour,
      opportunityCaptureRate: performance.opportunityCaptureRate,
      missedOpportunities: performance.missedOpportunities,
    };
  }

  function recordEquity(botState, context, time = Date.now()) {
    const metrics = getMetrics(botState, context);
    const last = botState.equityHistory.at(-1);
    const point = { time, equity: metrics.equity };
    if (last && time - last.time < 60000) {
      botState.equityHistory[botState.equityHistory.length - 1] = point;
    } else {
      botState.equityHistory.push(point);
    }
    botState.equityHistory = botState.equityHistory.slice(-500);
  }

  function logActivity(botState, message) {
    botState.activityLog.unshift({ time: Date.now(), message });
    botState.activityLog = botState.activityLog.slice(0, 80);
  }

  function getEffectiveThresholds(config) {
    if (!config.professionalMode) {
      return {
        minConfidence: config.minConfidence,
        signalScoreThreshold: config.signalScoreThreshold,
      };
    }
    return {
      minConfidence: Math.max(config.proMinConfidenceFloor || 55, config.minConfidence),
      signalScoreThreshold: config.signalScoreThreshold,
    };
  }

  function getDailyRealizedPnl(botState) {
    const dayStart = Date.now() - 86400000;
    return botState.trades
      .filter((trade) => trade.closedAt > dayStart)
      .reduce((sum, trade) => sum + (Number.isFinite(trade.pnl) ? trade.pnl : 0), 0);
  }

  function isDailyLossLimitHit(botState, config) {
    const limit = config.maxDailyLossPercent;
    if (!(limit > 0)) return false;
    const dailyPnl = getDailyRealizedPnl(botState);
    const maxLoss = botState.initialCapital * (limit / 100);
    return dailyPnl < 0 && Math.abs(dailyPnl) >= maxLoss;
  }

  function getAssetLearningPenalty(botState, assetKey) {
    const recentTrades = botState.trades.filter((trade) => trade.asset === assetKey).slice(0, 8);
    if (recentTrades.length < 3) return 0;
    const losses = recentTrades.filter((trade) => trade.pnl < 0).length;
    const lossRatio = losses / recentTrades.length;
    if (lossRatio >= 0.75) return 20;
    if (lossRatio >= 0.6) return 12;
    if (lossRatio >= 0.5) return 6;
    return 0;
  }

  function passesDailyTrendFilter(direction, dailyClass, config) {
    if (!config.blockAgainstDailyTrend || !dailyClass) return true;
    if (direction === "long") return dailyClass !== "negative";
    if (direction === "short") return dailyClass !== "positive";
    return true;
  }

  function passesDirectionalEntryFilters(direction, decision, config) {
    if (!decision || decision.className === "neutral") return false;
    const momentum = decision.momentum15;
    const rsi = decision.rsi;
    const volumeConfirmed =
      !config.useVolume ||
      (decision.reasons || []).some((reason) => reason.includes("forgalom"));

    if (direction === "long") {
      const momentumMin = config.longMomentumMin ?? config.momentumThreshold;
      if (momentum === null || momentum < momentumMin) return false;
      if (rsi === null || rsi < config.rsiLongMin || rsi > config.rsiLongMax) return false;
      if (config.useMacd && decision.ema9 !== null && decision.ema21 !== null && decision.ema9 <= decision.ema21) {
        return false;
      }
      return volumeConfirmed;
    }

    const momentumMin = config.shortMomentumMin ?? config.momentumThreshold;
    if (momentum === null || momentum > -momentumMin) return false;
    if (rsi === null || rsi < config.rsiShortMin || rsi > config.rsiShortMax) return false;
    if (config.useMacd && decision.ema9 !== null && decision.ema21 !== null && decision.ema9 >= decision.ema21) {
      return false;
    }
    return volumeConfirmed;
  }

  function getBotTickIntervalMs(config) {
    if (!config.enabled) return 60000;
    if (!config.professionalMode) return 60000;
    if (config.marketWideMode) return 15000;
    return 30000;
  }

  function getCooldownStatus(config, botState, assetKey, now, opportunityScore = 0) {
    const lastAction = botState.lastActionAt[assetKey] || 0;
    const lastOutcome = botState.lastActionOutcome?.[assetKey];

    if (!config.professionalMode) {
      const cooldownMs = config.cooldownMinutes * 60000;
      const remaining = cooldownMs - (now - lastAction);
      if (remaining > 0) {
        return {
          blocked: true,
          remainingMs: remaining,
          reason: "cooldown",
          detail: `Cooldown: ${Math.ceil(remaining / 60000)} perc hátra`,
        };
      }
      return { blocked: false, reason: "ready" };
    }

    if (lastOutcome?.outcome === "loss") {
      const cooldownMs = config.cooldownMinutes * 60000;
      const remaining = cooldownMs - (now - lastOutcome.time);
      if (remaining > 0) {
        return {
          blocked: true,
          remainingMs: remaining,
          reason: "loss-cooldown",
          detail: `Vesztes ügylet után pihenő: ${Math.ceil(remaining / 60000)} perc hátra`,
        };
      }
    }

    if (lastOutcome?.outcome === "win") {
      if (opportunityScore >= (config.proHighScoreThreshold || 75)) {
        return {
          blocked: false,
          reason: "pro-immediate",
          detail: "Magas pontszámú lehetőség – azonnali belépés nyertes után",
        };
      }
      const winCooldownMs = (config.proWinCooldownMinutes || 2) * 60000;
      const remaining = winCooldownMs - (now - lastOutcome.time);
      if (remaining > 0) {
        return {
          blocked: true,
          remainingMs: remaining,
          reason: "win-short-cooldown",
          detail: `Rövid pihenő nyertes után: ${Math.ceil(remaining / 1000)} mp hátra`,
        };
      }
      return { blocked: false, reason: "pro-win-cleared", detail: "Nyertes után – kész új belépésre" };
    }

    if (now - lastAction < 30000 && lastAction > 0) {
      const remaining = 30000 - (now - lastAction);
      return {
        blocked: true,
        remainingMs: remaining,
        reason: "min-gap",
        detail: "Minimális várakozás az utolsó művelet után",
      };
    }

    return { blocked: false, reason: "pro-ready", detail: "Pro mód – kész kereskedésre" };
  }

  function recordMissedOpportunity(botState, opportunity, reason, detail) {
    if (!botState.performanceStats) {
      botState.performanceStats = { eligibleTicks: 0, capturedCount: 0, missedLog: [] };
    }
    const entry = {
      time: Date.now(),
      assetKey: opportunity.assetKey,
      assetName: opportunity.assetName,
      opportunityScore: opportunity.opportunityScore,
      signal: opportunity.signal,
      confidence: opportunity.confidence,
      reason,
      detail,
    };
    botState.performanceStats.missedLog = [entry, ...(botState.performanceStats.missedLog || [])].slice(0, 25);
  }

  function getPerformanceMetrics(botState) {
    const hourAgo = Date.now() - 3600000;
    const tradesLastHour = botState.trades.filter((trade) => trade.closedAt > hourAgo).length;
    const stats = botState.performanceStats || { eligibleTicks: 0, capturedCount: 0, missedLog: [] };
    const captureRate =
      stats.eligibleTicks > 0 ? (stats.capturedCount / stats.eligibleTicks) * 100 : null;
    return {
      tradesPerHour: tradesLastHour,
      opportunityCaptureRate: captureRate,
      missedOpportunities: stats.missedLog || [],
      eligibleTicks: stats.eligibleTicks,
      capturedCount: stats.capturedCount,
    };
  }

  function canOpen(assetKey, botState, now, opportunityScore = 0) {
    if (botState.positions.length >= botState.config.maxPositions) return false;
    if (botState.positions.some((position) => position.asset === assetKey)) return false;
    const status = getCooldownStatus(botState.config, botState, assetKey, now, opportunityScore);
    return !status.blocked;
  }

  function calculatePositionSize(botState, entry, stop, config, context) {
    const unitRisk = Math.abs(entry - stop);
    if (!(unitRisk > 0) || !(entry > 0)) return 0;

    const metrics = getMetrics(botState, context);
    const equity = Math.max(0, metrics.equity);
    if (!(equity > 0)) return 0;

    const desiredRisk = equity * (config.riskPercent / 100);
    const feeBuffer = entry * ((config.feePercent || 0.1) / 100);
    let quantity = desiredRisk / (unitRisk + feeBuffer);

    const maxPositions = Math.max(1, config.maxPositions || 1);
    const maxSingleNotional = (equity * MAX_TOTAL_EXPOSURE_RATIO) / maxPositions;
    quantity = Math.min(quantity, maxSingleNotional / entry);

    const availableNotional = getAvailableBuyingPower(botState, config, context);
    quantity = Math.min(quantity, availableNotional / entry);

    quantity = Math.min(quantity, equity / entry);

    return Math.max(0, quantity);
  }

  function passesAlignment(direction, decision, config) {
    if (!config.requireAlignment) return true;
    const alignment = decision.alignment;
    if (!alignment || alignment.available < config.minAlignedTimeframes) return false;
    if (direction === "long") return alignment.bullishRatio >= config.minAlignmentRatio;
    return alignment.bearishRatio >= config.minAlignmentRatio;
  }

  function passesDirection(direction, config) {
    if (config.direction === "both") return true;
    return config.direction === direction;
  }

  function getScanAssetKeys(config, botState) {
    const positionAssets = botState.positions.map((position) => position.asset);
    if (config.marketWideMode) {
      const allKeys = window.AssetCatalog?.ALL_KEYS || config.assets;
      return [...new Set([...allKeys, ...positionAssets])];
    }
    return [...new Set([...config.assets, ...positionAssets])];
  }

  function getTradeableAssetKeys(config) {
    if (config.marketWideMode) {
      return window.AssetCatalog?.ALL_KEYS || config.assets;
    }
    return config.assets;
  }

  function compareOpportunityResults(a, b) {
    if (b.opportunityScore !== a.opportunityScore) {
      return b.opportunityScore - a.opportunityScore;
    }
    const aEntry =
      a.entryQuality?.activeScore ??
      (a.direction === "long" ? a.entryQuality?.longScore : a.entryQuality?.shortScore) ??
      0;
    const bEntry =
      b.entryQuality?.activeScore ??
      (b.direction === "long" ? b.entryQuality?.longScore : b.entryQuality?.shortScore) ??
      0;
    if (bEntry !== aEntry) return bEntry - aEntry;
    if (a.eligible !== b.eligible) {
      return a.eligible ? -1 : 1;
    }
    const confidenceDiff = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (confidenceDiff !== 0) return confidenceDiff;
    return Math.abs(b.score ?? 0) - Math.abs(a.score ?? 0);
  }

  function computeOpportunityScore(decision, config, botState = null, assetKey = null) {
    if (!decision || decision.className === "neutral") {
      return {
        total: 0,
        confidence: 0,
        signalStrength: 0,
        alignmentBonus: 0,
        momentumBonus: 0,
        rsiBonus: 0,
        learningPenalty: 0,
      };
    }

    const confidence = decision.confidence || 0;
    const signalStrength = Math.abs(decision.score || 0) * 5;
    let alignmentBonus = 0;
    if (decision.alignment?.available >= config.minAlignedTimeframes) {
      const ratio =
        decision.className === "positive"
          ? decision.alignment.bullishRatio
          : decision.alignment.bearishRatio;
      alignmentBonus = ratio * 15;
    }
    let momentumBonus = 0;
    if (decision.momentum15 !== null) {
      momentumBonus = Math.min(10, Math.abs(decision.momentum15) * 2);
    }
    let rsiBonus = 0;
    if (decision.rsi !== null) {
      if (
        decision.className === "positive" &&
        decision.rsi >= config.rsiLongMin &&
        decision.rsi <= config.rsiLongMax
      ) {
        rsiBonus = 8;
      } else if (
        decision.className === "negative" &&
        decision.rsi >= config.rsiShortMin &&
        decision.rsi <= config.rsiShortMax
      ) {
        rsiBonus = 8;
      }
    }
    const learningPenalty =
      botState && assetKey ? getAssetLearningPenalty(botState, assetKey) : 0;
    const total =
      confidence + signalStrength + alignmentBonus + momentumBonus + rsiBonus - learningPenalty;
    return {
      total,
      confidence,
      signalStrength,
      alignmentBonus,
      momentumBonus,
      rsiBonus,
      learningPenalty,
    };
  }

  function evaluateOpportunity(assetKey, decision, config, botState, now, context = null) {
    const assetName = window.AssetCatalog?.getName(assetKey) || assetKey;
    const scoreBreakdown = computeOpportunityScore(decision, config, botState, assetKey);
    const thresholds = getEffectiveThresholds(config);
    const filterReasons = [];
    const direction =
      decision?.className === "positive"
        ? "long"
        : decision?.className === "negative"
          ? "short"
          : null;
    const entryQuality =
      decision && context
        ? analyzeEntryQuality(
            assetKey,
            direction || "long",
            decision,
            config,
            context,
            botState,
          )
        : null;

    if (!decision) {
      filterReasons.push("Nincs elérhető piaci adat");
    } else if (decision.className === "neutral") {
      filterReasons.push("Semleges jelzés – küszöb alatt");
    } else if (decision.confidence < thresholds.minConfidence) {
      filterReasons.push(
        `Alacsony bizalom (${decision.confidence}% < ${thresholds.minConfidence}%)`,
      );
    } else if (
      Math.abs(decision.score || 0) < thresholds.signalScoreThreshold &&
      decision.className !== "neutral"
    ) {
      filterReasons.push(
        `Jelzéserősség alacsony (${Math.abs(decision.score || 0).toFixed(2)} < ${thresholds.signalScoreThreshold})`,
      );
    } else if (scoreBreakdown.total < (config.minOpportunityScore || 65)) {
      filterReasons.push(
        `Lehetőség pontszám alacsony (${scoreBreakdown.total.toFixed(0)} < ${config.minOpportunityScore || 65})`,
      );
    }

    if (decision && decision.className !== "neutral") {
      const direction = decision.className === "positive" ? "long" : "short";
      if (!passesDirection(direction, config)) {
        filterReasons.push(`Irány szűrő (${config.direction}) kizárja a ${direction.toUpperCase()} setupot`);
      }
      if (!passesAlignment(direction, decision, config)) {
        filterReasons.push("Idősík-egyezés nem teljesül");
      }
      if (!passesDailyTrendFilter(direction, decision.dailyClass, config)) {
        filterReasons.push("Napi trend ellen – belépés tiltva");
      }
      if (!passesDirectionalEntryFilters(direction, decision, config)) {
        filterReasons.push(
          direction === "long"
            ? "LONG szűrők nem teljesülnek (RSI/momentum/MACD/volumen)"
            : "SHORT szűrők nem teljesülnek (RSI/momentum/MACD/volumen)",
        );
      }
      if (scoreBreakdown.learningPenalty >= 12) {
        filterReasons.push("Korábbi vesztes minták – eszköz büntetve");
      }
      if (entryQuality) {
        const qualityGate = passesEntryQualityGate(
          entryQuality,
          direction,
          config,
          scoreBreakdown.total,
        );
        if (!qualityGate.pass) {
          filterReasons.push(qualityGate.reason);
        }
      }
      if (!(decision.stop > 0) || !(decision.target > 0) || !(decision.currentPrice > 0)) {
        filterReasons.push("Hiányzó stop/cél/ár adat");
      }
    }

    if (!config.enabled) filterReasons.push("Bot kikapcsolva");
    if (!isWithinTradingHours(config)) filterReasons.push("Kereskedési ablakon kívül");
    if (isDailyLossLimitHit(botState, config)) {
      filterReasons.push(`Napi veszteség limit (${config.maxDailyLossPercent}%) elérve`);
    }
    const cooldownStatus = getCooldownStatus(
      config,
      botState,
      assetKey,
      now,
      scoreBreakdown.total,
    );
    if (!canOpen(assetKey, botState, now, scoreBreakdown.total)) {
      if (botState.positions.some((position) => position.asset === assetKey)) {
        filterReasons.push("Már van nyitott pozíció");
      } else if (botState.positions.length >= config.maxPositions) {
        filterReasons.push("Max. pozíció elérve");
      } else {
        filterReasons.push(cooldownStatus.detail || "Cooldown aktív");
      }
    }

    const eligible = filterReasons.length === 0 && decision && decision.className !== "neutral";

    return {
      assetKey,
      assetName,
      decision,
      direction,
      signal: decision?.signal || "Nincs adat",
      className: decision?.className || "neutral",
      confidence: decision?.confidence ?? null,
      score: decision?.score ?? null,
      opportunityScore: scoreBreakdown.total,
      scoreBreakdown,
      entryQuality,
      entryReadiness: entryQuality
        ? direction
          ? direction === "long"
            ? entryQuality.longReadiness
            : entryQuality.shortReadiness
          : entryQuality.longScore >= entryQuality.shortScore
            ? entryQuality.longReadiness
            : entryQuality.shortReadiness
        : "ROSSZ",
      entryReadinessDetail: entryQuality
        ? `L:${entryQuality.longReadiness} (${entryQuality.longScore}) · S:${entryQuality.shortReadiness} (${entryQuality.shortScore})`
        : null,
      eligible,
      filterReasons,
      topReasons: (decision?.reasons || []).slice(0, 3),
      entryReasons: entryQuality
        ? (entryQuality.reasons?.[direction] || []).slice(0, 2)
        : [],
    };
  }

  function scanMarketOpportunities(botState, context, now) {
    const config = botState.config;
    context.botConfig = config;
    const scanKeys = getScanAssetKeys(config, botState);
    const results = scanKeys.map((assetKey) => {
      const decision = analyzeSignal(assetKey, config, context);
      return evaluateOpportunity(assetKey, decision, config, botState, now, context);
    });
    results.sort(compareOpportunityResults);
    return results;
  }

  function closePosition(botState, id, exitPrice, reason, closedAt, context) {
    context.botConfig = botState.config;
    const index = botState.positions.findIndex((position) => position.id === id);
    if (index < 0) return null;
    const [position] = botState.positions.splice(index, 1);
    const config = botState.config;
    const adjustedExit = applySlippage(exitPrice, position.direction, false, config);
    const directionMultiplier = position.direction === "long" ? 1 : -1;
    const grossPnl = (adjustedExit - position.entry) * position.quantity * directionMultiplier;
    const fees = calcExecutionCosts(position.entry, adjustedExit, position.quantity, config);
    const pnl = grossPnl - fees;
    botState.cash += pnl;
    if (botState.cash < 0) botState.cash = 0;
    const trade = {
      ...position,
      exit: adjustedExit,
      reason,
      closedAt,
      fees,
      pnl,
      outcome: pnl >= 0 ? "win" : "loss",
      analysis: buildTradeAnalysis(position, pnl, reason, context),
    };
    botState.trades.unshift(trade);
    botState.trades = botState.trades.slice(0, 300);
    botState.lastActionAt[position.asset] = closedAt;
    botState.lastActionOutcome = botState.lastActionOutcome || {};
    botState.lastActionOutcome[position.asset] = {
      time: closedAt,
      outcome: trade.outcome,
    };
    recordEquity(botState, context, closedAt);
    const assetName = window.AssetCatalog?.getName(position.asset) || position.asset;
    logActivity(
      botState,
      `${assetName} ${position.direction.toUpperCase()} lezárva (${reason}): ${formatPrice(pnl, context)}`,
    );
    if (config.autoLearnEnabled) {
      runAutoLearn(botState, context, { trigger: "trade-close", trade });
    }
    return trade;
  }

  function buildTradeAnalysis(position, pnl, reason, context) {
    const decision = analyzeSignal(position.asset, context.botConfig || {}, context);
    const reasons = [];
    if (reason === "Stop-loss" || reason === "Követő stop") {
      reasons.push(
        reason === "Követő stop"
          ? "A követő stop védte a nyereséget vagy limitálta a veszteséget."
          : "A stop szint teljesült – a piac ellen fordult.",
      );
      if (decision?.alignment?.available >= 2 && decision.alignment.bullishRatio < 0.5) {
        reasons.push("Több idősík csökkenő trendet mutatott a belépéskor.");
      }
    } else if (reason === "Célár") {
      reasons.push("A célár elérése – a terv szerinti kimenetel.");
    } else if (reason === "Részleges profitvétel") {
      reasons.push("Részleges profitvétel – a maradék pozíció breakeven stopnál.");
    } else if (reason === "Időlimit") {
      reasons.push("A pozíció túl sokáig nyitva volt eredmény nélkül – időalapú zárás.");
    } else if (reason === "Jelzésfordulás") {
      reasons.push("Az ellentétes jelzés miatt zártuk a pozíciót.");
    } else {
      reasons.push(`Kilépési ok: ${reason}`);
    }
    if (position.confidence < 60) {
      reasons.push("Alacsony megbízhatóságú jelzésből nyitottunk – óvatosabb küszöb segíthet.");
    }
    if (position.riskReward !== null && position.riskReward < 1.5) {
      reasons.push("Gyenge kockázat/hozam arány (< 1.5) csökkentette az edge-et.");
    }
    if (pnl < 0 && decision?.rsi !== null && decision.rsi > 70 && position.direction === "long") {
      reasons.push("LONG pozíció túlvett RSI mellett – késői belépés.");
    }
    if (pnl < 0 && decision?.rsi !== null && decision.rsi < 30 && position.direction === "short") {
      reasons.push("SHORT pozíció túladott RSI mellett – késői belépés.");
    }
    return reasons;
  }

  function getPositionRiskUnit(position) {
    return Math.abs(position.entry - (position.initialStop || position.stop));
  }

  function partialClosePosition(botState, id, exitPrice, percent, reason, closedAt, context) {
    const index = botState.positions.findIndex((position) => position.id === id);
    if (index < 0) return null;
    const position = botState.positions[index];
    const closeQty = position.quantity * (percent / 100);
    if (!(closeQty > 0)) return null;

    const config = botState.config;
    const adjustedExit = applySlippage(exitPrice, position.direction, false, config);
    const directionMultiplier = position.direction === "long" ? 1 : -1;
    const grossPnl = (adjustedExit - position.entry) * closeQty * directionMultiplier;
    const fees = calcExecutionCosts(position.entry, adjustedExit, closeQty, config);
    const pnl = grossPnl - fees;
    botState.cash += pnl;
    if (botState.cash < 0) botState.cash = 0;

    const trade = {
      ...position,
      quantity: closeQty,
      exit: adjustedExit,
      reason,
      closedAt,
      fees,
      pnl,
      outcome: pnl >= 0 ? "win" : "loss",
      partial: true,
      analysis: [`Részleges zárás (${percent}%): ${reason}`],
    };
    botState.trades.unshift(trade);
    botState.trades = botState.trades.slice(0, 300);

    position.quantity -= closeQty;
    position.partialTaken = true;
    position.stop = position.entry;
    position.lastCheckedAt = closedAt;

    if (position.quantity <= 0.00000001) {
      botState.positions.splice(index, 1);
    }

    recordEquity(botState, context, closedAt);
    const assetName = window.AssetCatalog?.getName(position.asset) || position.asset;
    logActivity(
      botState,
      `${assetName} ${position.direction.toUpperCase()} részleges zárás (${percent}%): ${formatPrice(pnl, context)}`,
    );
    return trade;
  }

  function updateTrailingStop(position, candle, config, atr) {
    if (!(atr > 0)) return;
    const riskUnit = getPositionRiskUnit(position);
    if (!(riskUnit > 0)) return;
    const breakevenR = config.breakevenAfterR ?? 1;

    if (position.direction === "long") {
      position.peakPrice = Math.max(position.peakPrice ?? position.entry, candle.high);
      const profitR = (position.peakPrice - position.entry) / riskUnit;
      if (profitR >= breakevenR && position.stop < position.entry && !position.partialTaken) {
        position.stop = position.entry;
        position.breakevenActive = true;
      }
    } else {
      position.troughPrice = Math.min(position.troughPrice ?? position.entry, candle.low);
      const profitR = (position.entry - position.troughPrice) / riskUnit;
      if (profitR >= breakevenR && position.stop > position.entry && !position.partialTaken) {
        position.stop = position.entry;
        position.breakevenActive = true;
      }
    }

    if (!config.useTrailingStop) return;
    const activationR = config.trailingActivationR ?? 0.75;
    const trailDistance = atr * (config.trailingAtrMultiplier ?? 1.5);

    if (position.direction === "long") {
      const profitR = (position.peakPrice - position.entry) / riskUnit;
      if (profitR >= activationR) {
        const newStop = position.peakPrice - trailDistance;
        if (newStop > position.stop) {
          position.stop = newStop;
          position.trailingActive = true;
        }
      }
    } else {
      const profitR = (position.entry - position.troughPrice) / riskUnit;
      if (profitR >= activationR) {
        const newStop = position.troughPrice + trailDistance;
        if (newStop < position.stop) {
          position.stop = newStop;
          position.trailingActive = true;
        }
      }
    }
  }

  function updateOpenPositions(botState, assetKey, context) {
    const intraday = getSeries(context, assetKey, botState.config.primaryInterval);
    const currentPrice = getCurrentPrice(assetKey, context);
    if (!Number.isFinite(currentPrice)) return;
    const config = botState.config;
    const closures = [];
    const partials = [];
    const now = Date.now();
    const maxAgeMs = (config.maxPositionAgeMinutes || 120) * 60000;

    botState.positions
      .filter((position) => position.asset === assetKey)
      .forEach((position) => {
        if (!position.initialStop) position.initialStop = position.stop;
        if (!position.initialQuantity) position.initialQuantity = position.quantity;

        if (maxAgeMs > 0 && now - position.openedAt >= maxAgeMs) {
          const decision = analyzeSignal(assetKey, config, context);
          if (config.staleExitRequiresTrendBreak !== false) {
            const holdExit = analyzeHoldVsExit(
              position,
              decision,
              config,
              context,
              currentPrice,
              { staleCheck: true },
            );
            if (holdExit.shouldClose) {
              logHoldSellDecision(botState, position, holdExit, "elavult pozíció");
              closures.push({
                id: position.id,
                price: currentPrice,
                reason: holdExit.closeReason || "Trend megszakadt (időlimit)",
                time: now,
              });
            } else {
              logHoldSellDecision(botState, position, holdExit, "elavult – tartás");
            }
          } else {
            closures.push({
              id: position.id,
              price: currentPrice,
              reason: "Időlimit",
              time: now,
            });
          }
          return;
        }

        const decision = analyzeSignal(assetKey, config, context);
        const atr = decision?.atr;
        const newCandles = (intraday?.candles || []).filter(
          (candle) => candle.time > position.lastCheckedAt,
        );
        const riskUnit = getPositionRiskUnit(position);

        for (const candle of newCandles) {
          updateTrailingStop(position, candle, config, atr);

          const partialR = config.partialTakeProfitR ?? 1;
          if (
            config.partialTakeProfitEnabled &&
            !position.partialTaken &&
            riskUnit > 0
          ) {
            const partialTarget =
              position.direction === "long"
                ? position.entry + riskUnit * partialR
                : position.entry - riskUnit * partialR;
            const partialHit =
              position.direction === "long"
                ? candle.high >= partialTarget
                : candle.low <= partialTarget;
            if (partialHit) {
              partials.push({
                id: position.id,
                price: partialTarget,
                percent: config.partialTakeProfitPercent ?? 50,
                time: candle.time,
              });
              break;
            }
          }

          const stopHit =
            position.direction === "long"
              ? candle.low <= position.stop
              : candle.high >= position.stop;
          const targetHit =
            position.direction === "long"
              ? candle.high >= position.target
              : candle.low <= position.target;
          if (stopHit) {
            closures.push({
              id: position.id,
              price: position.stop,
              reason: position.trailingActive
                ? "Követő stop"
                : targetHit
                  ? "Stop (azonos gyertyában a célárral)"
                  : "Stop-loss",
              time: candle.time,
            });
            break;
          }
          if (targetHit) {
            closures.push({
              id: position.id,
              price: position.target,
              reason: "Célár",
              time: candle.time,
            });
            break;
          }
          position.lastCheckedAt = candle.time;
        }
      });

    partials.forEach((partial) => {
      partialClosePosition(
        botState,
        partial.id,
        partial.price,
        partial.percent,
        "Részleges profitvétel",
        partial.time,
        context,
      );
    });
    closures.forEach((closure) => {
      closePosition(botState, closure.id, closure.price, closure.reason, closure.time, context);
    });
  }

  function maybeOpenPosition(botState, assetKey, decision, context, now, options = {}) {
    const config = botState.config;
    const thresholds = getEffectiveThresholds(config);
    const opportunityScore = options.opportunityScore ?? computeOpportunityScore(decision, config, botState, assetKey).total;
    if (!config.enabled) return null;
    if (isDailyLossLimitHit(botState, config)) return null;
    if (!options.skipAssetCheck && !getTradeableAssetKeys(config).includes(assetKey)) return null;
    if (!isWithinTradingHours(config)) return null;
    if (!decision || decision.className === "neutral") return null;
    if (decision.confidence < thresholds.minConfidence) return null;
    if (Math.abs(decision.score || 0) < thresholds.signalScoreThreshold) return null;
    if (opportunityScore < (config.minOpportunityScore || 65)) return null;
    if (!canOpen(assetKey, botState, now, opportunityScore)) return null;
    if (!(decision.stop > 0) || !(decision.target > 0) || !(decision.currentPrice > 0)) return null;

    const direction = decision.className === "positive" ? "long" : "short";
    if (!passesDirection(direction, config)) return null;
    if (!passesAlignment(direction, decision, config)) return null;
    if (!passesDailyTrendFilter(direction, decision.dailyClass, config)) return null;
    if (!passesDirectionalEntryFilters(direction, decision, config)) return null;

    const entryQuality = analyzeEntryQuality(
      assetKey,
      direction,
      decision,
      config,
      context,
      botState,
    );
    const qualityGate = passesEntryQualityGate(
      entryQuality,
      direction,
      config,
      opportunityScore,
    );
    if (!qualityGate.pass) return null;

    const activeReadiness =
      direction === "long" ? entryQuality.longReadiness : entryQuality.shortReadiness;
    const activeScore = direction === "long" ? entryQuality.longScore : entryQuality.shortScore;

    const rawEntry = decision.currentPrice;
    const entry = applySlippage(rawEntry, direction, true, config);
    const quantity = calculatePositionSize(botState, entry, decision.stop, config, context);
    if (!(quantity > 0)) return null;

    const notional = entry * quantity;
    const availableNotional = getAvailableBuyingPower(botState, config, context);
    if (notional > availableNotional + 0.01) return null;

    const cooldownStatus = getCooldownStatus(config, botState, assetKey, now, opportunityScore);
    const position = {
      id: `${now}-${Math.random().toString(16).slice(2)}`,
      asset: assetKey,
      direction,
      quantity,
      entry,
      stop: decision.stop,
      target: decision.target,
      riskPercent: config.riskPercent,
      confidence: decision.confidence,
      riskReward: decision.riskReward,
      interval: decision.interval,
      signal: decision.signal,
      reasons: decision.reasons.slice(0, 4),
      entryQuality: {
        score: activeScore,
        readiness: activeReadiness,
        regime: entryQuality.regime,
        structure: entryQuality.structure,
        reasons: (entryQuality.reasons?.[direction] || []).slice(0, 3),
      },
      openedAt: now,
      lastCheckedAt: now,
      initialStop: decision.stop,
      initialQuantity: quantity,
      opportunityScore,
    };
    botState.positions.push(position);
    botState.lastActionAt[assetKey] = now;
    const assetName = window.AssetCatalog?.getName(assetKey) || assetKey;
    const proNote =
      config.professionalMode && cooldownStatus.reason === "pro-immediate"
        ? " · Pro: azonnali belépés magas pontszám miatt"
        : config.professionalMode
          ? " · Pro mód"
          : "";
    logActivity(
      botState,
      `${assetName} ${direction.toUpperCase()} nyitva @ ${formatPrice(entry, context)} · ${decision.signal} (${decision.confidence}%, ${opportunityScore.toFixed(0)} pont, belépés ${activeScore} ${qualityGate.waitOverride ? "VÁR→" : ""}${activeReadiness})${proNote}`,
    );
    return position;
  }

  function maybeCloseOnReversal(botState, assetKey, decision, context, now) {
    const config = botState.config;
    if (!config.autoCloseOnReversal || !decision) return;
    const currentPrice = getCurrentPrice(assetKey, context);
    if (!Number.isFinite(currentPrice)) return;
    botState.positions
      .filter((position) => position.asset === assetKey)
      .forEach((position) => {
        const oppositeSignal =
          (position.direction === "long" && decision.className === "negative") ||
          (position.direction === "short" && decision.className === "positive");
        if (!oppositeSignal) return;

        const holdExit = analyzeHoldVsExit(
          position,
          decision,
          config,
          context,
          currentPrice,
          { reversalCheck: true },
        );
        logHoldSellDecision(botState, position, holdExit, "jelzésfordulás");
        if (!holdExit.shouldClose) return;

        closePosition(
          botState,
          position.id,
          currentPrice,
          holdExit.closeReason || "Jelzésfordulás",
          now,
          context,
        );
      });
  }

  function tick(botState, context) {
    const currency =
      context?.fxContext?.resolveCurrency?.(botState.config) ??
      context?.botCurrency ??
      "USD";
    if (!isFxReadyForCurrency(context?.fxContext || null, currency)) {
      botState._balanceReconcilePending = true;
      return { opened: 0, closed: 0, skipped: "fx-pending" };
    }

    const validation = validateBalanceState(botState, context, context?.fxContext || null);
    if (validation.repaired) saveBotState(botState);
    if (validation.pending) return { opened: 0, closed: 0, skipped: "balance-pending" };
    if (!botState.config.enabled) return { opened: 0, closed: 0 };
    if (isDailyLossLimitHit(botState, botState.config)) {
      logActivity(
        botState,
        `Napi veszteség limit (${botState.config.maxDailyLossPercent}%) – új belépés szünetel`,
      );
      return { opened: 0, closed: 0, skipped: "daily-loss-limit" };
    }
    const now = Date.now();
    let opened = 0;
    const beforeTrades = botState.trades.length;
    const config = botState.config;
    context.botConfig = config;

    const scanKeys = getScanAssetKeys(config, botState);
    const positionAssets = [...new Set(botState.positions.map((position) => position.asset))];

    positionAssets.forEach((assetKey) => {
      updateOpenPositions(botState, assetKey, context);
    });

    const scanResults = scanKeys.map((assetKey) => {
      const decision = analyzeSignal(assetKey, config, context);
      maybeCloseOnReversal(botState, assetKey, decision, context, now);
      return evaluateOpportunity(assetKey, decision, config, botState, now, context);
    });
    scanResults.sort(compareOpportunityResults);

    const eligible = scanResults.filter((result) => result.eligible);
    let chosen = null;

    if (eligible.length) {
      botState.performanceStats = botState.performanceStats || {
        eligibleTicks: 0,
        capturedCount: 0,
        missedLog: [],
      };
      botState.performanceStats.eligibleTicks += 1;
    }

    if (config.marketWideMode) {
      const topN = Math.max(1, config.marketWideTopN || 1);
      const topEligible = eligible.slice(0, topN);
      if (topEligible.length) {
        chosen = topEligible[0];
        const position = maybeOpenPosition(
          botState,
          chosen.assetKey,
          chosen.decision,
          context,
          now,
          {
            skipAssetCheck: true,
            opportunityScore: chosen.opportunityScore,
          },
        );
        if (position) {
          opened += 1;
          botState.performanceStats.capturedCount += 1;
          logActivity(
            botState,
            `Piaci mód: ${chosen.assetName} választva (${chosen.opportunityScore.toFixed(0)} pont) – ${chosen.signal} (${chosen.confidence}%)`,
          );
        } else {
          const cooldownStatus = getCooldownStatus(
            config,
            botState,
            chosen.assetKey,
            now,
            chosen.opportunityScore,
          );
          recordMissedOpportunity(
            botState,
            chosen,
            cooldownStatus.reason,
            cooldownStatus.detail,
          );
          logActivity(
            botState,
            `Kihagyott lehetőség: ${chosen.assetName} (${chosen.opportunityScore.toFixed(0)} pont) – ${cooldownStatus.detail}`,
          );
        }
      }
    } else {
      config.assets.forEach((assetKey) => {
        const result = scanResults.find((entry) => entry.assetKey === assetKey);
        if (!result || !result.eligible) return;
        const position = maybeOpenPosition(botState, assetKey, result.decision, context, now, {
          opportunityScore: result.opportunityScore,
        });
        if (position) {
          opened += 1;
          botState.performanceStats.capturedCount += 1;
        } else {
          const cooldownStatus = getCooldownStatus(
            config,
            botState,
            assetKey,
            now,
            result.opportunityScore,
          );
          recordMissedOpportunity(
            botState,
            result,
            cooldownStatus.reason,
            cooldownStatus.detail,
          );
          logActivity(
            botState,
            `Kihagyott lehetőség: ${result.assetName} (${result.opportunityScore.toFixed(0)} pont) – ${cooldownStatus.detail}`,
          );
        }
      });
    }

    botState.lastScan = {
      time: now,
      marketWideMode: config.marketWideMode,
      results: scanResults,
      chosen: chosen
        ? {
            assetKey: chosen.assetKey,
            assetName: chosen.assetName,
            opportunityScore: chosen.opportunityScore,
            signal: chosen.signal,
            confidence: chosen.confidence,
            direction: chosen.direction,
            entryReadiness: chosen.entryReadiness,
            entryQuality: chosen.entryQuality,
            scoreBreakdown: chosen.scoreBreakdown,
            topReasons: chosen.topReasons,
            filterReasons: [],
          }
        : eligible.length
          ? null
          : {
              assetKey: null,
              reason:
                scanResults.length === 0
                  ? "Nincs szkennelhető eszköz."
                  : "Egyetlen eszköz sem teljesíti a szűrőket.",
            },
    };

    const closed = botState.trades.length - beforeTrades;
    recordEquity(botState, context, now);
    botState.lastTickAt = now;
    saveBotState(botState);
    return { opened, closed };
  }

  function formatConfigValue(key, value) {
    if (value === null || value === undefined) return "–";
    if (typeof value === "boolean") return value ? "bekapcsolva" : "kikapcsolva";
    if (key === "assets" && Array.isArray(value)) {
      return value.map((assetKey) => window.AssetCatalog?.getName(assetKey) || assetKey).join(", ");
    }
    if (key === "direction") return DIRECTION_LABELS[value] || String(value);
    if (key === "primaryInterval") return INTERVAL_LABELS[value] || `${value} perc`;
    if (key === "currency") return CURRENCY_LABELS[value] || String(value);
    if (key === "minAlignmentRatio") return `${Math.round(value * 100)}%`;
    if (key === "initialCapital" || key === "accountReset") {
      return `$${Number(value).toLocaleString("hu-HU", { maximumFractionDigits: 0 })} (belső USD)`;
    }
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
    return String(value);
  }

  function configValuesEqual(key, left, right) {
    if (key === "assets") {
      return [...(left || [])].sort().join() === [...(right || [])].sort().join();
    }
    return left === right;
  }

  function diffConfigs(before, after) {
    const changes = [];
    Object.keys(DEFAULT_CONFIG).forEach((key) => {
      const from = before?.[key];
      const to = after?.[key];
      if (!configValuesEqual(key, from, to)) {
        changes.push({ key, from, to });
      }
    });
    return changes;
  }

  function logConfigChanges(botState, source, changes, defaultReason = "") {
    if (!changes?.length || !botState) return;
    botState.configChangeLog = botState.configChangeLog || [];
    const time = Date.now();
    changes.forEach((change) => {
      botState.configChangeLog.unshift({
        time,
        source,
        key: change.key,
        label: CONFIG_LABELS[change.key] || change.key,
        from: change.from,
        to: change.to,
        reason: change.reason || defaultReason,
      });
    });
    botState.configChangeLog = botState.configChangeLog.slice(0, 200);
    saveBotState(botState);
  }

  function clearConfigChangeLog(botState) {
    if (!botState) return;
    botState.configChangeLog = [];
    saveBotState(botState);
  }

  function exportConfigChangeLogCsv(botState) {
    const rows = [["Idő", "Mező", "Régi érték", "Új érték", "Forrás", "Indok"]];
    (botState?.configChangeLog || []).forEach((entry) => {
      rows.push([
        new Date(entry.time).toISOString(),
        entry.label,
        formatConfigValue(entry.key, entry.from),
        formatConfigValue(entry.key, entry.to),
        SOURCE_LABELS[entry.source] || entry.source,
        entry.reason || "",
      ]);
    });
    return rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
  }

  function pickLearnable(config) {
    const picked = {};
    LEARNABLE_KEYS.forEach((key) => {
      picked[key] = config[key];
    });
    return picked;
  }

  function runAutoLearn(botState, context, options = {}) {
    const { dryRun = false, trigger = "manual" } = options;
    if (!dryRun && !botState.config.autoLearnEnabled) return null;
    if (botState.trades.length < 5) {
      return {
        applied: false,
        reason: "Legalább 5 lezárt ügylet kell az auto-tanuláshoz.",
        changes: [],
      };
    }

    const metrics = getMetrics(botState, context);
    const before = pickLearnable(botState.config);
    const next = { ...botState.config };
    const changes = [];

    function propose(key, newValue, reason) {
      if (typeof next[key] === "boolean") {
        if (next[key] !== newValue) {
          changes.push({ key, from: next[key], to: newValue, reason });
          next[key] = newValue;
        }
        return;
      }
      const clamped = clampParam(key, newValue);
      if (clamped !== next[key]) {
        changes.push({ key, from: next[key], to: clamped, reason });
        next[key] = clamped;
      }
    }

    if (metrics.winRate !== null && metrics.winRate < 45) {
      propose(
        "minConfidence",
        next.minConfidence + 5,
        `Alacsony találati arány (${metrics.winRate.toFixed(1)}%) – szigorúbb belépő.`,
      );
    } else if (metrics.winRate !== null && metrics.winRate > 62 && metrics.profitFactor > 1.3) {
      propose(
        "minConfidence",
        next.minConfidence - 5,
        `Erős találati arány (${metrics.winRate.toFixed(1)}%) – enyhébb küszöb lehetséges.`,
      );
    }

    if (metrics.profitFactor !== null && metrics.profitFactor < 1 && metrics.profitFactor !== Infinity) {
      propose(
        "riskPercent",
        next.riskPercent - 0.25,
        `Profit factor ${metrics.profitFactor.toFixed(2)} – kockázat csökkentése.`,
      );
      propose(
        "rewardRatio",
        next.rewardRatio + 0.25,
        "Magasabb cél R arány a vesztes ügyletek kompenzálásához.",
      );
    }

    if (metrics.maxDrawdown > 12) {
      propose(
        "maxPositions",
        next.maxPositions - 1,
        `Magas drawdown (${metrics.maxDrawdown.toFixed(1)}%) – kevesebb párhuzamos pozíció.`,
      );
      propose(
        "riskPercent",
        next.riskPercent - 0.25,
        "Drawdown miatt csökkentett kockázat.",
      );
    }

    const tradesPerDay = botState.trades.filter((trade) => trade.closedAt > Date.now() - 86400000).length;
    if (tradesPerDay > 8 && !next.professionalMode) {
      propose(
        "cooldownMinutes",
        next.cooldownMinutes + 10,
        `${tradesPerDay} ügylet / 24 óra – hosszabb cooldown.`,
      );
    }

    const stopLosses = botState.trades.filter(
      (trade) => trade.reason === "Stop-loss" || trade.reason === "Követő stop",
    ).length;
    const stopRatio = botState.trades.length ? stopLosses / botState.trades.length : 0;
    if (stopRatio > 0.5 && botState.trades.length >= 6) {
      propose(
        "atrStopMultiplier",
        next.atrStopMultiplier + 0.25,
        "Sok stop-loss – szélesebb ATR stop.",
      );
      propose(
        "atrStopMultiplierLong",
        (next.atrStopMultiplierLong ?? next.atrStopMultiplier) + 0.25,
        "LONG stop szélesítése a zajos kifutások csökkentésére.",
      );
      propose(
        "atrStopMultiplierShort",
        (next.atrStopMultiplierShort ?? next.atrStopMultiplier) + 0.25,
        "SHORT stop szélesítése a zajos kifutások csökkentésére.",
      );
      propose(
        "signalScoreThreshold",
        next.signalScoreThreshold + 0.25,
        "Szigorúbb jelzésküszöb a gyengébb setupok kiszűréséhez.",
      );
      propose(
        "minOpportunityScore",
        (next.minOpportunityScore || 65) + 5,
        "Magasabb lehetőség-pontszám – kevesebb, de jobb belépés.",
      );
    }

    const dailyPnl = getDailyRealizedPnl(botState);
    if (dailyPnl < 0 && Math.abs(dailyPnl) > botState.initialCapital * 0.03) {
      propose(
        "maxPositions",
        Math.max(1, next.maxPositions - 1),
        "Negatív napi eredmény – kevesebb párhuzamos pozíció.",
      );
      propose(
        "cooldownMinutes",
        next.cooldownMinutes + 10,
        "Negatív nap – hosszabb pihenő új belépések között.",
      );
    }

    const recentLearning = botState.learningHistory?.[0];
    if (
      recentLearning &&
      Date.now() - recentLearning.time < 3600000 &&
      recentLearning.changes.some((change) => change.key === "minConfidence")
    ) {
      // Avoid oscillating confidence within the same hour.
    } else if (metrics.avgLoss > metrics.avgWin * 0.8 && metrics.losses >= 4) {
      propose(
        "rewardRatio",
        next.rewardRatio + 0.25,
        "Átlagos veszteség közelít a nyereséghez – magasabb cél R arány.",
      );
    }

    const mixedAlignmentLosses = botState.trades.filter(
      (trade) =>
        trade.outcome === "loss" &&
        trade.analysis?.some((line) => line.includes("idősík")),
    ).length;
    if (mixedAlignmentLosses >= 3 && !next.requireAlignment) {
      propose(
        "requireAlignment",
        true,
        "Vegyes idősíkos veszteségek – idősík-egyezés kötelezővé tétele.",
      );
    }

    const weakMomentumLosses = botState.trades.filter(
      (trade) => trade.outcome === "loss" && trade.confidence < 58,
    ).length;
    if (weakMomentumLosses >= 4) {
      propose(
        "momentumThreshold",
        next.momentumThreshold + 0.02,
        "Gyenge momentumú vesztes ügyletek – magasabb lendület-küszöb.",
      );
    }

    if (!changes.length) {
      return { applied: false, reason: "Nincs szükség módosításra.", changes: [], before, after: before };
    }

    const after = pickLearnable(next);
    const entry = {
      time: Date.now(),
      trigger,
      before,
      after,
      changes,
    };

    if (!dryRun && botState.config.autoLearnEnabled) {
      botState.config = { ...botState.config, ...next };
      botState.learningHistory = [entry, ...(botState.learningHistory || [])].slice(0, 30);
      logConfigChanges(botState, "auto-tanulás", changes);
      logActivity(
        botState,
        `Auto-tanulás: ${changes.length} paraméter módosítva (${changes.map((c) => c.key).join(", ")}).`,
      );
      saveBotState(botState);
      return { applied: true, ...entry };
    }

    return { applied: false, preview: true, ...entry };
  }

  function buildSuggestions(botState, context) {
    const metrics = getMetrics(botState, context);
    const suggestions = [];
    if (!botState.trades.length) {
      return [
        {
          severity: "info",
          title: "Még nincs bot-tapasztalat",
          detail: "Kapcsold be a botot és várj néhány jelzésváltást. A javaslatok az első lezárt ügyletek után jelennek meg.",
        },
      ];
    }

    if (metrics.winRate !== null && metrics.winRate < 45) {
      suggestions.push({
        severity: "warning",
        title: "Alacsony találati arány",
        detail: `Win rate: ${metrics.winRate.toFixed(1)}%. Emeld a minimum megbízhatóságot vagy kapcsold be az auto-tanulást.`,
      });
    }

    if (metrics.profitFactor !== null && metrics.profitFactor < 1 && metrics.profitFactor !== Infinity) {
      suggestions.push({
        severity: "critical",
        title: "Negatív profit factor",
        detail: `PF: ${metrics.profitFactor.toFixed(2)}. Csökkentsd a kockázatot vagy növeld a cél R arányt.`,
      });
    }

    if (isDailyLossLimitHit(botState, botState.config)) {
      suggestions.push({
        severity: "critical",
        title: "Napi veszteség limit elérve",
        detail: `A bot ma már ${botState.config.maxDailyLossPercent}% veszteséget realizált – új belépések szünetelnek.`,
      });
    }

    const stopLossCount = botState.trades.filter(
      (trade) => trade.reason === "Stop-loss",
    ).length;
    if (botState.trades.length >= 5 && stopLossCount / botState.trades.length > 0.5) {
      suggestions.push({
        severity: "warning",
        title: "Sok stop-loss kifutás",
        detail: "Növeld az ATR stop szorzót (2.5+) vagy válts 5 perces idősíkra a zaj csökkentéséhez.",
      });
    }

    if (metrics.maxDrawdown > 12) {
      suggestions.push({
        severity: "warning",
        title: "Magas visszaesés",
        detail: `Max. drawdown: ${metrics.maxDrawdown.toFixed(1)}%. Csökkentsd a max. pozíciók számát vagy a kockázat %-ot.`,
      });
    }

    const tradesPerDay = botState.trades.filter(
      (trade) => trade.closedAt > Date.now() - 86400000,
    ).length;
    if (tradesPerDay > 8 && !botState.config.professionalMode) {
      suggestions.push({
        severity: "warning",
        title: "Túl sok ügylet",
        detail: `${tradesPerDay} ügylet az elmúlt 24 órában. Növeld a cooldown időt vagy kapcsold ki a profi módot.`,
      });
    }

    if (botState.config.professionalMode) {
      const perf = getPerformanceMetrics(botState);
      if (perf.opportunityCaptureRate !== null && perf.opportunityCaptureRate < 40 && perf.eligibleTicks >= 5) {
        suggestions.push({
          severity: "info",
          title: "Alacsony lehetőség-kihasználás",
          detail: `Capture rate: ${perf.opportunityCaptureRate.toFixed(0)}%. Ellenőrizd a max. pozíciót vagy a cooldown beállításokat.`,
        });
      }
    }

    const intervalStats = {};
    botState.trades.forEach((trade) => {
      const key = trade.interval ? `${trade.interval}p` : "ismeretlen";
      if (!intervalStats[key]) intervalStats[key] = { wins: 0, losses: 0, pnl: 0 };
      if (trade.pnl >= 0) intervalStats[key].wins += 1;
      else intervalStats[key].losses += 1;
      intervalStats[key].pnl += trade.pnl;
    });
    Object.entries(intervalStats).forEach(([interval, stats]) => {
      const total = stats.wins + stats.losses;
      if (total >= 3 && stats.pnl < 0) {
        suggestions.push({
          severity: "warning",
          title: `Gyenge idősík: ${interval}`,
          detail: `${total} ügyletből ${context.formatBotPrice ? context.formatBotPrice(stats.pnl) : `${stats.pnl.toFixed(2)} USD`} nettó.`,
        });
      }
    });

    const assetStats = {};
    botState.trades.forEach((trade) => {
      if (!assetStats[trade.asset]) assetStats[trade.asset] = { pnl: 0, count: 0 };
      assetStats[trade.asset].pnl += trade.pnl;
      assetStats[trade.asset].count += 1;
    });
    Object.entries(assetStats).forEach(([assetKey, stats]) => {
      if (stats.count >= 3 && stats.pnl < -50) {
        const name = window.AssetCatalog?.getName(assetKey) || assetKey;
        suggestions.push({
          severity: "warning",
          title: `Gyenge eszköz: ${name}`,
          detail: `${stats.count} ügylet, ${context.formatBotPrice ? context.formatBotPrice(stats.pnl) : `${stats.pnl.toFixed(2)} USD`}.`,
        });
      }
    });

    const learnPreview = runAutoLearn(botState, context, { dryRun: true });
    if (learnPreview?.changes?.length) {
      suggestions.push({
        severity: "info",
        title: "Auto-tanulás javaslat",
        detail: learnPreview.changes.map((c) => `${c.key}: ${c.from} → ${c.to}`).join("; "),
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        severity: "positive",
        title: "Stabil működés",
        detail: "Nincs kritikus probléma. Folytasd a megfigyelést.",
      });
    }

    return suggestions;
  }

  function resetBot(config) {
    const botState = createBotState(config);
    saveBotState(botState);
    return botState;
  }

  window.VirtualBot = {
    STORAGE_KEY,
    DEFAULT_CONFIG,
    PARAM_BOUNDS,
    LEARNABLE_KEYS,
    CONFIG_LABELS,
    SOURCE_LABELS,
    formatConfigValue,
    diffConfigs,
    logConfigChanges,
    clearConfigChangeLog,
    exportConfigChangeLogCsv,
    loadBotState,
    saveBotState,
    createBotState,
    getOrCreateBotUserId,
    buildSyncPayload,
    mergeBotStateWithCloud,
    initCloudSync,
    resolveBotSyncEndpoint,
    getCloudSyncStatus: () => ({
      status: cloudSyncRuntime.status,
      error: cloudSyncRuntime.lastError,
      lastSyncedAt: cloudSyncRuntime.lastSyncedAt,
      userId: getOrCreateBotUserId(),
    }),
    passesEntryQualityGate,
    getMetrics,
    getPerformanceMetrics,
    getEffectiveThresholds,
    getBotTickIntervalMs,
    tick,
    analyzeSignal,
    analyzeEntryQuality,
    analyzeHoldVsExit,
    scanMarketOpportunities,
    evaluateOpportunity,
    getScanAssetKeys,
    getTradeableAssetKeys,
    computeOpportunityScore,
    compareOpportunityResults,
    buildSuggestions,
    runAutoLearn,
    resetBot,
    applyCapitalFromConfig,
    resetCapitalAccount,
    syncCapitalBalanceOnly,
    recalculateCashFromTrades,
    backupPersistentData,
    restorePersistentDataFallback,
    reconcileCapitalOnLoad,
    reconcileBalanceOnLoad,
    validateBalanceState,
    needsFxForCurrency,
    isFxReadyForCurrency,
    getMaxAllowedEquity,
    closePosition,
    getCurrentPrice,
    isWithinTradingHours,
  };
})();
