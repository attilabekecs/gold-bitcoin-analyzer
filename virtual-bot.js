(function () {
  "use strict";

  const Intelligence = window.BotIntelligence;
  const Adaptive = window.BotAdaptiveController;
  const StrategyArena = window.BotStrategyArena;

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
    minOpportunityScore: { min: 50, max: 120, step: 5 },
    maxDailyLossPercent: { min: 1, max: 15, step: 0.5 },
    maxPositionAgeMinutes: { min: 30, max: 480, step: 15 },
    trailingAtrMultiplier: { min: 0.5, max: 4, step: 0.25 },
    trailingActivationR: { min: 0.25, max: 2, step: 0.25 },
    partialTakeProfitR: { min: 0.5, max: 3, step: 0.25 },
    partialTakeProfitPercent: { min: 25, max: 75, step: 5 },
    minEntryQualityScore: { min: 50, max: 95, step: 5 },
    entryQualityReadyThreshold: { min: 50, max: 90, step: 5 },
    entryQualityWaitThreshold: { min: 35, max: 70, step: 5 },
    minHoldMinutes: { min: 5, max: 120, step: 5 },
    minSellUrgencyScore: { min: 40, max: 90, step: 5 },
    maxTradesPerDay: { min: 1, max: 30, step: 1 },
    maxTradesPerHour: { min: 1, max: 10, step: 1 },
    minEntryGapMinutes: { min: 0, max: 60, step: 5 },
    volumeMultiplier: { min: 1, max: 3, step: 0.1 },
    autoLearnNoTradeHours: { min: 1, max: 1, step: 1 },
    autoLearnMaxDailyAdjustments: { min: 5, max: 50, step: 1 },
    autoLearnMinChangeMinutes: { min: 5, max: 60, step: 5 },
    autoLearnTargetWinRate: { min: 30, max: 70, step: 5 },
    autoLearnTargetTradesPer6h: { min: 1, max: 5, step: 1 },
    autoLearnRollingWindow: { min: 10, max: 50, step: 5 },
    aggressiveAdaptiveReviewMinutes: { min: 1, max: 30, step: 1 },
    aggressiveAdaptiveNoTradeMinutes: { min: 5, max: 120, step: 5 },
    aggressiveAdaptiveBatchSize: { min: 2, max: 8, step: 1 },
    minimumSetupSamples: { min: 5, max: 30, step: 1 },
    maximumOpenRiskPercent: { min: 1, max: 10, step: 0.5 },
    maximumGroupRiskPercent: { min: 1, max: 8, step: 0.5 },
    maximumConsecutiveLosses: { min: 2, max: 10, step: 1 },
    maximumWeeklyLossPercent: { min: 1, max: 20, step: 0.5 },
    strategyArenaMinimumTrades: { min: 20, max: 150, step: 5 },
    strategyArenaMinimumProfitFactor: { min: 1, max: 3, step: 0.1 },
    strategyArenaMaximumDrawdownPercent: { min: 2, max: 20, step: 0.5 },
  };

  const CONFIG_PRESETS = {
    conservative: {
      label: "Konzervatív",
      description: "Szigorú szűrők, kevesebb ügylet, trend-követő belépés.",
      config: {
        minConfidence: 68,
        signalScoreThreshold: 3,
        minOpportunityScore: 82,
        minEntryQualityScore: 72,
        entryQualityReadyThreshold: 70,
        riskPercent: 1,
        maxPositions: 1,
        cooldownMinutes: 45,
        minEntryGapMinutes: 20,
        requireAlignment: true,
        minAlignmentRatio: 0.8,
        maxDailyLossPercent: 3,
        regimeFilter: "trending",
        htfTrendFilterStrength: "strict",
        entryMode: "pullback",
        maxTradesPerDay: 5,
        maxTradesPerHour: 2,
        scannerRefreshPriority: "quality",
      },
    },
    balanced: {
      label: "Kiegyensúlyozott",
      description: "Alapértelmezett Winso profil – mérsékelt kockázat és aktivitás.",
      config: {
        minConfidence: 58,
        signalScoreThreshold: 2.75,
        minOpportunityScore: 65,
        minEntryQualityScore: 62,
        riskPercent: 1.5,
        maxPositions: 2,
        cooldownMinutes: 30,
        minEntryGapMinutes: 10,
        requireAlignment: true,
        minAlignmentRatio: 0.7,
        maxDailyLossPercent: 5,
        regimeFilter: "both",
        htfTrendFilterStrength: "medium",
        entryMode: "both",
        maxTradesPerDay: 10,
        maxTradesPerHour: 4,
        scannerRefreshPriority: "balanced",
      },
    },
    aggressive: {
      label: "Agresszív",
      description: "Ultraaktív, ötpercenként adaptív profil – több belépés kontrollált kockázattal.",
      config: {
        minConfidence: 48,
        signalScoreThreshold: 1.75,
        minOpportunityScore: 55,
        minEntryQualityScore: 50,
        entryQualityReadyThreshold: 55,
        entryQualityWaitThreshold: 35,
        riskPercent: 2,
        maxPositions: 4,
        cooldownMinutes: 5,
        minEntryGapMinutes: 0,
        requireAlignment: false,
        minAlignmentRatio: 0.55,
        maxDailyLossPercent: 8,
        regimeFilter: "both",
        htfTrendFilterStrength: "loose",
        entryMode: "both",
        maxTradesPerDay: 24,
        maxTradesPerHour: 8,
        scannerRefreshPriority: "fast",
        aggressiveAdaptiveEnabled: true,
        aggressiveAdaptiveReviewMinutes: 5,
        aggressiveAdaptiveNoTradeMinutes: 15,
        aggressiveAdaptiveBatchSize: 6,
        autoLearnMaxDailyAdjustments: 48,
        autoLearnMinChangeMinutes: 5,
        autoLearnTargetWinRate: 45,
        autoLearnTargetTradesPer6h: 4,
      },
    },
    proScalp: {
      label: "Pro scalp",
      description: "Gyors szkennelés, rövid tartás, magas aktivitás pro módban.",
      config: {
        professionalMode: true,
        marketWideMode: true,
        primaryInterval: 1,
        minConfidence: 55,
        signalScoreThreshold: 2.5,
        minOpportunityScore: 62,
        minEntryQualityScore: 58,
        riskPercent: 1.25,
        maxPositions: 2,
        cooldownMinutes: 10,
        proWinCooldownMinutes: 2,
        proHighScoreThreshold: 70,
        minHoldMinutes: 8,
        maxPositionAgeMinutes: 45,
        minEntryGapMinutes: 5,
        entryMode: "breakout",
        regimeFilter: "trending",
        htfTrendFilterStrength: "medium",
        maxTradesPerDay: 20,
        maxTradesPerHour: 8,
        scannerRefreshPriority: "fast",
        trailingActivationR: 0.5,
        partialTakeProfitR: 0.75,
        partialTakeProfitPercent: 60,
      },
    },
    proSwing: {
      label: "Pro swing",
      description: "Hosszabb idősík, nagyobb R cél, kevesebb de minőségibb ügylet.",
      config: {
        professionalMode: true,
        marketWideMode: true,
        primaryInterval: 15,
        minConfidence: 62,
        signalScoreThreshold: 3,
        minOpportunityScore: 72,
        minEntryQualityScore: 68,
        riskPercent: 1.5,
        maxPositions: 2,
        cooldownMinutes: 60,
        rewardRatio: 3,
        minHoldMinutes: 30,
        maxPositionAgeMinutes: 360,
        minEntryGapMinutes: 30,
        entryMode: "pullback",
        regimeFilter: "trending",
        htfTrendFilterStrength: "strict",
        maxTradesPerDay: 6,
        maxTradesPerHour: 2,
        scannerRefreshPriority: "quality",
        trailingActivationR: 1,
        partialTakeProfitR: 1.5,
        partialTakeProfitPercent: 40,
      },
    },
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
    maxPositions: 3,
    cooldownMinutes: 10,
    proMinConfidenceFloor: 50,
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
    signalScoreThreshold: 2.25,
    minConfidence: 52,
    requireAlignment: false,
    minAlignmentRatio: 0.6,
    minAlignedTimeframes: 2,
    blockAgainstDailyTrend: false,
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
    minOpportunityScore: 58,
    minEntryQualityScore: 55,
    entryQualityReadyThreshold: 58,
    entryQualityWaitThreshold: 38,
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
    maxTradesPerDay: 20,
    maxTradesPerHour: 8,
    minEntryGapMinutes: 5,
    regimeFilter: "both",
    htfTrendFilterStrength: "loose",
    entryMode: "both",
    scannerRefreshPriority: "fast",
    autoLearnNoTradeHours: 1,
    autoLearnMaxDailyAdjustments: 48,
    autoLearnMinChangeMinutes: 5,
    autoLearnTargetWinRate: 45,
    autoLearnTargetTradesPer6h: 4,
    autoLearnRollingWindow: 20,
    aggressiveAdaptiveEnabled: true,
    aggressiveAdaptiveReviewMinutes: 5,
    aggressiveAdaptiveNoTradeMinutes: 15,
    aggressiveAdaptiveBatchSize: 6,
    adaptiveConfigVersion: 3,
    aggressiveAdaptiveProfileRevision: 1,
    intelligenceEnabled: true,
    minimumSetupSamples: 8,
    maximumOpenRiskPercent: 4.5,
    maximumGroupRiskPercent: 3,
    maximumConsecutiveLosses: 4,
    maximumWeeklyLossPercent: 8,
    autoConfigRollbackEnabled: true,
    strategyArenaEnabled: true,
    strategyArenaAutoPromotionEnabled: true,
    strategyArenaMinimumTrades: 50,
    strategyArenaMinimumProfitFactor: 1.2,
    strategyArenaMaximumDrawdownPercent: 8,
  };

  const DIAGNOSTIC_STALE_HOURS = 4;
  const DIAGNOSTIC_LOG_COOLDOWN_MS = 3600000;

  const AUTO_LEARN_FINE_STEPS = {
    minConfidence: 1,
    minOpportunityScore: 1,
    minEntryQualityScore: 1,
    signalScoreThreshold: 0.25,
    atrStopMultiplier: 0.1,
    atrStopMultiplierLong: 0.1,
    atrStopMultiplierShort: 0.1,
    momentumThreshold: 0.02,
    longMomentumMin: 0.02,
    shortMomentumMin: 0.02,
    cooldownMinutes: 5,
    minEntryGapMinutes: 5,
    rewardRatio: 0.25,
    riskPercent: 0.25,
    reversalMinConfidence: 2,
    reversalMinScore: 0.25,
    maxTradesPerDay: 1,
    maxTradesPerHour: 1,
  };

  const AUTO_LEARN_DELTAS = {
    minConfidence: 2,
    minOpportunityScore: 2,
    minEntryQualityScore: 2,
    signalScoreThreshold: 0.25,
    atrStopMultiplier: 0.1,
    atrStopMultiplierLong: 0.1,
    atrStopMultiplierShort: 0.1,
    momentumThreshold: 0.02,
    longMomentumMin: 0.02,
    shortMomentumMin: 0.02,
    cooldownMinutes: 5,
    minEntryGapMinutes: 5,
    rewardRatio: 0.25,
    riskPercent: 0.25,
    reversalMinConfidence: 2,
    reversalMinScore: 0.25,
    maxTradesPerDay: 2,
    maxTradesPerHour: 1,
  };

  const LOOSEN_SAFETY_FLOORS = {
    minConfidence: 45,
    minOpportunityScore: 55,
    minEntryQualityScore: 50,
    entryQualityReadyThreshold: 55,
    entryQualityWaitThreshold: 35,
    signalScoreThreshold: 1.75,
    momentumThreshold: 0.05,
    longMomentumMin: 0.05,
    shortMomentumMin: 0.05,
    cooldownMinutes: 5,
    minEntryGapMinutes: 0,
    maxTradesPerDay: 3,
    maxTradesPerHour: 1,
    riskPercent: 0.5,
    proMinConfidenceFloor: 40,
  };

  const LOOSEN_SAFETY_CEILINGS = {
    maxTradesPerDay: 24,
    maxTradesPerHour: 8,
    maxPositions: 4,
  };

  const FILTER_REASON_CATEGORIES = [
    { match: /Bot kikapcsolva/i, key: "bot-disabled", label: "Bot kikapcsolva" },
    { match: /Alacsony bizalom/i, key: "low-confidence", label: "Alacsony bizalom" },
    { match: /Jelzéserősség/i, key: "low-signal", label: "Gyenge jelzés" },
    { match: /Lehetőség pontszám/i, key: "low-opportunity", label: "Alacsony lehetőség-pont" },
    { match: /Belépési minőség|Setup kialakul|Belépési minőség rossz/i, key: "entry-quality", label: "Belépési minőség nem elég" },
    { match: /Idősík-egyezés/i, key: "alignment", label: "Idősík-egyezés hiányzik" },
    { match: /Napi trend ellen/i, key: "daily-trend", label: "Napi trend ellen" },
    { match: /LONG szűrők|SHORT szűrők/i, key: "direction-filters", label: "Irány-specifikus szűrők" },
    { match: /Irány szűrő/i, key: "direction-mode", label: "Kereskedési irány szűrő" },
    { match: /Halott piac|Extrém zajos|Rezsím-szűrő/i, key: "regime", label: "Piaci rezsím / volatilitás" },
    { match: /Magasabb idősík|HTF trend/i, key: "htf-trend", label: "HTF trend szűrő" },
    { match: /Belépési mód/i, key: "entry-mode", label: "Belépési mód (breakout/pullback)" },
    { match: /Cooldown|pihenő|Minimális várakozás/i, key: "cooldown", label: "Cooldown / pihenő" },
    { match: /Belépési szünet|belépések között/i, key: "entry-gap", label: "Min. idő belépések között" },
    { match: /Napi ügylet limit|Óránkénti ügylet limit/i, key: "trade-rate", label: "Ügylet-limit (nap/óra)" },
    { match: /Napi veszteség limit/i, key: "daily-loss", label: "Napi veszteség limit" },
    { match: /Max\. pozíció|Már van nyitott/i, key: "max-positions", label: "Max. pozíció / duplikált eszköz" },
    { match: /Kereskedési ablakon/i, key: "trading-hours", label: "Kereskedési óra" },
    { match: /Semleges jelzés/i, key: "neutral-signal", label: "Semleges jelzés" },
    { match: /Nincs elérhető|Hiányzó stop|Nincs szkennelhető/i, key: "data", label: "Adat / árkép hiány" },
    { match: /FX|árfolyam/i, key: "fx-pending", label: "FX / deviza nem kész" },
    { match: /Korábbi vesztes|eszköz büntetve/i, key: "learning-penalty", label: "Eszköz tanulási büntetés" },
    { match: /Bot Intelligence:.*Setup tiltva/i, key: "intelligence-setup", label: "Negatív setup-várhatóérték" },
    { match: /Bot Intelligence:.*kockázat|Korrelált/i, key: "intelligence-portfolio", label: "Portfóliókockázati védelem" },
    { match: /Bot Intelligence:/i, key: "intelligence-safety", label: "Intelligence biztonsági kapu" },
  ];

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
    "blockAgainstDailyTrend",
    "direction",
    "momentumThreshold",
    "longMomentumMin",
    "shortMomentumMin",
    "minOpportunityScore",
    "minEntryQualityScore",
    "entryQualityReadyThreshold",
    "entryQualityWaitThreshold",
    "minAlignmentRatio",
    "maxTradesPerDay",
    "maxTradesPerHour",
    "minEntryGapMinutes",
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
    maxTradesPerDay: "Max. ügylet / nap",
    maxTradesPerHour: "Max. ügylet / óra",
    minEntryGapMinutes: "Min. idő belépések között (perc)",
    regimeFilter: "Rezsím szűrő",
    htfTrendFilterStrength: "HTF trend szűrő erősség",
    entryMode: "Belépési mód",
    scannerRefreshPriority: "Szkenner frissítés prioritás",
    volumeMultiplier: "Volumen spike szorzó",
    autoLearnNoTradeHours: "Auto-tanulás: ügylet-szünet (óra)",
    autoLearnMaxDailyAdjustments: "Auto-tanulás: max. módosítás / nap",
    autoLearnMinChangeMinutes: "Auto-tanulás: min. idő módosítások között (perc)",
    autoLearnTargetWinRate: "Auto-tanulás: cél win rate (%)",
    autoLearnTargetTradesPer6h: "Auto-tanulás: cél ügylet / 6 óra",
    autoLearnRollingWindow: "Auto-tanulás: gördülő ablak (ügylet)",
    aggressiveAdaptiveEnabled: "Agresszív folyamatos adaptáció",
    aggressiveAdaptiveReviewMinutes: "Adaptív felülvizsgálat (perc)",
    aggressiveAdaptiveNoTradeMinutes: "Adaptív ügylet-szünet (perc)",
    aggressiveAdaptiveBatchSize: "Paraméter / adaptív ciklus",
    intelligenceEnabled: "Bot Intelligence",
    minimumSetupSamples: "Setup minimum minta",
    maximumOpenRiskPercent: "Max. teljes nyitott kockázat",
    maximumGroupRiskPercent: "Max. eszközcsoport-kockázat",
    maximumConsecutiveLosses: "Max. egymást követő veszteség",
    maximumWeeklyLossPercent: "Max. heti veszteség",
    autoConfigRollbackEnabled: "Automatikus konfiguráció-visszaállítás",
    strategyArenaEnabled: "Champion–Challenger aréna",
    strategyArenaAutoPromotionEnabled: "Automatikus kihívó-előléptetés",
    strategyArenaMinimumTrades: "Aréna minimum ügyletszám",
    strategyArenaMinimumProfitFactor: "Aréna minimum profit factor",
    strategyArenaMaximumDrawdownPercent: "Aréna maximum drawdown",
  };

  const REGIME_FILTER_LABELS = {
    both: "Trend és oldalazó is",
    trending: "Csak trendelő piac",
    ranging: "Csak oldalazó piac",
  };

  const HTF_STRENGTH_LABELS = {
    strict: "Szigorú (minden HTF egyezés)",
    medium: "Közepes (≥50% HTF)",
    loose: "Laza (nincs HTF tiltás)",
  };

  const ENTRY_MODE_LABELS = {
    both: "Breakout és pullback is",
    breakout: "Csak breakout (erős momentum)",
    pullback: "Csak pullback (visszahúzódás)",
  };

  const SCANNER_PRIORITY_LABELS = {
    balanced: "Kiegyensúlyozott",
    fast: "Gyors (több scan)",
    quality: "Minőség (ritkább scan)",
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

  function clampLearnValue(key, value) {
    const bounds = PARAM_BOUNDS[key];
    if (!bounds) return value;
    const step = AUTO_LEARN_FINE_STEPS[key] ?? bounds.step ?? 0;
    const stepped = step > 0 ? Math.round(value / step) * step : value;
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

  function migrateAggressiveAdaptiveConfig(config = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    const profileRevision = Number(config?.aggressiveAdaptiveProfileRevision) || 0;
    const migrated = profileRevision >= 1
      ? merged
      : {
      ...merged,
      minConfidence: Math.min(merged.minConfidence, 52),
      signalScoreThreshold: Math.min(merged.signalScoreThreshold, 2.25),
      minOpportunityScore: Math.min(merged.minOpportunityScore, 58),
      minEntryQualityScore: Math.min(merged.minEntryQualityScore, 55),
      cooldownMinutes: Math.min(merged.cooldownMinutes, 10),
      minEntryGapMinutes: Math.min(merged.minEntryGapMinutes, 5),
      proMinConfidenceFloor: Math.min(merged.proMinConfidenceFloor, 50),
      maxPositions: Math.max(merged.maxPositions, 3),
      maxTradesPerDay: Math.max(merged.maxTradesPerDay, 20),
      maxTradesPerHour: Math.max(merged.maxTradesPerHour, 8),
      requireAlignment: false,
      blockAgainstDailyTrend: false,
      regimeFilter: "both",
      htfTrendFilterStrength: "loose",
      entryMode: "both",
      scannerRefreshPriority: "fast",
      autoLearnMaxDailyAdjustments: 48,
      autoLearnMinChangeMinutes: 5,
      autoLearnTargetWinRate: 45,
      autoLearnTargetTradesPer6h: 4,
      aggressiveAdaptiveEnabled: true,
      aggressiveAdaptiveReviewMinutes: 5,
      aggressiveAdaptiveNoTradeMinutes: 15,
      aggressiveAdaptiveBatchSize: 6,
      adaptiveConfigVersion: 3,
      aggressiveAdaptiveProfileRevision: 1,
    };
    if (!migrated.aggressiveAdaptiveEnabled) return migrated;
    return {
      ...migrated,
      cooldownMinutes: Math.min(migrated.cooldownMinutes, 10),
      minEntryGapMinutes: Math.min(migrated.minEntryGapMinutes, 5),
      maxPositions: Math.max(migrated.maxPositions, 3),
      maxTradesPerDay: Math.max(migrated.maxTradesPerDay, 20),
      maxTradesPerHour: Math.max(migrated.maxTradesPerHour, 8),
      autoLearnMaxDailyAdjustments: Math.max(migrated.autoLearnMaxDailyAdjustments, 48),
      autoLearnMinChangeMinutes: Math.min(migrated.autoLearnMinChangeMinutes, 5),
      autoLearnTargetTradesPer6h: Math.max(migrated.autoLearnTargetTradesPer6h, 4),
      aggressiveAdaptiveReviewMinutes: Math.min(
        migrated.aggressiveAdaptiveReviewMinutes,
        5,
      ),
      aggressiveAdaptiveNoTradeMinutes: Math.min(
        migrated.aggressiveAdaptiveNoTradeMinutes,
        15,
      ),
      aggressiveAdaptiveBatchSize: Math.max(migrated.aggressiveAdaptiveBatchSize, 6),
    };
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
        tradeDiagnostics: botState.tradeDiagnostics || createEmptyTradeDiagnostics(),
        autoLearnRuntime: botState.autoLearnRuntime || createEmptyAutoLearnRuntime(),
        intelligence: botState.intelligence || createEmptyIntelligenceState(),
        strategyArena: botState.strategyArena || createEmptyStrategyArenaState(botState.config, botState.initialCapital),
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
    botState.config = migrateAggressiveAdaptiveConfig(incoming.config);
    botState.config.autoLearnNoTradeHours = 1;
    botState.trades = Array.isArray(incoming.trades) ? incoming.trades : [];
    botState.positions = Array.isArray(incoming.positions) ? incoming.positions : [];
    botState.equityHistory = Array.isArray(incoming.equityHistory) ? incoming.equityHistory : [];
    botState.learningHistory = Array.isArray(incoming.learningHistory) ? incoming.learningHistory : [];
    botState.configChangeLog = Array.isArray(incoming.configChangeLog) ? incoming.configChangeLog : [];
    botState.activityLog = Array.isArray(incoming.activityLog) ? incoming.activityLog : [];
    botState.performanceStats = incoming.performanceStats || botState.performanceStats;
    botState.tradeDiagnostics = {
      ...createEmptyTradeDiagnostics(),
      ...(incoming.tradeDiagnostics || botState.tradeDiagnostics || {}),
    };
    botState.autoLearnRuntime = {
      ...createEmptyAutoLearnRuntime(),
      ...(incoming.autoLearnRuntime || botState.autoLearnRuntime || {}),
    };
    botState.intelligence = {
      ...createEmptyIntelligenceState(),
      ...(incoming.intelligence || botState.intelligence || {}),
    };
    botState.strategyArena = StrategyArena?.ensureArena?.(
      incoming.strategyArena || botState.strategyArena,
      botState.config,
      incoming.initialCapital || botState.initialCapital,
    ) || incoming.strategyArena || botState.strategyArena;
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
      tradeDiagnostics: {
        lastOpenSuccessAt: null,
        lastOpenAttemptAt: null,
        lastScanAt: null,
        rejectionCounts: {},
        lastTopReasons: [],
        lastStaleLogAt: 0,
        lastSuggestionLogAt: 0,
        lastNoTradeLearnAt: 0,
      },
      autoLearnRuntime: createEmptyAutoLearnRuntime(),
      intelligence: createEmptyIntelligenceState(),
      strategyArena: createEmptyStrategyArenaState(merged, merged.initialCapital, now),
    };
  }

  function createEmptyStrategyArenaState(config = DEFAULT_CONFIG, capital = 10000, now = Date.now()) {
    return StrategyArena?.createArena?.(config, capital, now) || null;
  }

  function ensureStrategyArenaState(botState, now = Date.now()) {
    if (!botState || !StrategyArena) return botState?.strategyArena || null;
    botState.strategyArena = StrategyArena.ensureArena(
      botState.strategyArena,
      botState.config,
      botState.initialCapital,
      now,
    );
    return botState.strategyArena;
  }

  function createEmptyIntelligenceState() {
    return {
      version: 1,
      activeCheckpoint: null,
      checkpointHistory: [],
      rollbackHistory: [],
      killSwitch: { active: false, reasons: [] },
      validation: null,
      report: null,
      lastReportAt: 0,
    };
  }

  function createEmptyTradeDiagnostics() {
    return {
      lastOpenSuccessAt: null,
      lastOpenAttemptAt: null,
      lastScanAt: null,
      rejectionCounts: {},
      lastTopReasons: [],
      lastStaleLogAt: 0,
      lastSuggestionLogAt: 0,
      lastNoTradeLearnAt: 0,
    };
  }

  function createEmptyAutoLearnRuntime() {
    return {
      recoveryVersion: 1,
      dailyCount: 0,
      dayKey: "",
      lastChangeAt: 0,
      lastChangeSummary: "",
      lastTrigger: "",
      lastTradeId: null,
      nextReviewAt: 0,
      targetsMetAt: 0,
      inactivityStartedAt: 0,
      recoveryStep: 0,
      recoveryExhausted: false,
      recoveryBlockers: [],
      adaptiveMode: "monitoring",
      lastMonitorAt: 0,
      inactivityMinutes: 0,
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
      saved.config = migrateAggressiveAdaptiveConfig(saved.config);
      saved.config.autoLearnNoTradeHours = 1;
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
      saved.tradeDiagnostics = {
        ...createEmptyTradeDiagnostics(),
        ...(saved.tradeDiagnostics || {}),
      };
      saved.autoLearnRuntime = {
        ...createEmptyAutoLearnRuntime(),
        ...(saved.autoLearnRuntime || {}),
      };
      saved.intelligence = {
        ...createEmptyIntelligenceState(),
        ...(saved.intelligence || {}),
      };
      saved.strategyArena = StrategyArena?.ensureArena?.(
        saved.strategyArena,
        saved.config,
        saved.initialCapital,
      ) || saved.strategyArena || null;
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
    if (!emaFn) return { aligned: false, ratio: 0, bonus: 0, available: 0, blockMisaligned: false };

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
    const strengthCfg = getHtfStrengthConfig(config);
    const alignedOk = ratio >= strengthCfg.minRatio;
    const bonus = ratio >= 1 ? 12 : ratio >= 0.5 ? 5 : strengthCfg.blockMisaligned ? -10 : 0;
    return {
      aligned: alignedOk,
      ratio,
      bonus,
      available,
      blockMisaligned: strengthCfg.blockMisaligned && !alignedOk && available > 0,
    };
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

    const regimeGateLong = passesRegimeFilter(regime.regime, config);
    const regimeGateShort = passesRegimeFilter(regime.regime, config);
    if (!regimeGateLong.pass) blocks.long.push(regimeGateLong.reason);
    if (!regimeGateShort.pass) blocks.short.push(regimeGateShort.reason);

    const longHtf = getHigherTimeframeBias(assetKey, "long", context, config);
    const shortHtf = getHigherTimeframeBias(assetKey, "short", context, config);
    longScore += longHtf.bonus;
    shortScore += shortHtf.bonus;
    if (longHtf.aligned) reasons.long.push("Magasabb idősíkok LONG irányban");
    else if (longHtf.blockMisaligned) {
      blocks.long.push("HTF trend szűrő – LONG ellen");
    } else if (longHtf.available) {
      blocks.long.push("Magasabb idősík ellen LONG-nak");
    }
    if (shortHtf.aligned) reasons.short.push("Magasabb idősíkok SHORT irányban");
    else if (shortHtf.blockMisaligned) {
      blocks.short.push("HTF trend szűrő – SHORT ellen");
    } else if (shortHtf.available) {
      blocks.short.push("Magasabb idősík ellen SHORT-nak");
    }

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
    const priority = config.scannerRefreshPriority || "balanced";
    if (priority === "fast") {
      return config.professionalMode ? 10000 : 20000;
    }
    if (priority === "quality") {
      return config.professionalMode ? 45000 : 90000;
    }
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
      direction: opportunity.direction,
      entry: opportunity.decision?.currentPrice,
      stop: opportunity.decision?.stop,
      target: opportunity.decision?.target,
      interval: opportunity.decision?.interval,
      regime: opportunity.intelligence?.regime || opportunity.entryQuality?.regime,
      setupKey: opportunity.intelligence?.setupKey || null,
      maxAgeMs: 6 * 3600000,
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

  function ensureIntelligenceState(botState) {
    const intelligenceDefaults = [
      "intelligenceEnabled",
      "minimumSetupSamples",
      "maximumOpenRiskPercent",
      "maximumGroupRiskPercent",
      "maximumConsecutiveLosses",
      "maximumWeeklyLossPercent",
      "autoConfigRollbackEnabled",
    ];
    intelligenceDefaults.forEach((key) => {
      if (botState.config[key] === undefined || botState.config[key] === null) {
        botState.config[key] = DEFAULT_CONFIG[key];
      }
    });
    if (!botState.intelligence) {
      botState.intelligence = createEmptyIntelligenceState();
    }
    return botState.intelligence;
  }

  function normalizeMarketTimestamp(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp)) return 0;
    return timestamp < 100000000000 ? timestamp * 1000 : timestamp;
  }

  function getLatestMarketDataAt(context) {
    let latest = 0;
    Object.values(context?.intraday || {}).forEach((series) => {
      const candle = series?.candles?.[series.candles.length - 1];
      latest = Math.max(
        latest,
        normalizeMarketTimestamp(candle?.time),
        normalizeMarketTimestamp(series?.updatedAt),
      );
    });
    return latest || Date.now();
  }

  function buildIntelligenceCandidate(assetKey, direction, decision, entryQuality, config, now) {
    const assetMeta = window.AssetCatalog?.getAsset?.(assetKey) || {};
    const activeScore =
      direction === "long" ? entryQuality?.longScore : entryQuality?.shortScore;
    return {
      asset: assetKey,
      category: assetMeta.category || assetMeta.type || "",
      direction,
      interval: decision?.interval || config.primaryInterval,
      regime: Intelligence?.classifyRegime?.(decision, entryQuality) || entryQuality?.regime,
      structure: entryQuality?.structure,
      entryMode: config.entryMode,
      time: now,
      confidence: decision?.confidence,
      entryQualityScore: activeScore,
      riskPercent: config.riskPercent,
      decision,
      entryQuality,
    };
  }

  function refreshIntelligenceState(botState, context, force = false) {
    const intelligence = ensureIntelligenceState(botState);
    if (!Intelligence || !botState.config.intelligenceEnabled) {
      intelligence.report = null;
      intelligence.killSwitch = { active: false, reasons: [] };
      return intelligence;
    }
    const now = Date.now();
    if (!force && intelligence.lastReportAt && now - intelligence.lastReportAt < 10000) {
      return intelligence;
    }
    const lastMarketDataAt = getLatestMarketDataAt(context);
    const dataHealthy = now - lastMarketDataAt <= 5 * 60000;
    const killSwitch = Intelligence.evaluateKillSwitch(
      {
        ...botState,
        lastMarketDataAt,
        dataHealthy,
      },
      now,
      {
        maximumDailyLossPercent: botState.config.maxDailyLossPercent,
        maximumWeeklyLossPercent: botState.config.maximumWeeklyLossPercent,
        maximumConsecutiveLosses: botState.config.maximumConsecutiveLosses,
      },
    );
    const report = Intelligence.buildIntelligenceReport(botState, {
      lastMarketDataAt,
      dataHealthy,
    });
    report.killSwitch = killSwitch;
    intelligence.killSwitch = killSwitch;
    intelligence.validation = report.validation;
    intelligence.report = report;
    intelligence.lastReportAt = now;
    return intelligence;
  }

  function assessIntelligenceEntry(
    botState,
    assetKey,
    direction,
    decision,
    entryQuality,
    context,
    now,
  ) {
    const config = botState.config;
    if (!Intelligence || !config.intelligenceEnabled) {
      return {
        allowed: true,
        riskMultiplier: 1,
        regime: entryQuality?.regime || "unknown",
      };
    }
    const intelligence = refreshIntelligenceState(botState, context);
    const candidate = buildIntelligenceCandidate(
      assetKey,
      direction,
      decision,
      entryQuality,
      config,
      now,
    );
    const setupGate = Intelligence.evaluateSetupGate(botState.trades, candidate, {
      minimumSetupSamples: config.minimumSetupSamples,
    });
    const portfolioRisk = Intelligence.evaluatePortfolioRisk(botState.positions, candidate, {
      maximumOpenRiskPercent: config.maximumOpenRiskPercent,
      maximumGroupRiskPercent: config.maximumGroupRiskPercent,
    });
    const killSwitch = intelligence.killSwitch || { active: false, reasons: [] };
    const drawdownPercent = killSwitch.drawdownPercent || 0;
    const riskMultiplier = Intelligence.dynamicRiskMultiplier({
      confidence: decision?.confidence,
      regime: candidate.regime,
      drawdownPercent,
      setupGate,
      portfolioRisk,
      validation: intelligence.validation,
    });
    const reasons = [];
    if (killSwitch.active) reasons.push(...killSwitch.reasons);
    if (!setupGate.allowed) reasons.push(setupGate.reason);
    if (!portfolioRisk.allowed) reasons.push(...portfolioRisk.reasons);
    return {
      allowed: reasons.length === 0,
      reasons,
      riskMultiplier,
      regime: candidate.regime,
      setupKey: setupGate.key,
      setupGate,
      portfolioRisk,
      validation: intelligence.validation,
      candidate,
    };
  }

  function updateMissedOpportunityOutcomes(botState, context, now = Date.now()) {
    if (!Intelligence || !botState.performanceStats?.missedLog?.length) return;
    botState.performanceStats.missedLog = botState.performanceStats.missedLog.map((item) => {
      if (item.outcome) return item;
      const currentPrice = getCurrentPrice(item.assetKey, context);
      return Intelligence.evaluateMissedOpportunity(item, currentPrice, now);
    });
  }

  function maybeCreateConfigCheckpoint(botState, reason) {
    if (
      !Intelligence ||
      !botState.config.intelligenceEnabled ||
      !botState.config.autoConfigRollbackEnabled
    ) {
      return null;
    }
    const intelligence = ensureIntelligenceState(botState);
    if (intelligence.activeCheckpoint) return intelligence.activeCheckpoint;
    const checkpoint = Intelligence.createConfigCheckpoint(botState.config, botState.trades, {
      reason,
    });
    intelligence.activeCheckpoint = checkpoint;
    intelligence.checkpointHistory = [
      checkpoint,
      ...(intelligence.checkpointHistory || []),
    ].slice(0, 20);
    return checkpoint;
  }

  function evaluateAutomaticConfigRollback(botState) {
    if (!Intelligence || !botState.config.autoConfigRollbackEnabled) return null;
    const intelligence = ensureIntelligenceState(botState);
    const checkpoint = intelligence.activeCheckpoint;
    if (!checkpoint) return null;
    const evaluation = Intelligence.evaluateCheckpointRollback(checkpoint, botState.trades);
    if (evaluation.pending) return evaluation;
    if (evaluation.shouldRollback) {
      const before = { ...botState.config };
      const preserved = {
        enabled: botState.config.enabled,
        assets: botState.config.assets,
        currency: botState.config.currency,
        initialCapital: botState.config.initialCapital,
      };
      botState.config = { ...checkpoint.config, ...preserved };
      const changes = diffConfigs(before, botState.config).map((change) => ({
        ...change,
        reason: evaluation.reason,
      }));
      intelligence.rollbackHistory = [
        {
          time: Date.now(),
          checkpointId: checkpoint.id,
          reason: evaluation.reason,
          evaluation,
        },
        ...(intelligence.rollbackHistory || []),
      ].slice(0, 20);
      intelligence.activeCheckpoint = null;
      if (changes.length) {
        logConfigChanges(botState, "auto-tanulás", changes, evaluation.reason);
      }
      logActivity(botState, `Bot Intelligence rollback: ${evaluation.reason}`);
      return { ...evaluation, rolledBack: true, changes };
    }
    intelligence.activeCheckpoint = null;
    logActivity(botState, "Bot Intelligence: az új konfiguráció validálva, rollback nem szükséges.");
    return { ...evaluation, promoted: true };
  }

  function canOpen(assetKey, botState, now, opportunityScore = 0) {
    if (botState.positions.length >= botState.config.maxPositions) return false;
    if (botState.positions.some((position) => position.asset === assetKey)) return false;
    const status = getCooldownStatus(botState.config, botState, assetKey, now, opportunityScore);
    return !status.blocked;
  }

  function calculatePositionSize(botState, entry, stop, config, context, riskMultiplier = 1) {
    const unitRisk = Math.abs(entry - stop);
    if (!(unitRisk > 0) || !(entry > 0)) return 0;

    const metrics = getMetrics(botState, context);
    const equity = Math.max(0, metrics.equity);
    if (!(equity > 0)) return 0;

    const effectiveRiskPercent = config.riskPercent * clamp(riskMultiplier, 0.25, 1.2);
    const desiredRisk = equity * (effectiveRiskPercent / 100);
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

  function getHtfStrengthConfig(config) {
    const strength = config.htfTrendFilterStrength || "medium";
    if (strength === "strict") {
      return { minRatio: 1, blockMisaligned: true };
    }
    if (strength === "loose") {
      return { minRatio: 0, blockMisaligned: false };
    }
    return { minRatio: 0.5, blockMisaligned: true };
  }

  function passesRegimeFilter(regime, config) {
    const filter = config.regimeFilter || "both";
    if (filter === "both") return { pass: true };
    if (filter === "trending") {
      return regime === "trending"
        ? { pass: true }
        : { pass: false, reason: `Rezsím-szűrő: csak trendelő piac (jelenleg: ${regime})` };
    }
    if (filter === "ranging") {
      return regime === "ranging"
        ? { pass: true }
        : { pass: false, reason: `Rezsím-szűrő: csak oldalazó piac (jelenleg: ${regime})` };
    }
    return { pass: true };
  }

  function passesEntryMode(direction, decision, config) {
    const mode = config.entryMode || "both";
    if (mode === "both" || !decision) return { pass: true };
    const volumeOk =
      !config.useVolume ||
      decision.volumeRatio === null ||
      decision.volumeRatio >= (config.volumeMultiplier ?? 1.4);
    const longMomMin = config.longMomentumMin ?? config.momentumThreshold;
    const shortMomMin = config.shortMomentumMin ?? config.momentumThreshold;
    const momentum = decision.momentum15;

    if (mode === "breakout") {
      if (direction === "long") {
        return momentum !== null && momentum >= longMomMin * 1.15 && volumeOk
          ? { pass: true }
          : {
              pass: false,
              reason: "Belépési mód: breakout – erős LONG momentum és volumen kell",
            };
      }
      return momentum !== null && momentum <= -shortMomMin * 1.15 && volumeOk
        ? { pass: true }
        : {
            pass: false,
            reason: "Belépési mód: breakout – erős SHORT momentum és volumen kell",
          };
    }

    if (direction === "long") {
      const pullbackOk =
        momentum !== null &&
        momentum >= 0 &&
        momentum < longMomMin &&
        decision.rsi !== null &&
        decision.rsi >= config.rsiLongMin &&
        decision.rsi <= config.rsiLongMax;
      return pullbackOk
        ? { pass: true }
        : {
            pass: false,
            reason: "Belépési mód: pullback – mérsékelt momentum és RSI zóna kell LONG-hoz",
          };
    }
    const pullbackOk =
      momentum !== null &&
      momentum <= 0 &&
      momentum > -shortMomMin &&
      decision.rsi !== null &&
      decision.rsi >= config.rsiShortMin &&
      decision.rsi <= config.rsiShortMax;
    return pullbackOk
      ? { pass: true }
      : {
          pass: false,
          reason: "Belépési mód: pullback – mérsékelt momentum és RSI zóna kell SHORT-hoz",
        };
  }

  function countRecentOpens(botState, windowMs, now) {
    const since = now - windowMs;
    const fromPositions = botState.positions.filter((position) => position.openedAt > since).length;
    const fromTrades = botState.trades.filter((trade) => (trade.openedAt || 0) > since).length;
    return fromPositions + fromTrades;
  }

  function getTradeRateLimitStatus(botState, config, now) {
    const dayLimit = config.maxTradesPerDay ?? 10;
    const hourLimit = config.maxTradesPerHour ?? 4;
    const opensDay = countRecentOpens(botState, 86400000, now);
    const opensHour = countRecentOpens(botState, 3600000, now);
    if (opensDay >= dayLimit) {
      return {
        blocked: true,
        reason: `Napi ügylet limit (${opensDay}/${dayLimit})`,
      };
    }
    if (opensHour >= hourLimit) {
      return {
        blocked: true,
        reason: `Óránkénti ügylet limit (${opensHour}/${hourLimit})`,
      };
    }
    return { blocked: false };
  }

  function getGlobalEntryGapStatus(config, botState, now) {
    const gapMinutes = config.minEntryGapMinutes ?? 0;
    if (!(gapMinutes > 0)) return { blocked: false };
    const diagnostics = botState.tradeDiagnostics || createEmptyTradeDiagnostics();
    const lastOpen =
      diagnostics.lastOpenSuccessAt ||
      botState.positions.reduce((max, position) => Math.max(max, position.openedAt || 0), 0) ||
      botState.trades.reduce((max, trade) => Math.max(max, trade.openedAt || 0), 0) ||
      0;
    if (!lastOpen) return { blocked: false };
    const gapMs = gapMinutes * 60000;
    const remaining = gapMs - (now - lastOpen);
    if (remaining > 0) {
      return {
        blocked: true,
        reason: `Belépések között min. ${gapMinutes} perc (${Math.ceil(remaining / 60000)} perc hátra)`,
      };
    }
    return { blocked: false };
  }

  function categorizeFilterReason(reason) {
    if (!reason) return { key: "other", label: "Egyéb szűrő" };
    const found = FILTER_REASON_CATEGORIES.find((entry) => entry.match.test(reason));
    return found || { key: "other", label: reason.slice(0, 48) };
  }

  function ensureTradeDiagnostics(botState) {
    if (!botState.tradeDiagnostics) {
      botState.tradeDiagnostics = createEmptyTradeDiagnostics();
    }
    return botState.tradeDiagnostics;
  }

  function recordDiagnosticRejections(botState, scanResults) {
    const diagnostics = ensureTradeDiagnostics(botState);
    diagnostics.lastScanAt = Date.now();
    const tallies = { ...(diagnostics.rejectionCounts || {}) };

    (scanResults || []).forEach((result) => {
      if (result.eligible) return;
      (result.filterReasons || []).forEach((reason) => {
        const category = categorizeFilterReason(reason);
        tallies[category.key] = (tallies[category.key] || 0) + 1;
      });
      if (!result.filterReasons?.length && result.decision?.className === "neutral") {
        tallies["neutral-signal"] = (tallies["neutral-signal"] || 0) + 1;
      }
    });

    diagnostics.rejectionCounts = tallies;
    diagnostics.lastTopReasons = Object.entries(tallies)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([key, count]) => {
        const label =
          FILTER_REASON_CATEGORIES.find((entry) => entry.key === key)?.label || key;
        return { key, label, count };
      });
  }

  function buildLooseningSuggestions(botState, topReasons) {
    const config = botState.config;
    const suggestions = [];
    const add = (key, direction, detail) => {
      suggestions.push({ key, direction, detail });
    };

    topReasons.forEach(({ key }) => {
      if (key === "low-confidence" && config.minConfidence > 45) {
        add("minConfidence", "lower", `Csökkentsd a min. bizalmat (${config.minConfidence}% → ${config.minConfidence - 5}%)`);
      }
      if (key === "low-opportunity" && config.minOpportunityScore > 55) {
        add(
          "minOpportunityScore",
          "lower",
          `Engedd le a min. lehetőség pontot (${config.minOpportunityScore} → ${config.minOpportunityScore - 5})`,
        );
      }
      if (key === "entry-quality" && config.minEntryQualityScore > 50) {
        add(
          "minEntryQualityScore",
          "lower",
          `Lazítsd a belépési minőséget (${config.minEntryQualityScore} → ${config.minEntryQualityScore - 5})`,
        );
      }
      if (key === "alignment" && config.requireAlignment) {
        add("requireAlignment", "toggle", "Kapcsold ki az idősík-egyezés kötelezőt, vagy csökkentsd az arányt");
      }
      if (key === "regime" && config.regimeFilter !== "both") {
        add("regimeFilter", "both", 'Állítsd a rezsím szűrőt "Mindkettő"-re');
      }
      if (key === "htf-trend" && config.htfTrendFilterStrength === "strict") {
        add("htfTrendFilterStrength", "medium", "Lazítsd a HTF trend szűrőt közepesre");
      }
      if (key === "entry-mode" && config.entryMode !== "both") {
        add("entryMode", "both", "Engedélyezd mindkét belépési módot (breakout + pullback)");
      }
      if (key === "cooldown" && config.cooldownMinutes > 10) {
        add("cooldownMinutes", "lower", `Rövidítsd a cooldown-t (${config.cooldownMinutes} → ${Math.max(5, config.cooldownMinutes - 10)} perc)`);
      }
      if (key === "entry-gap" && config.minEntryGapMinutes > 0) {
        add(
          "minEntryGapMinutes",
          "lower",
          `Csökkentsd a belépések közti minimumot (${config.minEntryGapMinutes} perc)`,
        );
      }
      if (key === "trade-rate") {
        add("maxTradesPerDay", "raise", "Emeld a napi/óránkénti ügylet limitet, ha szándékosan aktívabb kereskedést akarsz");
      }
    });

    const unique = [];
    const seen = new Set();
    suggestions.forEach((item) => {
      if (seen.has(item.key)) return;
      seen.add(item.key);
      unique.push(item);
    });
    return unique.slice(0, 4);
  }

  function maybeLogStaleTradeDiagnostics(botState, context) {
    if (!botState.config.enabled) return;
    const diagnostics = ensureTradeDiagnostics(botState);
    const now = Date.now();
    const lastOpen = diagnostics.lastOpenSuccessAt || 0;
    const staleMs = DIAGNOSTIC_STALE_HOURS * 3600000;
    if (lastOpen && now - lastOpen < staleMs) return;
    if (now - (diagnostics.lastStaleLogAt || 0) < DIAGNOSTIC_LOG_COOLDOWN_MS) return;

    const hoursSince = lastOpen
      ? Math.round((now - lastOpen) / 3600000)
      : null;
    const topReasons = diagnostics.lastTopReasons || [];
    const reasonSummary =
      topReasons.length > 0
        ? topReasons.map((entry) => `${entry.label} (${entry.count}×)`).join(", ")
        : "Nincs friss szkenner-adat – ellenőrizd az adatforrást és a bot kapcsolót";

    logActivity(
      botState,
      hoursSince === null
        ? `Diagnosztika: még nem nyitott ügyletet – fő okok: ${reasonSummary}`
        : `Diagnosztika: ${hoursSince} órája nem nyitott ügyletet – fő okok: ${reasonSummary}`,
    );

    const suggestions = buildLooseningSuggestions(botState, topReasons);
    if (
      suggestions.length &&
      now - (diagnostics.lastSuggestionLogAt || 0) >= DIAGNOSTIC_LOG_COOLDOWN_MS
    ) {
      diagnostics.lastSuggestionLogAt = now;
      logConfigChanges(botState, "pro mód", [
        {
          key: "tradeDiagnostics",
          from: "—",
          to: "Javaslat",
          reason: `Hosszú ügylet-szünet – finomhangolási tippek: ${suggestions.map((item) => item.detail).join(" · ")}`,
        },
      ]);
    }

    diagnostics.lastStaleLogAt = now;
  }

  function getTradeDiagnostics(botState, context = null) {
    const diagnostics = ensureTradeDiagnostics(botState);
    const now = Date.now();
    const config = botState.config;
    const lastOpen = diagnostics.lastOpenSuccessAt || 0;
    const hoursSinceOpen = lastOpen ? (now - lastOpen) / 3600000 : null;
    const isStale =
      config.enabled &&
      (hoursSinceOpen === null || hoursSinceOpen >= DIAGNOSTIC_STALE_HOURS);
    const topReasons = diagnostics.lastTopReasons || [];
    const suggestions = isStale ? buildLooseningSuggestions(botState, topReasons) : [];

    const blockers = [];
    if (!config.enabled) blockers.push("Bot kikapcsolva");
    const currency =
      context?.fxContext?.resolveCurrency?.(config) ?? context?.botCurrency ?? "USD";
    if (context && !isFxReadyForCurrency(context.fxContext || null, currency)) {
      blockers.push("Devizaárfolyam (FX) még nem kész");
    }
    if (isDailyLossLimitHit(botState, config)) {
      blockers.push(`Napi veszteség limit (${config.maxDailyLossPercent}%)`);
    }
    if (!isWithinTradingHours(config) && config.useTradingHours) {
      blockers.push("Kereskedési ablakon kívül");
    }
    const rateStatus = getTradeRateLimitStatus(botState, config, now);
    if (rateStatus.blocked) blockers.push(rateStatus.reason);
    const gapStatus = getGlobalEntryGapStatus(config, botState, now);
    if (gapStatus.blocked) blockers.push(gapStatus.reason);
    if (botState.positions.length >= config.maxPositions) {
      blockers.push("Max. pozíció elérve");
    }

    return {
      enabled: config.enabled,
      isStale,
      hoursSinceOpen,
      hoursSinceOpenLabel:
        hoursSinceOpen === null
          ? "Még nem nyitott ügyletet"
          : hoursSinceOpen < 1
            ? `${Math.round(hoursSinceOpen * 60)} perce`
            : `${hoursSinceOpen.toFixed(1)} órája`,
      lastOpenSuccessAt: lastOpen || null,
      lastOpenAttemptAt: diagnostics.lastOpenAttemptAt || null,
      lastScanAt: diagnostics.lastScanAt || botState.lastScan?.time || null,
      topReasons,
      blockers,
      suggestions,
      eligibleAssets:
        botState.lastScan?.results?.filter((result) => result.eligible).length ?? 0,
      scannedAssets: botState.lastScan?.results?.length ?? 0,
    };
  }

  function applyConfigPreset(botState, presetKey, options = {}) {
    const preset = CONFIG_PRESETS[presetKey];
    if (!preset || !botState) return null;
    const before = { ...botState.config, assets: [...(botState.config.assets || [])] };
    const next = { ...botState.config, ...preset.config, assets: before.assets };
    const changes = diffConfigs(before, next);
    botState.config = next;
    if (!options.skipLog && changes.length) {
      logConfigChanges(
        botState,
        options.source || "beállítás",
        changes.map((change) => ({
          ...change,
          reason: options.reason || `Előbeállítás alkalmazva: ${preset.label}`,
        })),
      );
      logActivity(botState, `Előbeállítás: ${preset.label} – ${changes.length} paraméter módosítva.`);
    } else {
      saveBotState(botState);
    }
    return { preset, changes, config: botState.config };
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
    const intelligence =
      decision && direction
        ? assessIntelligenceEntry(
            botState,
            assetKey,
            direction,
            decision,
            entryQuality,
            context,
            now,
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
      const entryModeGate = passesEntryMode(direction, decision, config);
      if (!entryModeGate.pass) {
        filterReasons.push(entryModeGate.reason);
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
      if (intelligence && !intelligence.allowed) {
        intelligence.reasons.forEach((reason) => {
          filterReasons.push(`Bot Intelligence: ${reason}`);
        });
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
    const rateStatus = getTradeRateLimitStatus(botState, config, now);
    if (rateStatus.blocked) filterReasons.push(rateStatus.reason);
    const gapStatus = getGlobalEntryGapStatus(config, botState, now);
    if (gapStatus.blocked) filterReasons.push(gapStatus.reason);
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
      intelligence,
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

  function buildArenaShadowState(botState, profile) {
    return {
      ...botState,
      config: {
        ...profile.config,
        enabled: true,
        intelligenceEnabled: false,
        assets: [...(profile.config.assets || botState.config.assets || [])],
      },
      cash: profile.equity,
      initialCapital: profile.initialCapital,
      positions: profile.positions,
      trades: profile.trades,
      equityHistory: profile.equityHistory,
      lastActionAt: profile.lastActionAt,
      lastActionOutcome: {},
      intelligence: createEmptyIntelligenceState(),
    };
  }

  function runStrategyArena(botState, context, now = Date.now()) {
    if (!StrategyArena || !botState.config.strategyArenaEnabled) return null;
    const arena = StrategyArena.ensureArena(
      botState.strategyArena,
      botState.config,
      botState.initialCapital,
      now,
    );
    botState.strategyArena = arena;

    const assetKeys = new Set(botState.config.assets || []);
    arena.profiles.forEach((profile) => {
      (profile.positions || []).forEach((position) => assetKeys.add(position.asset));
    });
    const prices = {};
    assetKeys.forEach((assetKey) => {
      const price = getCurrentPrice(assetKey, context);
      if (Number.isFinite(price) && price > 0) prices[assetKey] = price;
    });

    arena.profiles.forEach((profile) => {
      StrategyArena.updateShadowPositions(profile, prices, now);
      const shadowState = buildArenaShadowState(botState, profile);
      const profileConfig = shadowState.config;
      context.botConfig = profileConfig;
      const results = getScanAssetKeys(profileConfig, shadowState).map((assetKey) => {
        const decision = analyzeSignal(assetKey, profileConfig, context);
        return evaluateOpportunity(assetKey, decision, profileConfig, shadowState, now, context);
      });
      results.sort(compareOpportunityResults);
      const candidate = results.find((result) => result.eligible);
      if (!candidate) return;
      StrategyArena.openShadowPosition(profile, {
        asset: candidate.assetKey,
        direction: candidate.direction,
        entry: candidate.decision.currentPrice,
        stop: candidate.decision.stop,
        target: candidate.decision.target,
        confidence: candidate.confidence,
        opportunityScore: candidate.opportunityScore,
        signal: candidate.signal,
        regime: candidate.entryQuality?.regime || "unknown",
      }, now);
    });
    context.botConfig = botState.config;
    arena.lastTickAt = now;

    const killSwitch = botState.intelligence?.killSwitch || { active: false, reasons: [] };
    const decision = StrategyArena.evaluatePromotion(arena, {
      minimumTrades: botState.config.strategyArenaMinimumTrades,
      minimumProfitFactor: botState.config.strategyArenaMinimumProfitFactor,
      maximumDrawdownPercent: botState.config.strategyArenaMaximumDrawdownPercent,
      blocked: killSwitch.active,
      blockedReason: killSwitch.reasons?.join(" · "),
    }, now);

    if (decision.eligible && botState.config.strategyArenaAutoPromotionEnabled) {
      const challenger = arena.profiles.find((profile) => profile.id === decision.challengerId);
      if (challenger) {
        maybeCreateConfigCheckpoint(botState, `Stratégia-aréna előléptetés: ${challenger.label}`);
        const before = copyConfigForCheckpoint(botState.config);
        const preserved = {
          enabled: botState.config.enabled,
          assets: [...(botState.config.assets || [])],
          currency: botState.config.currency,
          initialCapital: botState.config.initialCapital,
          strategyArenaEnabled: botState.config.strategyArenaEnabled,
          strategyArenaAutoPromotionEnabled: botState.config.strategyArenaAutoPromotionEnabled,
          strategyArenaMinimumTrades: botState.config.strategyArenaMinimumTrades,
          strategyArenaMinimumProfitFactor: botState.config.strategyArenaMinimumProfitFactor,
          strategyArenaMaximumDrawdownPercent: botState.config.strategyArenaMaximumDrawdownPercent,
        };
        botState.config = { ...challenger.config, ...preserved };
        StrategyArena.promote(arena, challenger.id, now);
        const changes = diffConfigs(before, botState.config).map((change) => ({
          ...change,
          reason: `${challenger.label} validált árnyékteljesítménye felülmúlta a Championt.`,
        }));
        if (changes.length) {
          logConfigChanges(botState, "strategy-arena", changes);
          logActivity(botState, `Stratégia-aréna: ${challenger.label} előléptetve (${changes.length} paraméter).`);
        }
      }
    }
    return decision;
  }

  function copyConfigForCheckpoint(config) {
    return { ...config, assets: [...(config.assets || [])] };
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
    evaluateAutomaticConfigRollback(botState);
    refreshIntelligenceState(botState, context, true);
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
    const diagnostics = ensureTradeDiagnostics(botState);
    const thresholds = getEffectiveThresholds(config);
    const opportunityScore = options.opportunityScore ?? computeOpportunityScore(decision, config, botState, assetKey).total;
    if (!config.enabled) return null;
    if (decision && decision.className !== "neutral") {
      diagnostics.lastOpenAttemptAt = now;
    }
    if (isDailyLossLimitHit(botState, config)) return null;
    const rateStatus = getTradeRateLimitStatus(botState, config, now);
    if (rateStatus.blocked) return null;
    const gapStatus = getGlobalEntryGapStatus(config, botState, now);
    if (gapStatus.blocked) return null;
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
    const entryModeGate = passesEntryMode(direction, decision, config);
    if (!entryModeGate.pass) return null;

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

    const intelligence = assessIntelligenceEntry(
      botState,
      assetKey,
      direction,
      decision,
      entryQuality,
      context,
      now,
    );
    if (!intelligence.allowed) return null;

    const activeReadiness =
      direction === "long" ? entryQuality.longReadiness : entryQuality.shortReadiness;
    const activeScore = direction === "long" ? entryQuality.longScore : entryQuality.shortScore;

    const rawEntry = decision.currentPrice;
    const entry = applySlippage(rawEntry, direction, true, config);
    const quantity = calculatePositionSize(
      botState,
      entry,
      decision.stop,
      config,
      context,
      intelligence.riskMultiplier,
    );
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
      effectiveRiskPercent: config.riskPercent * intelligence.riskMultiplier,
      riskMultiplier: intelligence.riskMultiplier,
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
      setupKey: intelligence.setupKey,
      regime: intelligence.regime,
      intelligence: {
        setupKey: intelligence.setupKey,
        regime: intelligence.regime,
        setupSampleSize: intelligence.setupGate?.stats?.sampleSize || 0,
        setupExpectancy: intelligence.setupGate?.stats?.expectancy || 0,
        validationStatus: intelligence.validation?.status || "insufficient-data",
        portfolioGroup: intelligence.portfolioRisk?.group || "other",
        riskMultiplier: intelligence.riskMultiplier,
      },
    };
    botState.positions.push(position);
    botState.lastActionAt[assetKey] = now;
    diagnostics.lastOpenSuccessAt = now;
    diagnostics.lastOpenAttemptAt = now;
    const autoLearnRuntime = ensureAutoLearnRuntime(botState);
    autoLearnRuntime.inactivityStartedAt = now;
    autoLearnRuntime.recoveryStep = 0;
    autoLearnRuntime.recoveryExhausted = false;
    autoLearnRuntime.recoveryBlockers = [];
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
    const now = Date.now();
    let opened = 0;
    const beforeTrades = botState.trades.length;
    const config = botState.config;
    context.botConfig = config;
    refreshIntelligenceState(botState, context, true);
    updateMissedOpportunityOutcomes(botState, context, now);

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
            intelligence: chosen.intelligence,
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
    recordDiagnosticRejections(botState, scanResults);
    maybeLogStaleTradeDiagnostics(botState, context);
    maybeRunNoTradeAutoLearn(botState, context);
    runStrategyArena(botState, context, now);
    recordEquity(botState, context, now);
    refreshIntelligenceState(botState, context, true);
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
    if (key === "regimeFilter") return REGIME_FILTER_LABELS[value] || String(value);
    if (key === "htfTrendFilterStrength") return HTF_STRENGTH_LABELS[value] || String(value);
    if (key === "entryMode") return ENTRY_MODE_LABELS[value] || String(value);
    if (key === "scannerRefreshPriority") return SCANNER_PRIORITY_LABELS[value] || String(value);
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

  function getAutoLearnDayKey(time = Date.now()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(time);
  }

  function ensureAutoLearnRuntime(botState) {
    if (!botState.autoLearnRuntime) {
      botState.autoLearnRuntime = createEmptyAutoLearnRuntime();
    }
    const runtime = botState.autoLearnRuntime;
    const dayKey = getAutoLearnDayKey();
    if (runtime.dayKey !== dayKey) {
      runtime.dayKey = dayKey;
      runtime.dailyCount = 0;
    }
    return runtime;
  }

  function getRollingLearningMetrics(botState, config) {
    const windowSize = config.autoLearnRollingWindow || 20;
    const recent = botState.trades.filter((trade) => !trade.partial).slice(0, windowSize);
    const wins = recent.filter((trade) => trade.pnl > 0);
    const rollingPnl = recent.reduce((sum, trade) => sum + (Number.isFinite(trade.pnl) ? trade.pnl : 0), 0);
    const winRate = recent.length ? (wins.length / recent.length) * 100 : null;
    const sixHoursAgo = Date.now() - 6 * 3600000;
    const tradesLast6h = botState.trades.filter(
      (trade) => !trade.partial && trade.closedAt > sixHoursAgo,
    ).length;
    const diagnostics = ensureTradeDiagnostics(botState);
    const runtime = ensureAutoLearnRuntime(botState);
    const lastOpen = diagnostics.lastOpenSuccessAt || 0;
    if (!runtime.inactivityStartedAt) {
      runtime.inactivityStartedAt = lastOpen || botState.lastTickAt || Date.now();
    }
    const inactivityReference = lastOpen || runtime.inactivityStartedAt;
    const hoursSinceOpen = (Date.now() - inactivityReference) / 3600000;
    return {
      windowSize,
      sampleSize: recent.length,
      winRate,
      rollingPnl,
      tradesLast6h,
      hoursSinceOpen,
      minutesSinceOpen: hoursSinceOpen * 60,
    };
  }

  function areLearningTargetsMet(botState, context) {
    const config = botState.config;
    if (!config.enabled) return true;
    const rolling = getRollingLearningMetrics(botState, config);
    const targetWinRate = config.autoLearnTargetWinRate ?? 40;
    const targetTradesPer6h = config.autoLearnTargetTradesPer6h ?? 1;
    const winRateOk =
      rolling.sampleSize < 5 || rolling.winRate === null || rolling.winRate >= targetWinRate;
    const tradesOk =
      !config.enabled ||
      rolling.tradesLast6h >= targetTradesPer6h ||
      (rolling.minutesSinceOpen !== null &&
        rolling.minutesSinceOpen < (config.aggressiveAdaptiveNoTradeMinutes ?? 15));
    const pnlOk = rolling.sampleSize < 5 || rolling.rollingPnl >= 0;
    return winRateOk && tradesOk && pnlOk;
  }

  function getPrimaryLearningGoal(botState, context) {
    const config = botState.config;
    const rolling = getRollingLearningMetrics(botState, config);
    const targetWinRate = config.autoLearnTargetWinRate ?? 40;
    const targetTradesPer6h = config.autoLearnTargetTradesPer6h ?? 1;
    if (
      config.enabled &&
      rolling.minutesSinceOpen >= (config.aggressiveAdaptiveNoTradeMinutes ?? 15)
    ) {
      return "több ügylet";
    }
    if (rolling.sampleSize >= 5 && rolling.winRate !== null && rolling.winRate < targetWinRate) {
      return "jobb találati arány";
    }
    if (rolling.sampleSize >= 5 && rolling.rollingPnl < 0) {
      return "pozitív gördülő PnL";
    }
    if (rolling.tradesLast6h < targetTradesPer6h) {
      return "több ügylet";
    }
    return "célok teljesítve";
  }

  function canApplyAutoLearnChange(botState, config, options = {}) {
    if (!config.autoLearnEnabled && !options.force) {
      return { ok: false, reason: "Auto-tanulás kikapcsolva." };
    }
    if (!options.ignoreTargets && areLearningTargetsMet(botState, null)) {
      return { ok: false, reason: "A tanulási célok teljesülnek – nincs szükség módosításra." };
    }
    const runtime = ensureAutoLearnRuntime(botState);
    const maxDaily = config.autoLearnMaxDailyAdjustments ?? 20;
    if (runtime.dailyCount >= maxDaily) {
      return {
        ok: false,
        reason: `Napi auto-tanulási limit elérve (${maxDaily} módosítás).`,
      };
    }
    const minIntervalMs = (config.autoLearnMinChangeMinutes ?? 15) * 60000;
    if (
      !options.ignoreInterval &&
      runtime.lastChangeAt &&
      Date.now() - runtime.lastChangeAt < minIntervalMs
    ) {
      const waitMin = Math.ceil((minIntervalMs - (Date.now() - runtime.lastChangeAt)) / 60000);
      return {
        ok: false,
        reason: `Várakozás a következő auto-módosításig (${waitMin} perc).`,
        nextReviewAt: runtime.lastChangeAt + minIntervalMs,
      };
    }
    return { ok: true };
  }

  function proposeLearnChange(next, changes, key, newValue, reason, options = {}) {
    const loosen = options.loosen === true;
    if (typeof next[key] === "boolean") {
      if (next[key] === newValue) return;
      changes.push({ key, from: next[key], to: newValue, reason });
      next[key] = newValue;
      return;
    }
    if (typeof next[key] === "string") {
      if (next[key] === newValue) return;
      changes.push({ key, from: next[key], to: newValue, reason });
      next[key] = newValue;
      return;
    }
    let clamped = clampLearnValue(key, newValue);
    if (loosen && LOOSEN_SAFETY_CEILINGS[key] !== undefined) {
      clamped = Math.min(clamped, LOOSEN_SAFETY_CEILINGS[key]);
      if (clamped <= next[key]) return;
    } else if (loosen && LOOSEN_SAFETY_FLOORS[key] !== undefined) {
      clamped = Math.max(clamped, LOOSEN_SAFETY_FLOORS[key]);
      if (clamped >= next[key]) return;
    }
    if (clamped === next[key]) return;
    changes.push({ key, from: next[key], to: clamped, reason });
    next[key] = clamped;
  }

  function finalizeLearningChanges(changes, maxCount = 3) {
    if (Adaptive?.selectBatch) return Adaptive.selectBatch(changes, maxCount);
    const unique = [];
    const seen = new Set();
    changes.forEach((change) => {
      if (seen.has(change.key)) return;
      seen.add(change.key);
      unique.push(change);
    });
    return unique.slice(0, maxCount);
  }

  function applyLearningChanges(botState, changes, meta = {}) {
    if (!changes?.length) return null;
    const before = pickLearnable(botState.config);
    maybeCreateConfigCheckpoint(
      botState,
      `Auto-tanulás előtti állapot (${meta.trigger || "auto"})`,
    );
    const next = { ...botState.config };
    changes.forEach((change) => {
      next[change.key] = change.to;
    });
    botState.config = next;
    const after = pickLearnable(next);
    const runtime = ensureAutoLearnRuntime(botState);
    const now = Date.now();
    runtime.dailyCount += 1;
    runtime.lastChangeAt = now;
    runtime.lastTrigger = meta.trigger || "auto";
    runtime.lastTradeId = meta.tradeId || null;
    if (
      String(meta.trigger || "").startsWith("no-trade-") ||
      String(meta.trigger || "").includes("activity-recovery")
    ) {
      runtime.recoveryStep = (runtime.recoveryStep || 0) + 1;
      runtime.recoveryExhausted = false;
      runtime.recoveryBlockers = meta.blockers || [];
    }
    runtime.lastChangeSummary = changes
      .map((change) => `${CONFIG_LABELS[change.key] || change.key}: ${formatConfigValue(change.key, change.from)} → ${formatConfigValue(change.key, change.to)}`)
      .join(" · ");
    runtime.nextReviewAt = now + (botState.config.autoLearnMinChangeMinutes ?? 15) * 60000;
    if (areLearningTargetsMet(botState, null)) {
      runtime.targetsMetAt = now;
    }

    const entry = {
      time: now,
      trigger: meta.trigger || "auto",
      tradeId: meta.tradeId || null,
      before,
      after,
      changes,
    };
    botState.learningHistory = [entry, ...(botState.learningHistory || [])].slice(0, 30);
    logConfigChanges(botState, "auto-tanulás", changes);
    logActivity(
      botState,
      meta.activityMessage ||
        `Auto-tanulás: ${changes.length} paraméter módosítva (${changes.map((c) => c.key).join(", ")}).`,
    );
    saveBotState(botState);
    return { applied: true, ...entry };
  }

  function buildTradeCloseLearningChanges(trade, config) {
    if (!trade || trade.partial) return [];
    const next = { ...config };
    const pending = [];
    const assetName = window.AssetCatalog?.getName(trade.asset) || trade.asset;
    const tradeRef = trade.id ? `#${trade.id.slice(-8)}` : "ismeretlen";
    const entryQuality = trade.entryQuality?.score ?? null;
    const regime = trade.entryQuality?.regime || "unknown";
    const direction = trade.direction || "long";
    const delta = AUTO_LEARN_DELTAS;
    const baseReason = `${assetName} ${direction.toUpperCase()} ${tradeRef} (${trade.reason || "zárás"})`;

    function queue(key, newValue, detail, loosen = false) {
      const reason = `${baseReason}: ${detail}`;
      const scratch = { ...next };
      const changes = [];
      proposeLearnChange(scratch, changes, key, newValue, reason, { loosen });
      if (changes.length) {
        pending.push(changes[0]);
        next[key] = changes[0].to;
      }
    }

    if (trade.outcome === "win") {
      if (trade.reason === "Célár") {
        queue(
          "minConfidence",
          next.minConfidence - delta.minConfidence,
          "célár elérve – enyhébb belépő küszöb",
          true,
        );
        queue(
          "minOpportunityScore",
          next.minOpportunityScore - delta.minOpportunityScore,
          "működő setup – alacsonyabb lehetőség-pont",
          true,
        );
      } else if (trade.reason === "Követő stop") {
        queue(
          "signalScoreThreshold",
          next.signalScoreThreshold - delta.signalScoreThreshold,
          "követő stop védte a nyereséget – enyhébb jelzésküszöb",
          true,
        );
      } else {
        queue(
          "rewardRatio",
          next.rewardRatio + delta.rewardRatio,
          "nyertes ügylet – magasabb cél R arány",
        );
      }
      if (entryQuality !== null && entryQuality >= (config.entryQualityReadyThreshold ?? 62)) {
        queue(
          "minEntryQualityScore",
          next.minEntryQualityScore - delta.minEntryQualityScore,
          `jó belépési minőség (${entryQuality}) – finom lazítás`,
          true,
        );
      }
    } else {
      if (trade.reason === "Stop-loss" || trade.reason === "Követő stop") {
        const stopKey =
          direction === "long" ? "atrStopMultiplierLong" : "atrStopMultiplierShort";
        queue(
          stopKey,
          (next[stopKey] ?? next.atrStopMultiplier) + delta[stopKey],
          "stop teljesült – szélesebb ATR stop",
        );
        queue(
          "minConfidence",
          next.minConfidence + delta.minConfidence,
          "vesztes stop – szigorúbb bizalom küszöb",
        );
        queue(
          "signalScoreThreshold",
          next.signalScoreThreshold + delta.signalScoreThreshold,
          "stop kifutás – erősebb jelzés kell",
        );
      } else if (trade.reason === "Jelzésfordulás") {
        queue(
          "reversalMinConfidence",
          next.reversalMinConfidence + delta.reversalMinConfidence,
          "jelzésfordulás miatti veszteség – magasabb fordulás-küszöb",
        );
      } else if (trade.reason === "Időlimit") {
        queue(
          "maxPositionAgeMinutes",
          next.maxPositionAgeMinutes - 15,
          "időlimit zárás – rövidebb max. tartási idő",
        );
      } else {
        queue(
          "minConfidence",
          next.minConfidence + delta.minConfidence,
          "vesztes ügylet – szigorúbb belépő",
        );
      }

      if (entryQuality !== null && entryQuality < (config.minEntryQualityScore ?? 62)) {
        queue(
          "minEntryQualityScore",
          next.minEntryQualityScore + delta.minEntryQualityScore,
          `gyenge belépési minőség (${entryQuality}) – szigorítás`,
        );
      }
      if ((trade.confidence || 0) < 60) {
        queue(
          "momentumThreshold",
          next.momentumThreshold + delta.momentumThreshold,
          "alacsony bizalmú veszteség – magasabb momentum küszöb",
        );
      }
      if (regime === "ranging" || regime === "choppy") {
        queue(
          "minOpportunityScore",
          next.minOpportunityScore + delta.minOpportunityScore,
          `${regime} rezsím – magasabb lehetőség-pont`,
        );
      }
    }

    return finalizeLearningChanges(pending, 3);
  }

  function buildNoTradeLooseningChange(botState) {
    const config = botState.config;
    const diagnostics = ensureTradeDiagnostics(botState);
    const topReasons = diagnostics.lastTopReasons || [];
    if (!topReasons.length) return [];

    const next = { ...config };
    const pending = [];
    const runtime = ensureAutoLearnRuntime(botState);
    const reference = diagnostics.lastOpenSuccessAt || runtime.inactivityStartedAt || Date.now();
    const inactivityMinutes = Math.max(1, Math.round((Date.now() - reference) / 60000));
    const delta = AUTO_LEARN_DELTAS;
    const batchSize = config.aggressiveAdaptiveBatchSize ?? 6;

    function loosenOne(key, newValue, label) {
      const reason = `Adaptív helyreállítás ${inactivityMinutes} perc ügylet-szünet után: ${label}`;
      const scratch = { ...next };
      const changes = [];
      proposeLearnChange(scratch, changes, key, newValue, reason, { loosen: true });
      if (changes.length) {
        pending.push(changes[0]);
        next[key] = changes[0].to;
      }
    }

    topReasons.slice(0, 8).forEach(({ key: topKey, label }) => {
      if (pending.length >= batchSize) return;
      if (topKey === "low-confidence") {
        loosenOne("minConfidence", next.minConfidence - delta.minConfidence, label);
      } else if (topKey === "low-opportunity") {
        loosenOne(
          "minOpportunityScore",
          next.minOpportunityScore - delta.minOpportunityScore,
          label,
        );
      } else if (topKey === "entry-quality") {
        loosenOne(
          "minEntryQualityScore",
          next.minEntryQualityScore - delta.minEntryQualityScore,
          label,
        );
        loosenOne(
          "entryQualityReadyThreshold",
          next.entryQualityReadyThreshold - delta.minEntryQualityScore,
          label,
        );
      } else if (topKey === "alignment" && next.requireAlignment) {
        loosenOne("requireAlignment", false, label);
      } else if (topKey === "alignment") {
        loosenOne("minAlignmentRatio", next.minAlignmentRatio - 0.05, label);
      } else if (topKey === "regime" && next.regimeFilter !== "both") {
        loosenOne("regimeFilter", "both", label);
      } else if (topKey === "htf-trend" && next.htfTrendFilterStrength === "strict") {
        loosenOne("htfTrendFilterStrength", "medium", label);
      } else if (topKey === "htf-trend" && next.htfTrendFilterStrength === "medium") {
        loosenOne("htfTrendFilterStrength", "loose", label);
      } else if (topKey === "entry-mode" && next.entryMode !== "both") {
        loosenOne("entryMode", "both", label);
      } else if (topKey === "cooldown") {
        loosenOne("cooldownMinutes", next.cooldownMinutes - delta.cooldownMinutes, label);
      } else if (topKey === "entry-gap") {
        loosenOne("minEntryGapMinutes", next.minEntryGapMinutes - delta.minEntryGapMinutes, label);
      } else if (topKey === "trade-rate") {
        loosenOne("maxTradesPerDay", next.maxTradesPerDay + delta.maxTradesPerDay, label);
        loosenOne("maxTradesPerHour", next.maxTradesPerHour + delta.maxTradesPerHour, label);
      } else if (topKey === "max-positions") {
        loosenOne("maxPositions", next.maxPositions + 1, label);
      } else if (topKey === "low-signal") {
        loosenOne(
          "signalScoreThreshold",
          next.signalScoreThreshold - delta.signalScoreThreshold,
          label,
        );
      } else if (topKey === "direction-filters") {
        loosenOne("momentumThreshold", next.momentumThreshold - delta.momentumThreshold, label);
        loosenOne("longMomentumMin", next.longMomentumMin - delta.longMomentumMin, label);
        loosenOne("shortMomentumMin", next.shortMomentumMin - delta.shortMomentumMin, label);
      } else if (topKey === "daily-trend" && next.blockAgainstDailyTrend) {
        loosenOne("blockAgainstDailyTrend", false, label);
      } else if (topKey === "direction-mode" && next.direction !== "both") {
        loosenOne("direction", "both", label);
      }
    });

    return finalizeLearningChanges(pending, batchSize);
  }

  function learnFromTradeClose(botState, context, trade) {
    if (!botState.config.autoLearnEnabled || !trade || trade.partial) {
      return { applied: false, reason: "Nincs trade-close tanulás.", changes: [] };
    }
    const gate = canApplyAutoLearnChange(botState, botState.config);
    if (!gate.ok) {
      return { applied: false, reason: gate.reason, changes: [], nextReviewAt: gate.nextReviewAt };
    }
    const changes = buildTradeCloseLearningChanges(trade, botState.config);
    if (!changes.length) {
      return { applied: false, reason: "Nincs szükség módosításra ennél az ügyletnél.", changes: [] };
    }
    return applyLearningChanges(botState, changes, {
      trigger: "trade-close",
      tradeId: trade.id,
      activityMessage: `Auto-tanulás (ügylet): ${changes.length} paraméter finomhangolva – ${trade.id?.slice(-8) || "?"}.`,
    });
  }

  function maybeRunNoTradeAutoLearn(botState, context) {
    if (!botState.config.autoLearnEnabled || !botState.config.enabled) return null;
    const config = botState.config;
    const diagnostics = ensureTradeDiagnostics(botState);
    const runtime = ensureAutoLearnRuntime(botState);
    const now = Date.now();
    const lastOpen = diagnostics.lastOpenSuccessAt || 0;
    if (!runtime.inactivityStartedAt) {
      runtime.inactivityStartedAt = lastOpen || botState.lastTickAt || now;
    }
    const rolling = getRollingLearningMetrics(botState, config);
    const decision = Adaptive?.decideCycle
      ? Adaptive.decideCycle({ config, runtime, diagnostics, rolling, now })
      : {
          shouldAdjust:
            now - (lastOpen || runtime.inactivityStartedAt) >=
            (config.autoLearnNoTradeHours ?? 1) * 3600000,
          mode: "activity-recovery",
          maxChanges: 3,
        };
    runtime.lastMonitorAt = now;
    runtime.adaptiveMode = decision.mode;
    runtime.inactivityMinutes = decision.inactivityMinutes || 0;
    if (!decision.shouldAdjust) {
      if (decision.nextReviewAt) runtime.nextReviewAt = decision.nextReviewAt;
      return { applied: false, monitoring: true, mode: decision.mode };
    }

    const gate = canApplyAutoLearnChange(botState, config, { ignoreTargets: true });
    if (!gate.ok) return { applied: false, reason: gate.reason, nextReviewAt: gate.nextReviewAt };

    const blockers = (diagnostics.lastTopReasons || []).slice(0, 8).map((item) => item.label);
    const needsQualityRepair = decision.mode === "quality-repair";
    const qualityPreview = needsQualityRepair
      ? runAggregateAutoLearnPreview(botState, context)
      : null;
    const maxChanges = decision.maxChanges || config.aggressiveAdaptiveBatchSize || 6;
    const changes = needsQualityRepair
      ? finalizeLearningChanges(qualityPreview?.changes || [], maxChanges)
      : buildNoTradeLooseningChange(botState);
    if (!changes?.length) {
      const firstExhaustedNotice = !runtime.recoveryExhausted;
      runtime.recoveryExhausted = true;
      runtime.recoveryBlockers = blockers;
      runtime.lastTrigger = "no-trade-safety-limit";
      runtime.nextReviewAt =
        now + (config.aggressiveAdaptiveReviewMinutes ?? config.autoLearnMinChangeMinutes ?? 5) * 60000;
      if (firstExhaustedNotice) {
        logActivity(
          botState,
          "Auto-tanulás: a biztonságosan lazítható küszöbök elfogytak; a bot tovább figyeli a piacot, de nem kényszerít ügyletet.",
        );
      }
      saveBotState(botState);
      return {
        applied: false,
        reason: "A biztonságos finomhangolási határ elérve; nincs kényszerített belépés.",
        changes: [],
        nextReviewAt: runtime.nextReviewAt,
      };
    }

    diagnostics.lastNoTradeLearnAt = now;
    const inactivityLabel = Math.max(
      config.aggressiveAdaptiveNoTradeMinutes ?? 15,
      Math.round(decision.inactivityMinutes || 0),
    );
    return applyLearningChanges(botState, changes, {
      trigger: needsQualityRepair
        ? "continuous-quality-repair"
        : "continuous-activity-recovery",
      blockers,
      activityMessage: needsQualityRepair
        ? `Folyamatos adaptáció: negatív gördülő teljesítmény → ${changes.length} minőségi/kockázati paraméter javítva.`
        : `Folyamatos adaptáció: ${inactivityLabel} perc ügylet nélkül → ${changes.length} aktivitási/belépési paraméter módosítva, majd teljes újraelemzés indul.`,
    });
  }

  function getAutoLearnStatus(botState, context = null) {
    const config = botState?.config || {};
    const runtime = ensureAutoLearnRuntime(botState || { autoLearnRuntime: createEmptyAutoLearnRuntime() });
    const rolling = botState ? getRollingLearningMetrics(botState, config) : null;
    const targetsMet = botState ? areLearningTargetsMet(botState, context) : false;
    const goal = botState ? getPrimaryLearningGoal(botState, context) : "";
    const maxDaily = config.autoLearnMaxDailyAdjustments ?? 20;
    const minIntervalMs = (config.autoLearnMinChangeMinutes ?? 15) * 60000;
    const nextReviewAt =
      runtime.nextReviewAt && runtime.nextReviewAt > Date.now()
        ? runtime.nextReviewAt
        : runtime.lastChangeAt
          ? runtime.lastChangeAt + minIntervalMs
          : Date.now();

    return {
      active: Boolean(config.autoLearnEnabled),
      dailyCount: runtime.dailyCount,
      maxDaily,
      minIntervalMinutes: config.autoLearnMinChangeMinutes ?? 15,
      lastChangeAt: runtime.lastChangeAt || null,
      lastChangeSummary: runtime.lastChangeSummary || "",
      lastTrigger: runtime.lastTrigger || "",
      lastTradeId: runtime.lastTradeId || null,
      nextReviewAt,
      targetsMet,
      goal,
      rolling,
      targetWinRate: config.autoLearnTargetWinRate ?? 40,
      targetTradesPer6h: config.autoLearnTargetTradesPer6h ?? 1,
      noTradeTimeoutHours: config.autoLearnNoTradeHours ?? 1,
      aggressiveAdaptiveEnabled: Boolean(config.aggressiveAdaptiveEnabled),
      adaptiveReviewMinutes: config.aggressiveAdaptiveReviewMinutes ?? 5,
      adaptiveNoTradeMinutes: config.aggressiveAdaptiveNoTradeMinutes ?? 15,
      adaptiveBatchSize: config.aggressiveAdaptiveBatchSize ?? 6,
      adaptiveMode: runtime.adaptiveMode || "monitoring",
      lastMonitorAt: runtime.lastMonitorAt || null,
      inactivityMinutes: runtime.inactivityMinutes || 0,
      recoveryStep: runtime.recoveryStep || 0,
      recoveryExhausted: Boolean(runtime.recoveryExhausted),
      recoveryBlockers: runtime.recoveryBlockers || [],
    };
  }

  function runAggregateAutoLearnPreview(botState, context) {
    if (botState.trades.length < 5) {
      return {
        applied: false,
        reason: "Legalább 5 lezárt ügylet kell az összesített elemzéshez.",
        changes: [],
      };
    }

    const metrics = getMetrics(botState, context);
    const before = pickLearnable(botState.config);
    const next = { ...botState.config };
    const changes = [];

    function propose(key, newValue, reason, loosen = false) {
      proposeLearnChange(next, changes, key, newValue, reason, { loosen });
    }

    if (metrics.winRate !== null && metrics.winRate < 45) {
      propose(
        "minConfidence",
        next.minConfidence + AUTO_LEARN_DELTAS.minConfidence,
        `Alacsony találati arány (${metrics.winRate.toFixed(1)}%) – szigorúbb belépő.`,
      );
    } else if (metrics.winRate !== null && metrics.winRate > 62 && metrics.profitFactor > 1.3) {
      propose(
        "minConfidence",
        next.minConfidence - AUTO_LEARN_DELTAS.minConfidence,
        `Erős találati arány (${metrics.winRate.toFixed(1)}%) – enyhébb küszöb lehetséges.`,
        true,
      );
    }

    if (metrics.profitFactor !== null && metrics.profitFactor < 1 && metrics.profitFactor !== Infinity) {
      propose("riskPercent", next.riskPercent - AUTO_LEARN_DELTAS.riskPercent, `Profit factor ${metrics.profitFactor.toFixed(2)} – kockázat csökkentése.`);
      propose("rewardRatio", next.rewardRatio + AUTO_LEARN_DELTAS.rewardRatio, "Magasabb cél R arány a vesztes ügyletek kompenzálásához.");
    }

    if (metrics.maxDrawdown > 12) {
      propose("maxPositions", next.maxPositions - 1, `Magas drawdown (${metrics.maxDrawdown.toFixed(1)}%) – kevesebb párhuzamos pozíció.`);
      propose("riskPercent", next.riskPercent - AUTO_LEARN_DELTAS.riskPercent, "Drawdown miatt csökkentett kockázat.");
    }

    const stopLosses = botState.trades.filter(
      (trade) => trade.reason === "Stop-loss" || trade.reason === "Követő stop",
    ).length;
    const stopRatio = botState.trades.length ? stopLosses / botState.trades.length : 0;
    if (stopRatio > 0.5 && botState.trades.length >= 6) {
      propose("atrStopMultiplier", next.atrStopMultiplier + AUTO_LEARN_DELTAS.atrStopMultiplier, "Sok stop-loss – szélesebb ATR stop.");
      propose("signalScoreThreshold", next.signalScoreThreshold + AUTO_LEARN_DELTAS.signalScoreThreshold, "Szigorúbb jelzésküszöb a gyengébb setupok kiszűréséhez.");
      propose("minOpportunityScore", next.minOpportunityScore + AUTO_LEARN_DELTAS.minOpportunityScore, "Magasabb lehetőség-pontszám – kevesebb, de jobb belépés.");
    }

    const dailyPnl = getDailyRealizedPnl(botState);
    if (dailyPnl < 0 && Math.abs(dailyPnl) > botState.initialCapital * 0.03) {
      propose("maxPositions", Math.max(1, next.maxPositions - 1), "Negatív napi eredmény – kevesebb párhuzamos pozíció.");
      propose("cooldownMinutes", next.cooldownMinutes + AUTO_LEARN_DELTAS.cooldownMinutes, "Negatív nap – hosszabb pihenő új belépések között.");
    }

    const finalized = finalizeLearningChanges(
      changes,
      botState.config.aggressiveAdaptiveBatchSize ?? 6,
    );
    const after = pickLearnable({ ...next, ...Object.fromEntries(finalized.map((c) => [c.key, c.to])) });
    if (!finalized.length) {
      return { applied: false, reason: "Nincs szükség módosításra.", changes: [], before, after: before };
    }
    return { applied: false, preview: true, trigger: "manual-preview", before, after, changes: finalized };
  }

  function runAutoLearn(botState, context, options = {}) {
    const { dryRun = false, trigger = "manual", trade = null } = options;
    if (!dryRun && !botState.config.autoLearnEnabled) return null;

    if (trigger === "trade-close" && trade) {
      if (dryRun) {
        const changes = buildTradeCloseLearningChanges(trade, botState.config);
        return {
          applied: false,
          preview: true,
          trigger,
          changes,
          reason: changes.length ? null : "Nincs javasolt módosítás ehhez az ügylethez.",
        };
      }
      return learnFromTradeClose(botState, context, trade);
    }

    if (trigger === "no-trade-timeout") {
      if (dryRun) {
        const changes = buildNoTradeLooseningChange(botState) || [];
        return { applied: false, preview: true, trigger, changes };
      }
      return maybeRunNoTradeAutoLearn(botState, context);
    }

    const preview = runAggregateAutoLearnPreview(botState, context);
    if (dryRun || !preview.changes?.length) {
      return preview;
    }

    const gate = canApplyAutoLearnChange(botState, botState.config, { ignoreInterval: trigger === "manual-apply" });
    if (!gate.ok) {
      return { applied: false, reason: gate.reason, changes: [], nextReviewAt: gate.nextReviewAt };
    }

    return applyLearningChanges(botState, preview.changes, {
      trigger: trigger || "manual-apply",
      activityMessage: `Auto-tanulás (összesített): ${preview.changes.length} paraméter módosítva.`,
    });
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

    const tradeDiag = getTradeDiagnostics(botState, context);
    if (tradeDiag.isStale) {
      suggestions.push({
        severity: "warning",
        title: "Hosszú ideje nincs új ügylet",
        detail:
          tradeDiag.topReasons.length > 0
            ? `${tradeDiag.hoursSinceOpenLabel} – fő okok: ${tradeDiag.topReasons
                .slice(0, 3)
                .map((entry) => entry.label)
                .join(", ")}`
            : `${tradeDiag.hoursSinceOpenLabel} nem nyitott ügyletet – ellenőrizd a szűrőket és az adatokat.`,
      });
      tradeDiag.suggestions.slice(0, 2).forEach((item) => {
        suggestions.push({
          severity: "info",
          title: "Finomhangolási tipp",
          detail: item.detail,
        });
      });
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
    CONFIG_PRESETS,
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
    getTradeDiagnostics,
    applyConfigPreset,
    getEffectiveThresholds,
    getBotTickIntervalMs,
    tick,
    analyzeSignal,
    analyzeEntryQuality,
    analyzeHoldVsExit,
    scanMarketOpportunities,
    runStrategyArena,
    evaluateOpportunity,
    getScanAssetKeys,
    getTradeableAssetKeys,
    computeOpportunityScore,
    compareOpportunityResults,
    buildSuggestions,
    runAutoLearn,
    getAutoLearnStatus,
    refreshIntelligenceState,
    ensureStrategyArenaState,
    evaluateAutomaticConfigRollback,
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
