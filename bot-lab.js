(function () {
  "use strict";

  const Catalog = window.AssetCatalog;
  const Bot = window.VirtualBot;
  if (!Bot || !Catalog) return;

  let bridge = null;
  let equityChart = null;
  let lastLearnPreview = null;
  let activeSection = "summary";

  const BOT_SECTIONS = [
    "summary",
    "intelligence",
    "scanner",
    "settings",
    "trades",
    "experiences",
  ];

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
    { id: "botLongMomentumMin", key: "longMomentumMin", type: "range", decimals: 2 },
    { id: "botShortMomentumMin", key: "shortMomentumMin", type: "range", decimals: 2 },
    { id: "botSignalScore", key: "signalScoreThreshold", type: "range", decimals: 2 },
    { id: "botMinOpportunityScore", key: "minOpportunityScore", type: "range", decimals: 0 },
    { id: "botMinEntryQualityScore", key: "minEntryQualityScore", type: "range", decimals: 0 },
    { id: "botEntryQualityReady", key: "entryQualityReadyThreshold", type: "range", decimals: 0 },
    { id: "botEntryQualityWait", key: "entryQualityWaitThreshold", type: "range", decimals: 0 },
    { id: "botMinAlignmentRatio", key: "minAlignmentRatio", type: "range", decimals: 0, displayScale: 100 },
    { id: "botMinAlignedTimeframes", key: "minAlignedTimeframes", type: "number" },
    { id: "botAtrPeriod", key: "atrPeriod", type: "number" },
    { id: "botAtrStopMultiplier", key: "atrStopMultiplier", type: "range", decimals: 2 },
    { id: "botAtrStopMultiplierLong", key: "atrStopMultiplierLong", type: "range", decimals: 2 },
    { id: "botAtrStopMultiplierShort", key: "atrStopMultiplierShort", type: "range", decimals: 2 },
    { id: "botRewardRatio", key: "rewardRatio", type: "range", decimals: 2 },
    { id: "botTrailingAtrMultiplier", key: "trailingAtrMultiplier", type: "range", decimals: 2 },
    { id: "botTrailingActivationR", key: "trailingActivationR", type: "range", decimals: 2 },
    { id: "botPartialTakeProfitR", key: "partialTakeProfitR", type: "range", decimals: 2 },
    { id: "botPartialTakeProfitPercent", key: "partialTakeProfitPercent", type: "range", decimals: 0 },
    { id: "botReversalMinConfidence", key: "reversalMinConfidence", type: "range", decimals: 0 },
    { id: "botReversalMinScore", key: "reversalMinScore", type: "range", decimals: 2 },
    { id: "botMaxPositionAge", key: "maxPositionAgeMinutes", type: "range", decimals: 0 },
    { id: "botMinHoldMinutes", key: "minHoldMinutes", type: "range", decimals: 0 },
    { id: "botMinSellUrgency", key: "minSellUrgencyScore", type: "range", decimals: 0 },
    { id: "botVolumeMultiplier", key: "volumeMultiplier", type: "range", decimals: 1 },
    { id: "botMaxTradesPerDay", key: "maxTradesPerDay", type: "range", decimals: 0 },
    { id: "botMaxTradesPerHour", key: "maxTradesPerHour", type: "range", decimals: 0 },
    { id: "botMinEntryGap", key: "minEntryGapMinutes", type: "range", decimals: 0 },
    { id: "botAutoLearnMaxDaily", key: "autoLearnMaxDailyAdjustments", type: "range", decimals: 0 },
    { id: "botAutoLearnMinInterval", key: "autoLearnMinChangeMinutes", type: "range", decimals: 0 },
    { id: "botAutoLearnTargetWinRate", key: "autoLearnTargetWinRate", type: "range", decimals: 0 },
    { id: "botAutoLearnTargetTrades6h", key: "autoLearnTargetTradesPer6h", type: "range", decimals: 0 },
    { id: "botAdaptiveReviewMinutes", key: "aggressiveAdaptiveReviewMinutes", type: "range", decimals: 0 },
    { id: "botAdaptiveNoTradeMinutes", key: "aggressiveAdaptiveNoTradeMinutes", type: "range", decimals: 0 },
    { id: "botAdaptiveBatchSize", key: "aggressiveAdaptiveBatchSize", type: "range", decimals: 0 },
    { id: "botMinimumSetupSamples", key: "minimumSetupSamples", type: "range", decimals: 0 },
    { id: "botMaximumOpenRisk", key: "maximumOpenRiskPercent", type: "range", decimals: 1 },
    { id: "botMaximumGroupRisk", key: "maximumGroupRiskPercent", type: "range", decimals: 1 },
    { id: "botMaximumConsecutiveLosses", key: "maximumConsecutiveLosses", type: "range", decimals: 0 },
    { id: "botMaximumWeeklyLoss", key: "maximumWeeklyLossPercent", type: "range", decimals: 1 },
    { id: "botMaxDailyLoss", key: "maxDailyLossPercent", type: "range", decimals: 1 },
    { id: "botFeePercent", key: "feePercent", type: "number" },
    { id: "botSpreadPercent", key: "spreadPercent", type: "number" },
    { id: "botSlippagePercent", key: "slippagePercent", type: "number" },
    { id: "botTradingHoursStart", key: "tradingHoursStart", type: "number" },
    { id: "botTradingHoursEnd", key: "tradingHoursEnd", type: "number" },
    { id: "botEntryMode", key: "entryMode", type: "select" },
    { id: "botRegimeFilter", key: "regimeFilter", type: "select" },
    { id: "botHtfTrendStrength", key: "htfTrendFilterStrength", type: "select" },
    { id: "botScannerPriority", key: "scannerRefreshPriority", type: "select" },
  ];

  const CHECKBOX_FIELDS = [
    { id: "botEnabled", key: "enabled" },
    { id: "botProfessionalMode", key: "professionalMode" },
    { id: "botAutoLearn", key: "autoLearnEnabled" },
    { id: "botAggressiveAdaptive", key: "aggressiveAdaptiveEnabled" },
    { id: "botMarketWideMode", key: "marketWideMode" },
    { id: "botAutoClose", key: "autoCloseOnReversal" },
    { id: "botUseMacd", key: "useMacd" },
    { id: "botUseVolume", key: "useVolume" },
    { id: "botRequireAlignment", key: "requireAlignment" },
    { id: "botBlockAgainstDailyTrend", key: "blockAgainstDailyTrend" },
    { id: "botUseTrailingStop", key: "useTrailingStop" },
    { id: "botPartialTakeProfit", key: "partialTakeProfitEnabled" },
    { id: "botIntelligenceEnabled", key: "intelligenceEnabled" },
    { id: "botAutoConfigRollback", key: "autoConfigRollbackEnabled" },
    { id: "botUseTradingHours", key: "useTradingHours" },
  ];

  const SETTING_HELP = {
    botCurrency: {
      what: "Meghatározza, milyen pénznemben látod a bot tőkéjét és eredményeit.",
      raise: "Ha USD-ben gondolkodsz, válaszd a szinkron vagy USD opciót.",
      lower: "HUF/EUR csak megjelenítés – a belső számítás USD-ben marad.",
    },
    botInitialCapital: {
      what: "A virtuális számla induló összege. Ebből számolja a pozícióméretet és a kockázatot.",
      raise: "Nagyobb tőke = nagyobb abszolút pozíciók, de a % kockázat ugyanaz marad.",
      lower: "Kisebb tőkével óvatosabban tesztelhetsz stratégiát.",
    },
    botMaxPositions: {
      what: "Egyszerre hány ügylet lehet nyitva. Több pozíció = több expozíció.",
      raise: "Ha diverzifikálnál több eszközre és van elég tőke.",
      lower: "Ha koncentráltabb, kevésbé szétszórt kereskedést szeretnél.",
    },
    botCooldown: {
      what: "Két ügylet közötti minimum várakozás ugyanazon az eszközön. Csökkenti az overtradinget.",
      raise: "Ha túl sok egymás utáni belépést látsz ugyanazon a piacon.",
      lower: "Ha a bot túl ritkán lép be jó setupokra (pro módban kevésbé számít).",
    },
    botPrimaryInterval: {
      what: "Melyik gyertya-idősíkon értékeli a jeleket. Rövidebb = gyorsabb, zajosabb.",
      raise: "15–60 perc stabilabb trendekhez; kevesebb, de tisztább jel.",
      lower: "1–5 perc aktívabb piacokhoz; több lehetőség, több zaj.",
    },
    botDirection: {
      what: "Mely irányokban kereskedhet: LONG, SHORT vagy mindkettő.",
      raise: "Both, ha mindkét irányban látod az esélyt.",
      lower: "Csak LONG vagy SHORT, ha egy irányban jobb a statisztikád.",
    },
    botAutoClose: {
      what: "Ellentétes erős jelzésnél automatikusan zárja a pozíciót.",
      raise: "Bekapcsolva, ha gyorsan reagálnál trendfordulásra.",
      lower: "Kikapcsolva, ha a stop/target és trailing stopot bízod a zárásra.",
    },
    botMarketWideMode: {
      what: "Az összes követett eszközt szkenneli, és a legjobb lehetőséget választja.",
      raise: "Bekapcsolva a legtöbb felhasználónak – nem maradsz le a legjobb setupról.",
      lower: "Kikapcsolva, ha csak konkrét eszközökre akarsz fókuszálni.",
    },
    botProHighScore: {
      what: "Pro módban: ha a lehetőség pontszám eléri ezt, nyertes ügylet után is azonnal beléphet.",
      raise: "Magasabb érték = csak kivételesen erős jeleknél ugrik be gyorsan.",
      lower: "Alacsonyabb érték = több azonnali belépés pro módban.",
    },
    botProWinCooldown: {
      what: "Pro módban nyertes ügylet után ennyi percet vár, mielőtt újra belép (ha nincs magas pontszám).",
      raise: "Hosszabb pihenő = kevesebb overtrading nyertes szériában.",
      lower: "Rövidebb pihenő = aktívabb kereskedés pro módban.",
    },
    botProConfidenceFloor: {
      what: "Pro mód minimális bizalmi padlója – ennél alacsonyabb jelzést nem vesz figyelembe.",
      raise: "Magasabb padló = kevesebb, de megbízhatóbb belépés.",
      lower: "Alacsonyabb padló = több lehetőség, de több zaj.",
    },
    botMinConfidence: {
      what: "A jelzés megbízhatósági százaléka. Csak ez felett nyit ügyletet.",
      raise: "65–75% között, ha kevesebb, de jobb minőségű trade-et akarsz.",
      lower: "55–60% körül, ha több belépést szeretnél adatvezérelten.",
    },
    botSignalScore: {
      what: "A technikai jel erőssége (EMA, RSI, MACD, momentum összpontszám).",
      raise: "3–3.5: szigorúbb, kevesebb hamis jel.",
      lower: "2.5–2.75: több belépés, még mindig szűrt.",
    },
    botMinOpportunityScore: {
      what: "Összesített lehetőség-pontszám (bizalom + jel + egyezés + momentum). Fő belépési szűrő.",
      raise: "75–90: csak kiváló setupok.",
      lower: "60–70: merészebb, de még adatvezérelt kereskedés.",
    },
    botMinEntryQualityScore: {
      what: "Belépési minőség minimuma (piaci struktúra, HTF, volumen, S/R).",
      raise: "70+: csak tiszta, jól felépült setupok.",
      lower: "58–65: erős VÁR állapotú setupok is beléphetnek.",
    },
    botEntryQualityReady: {
      what: "KÉSZ küszöb: e pontszám felett „készen áll” a belépésre a piaci kép.",
      raise: "70+: csak teljesen kialakult setup.",
      lower: "58–65: korábbi belépés, ha többi szűrő is teljesül.",
    },
    botEntryQualityWait: {
      what: "VÁR küszöb: köztes zóna – még kialakul, de erős setupnál beléphet.",
      raise: "50+: kevesebb korai belépés.",
      lower: "38–45: több „majdnem kész” setup is megfontolható.",
    },
    botMomentumThreshold: {
      what: "Minimum ármozgás % az utolsó N percben. Megerősíti a trend irányát.",
      raise: "0.15–0.25%: csak erős momentum.",
      lower: "0.08–0.12%: lassabb piacokon is belép.",
    },
    botLongMomentumMin: {
      what: "LONG irányhoz szükséges minimum pozitív momentum.",
      raise: "Magasabb = csak erős emelkedő lendület.",
      lower: "Alacsonyabb = több LONG lehetőség.",
    },
    botShortMomentumMin: {
      what: "SHORT irányhoz szükséges minimum negatív momentum.",
      raise: "Magasabb = csak erős eső lendület.",
      lower: "Alacsonyabb = több SHORT lehetőség.",
    },
    botRequireAlignment: {
      what: "Több idősíknak is egy irányba kell mutatnia (pl. 1p, 5p, 15p).",
      raise: "Bekapcsolva: kevesebb, de jobban megerősített jel.",
      lower: "Kikapcsolva: több belépés, kevesebb megerősítés.",
    },
    botMinAlignmentRatio: {
      what: "Az idősíkok hány százalékának kell egyeznie (pl. 70% = 7/10 idősík).",
      raise: "80–100%: szigorú egyezés.",
      lower: "60–70%: lazább, több setup átmegy.",
    },
    botBlockAgainstDailyTrend: {
      what: "Napi trend ellen nem nyit pozíciót (pl. napi csökkenésben nem LONG).",
      raise: "Bekapcsolva: trendkövetőbb stratégia.",
      lower: "Kikapcsolva: kontratrend setupok is megengedettek.",
    },
    botUseMacd: {
      what: "MACD (EMA12–EMA26) megerősíti az irányt. LONG-nál EMA9 > EMA21 kell.",
      raise: "Bekapcsolva: kevesebb hamis keresztezés.",
      lower: "Kikapcsolva: gyorsabb piacokon több jel.",
    },
    botUseVolume: {
      what: "Átlag feletti forgalom kell a belépéshez – megerősíti a mozgást.",
      raise: "Bekapcsolva: csak likvidebb, megbízhatóbb pillanatok.",
      lower: "Kikapcsolva: alacsony volumenű piacokon is belép.",
    },
    botRiskPercent: {
      what: "Egy ügyleten kockáztatott tőke %-a (stop távolság alapján számolja a méretet).",
      raise: "2–3%: agresszívebb, nagyobb pozíciók.",
      lower: "0.5–1%: konzervatív, kisebb drawdown.",
    },
    botAtrStopMultiplier: {
      what: "Stop-loss távolság = ATR × szorzó. Nagyobb szorzó = tágabb stop.",
      raise: "3–4: kevésbé zavar ki zaj, de nagyobb veszteség/ügylet.",
      lower: "1.5–2: szűkebb stop, gyorsabb kiszállás.",
    },
    botRewardRatio: {
      what: "Célár távolsága a stop-hoz képest (R arány). 2.5 = cél 2.5× a kockázat.",
      raise: "3–5: nagyobb profitcél, kevesebb találati arány is lehet.",
      lower: "1.5–2: közelebbi cél, gyakoribb TP.",
    },
    botMaxDailyLoss: {
      what: "Ha a napi realizált veszteség eléri ezt a %-ot, a bot nem nyit új pozíciót.",
      raise: "8–12%: lazább napi limit.",
      lower: "3–5%: szigorú védelem rossz napokon.",
    },
    botUseTrailingStop: {
      what: "Nyereséges pozíciónál a stop követi az árat (ATR alapú).",
      raise: "Bekapcsolva: több profitot hagyhat bent futó trendben.",
      lower: "Kikapcsolva: fix stop/target, egyszerűbb viselkedés.",
    },
    botPartialTakeProfit: {
      what: "Eléri az 1R-t (vagy beállított R-t), részben realizál profitot.",
      raise: "Bekapcsolva: biztosítja a nyereség egy részét.",
      lower: "Kikapcsolva: mindent vagy stop, vagy teljes cél zár.",
    },
    botReversalMinConfidence: {
      what: "Ellentétes jelzésnél zárás minimum bizalma.",
      raise: "75–85%: csak erős fordulójel zár.",
      lower: "60–70%: érzékenyebb fordulás-figyelés.",
    },
    botFeePercent: {
      what: "Szimulált kereskedési díj oldalanként (%). Realisztikusabb eredmény.",
      raise: "Magasabb díj = konzervatívabb nettó PnL becslés.",
      lower: "Alacsonyabb díj, ha alacsony költségű brókert modellezel.",
    },
    botMinHoldMinutes: {
      what: "Minimum perc, amíg a bot nem zár csak jelzés vagy időlimit miatt – csökkenti a túl korai kilépést.",
      raise: "20–30 perc: hagyja futni a setupot.",
      lower: "5–10 perc scalp stílusban.",
    },
    botMinSellUrgency: {
      what: "Tartás vs eladás döntésnél: ennyi pont kell az eladáshoz. Magasabb = nehezebb korai zárás.",
      raise: "65+: csak erős ellenjel zár.",
      lower: "45–50: érzékenyebb profitvédelem.",
    },
    botVolumeMultiplier: {
      what: "Hány szorosa kell legyen a forgalom az átlagnak a volumen-megerősítéshez.",
      raise: "1.8–2.5×: csak erős volumen-spike.",
      lower: "1.2–1.4: több setup átmegy.",
    },
    botMaxTradesPerDay: {
      what: "Napi maximum nyitott ügyletek száma – overtrading védelem.",
      raise: "15+: aktívabb napokhoz.",
      lower: "5–8: konzervatív profil.",
    },
    botMaxTradesPerHour: {
      what: "Óránkénti ügylet limit – burst védelem.",
      raise: "6–8: scalp mód.",
      lower: "2–3: lassabb kereskedés.",
    },
    botMinEntryGap: {
      what: "Globális minimum várakozás két belépés között (függetlenül az eszköztől).",
      raise: "20–30 perc: kevesebb egymás utáni belépés.",
      lower: "0–5 perc: aktívabb kereskedés.",
    },
    botEntryMode: {
      what: "Breakout = erős momentum + volumen; pullback = visszahúzódás RSI zónában.",
      raise: "Válaszd ki az egyik módot, ha túl sok zajos belépés van.",
      lower: "Both, ha mindkét setup típust használnád.",
    },
    botRegimeFilter: {
      what: "Milyen piaci rezsimben kereskedhet: trendelő, oldalazó vagy mindkettő.",
      raise: "Trendelő: kevesebb, de irányultságú setup.",
      lower: "Both: több lehetőség, de zajosabb piacokon is.",
    },
    botHtfTrendStrength: {
      what: "Magasabb idősíkok (15p, 1ó) trend-egyezésének szigorúsága belépés előtt.",
      raise: "Szigorú: minden HTF egyezés kell.",
      lower: "Laza: nincs HTF tiltás.",
    },
    botScannerPriority: {
      what: "Milyen gyakran frissítse a piaci szkennert pro módban.",
      raise: "Minőség: ritkább, de stabilabb scan.",
      lower: "Gyors: több scan, reaktívabb bot.",
    },
  };

  const PARAM_LABELS = {
    minConfidence: "Min. megbízhatóság",
    riskPercent: "Kockázat / ügylet",
    cooldownMinutes: "Cooldown (perc)",
    maxPositions: "Max. pozíció",
    rewardRatio: "Cél R arány",
    atrStopMultiplier: "ATR stop szorzó",
    atrStopMultiplierLong: "ATR stop LONG",
    atrStopMultiplierShort: "ATR stop SHORT",
    signalScoreThreshold: "Jelzésküszöb",
    requireAlignment: "Idősík-egyezés kötelező",
    blockAgainstDailyTrend: "Napi trend ellen tiltás",
    momentumThreshold: "Momentum küszöb",
    longMomentumMin: "LONG momentum min",
    shortMomentumMin: "SHORT momentum min",
    minOpportunityScore: "Min. lehetőség pontszám",
    maxDailyLossPercent: "Max. napi veszteség %",
    trailingAtrMultiplier: "Követő ATR szorzó",
    trailingActivationR: "Követő aktiválás (R)",
    partialTakeProfitR: "Részleges TP (R)",
    partialTakeProfitPercent: "Részleges TP %",
    reversalMinConfidence: "Fordulás min. bizalom",
    reversalMinScore: "Fordulás min. pontszám",
    maxPositionAgeMinutes: "Max. pozíció életkor (perc)",
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

  function getSettingTitle(element) {
    if (!element) return "Beállítás";
    const header = element.querySelector(".control-header span:first-child");
    if (header?.textContent) return header.textContent.trim();
    const toggle = element.querySelector(".toggle-label");
    if (toggle?.textContent) return toggle.textContent.trim();
    const firstText = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      .map((node) => node.textContent.trim())[0];
    if (firstText) return firstText;
    const label = element.closest("label");
    if (label && label !== element) return getSettingTitle(label);
    return "Beállítás";
  }

  function buildSettingHelpPanel(controlId, title) {
    const help = SETTING_HELP[controlId];
    if (!help) return null;
    const panel = document.createElement("div");
    panel.className = "bot-setting-help";
    panel.hidden = true;
    panel.innerHTML = `
      <p><strong>Mi ez?</strong> ${help.what}</p>
      <p><strong>Emeld, ha…</strong> ${help.raise}</p>
      <p><strong>Csökkentsd, ha…</strong> ${help.lower}</p>
    `;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "bot-help-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Mi ez?";
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      panel.hidden = expanded;
      toggle.textContent = expanded ? "Mi ez?" : "Elrejtés";
    });
    const header = document.createElement("div");
    header.className = "bot-setting-card-header";
    const heading = document.createElement("p");
    heading.className = "bot-setting-card-title";
    heading.textContent = title;
    header.append(heading, toggle);
    return { header, panel };
  }

  function enhanceBotSettingCards() {
    const form = document.getElementById("botConfigForm");
    if (!form || form.dataset.cardsEnhanced) return;
    form.dataset.cardsEnhanced = "1";

    const controlIds = [
      ...CONFIG_FIELDS.map((field) => field.id),
      ...CHECKBOX_FIELDS.map((field) => field.id),
      "botCurrency",
    ];

    controlIds.forEach((controlId) => {
      const control = document.getElementById(controlId);
      if (!control) return;
      const host =
        control.closest("label.control-slider, label.toggle-switch, label") ||
        control.parentElement;
      if (!host || host.closest(".bot-setting-card") || host.classList.contains("bot-asset-fieldset")) {
        return;
      }

      const title = getSettingTitle(host);
      const parts = buildSettingHelpPanel(controlId, title);
      if (!parts) return;

      const card = document.createElement("div");
      card.className = "bot-setting-card";
      card.dataset.settingId = controlId;
      host.parentNode.insertBefore(card, host);
      card.append(parts.header, host, parts.panel);
    });

    const proInfo = form.querySelector(".bot-pro-info");
    if (proInfo && !proInfo.closest(".bot-setting-card")) {
      const card = document.createElement("div");
      card.className = "bot-setting-card bot-setting-card-info";
      proInfo.parentNode.insertBefore(card, proInfo);
      card.append(proInfo);
    }

    const syncPanel = document.getElementById("botCloudSyncPanel");
    if (syncPanel && !syncPanel.closest(".bot-setting-card")) {
      const card = document.createElement("div");
      card.className = "bot-setting-card bot-setting-card-sync";
      syncPanel.parentNode.insertBefore(card, syncPanel);
      card.append(syncPanel);
    }
  }

  function renderCloudSyncStatus() {
    const panel = document.getElementById("botCloudSyncPanel");
    if (!panel || !Bot.getCloudSyncStatus) return;
    const sync = Bot.getCloudSyncStatus();
    const statusEl = panel.querySelector("[data-sync-status]");
    const detailEl = panel.querySelector("[data-sync-detail]");
    const userEl = panel.querySelector("[data-sync-user]");
    if (!statusEl || !detailEl || !userEl) return;

    const labels = {
      idle: "Várakozás",
      syncing: "Szinkronizálás…",
      synced: "Szinkronban",
      offline: "Offline / helyi",
      conflict: "Ütközés",
    };
    statusEl.textContent = labels[sync.status] || sync.status;
    panel.dataset.syncState = sync.status;

    if (sync.status === "synced" && sync.lastSyncedAt) {
      detailEl.textContent = `Utolsó szinkron: ${new Date(sync.lastSyncedAt).toLocaleString("hu-HU")}`;
    } else if (sync.error) {
      detailEl.textContent = sync.error;
    } else if (sync.status === "offline") {
      detailEl.textContent = "Helyi mentés aktív – online állapotban automatikusan szinkronizál.";
    } else {
      detailEl.textContent = "Ügyletek, tanulási napló és beállítások eszközök között megosztva.";
    }

    const shortId = sync.userId ? `${sync.userId.slice(0, 8)}…` : "–";
    userEl.textContent = shortId;
    userEl.title = sync.userId || "";
  }

  function logToggleChange(key, from, to, source, reason) {
    const botState = getBotState();
    if (!botState || from === to) return;
    Bot.logConfigChanges(botState, source, [{ key, from, to, reason }], reason);
  }

  function bindEvents() {
    const checks = document.getElementById("botAssetChecks");
    if (checks) {
      const categories = [
        { id: "crypto", label: "Kripto" },
        { id: "forex", label: "Deviza" },
        { id: "commodity", label: "Árucikk" },
        { id: "index", label: "Index" },
        { id: "etf", label: "ETF" },
        { id: "stock", label: "Részvény" },
      ];
      const groups = categories
        .map((category) => {
          const keys = Catalog.ALL_KEYS.filter(
            (assetKey) => Catalog.getAsset(assetKey)?.category === category.id,
          );
          if (!keys.length) return null;
          const group = document.createElement("div");
          group.className = "bot-asset-group";
          const title = document.createElement("p");
          title.className = "bot-asset-group-title";
          title.textContent = `${category.label} (${keys.length})`;
          const chips = document.createElement("div");
          chips.className = "bot-asset-group-chips";
          keys.forEach((assetKey) => {
            const meta = Catalog.getAsset(assetKey);
            const label = document.createElement("label");
            label.className = `toggle-chip${meta.featured ? " featured-asset-check" : ""}`;
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = assetKey;
            const text = document.createElement("span");
            text.textContent = meta.name;
            label.append(input, text);
            chips.append(label);
          });
          group.append(title, chips);
          return group;
        })
        .filter(Boolean);
      checks.replaceChildren(...groups);
    }

    bindSliderOutputs();

    document.getElementById("botEnabled")?.addEventListener("change", (event) => {
      const botState = getBotState();
      if (!botState) return;
      const from = botState.config.enabled;
      botState.config.enabled = event.target.checked;
      logToggleChange(
        "enabled",
        from,
        event.target.checked,
        "beállítás",
        event.target.checked ? "Bot bekapcsolva" : "Bot kikapcsolva",
      );
      Bot.saveBotState(botState);
      render();
      bridge?.scheduleBotTick?.();
      if (botState.config.enabled) bridge?.runTick?.();
    });

    document.getElementById("botProfessionalMode")?.addEventListener("change", (event) => {
      const botState = getBotState();
      if (!botState) return;
      const from = botState.config.professionalMode;
      botState.config.professionalMode = event.target.checked;
      logToggleChange(
        "professionalMode",
        from,
        event.target.checked,
        "pro mód",
        event.target.checked
          ? "Professzionális mód bekapcsolva – gyorsabb reagálás"
          : "Professzionális mód kikapcsolva",
      );
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
      const from = botState.config.autoLearnEnabled;
      botState.config.autoLearnEnabled = event.target.checked;
      logToggleChange(
        "autoLearnEnabled",
        from,
        event.target.checked,
        "beállítás",
        event.target.checked ? "Auto-tanulás bekapcsolva" : "Auto-tanulás kikapcsolva",
      );
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
      const from = botState.config.marketWideMode;
      botState.config.marketWideMode = event.target.checked;
      logToggleChange(
        "marketWideMode",
        from,
        event.target.checked,
        "beállítás",
        event.target.checked ? "Piaci mód bekapcsolva" : "Kézi eszközválasztás",
      );
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
    document.getElementById("botCopyUserId")?.addEventListener("click", async () => {
      const userId = Bot.getOrCreateBotUserId?.();
      if (!userId) return;
      try {
        await navigator.clipboard.writeText(userId);
        bridge?.showToast?.("Bot azonosító vágólapra másolva.");
      } catch {
        bridge?.showToast?.("Nem sikerült másolni – másold ki kézzel az azonosítót.");
      }
    });
    document.getElementById("botRunLearnButton")?.addEventListener("click", runLearnPreview);
    document.getElementById("botApplyLearnButton")?.addEventListener("click", applyLearnPreview);

    document.querySelectorAll("[data-bot-config-tab]").forEach((button) => {
      button.addEventListener("click", () => switchConfigTab(button.dataset.botConfigTab));
    });

    document.querySelectorAll("[data-bot-section]").forEach((button) => {
      button.addEventListener("click", () => switchSection(button.dataset.botSection));
    });

    document.getElementById("botClearChangeLog")?.addEventListener("click", clearChangeLog);
    document.getElementById("botExportChangeLog")?.addEventListener("click", exportChangeLog);

    document.querySelectorAll("[data-bot-preset]").forEach((button) => {
      button.addEventListener("click", () => applyPreset(button.dataset.botPreset));
    });

    document.getElementById("botCurrency")?.addEventListener("change", () => {
      const botState = getBotState();
      if (!botState) return;
      const previousCurrency = getBotCurrency(botState.config);
      const previousChoice = botState.config.currency || "sync";
      const nextChoice = document.getElementById("botCurrency").value;
      const nextCurrency = nextChoice === "sync"
        ? bridge.getBotCurrency?.({ currency: "sync" }) || previousCurrency
        : nextChoice;
      if (nextCurrency !== "USD" && !bridge.areExchangeRatesReady?.()) {
        document.getElementById("botCurrency").value = previousChoice;
        bridge?.showToast?.("Devizaárfolyamok betöltése folyamatban – várj a pénznem váltásával.");
        return;
      }
      const capitalInput = document.getElementById("botInitialCapital");
      const displayValue = Number(capitalInput?.value);
      if (Number.isFinite(displayValue) && displayValue > 0) {
        const usdValue = bridge.convertFromCurrency(displayValue, previousCurrency);
        botState.config.currency = nextChoice;
        if (capitalInput) {
          const converted = bridge.convertToCurrency(usdValue, nextCurrency);
          capitalInput.value =
            nextCurrency === "HUF"
              ? String(Math.round(converted))
              : String(Math.round(converted * 100) / 100);
        }
      } else {
        botState.config.currency = nextChoice;
      }
      logToggleChange(
        "currency",
        previousChoice,
        botState.config.currency,
        "kézi",
        "Pénznem módosítva",
      );
      Bot.saveBotState(botState);
      syncCapitalField(botState.config);
      render();
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

  function getBotCurrency(config) {
    return bridge?.getBotCurrency?.(config || getBotState()?.config) || "USD";
  }

  function updateCurrencyUi(currency, syncLabel = true) {
    const label = document.getElementById("botInitialCapitalLabel");
    const input = document.getElementById("botInitialCapital");
    const summaryCurrency = document.getElementById("botSummaryCurrency");
    const displayCurrency =
      document.getElementById("botCurrency")?.value === "sync"
        ? `${currency} (szinkron)`
        : currency;
    if (label && syncLabel) {
      const labelText = document.getElementById("botCapitalLabelText");
      if (labelText) labelText.textContent = `Kezdőtőke (${currency})`;
    }
    if (summaryCurrency) summaryCurrency.textContent = displayCurrency;
    if (input) {
      const minUsd = 100;
      const minDisplay = Math.max(1, Math.round(bridge.convertToCurrency(minUsd, currency)));
      input.min = String(minDisplay);
      input.step = currency === "HUF" ? "10000" : currency === "EUR" ? "100" : "100";
    }
  }

  function syncCapitalField(config) {
    const currency = getBotCurrency(config);
    const element = document.getElementById("botInitialCapital");
    if (!element) return;
    if (currency !== "USD" && !bridge.areExchangeRatesReady?.()) {
      element.dataset.capitalSyncPending = "1";
      return;
    }
    delete element.dataset.capitalSyncPending;
    const converted = bridge.convertToCurrency(config.initialCapital, currency);
    element.value =
      currency === "HUF" ? String(Math.round(converted)) : String(Math.round(converted * 100) / 100);
    updateCurrencyUi(currency);
  }

  function isSuspiciousCapitalConversion(displayCapital, usdCapital, currency) {
    if (currency === "USD" || !bridge.areExchangeRatesReady?.()) return false;
    if (!(displayCapital >= 1000) || usdCapital >= 50) return false;
    return true;
  }

  function switchConfigTab(tab) {
    const validTabs = ["general", "entry", "exit", "signals", "risk", "execution", "pro", "sync"];
    if (!validTabs.includes(tab)) tab = "general";

    document.querySelectorAll("[data-bot-config-tab]").forEach((button) => {
      const isActive = button.dataset.botConfigTab === tab;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", String(isActive));
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
      if (!element || key === "initialCapital") return;
      const value = config[key] ?? Bot.DEFAULT_CONFIG[key];
      if (config[key] === undefined && value !== undefined) config[key] = value;
      if (type === "number" || type === "range") element.value = value;
      else element.value = value;
    });

    CONFIG_FIELDS.filter((field) => field.type === "range").forEach(updateSliderOutput);

    CHECKBOX_FIELDS.forEach(({ id, key }) => {
      const element = document.getElementById(id);
      const value = config[key] ?? Bot.DEFAULT_CONFIG[key];
      if (config[key] === undefined && value !== undefined) config[key] = value;
      if (element) element.checked = Boolean(value);
    });

    const currencySelect = document.getElementById("botCurrency");
    if (currencySelect) currencySelect.value = config.currency || "sync";
    syncCapitalField(config);

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
      if (!element || key === "initialCapital") return;
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

    const currencySelect = document.getElementById("botCurrency");
    next.currency = currencySelect?.value || "sync";
    const capitalInput = document.getElementById("botInitialCapital");
    const displayCapital = Number(capitalInput?.value);
    const currency = getBotCurrency(next);
    if (Number.isFinite(displayCapital) && displayCapital > 0) {
      if (currency !== "USD" && !bridge.areExchangeRatesReady?.()) {
        next.initialCapital = base.initialCapital;
      } else {
        const usdCapital = bridge.convertFromCurrency(displayCapital, currency);
        if (
          !Number.isFinite(usdCapital) ||
          usdCapital <= 0 ||
          isSuspiciousCapitalConversion(displayCapital, usdCapital, currency)
        ) {
          next.initialCapital = base.initialCapital;
        } else {
          next.initialCapital = usdCapital;
        }
      }
    }

    const selectedAssets = [...document.querySelectorAll("#botAssetChecks input:checked")].map(
      (input) => input.value,
    );
    next.assets = selectedAssets.length ? selectedAssets : ["bitcoin"];
    return next;
  }

  function saveConfig() {
    const botState = getBotState();
    if (!botState) return;
    const before = { ...botState.config, assets: [...botState.config.assets] };
    const next = readConfigFromForm();
    const currency = getBotCurrency(next);
    if (currency !== "USD" && !bridge.areExchangeRatesReady?.()) {
      bridge?.showToast?.(
        "Devizaárfolyamok betöltése folyamatban – várj, mielőtt mented a kezdőtőkét.",
      );
      return;
    }
    const capitalInput = document.getElementById("botInitialCapital");
    const displayCapital = Number(capitalInput?.value);
    if (
      Number.isFinite(displayCapital) &&
      displayCapital > 0 &&
      isSuspiciousCapitalConversion(
        displayCapital,
        bridge.convertFromCurrency(displayCapital, currency),
        currency,
      )
    ) {
      bridge?.showToast?.(
        "Érvénytelen kezdőtőke – várj az árfolyam betöltésére, majd ellenőrizd a mezőt.",
      );
      syncCapitalField(botState.config);
      return;
    }
    if (!(next.initialCapital >= 100)) {
      bridge?.showToast?.(
        `A kezdőtőke legalább ${bridge.formatBotMoney(100, currency)} legyen.`,
      );
      return;
    }

    const capitalChanged = before.initialCapital !== next.initialCapital;
    const currencyChanged = before.currency !== next.currency;
    const needsAccountReset = capitalChanged || currencyChanged;

    if (needsAccountReset && botState.positions.length > 0) {
      const confirmed = window.confirm(
        "A kezdőtőke vagy pénznem módosítása újraindítja a kereskedési számlát (pozíciók és ügyletek törlődnek). A tapasztalatok és tanulási napló megmarad. Folytatod?",
      );
      if (!confirmed) return;
    } else if (needsAccountReset && botState.trades.length > 0) {
      const confirmed = window.confirm(
        "A kezdőtőke vagy pénznem módosítása törli a korábbi ügyleteket, de a tapasztalatok és auto-tanulási előzmények megmaradnak. Folytatod?",
      );
      if (!confirmed) return;
    }

    const changes = Bot.diffConfigs(before, next).map((change) => ({
      ...change,
      reason: needsAccountReset && change.key === "initialCapital"
        ? "Kezdőtőke mentése – számla újraindítva"
        : "Kézi beállítás mentése",
    }));
    botState.config = next;

    if (needsAccountReset) {
      Bot.applyCapitalFromConfig(botState, {
        skipLog: true,
        source: "kézi",
        reason: capitalChanged
          ? "Kezdőtőke mentése – számla újraindítva"
          : "Pénznem módosítása – számla újraindítva",
      });
      Bot.logConfigChanges(botState, "kézi", [
        ...changes,
        {
          key: "accountReset",
          from: before.initialCapital,
          to: next.initialCapital,
          reason: capitalChanged
            ? "Kezdőtőke mentése – számla újraindítva"
            : "Pénznem módosítása – számla újraindítva",
        },
      ]);
    } else if (changes.length) {
      Bot.logConfigChanges(botState, "kézi", changes);
    } else {
      Bot.saveBotState(botState);
    }

    render();
    bridge?.scheduleBotTick?.();
    if (needsAccountReset) {
      bridge?.showToast?.("Kezdőtőke mentése újraindította a számlát.");
    } else {
      bridge?.showToast?.("Bot beállítások elmentve.");
    }
    if (botState.config.enabled) bridge?.runTick?.();
  }

  function resetAccount() {
    if (
      !window.confirm(
        "Biztosan újraindítod a kereskedési számlát? A pozíciók és ügyletek törlődnek, de a tapasztalatok (tanulási napló, beállítás-változások) megmaradnak.",
      )
    ) {
      return;
    }
    const botState = getBotState();
    if (!botState) return;
    Bot.resetCapitalAccount(botState, {
      source: "kézi",
      reason: "Számla kézi újraindítása",
    });
    syncConfigForm();
    render();
    bridge?.showToast?.("Kereskedési számla újraindítva – tanulási adatok megmaradtak.");
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
    renderConfigChangeLog();
  }

  function clearChangeLog() {
    const botState = getBotState();
    if (!botState) return;
    if (!window.confirm("Biztosan törlöd a teljes beállítás-változás naplót?")) return;
    Bot.clearConfigChangeLog(botState);
    renderConfigChangeLog();
    bridge?.showToast?.("A változásnapló törölve.");
  }

  function exportChangeLog() {
    const botState = getBotState();
    if (!botState?.configChangeLog?.length) {
      bridge?.showToast?.("Nincs exportálható naplóbejegyzés.");
      return;
    }
    const csv = Bot.exportConfigChangeLogCsv(botState);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bot-valtozasnaplo-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    bridge?.showToast?.("Változásnapló exportálva CSV-be.");
  }

  function renderConfigChangeLog() {
    const botState = getBotState();
    const container = document.getElementById("botChangeLog");
    const countBadge = document.getElementById("botChangeLogCount");
    if (!container || !botState) return;

    const entries = botState.configChangeLog || [];
    if (countBadge) countBadge.textContent = `${entries.length} bejegyzés`;

    container.replaceChildren();
    if (!entries.length) {
      container.append(
        Object.assign(document.createElement("p"), {
          className: "helper-text",
          textContent: "Még nincs rögzített beállítás-változás. A kézi mentések, auto-tanulás és fontos kapcsolók itt jelennek meg.",
        }),
      );
      return;
    }

    entries.slice(0, 40).forEach((entry) => {
      const card = document.createElement("article");
      card.className = `bot-change-log-item source-${entry.source.replace(/\s+/g, "-")}`;
      const time = new Intl.DateTimeFormat("hu-HU", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(entry.time);
      const sourceLabel = Bot.SOURCE_LABELS?.[entry.source] || entry.source;
      const fromText =
        entry.key === "initialCapital" || entry.key === "accountReset"
          ? bridge.formatBotMoney(entry.from, getBotCurrency(botState.config))
          : Bot.formatConfigValue(entry.key, entry.from);
      const toText =
        entry.key === "initialCapital" || entry.key === "accountReset"
          ? bridge.formatBotMoney(entry.to, getBotCurrency(botState.config))
          : Bot.formatConfigValue(entry.key, entry.to);
      card.innerHTML = `
        <div class="bot-change-log-head">
          <time>${time}</time>
          <span class="bot-change-source">${sourceLabel}</span>
        </div>
        <strong>${entry.label}</strong>
        <div class="bot-change-values">
          <span class="bot-change-from">${fromText}</span>
          <span class="bot-change-arrow">→</span>
          <span class="bot-change-to">${toText}</span>
        </div>
        ${entry.reason ? `<small>${entry.reason}</small>` : ""}`;
      container.append(card);
    });
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

  function maybeReconcilePendingBalance() {
    const botState = getBotState();
    if (!botState?._balanceReconcilePending) return false;
    const fxContext = bridge?.getBotFxContext?.();
    const currency = getBotCurrency(botState.config);
    if (!Bot.isFxReadyForCurrency?.(fxContext, currency)) return false;
    const result = Bot.validateBalanceState(botState, getContext(), fxContext);
    if (result.repaired || !result.pending) {
      delete botState._balanceReconcilePending;
      Bot.saveBotState(botState);
      syncConfigForm();
      return true;
    }
    return false;
  }

  function render() {
    const botState = getBotState();
    if (!botState) return;
    maybeReconcilePendingBalance();
    const metrics = Bot.getMetrics(botState, getContext());
    const { formatNumber, setMetricValue, valueClass, appendEmptyTableRow } = bridge;
    const currency = getBotCurrency(botState.config);
    updateCurrencyUi(currency);
    if (bridge.areExchangeRatesReady?.() || currency === "USD") {
      syncCapitalField(botState.config);
    }

    setMetricValue(
      "botEquity",
      bridge.formatBotMoney(botState.cash, currency),
      botState.cash - botState.initialCapital,
    );
    setMetricValue(
      "botRealizedPnl",
      bridge.formatBotSignedMoney(metrics.realizedPnl, currency),
      metrics.realizedPnl,
    );
    setMetricValue(
      "botOpenPnl",
      bridge.formatBotSignedMoney(metrics.openPnl, currency),
      metrics.openPnl,
    );
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
      const currencyNote = ` · ${currency}`;
      status.textContent = botState.config.enabled
        ? `Bot aktív · ${metrics.tradeCount} lezárt ügylet · utolsó tick: ${
            botState.lastTickAt
              ? new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit" }).format(
                  botState.lastTickAt,
                )
              : "most"
          }${hoursNote}${proNote}${currencyNote}`
        : "Bot kikapcsolva – kapcsold be az automatikus papírkereskedéshez.";
      status.className = `bot-status ${botState.config.enabled ? "live" : ""}`;
    }

    const modeBadge = document.getElementById("botModeBadge");
    if (modeBadge) {
      const parts = [];
      if (botState.config.professionalMode) parts.push("Pro mód");
      if (botState.config.marketWideMode) parts.push(`Piaci mód (${Catalog.ALL_KEYS.length})`);
      if (botState.config.autoLearnEnabled) parts.push("Auto-tanulás");
      if (botState.config.currency && botState.config.currency !== "sync") {
        parts.push(botState.config.currency);
      } else if (botState.config.currency === "sync") {
        parts.push(`${currency} szinkron`);
      }
      modeBadge.textContent = parts.length ? parts.join(" · ") : "Kézi mód";
      modeBadge.className = `local-badge ${botState.config.professionalMode ? "pro-active" : ""} ${botState.config.autoLearnEnabled ? "learn-active" : ""} ${botState.config.marketWideMode ? "market-wide-active" : ""}`;
    }

    renderPositions(appendEmptyTableRow, formatNumber, valueClass, currency);
    renderTrades(appendEmptyTableRow, formatNumber, valueClass, currency);
    renderMissedOpportunities(formatNumber);
    renderNoTradeDiagnostics();
    renderAutoLearnStatus();
    renderSuggestions();
    renderActivity();
    renderEquityChart();
    renderMarketScan(formatNumber);
    renderLearnPanel();
    renderIntelligence();
    renderConfigChangeLog();
    renderCloudSyncStatus();
  }

  function appendIntelligenceMetric(container, label, value, detail, tone = "neutral") {
    const card = document.createElement("div");
    card.className = `intelligence-metric ${tone}`;
    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    const valueElement = document.createElement("strong");
    valueElement.textContent = value;
    const detailElement = document.createElement("small");
    detailElement.textContent = detail;
    card.append(labelElement, valueElement, detailElement);
    container.append(card);
  }

  function renderIntelligence() {
    const botState = getBotState();
    const metricGrid = document.getElementById("intelligenceMetricGrid");
    if (!botState || !metricGrid) return;

    const intelligence = Bot.refreshIntelligenceState?.(botState, getContext());
    const report = intelligence?.report;
    if (!report) return;

    const currency = getBotCurrency(botState.config);
    const overall = report.overall || {};
    const validation = report.validation || {};
    const killSwitch = report.killSwitch || { active: false, reasons: [] };
    const statusBadge = document.getElementById("intelligenceStatusBadge");
    const summary = document.getElementById("intelligenceSummary");

    if (statusBadge) {
      statusBadge.textContent = killSwitch.active
        ? "Biztonsági stop"
        : validation.status === "passed"
          ? "Validált"
          : validation.status === "failed"
            ? "Újratanulás"
            : "Adatgyűjtés";
      statusBadge.className = `intelligence-status ${
        killSwitch.active
          ? "danger"
          : validation.status === "passed"
            ? "positive"
            : validation.status === "failed"
              ? "warning"
              : "pending"
      }`;
    }
    if (summary) {
      summary.textContent = killSwitch.active
        ? `Új belépés szünetel: ${killSwitch.reasons.join(", ")}. A nyitott pozíciók védelme tovább működik.`
        : validation.reason || "A döntési réteg aktív és minden setupot több szinten ellenőriz.";
    }

    metricGrid.replaceChildren();
    appendIntelligenceMetric(
      metricGrid,
      "Várható érték / ügylet",
      bridge.formatBotSignedMoney?.(overall.expectancy || 0, currency) || `${overall.expectancy || 0}`,
      `${overall.sampleSize || 0} lezárt ügylet`,
      overall.expectancy > 0 ? "positive" : overall.sampleSize ? "negative" : "neutral",
    );
    appendIntelligenceMetric(
      metricGrid,
      "Konfidens találati arány",
      `${((overall.winRateLowerBound || 0) * 100).toFixed(1)}%`,
      "90%-os Wilson alsó korlát",
      overall.winRateLowerBound >= 0.3 ? "positive" : "neutral",
    );
    appendIntelligenceMetric(
      metricGrid,
      "Out-of-sample stabilitás",
      validation.consistency === undefined
        ? "–"
        : `${(validation.consistency * 100).toFixed(0)}%`,
      validation.status === "insufficient-data" ? "További minta szükséges" : validation.reason,
      validation.passed ? "positive" : "neutral",
    );
    appendIntelligenceMetric(
      metricGrid,
      "Setup memória",
      String(report.setupMemory?.length || 0),
      "külön tanult piaci minta",
    );
    appendIntelligenceMetric(
      metricGrid,
      "Max. drawdown",
      `${(overall.maxDrawdownPercent || 0).toFixed(2)}%`,
      "teljes lezárt mintán",
      overall.maxDrawdownPercent > 8 ? "negative" : "positive",
    );

    renderIntelligenceValidation(validation);
    renderIntelligenceRisk(killSwitch, currency);
    renderIntelligenceSetups(report);
    renderIntelligenceCalibration(report.calibration || []);
    renderIntelligenceMissed(report.missedOpportunity || {});
    renderIntelligenceRollback(botState, report.rollback);
  }

  function renderIntelligenceValidation(validation) {
    const badge = document.getElementById("intelligenceValidationBadge");
    const summary = document.getElementById("intelligenceValidationSummary");
    const folds = document.getElementById("intelligenceFoldGrid");
    if (!badge || !summary || !folds) return;
    const labels = {
      passed: "Megfelelt",
      failed: "Nem stabil",
      "insufficient-data": "Adatgyűjtés",
    };
    badge.textContent = labels[validation.status] || "–";
    badge.className = `local-badge ${validation.passed ? "sync-ok" : ""}`;
    summary.textContent = validation.reason || "Még nincs validációs eredmény.";
    folds.replaceChildren();
    if (!validation.folds?.length) {
      folds.append(
        Object.assign(document.createElement("span"), {
          className: "helper-text",
          textContent: `${validation.sampleSize || 0}/${validation.required || 20} ügylet áll rendelkezésre.`,
        }),
      );
      return;
    }
    validation.folds.forEach((fold, index) => {
      const item = document.createElement("div");
      item.className = `intelligence-fold ${fold.passed ? "positive" : "negative"}`;
      const label = document.createElement("span");
      label.textContent = `${index + 1}. tesztablak`;
      const value = document.createElement("strong");
      value.textContent = `${fold.testNetPnl >= 0 ? "+" : ""}${fold.testNetPnl.toFixed(2)}`;
      const detail = document.createElement("small");
      detail.textContent = `${fold.testSize} ügylet · EV ${fold.testExpectancy.toFixed(2)}`;
      item.append(label, value, detail);
      folds.append(item);
    });
  }

  function renderIntelligenceRisk(killSwitch, currency) {
    const badge = document.getElementById("intelligenceKillBadge");
    const container = document.getElementById("intelligenceRiskState");
    if (!badge || !container) return;
    badge.textContent = killSwitch.active ? "Belépés tiltva" : "Védelem aktív";
    badge.className = `local-badge ${killSwitch.active ? "" : "sync-ok"}`;
    container.replaceChildren();
    const rows = [
      ["Napi eredmény", bridge.formatBotSignedMoney?.(killSwitch.dailyPnl || 0, currency)],
      ["Heti eredmény", bridge.formatBotSignedMoney?.(killSwitch.weeklyPnl || 0, currency)],
      ["Drawdown", `${(killSwitch.drawdownPercent || 0).toFixed(2)}%`],
      ["Vesztes sorozat", `${killSwitch.consecutiveLosses || 0} ügylet`],
    ];
    rows.forEach(([label, value]) => {
      const row = document.createElement("div");
      const name = document.createElement("span");
      name.textContent = label;
      const result = document.createElement("strong");
      result.textContent = value || "–";
      row.append(name, result);
      container.append(row);
    });
    if (killSwitch.reasons?.length) {
      const warning = document.createElement("p");
      warning.className = "intelligence-warning";
      warning.textContent = killSwitch.reasons.join(" · ");
      container.append(warning);
    }
  }

  function renderIntelligenceSetups(report) {
    const container = document.getElementById("intelligenceSetupList");
    if (!container) return;
    container.replaceChildren();
    const setups = [
      ...(report.topSetups || []).map((setup) => ({ ...setup, tone: "positive", group: "Erős" })),
      ...(report.weakSetups || []).map((setup) => ({ ...setup, tone: "negative", group: "Gyenge" })),
    ].filter((setup, index, all) => all.findIndex((item) => item.key === setup.key) === index);
    if (!setups.length) {
      container.append(
        Object.assign(document.createElement("p"), {
          className: "helper-text",
          textContent: "Legalább három azonos setupból lezárt ügylet kell a rangsorhoz.",
        }),
      );
      return;
    }
    setups.slice(0, 8).forEach((setup) => {
      const item = document.createElement("div");
      item.className = `intelligence-setup ${setup.tone}`;
      const heading = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = setup.group;
      const key = document.createElement("strong");
      key.textContent = setup.key.split("|").slice(0, 4).join(" · ");
      heading.append(label, key);
      const metrics = document.createElement("small");
      metrics.textContent = `${setup.sampleSize} ügylet · ${(setup.winRate * 100).toFixed(0)}% win · EV ${setup.expectancy.toFixed(2)} · PF ${Number.isFinite(setup.profitFactor) ? setup.profitFactor.toFixed(2) : "∞"}`;
      item.append(heading, metrics);
      container.append(item);
    });
  }

  function renderIntelligenceCalibration(calibration) {
    const container = document.getElementById("intelligenceCalibration");
    if (!container) return;
    container.replaceChildren();
    calibration.forEach((bin) => {
      const row = document.createElement("div");
      row.className = "intelligence-calibration-row";
      const heading = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = bin.label;
      const value = document.createElement("strong");
      value.textContent = bin.sampleSize
        ? `${(bin.actualWinRate * 100).toFixed(0)}% valós · ${bin.sampleSize} db`
        : "nincs minta";
      heading.append(label, value);
      const track = document.createElement("div");
      track.className = "intelligence-calibration-track";
      const bar = document.createElement("span");
      bar.style.width = `${Math.max(2, (bin.actualWinRate || 0) * 100)}%`;
      track.append(bar);
      row.append(heading, track);
      container.append(row);
    });
  }

  function renderIntelligenceMissed(missed) {
    const container = document.getElementById("intelligenceMissed");
    if (!container) return;
    container.replaceChildren();
    const metrics = [
      ["Utólag értékelt", `${missed.evaluated || 0}/${missed.total || 0}`],
      ["Nyerő lett volna", String(missed.wouldWin || 0)],
      ["Vesztes lett volna", String(missed.wouldLose || 0)],
      [
        "Védelmi arány",
        missed.protectionRate === null || missed.protectionRate === undefined
          ? "–"
          : `${(missed.protectionRate * 100).toFixed(0)}%`,
      ],
    ];
    metrics.forEach(([label, value]) => {
      const item = document.createElement("div");
      const name = document.createElement("span");
      name.textContent = label;
      const result = document.createElement("strong");
      result.textContent = value;
      item.append(name, result);
      container.append(item);
    });
  }

  function renderIntelligenceRollback(botState, rollback) {
    const container = document.getElementById("intelligenceRollback");
    if (!container) return;
    container.replaceChildren();
    const intelligence = botState.intelligence || {};
    const checkpoint = intelligence.activeCheckpoint;
    const state = document.createElement("div");
    state.className = "intelligence-rollback-state";
    const title = document.createElement("strong");
    title.textContent = checkpoint ? "Aktív konfigurációs próba" : "Nincs függő konfigurációs próba";
    const detail = document.createElement("span");
    detail.textContent = checkpoint
      ? rollback?.reason || "Az új beállítás out-of-sample eredményeit figyeli."
      : "Minden automatikus módosítás előtt visszaállítható checkpoint készül.";
    state.append(title, detail);
    container.append(state);
    const history = document.createElement("small");
    history.textContent = `${intelligence.checkpointHistory?.length || 0} checkpoint · ${intelligence.rollbackHistory?.length || 0} automatikus visszaállítás`;
    container.append(history);
  }

  function renderPositions(appendEmptyTableRow, formatNumber, valueClass, currency) {
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
      const decimals = Catalog.getAsset(position.asset)?.priceDecimals ?? 2;
      const row = document.createElement("tr");
      [
        Catalog.getName(position.asset),
        position.direction.toUpperCase(),
        bridge.formatBotAssetPrice(position.entry, currency, decimals),
        bridge.formatBotAssetPrice(position.stop, currency, decimals),
        bridge.formatBotAssetPrice(position.target, currency, decimals),
        pnl === null ? "–" : bridge.formatBotSignedMoney(pnl, currency),
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

  function renderTrades(appendEmptyTableRow, formatNumber, valueClass, currency) {
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
        bridge.formatBotAssetPrice(trade.entry, currency, decimals),
        bridge.formatBotAssetPrice(trade.exit, currency, decimals),
        trade.reason,
        why || "–",
        bridge.formatBotSignedMoney(trade.pnl, currency),
      ].forEach((text, index) => {
        const cell = document.createElement("td");
        cell.textContent = text;
        if (index === 7) cell.className = valueClass(trade.pnl);
        row.append(cell);
      });
      table.append(row);
    });
  }

  function applyPreset(presetKey) {
    const botState = getBotState();
    if (!botState) return;
    const preset = Bot.CONFIG_PRESETS?.[presetKey];
    if (!preset) return;
    const confirmed = window.confirm(
      `Alkalmazod a „${preset.label}” előbeállítást?\n\n${preset.description}\n\nA jelenlegi paraméterek felülírásra kerülnek (eszközlista megmarad).`,
    );
    if (!confirmed) return;
    Bot.applyConfigPreset(botState, presetKey, { source: "beállítás" });
    syncConfigForm();
    render();
    bridge?.scheduleBotTick?.();
    bridge?.showToast?.(`${preset.label} profil alkalmazva – ellenőrizd a beállításokat.`);
    if (botState.config.enabled) bridge?.runTick?.();
  }

  function renderAutoLearnStatus() {
    const botState = getBotState();
    const card = document.getElementById("botAutoLearnStatusCard");
    const experiences = document.getElementById("botAutoLearnExperiencesStatus");
    if (!botState) return;

    const status = Bot.getAutoLearnStatus?.(botState, getContext());
    if (!status) return;

    const show = Boolean(status.active);
    if (card) card.hidden = !show;
    if (experiences) experiences.hidden = !show;

    const adaptiveMode = status.adaptiveMode || "monitoring";
    const recoveryActive =
      status.recoveryStep > 0 ||
      status.recoveryExhausted ||
      adaptiveMode === "activity-recovery" ||
      adaptiveMode === "quality-repair";
    const summaryText = status.active
      ? status.recoveryExhausted
        ? "A biztonságos finomhangolási határ elérve. A bot tovább elemez, de nem kényszerít belépést."
        : adaptiveMode === "quality-repair"
          ? "Folyamatos adaptáció: a gördülő eredmény gyenge, ezért a bot minőségi és kockázati javítást végez."
          : adaptiveMode === "activity-recovery"
            ? `Aktivitási helyreállítás: ${Math.round(status.inactivityMinutes || 0)} perc ügylet nélkül, ${status.adaptiveBatchSize} paraméteres ciklusokkal.`
            : `Folyamatos monitorozás aktív: felülvizsgálat ${status.adaptiveReviewMinutes} percenként, cél: ${status.goal}`
      : "";

    if (card) {
      const title = document.getElementById("botAutoLearnStatusTitle");
      const badge = document.getElementById("botAutoLearnStatusBadge");
      const summary = document.getElementById("botAutoLearnStatusSummary");
      const metrics = document.getElementById("botAutoLearnStatusMetrics");
      const next = document.getElementById("botAutoLearnStatusNext");

      if (title) {
        title.textContent = status.recoveryExhausted
          ? "Auto-tanulás – biztonsági határ"
          : adaptiveMode === "quality-repair"
            ? "Auto-tanulás – minőségi helyreállítás"
            : recoveryActive
              ? "Auto-tanulás – aktivitási helyreállítás"
            : status.targetsMet
              ? "Auto-tanulás – célok teljesülnek"
              : "Auto-tanulás – folyamatos monitorozás";
      }
      if (badge) {
        badge.textContent = status.recoveryExhausted
          ? "Biztonsági stop"
          : adaptiveMode === "quality-repair"
            ? "Minőségjavítás"
            : recoveryActive
              ? `${status.recoveryStep}. kör`
            : status.targetsMet
              ? "Cél teljesítve"
              : "Monitoroz";
        badge.className = `local-badge learn-active ${status.targetsMet && !recoveryActive ? "sync-ok" : ""}`;
      }
      if (summary) summary.textContent = summaryText;

      if (metrics) {
        metrics.replaceChildren();
        const rolling = status.rolling || {};
        const items = [
          {
            label: "Gördülő win rate",
            value:
              rolling.winRate === null || rolling.sampleSize < 5
                ? "–"
                : `${rolling.winRate.toFixed(1)}% / ${status.targetWinRate}%`,
            ok: rolling.sampleSize < 5 || rolling.winRate === null || rolling.winRate >= status.targetWinRate,
          },
          {
            label: "Ügylet / 6 óra",
            value: `${rolling.tradesLast6h ?? 0} / ${status.targetTradesPer6h}`,
            ok: (rolling.tradesLast6h ?? 0) >= status.targetTradesPer6h,
          },
          {
            label: "Gördülő PnL",
            value:
              rolling.sampleSize < 5
                ? "–"
                : bridge?.formatBotSignedMoney?.(rolling.rollingPnl, getBotCurrency(botState.config)) ||
                  `${rolling.rollingPnl?.toFixed(2)} USD`,
            ok: rolling.sampleSize < 5 || (rolling.rollingPnl ?? 0) >= 0,
          },
          {
            label: "Módosítások ma",
            value: `${status.dailyCount} / ${status.maxDaily}`,
            ok: status.dailyCount < status.maxDaily,
          },
          {
            label: "Adaptív vezérlés",
            value: recoveryActive
              ? status.recoveryExhausted
                ? "Biztonsági határ"
                : `${status.recoveryStep}. elemzési kör`
              : `${status.adaptiveReviewMinutes}p review · ${status.adaptiveNoTradeMinutes}p recovery · ${status.adaptiveBatchSize} paraméter`,
            ok: !status.recoveryExhausted,
          },
        ];
        items.forEach((item) => {
          const chip = document.createElement("div");
          chip.className = `bot-auto-learn-metric ${item.ok ? "ok" : "pending"}`;
          chip.innerHTML = `<span>${item.label}</span><strong>${item.value}</strong>`;
          metrics.append(chip);
        });
      }

      if (next) {
        const parts = [];
        if (status.lastChangeSummary) {
          parts.push(`Utolsó módosítás: ${status.lastChangeSummary}`);
        } else if (status.lastChangeAt) {
          parts.push(
            `Utolsó módosítás: ${new Intl.DateTimeFormat("hu-HU", {
              hour: "2-digit",
              minute: "2-digit",
            }).format(status.lastChangeAt)}`,
          );
        }
        if (status.nextReviewAt) {
          const reviewLabel =
            status.nextReviewAt > Date.now()
              ? new Intl.DateTimeFormat("hu-HU", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(status.nextReviewAt)
              : "most";
          parts.push(`Következő felülvizsgálat: ${reviewLabel}`);
        }
        if (status.recoveryBlockers?.length) {
          parts.push(`Vizsgált blokkolók: ${status.recoveryBlockers.slice(0, 6).join(", ")}`);
        }
        next.textContent = parts.join(" · ") || "Még nem történt auto-finomhangolás.";
      }
    }

    if (experiences) {
      experiences.textContent = summaryText;
      if (status.lastChangeSummary) {
        experiences.textContent += ` · Utolsó: ${status.lastChangeSummary}`;
      }
    }
  }

  function renderNoTradeDiagnostics() {
    const botState = getBotState();
    const panel = document.getElementById("botNoTradeDiagnostics");
    if (!panel || !botState) return;

    const diag = Bot.getTradeDiagnostics?.(botState, getContext());
    if (!diag || !diag.enabled) {
      panel.hidden = true;
      return;
    }

    const showPanel = diag.isStale || diag.blockers.length > 0;
    panel.hidden = !showPanel;
    if (!showPanel) return;

    panel.classList.toggle("is-stale", Boolean(diag.isStale));

    const title = document.getElementById("botNoTradeTitle");
    if (title) {
      title.textContent = diag.isStale
        ? `${diag.hoursSinceOpenLabel} nem nyitott ügyletet`
        : "Aktuális belépési akadályok";
    }

    const badge = document.getElementById("botNoTradeBadge");
    if (badge) {
      badge.textContent = diag.isStale ? "Figyelem" : "Info";
      badge.className = `local-badge ${diag.isStale ? "warn-active" : ""}`;
    }

    const summary = document.getElementById("botNoTradeSummary");
    if (summary) {
      summary.textContent = diag.isStale
        ? `A bot aktív, de ${diag.hoursSinceOpenLabel} nem nyitott sikeres ügyletet. ${diag.eligibleAssets}/${diag.scannedAssets} eszköz most is megfelelne a szűrőknek.`
        : `Jelenleg ${diag.blockers.length} aktív akadály blokkolja az új belépéseket.`;
    }

    const blockersEl = document.getElementById("botNoTradeBlockers");
    if (blockersEl) {
      blockersEl.replaceChildren();
      diag.blockers.forEach((text) => {
        const chip = document.createElement("span");
        chip.className = "bot-diag-chip";
        chip.textContent = text;
        blockersEl.append(chip);
      });
    }

    const reasonsEl = document.getElementById("botNoTradeReasons");
    if (reasonsEl) {
      reasonsEl.replaceChildren();
      if (!diag.topReasons.length) {
        const empty = document.createElement("li");
        empty.className = "helper-text";
        empty.textContent = "Még nincs összegyűjtött elutasítási statisztika – várj néhány szkenner ciklust.";
        reasonsEl.append(empty);
      } else {
        diag.topReasons.forEach((entry, index) => {
          const li = document.createElement("li");
          li.innerHTML = `<strong>${index + 1}.</strong> ${entry.label} <span>(${entry.count}×)</span>`;
          reasonsEl.append(li);
        });
      }
    }

    const hintsEl = document.getElementById("botNoTradeHints");
    if (hintsEl) {
      hintsEl.replaceChildren();
      diag.suggestions.forEach((hint) => {
        const li = document.createElement("li");
        li.textContent = hint.detail;
        hintsEl.append(li);
      });
    }
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
    const currency = getBotCurrency(botState.config);
    const points = botState.equityHistory;
    const fxReady = currency === "USD" || bridge.areExchangeRatesReady?.();
    const chartOptions = bridge?.paperChartOptions?.() || { responsive: true, maintainAspectRatio: false };
    if (chartOptions.scales?.y?.ticks) {
      chartOptions.scales.y.ticks.callback = (value) => {
        if (!fxReady) return `$${bridge.formatNumber(value, 0)}`;
        const usdValue = bridge.convertFromCurrency(value, currency);
        return bridge.formatBotMoney(usdValue, currency);
      };
    }
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
          data: points.map((point) =>
            fxReady ? bridge.convertToCurrency(point.equity, currency) : point.equity,
          ),
          borderColor: "#2f5d50",
          backgroundColor: "rgba(47, 93, 80, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        }],
      },
      options: chartOptions,
    });
    const state = getState();
    if (state) state.botEquityChart = equityChart;
  }

  function resolveScanRow(result, appState, botState) {
    const assetKey = result.assetKey;
    const liveAsset = appState?.assets?.[assetKey];
    const liveIntraday = appState?.intraday?.[assetKey];
    const cached = appState?.scanRowCache?.[assetKey];
    const lastScanRow = botState?.lastScan?.results?.find((entry) => entry.assetKey === assetKey);
    const fallback = cached || (lastScanRow
      ? {
          price:
            lastScanRow.decision?.currentPrice ??
            liveIntraday?.currentPrice ??
            liveAsset?.currentPrice,
          change: lastScanRow.decision?.momentum15 ?? lastScanRow.decision?.minuteChange,
          signal: lastScanRow.signal,
          className: lastScanRow.className,
          confidence: lastScanRow.confidence,
          opportunityScore: lastScanRow.opportunityScore,
          score: lastScanRow.score,
          scoreBreakdown: lastScanRow.scoreBreakdown,
          entryReadiness: lastScanRow.entryReadiness,
          entryReadinessDetail: lastScanRow.entryReadinessDetail,
          entryQuality: lastScanRow.entryQuality,
        }
      : null);
    const refreshing = appState?.assetRefreshing?.[assetKey];
    const hasLiveData = Boolean(
      result.decision ||
        liveIntraday ||
        liveAsset ||
        (result.signal && result.signal !== "Nincs adat"),
    );

    const price =
      result.decision?.currentPrice ??
      liveIntraday?.currentPrice ??
      liveAsset?.currentPrice ??
      fallback?.price;
    const change = result.decision?.momentum15 ?? result.decision?.minuteChange ?? fallback?.change;
    const signal =
      result.signal && result.signal !== "Nincs adat"
        ? result.signal
        : result.decision?.signal || fallback?.signal;
    const className = result.className || result.decision?.className || fallback?.className || "neutral";
    const confidence = result.confidence ?? result.decision?.confidence ?? fallback?.confidence;
    const opportunityScore = result.opportunityScore ?? fallback?.opportunityScore;
    const score = result.score ?? result.decision?.score ?? fallback?.score;
    const scoreBreakdown = result.scoreBreakdown || fallback?.scoreBreakdown;
    const entryReadiness = result.entryReadiness ?? fallback?.entryReadiness ?? "ROSSZ";
    const entryReadinessDetail =
      result.entryReadinessDetail ?? fallback?.entryReadinessDetail ?? null;
    const entryQuality = result.entryQuality ?? fallback?.entryQuality ?? null;
    const stale = Boolean(refreshing && fallback && !result.decision);
    const hasData = hasLiveData || Boolean(fallback);

    if (hasLiveData) {
      if (typeof appState?.updateScanRowCache === "function") {
        appState.updateScanRowCache(assetKey, {
          price,
          change,
          signal,
          className,
          confidence,
          opportunityScore,
          score,
          eligible: result.eligible,
          topReasons: result.topReasons,
          filterReasons: result.filterReasons,
          entryReadiness,
          entryReadinessDetail,
          entryQuality,
        });
      }
    }

    return {
      price,
      change,
      signal,
      className,
      confidence,
      opportunityScore,
      score,
      scoreBreakdown,
      entryReadiness,
      entryReadinessDetail,
      entryQuality,
      hasData,
      stale,
      eligible: result.eligible,
      topReasons: result.topReasons,
      filterReasons: result.filterReasons,
    };
  }

  function renderMarketScan(formatNumber) {
    const botState = getBotState();
    const grid = document.getElementById("botSignalGrid");
    const summary = document.getElementById("botScanSummary");
    const heading = document.getElementById("botScanHeading");
    const dataStatus = document.getElementById("botScanDataStatus");
    if (!grid || !botState) return;

    const context = getContext();
    context.botConfig = botState.config;
    const marketWide = botState.config.marketWideMode;
    const appState = getState();
    const scanProgress = appState?.scanLoadProgress;

    const trendLabel = (className) => {
      if (className === "positive") return "Emelkedő";
      if (className === "negative") return "Csökkenő";
      return "Semleges";
    };

    const sentimentFor = (assetKey, result) => {
      const analysis = appState?.assets?.[assetKey]?.analysis;
      if (analysis?.signal && analysis.signal !== "Nincs elég adat") return analysis.signal;
      if (result.decision?.reasons?.length) return result.decision.reasons[0];
      return trendLabel(result.className);
    };

    const hasScannerData = (result, appState, botState) => {
      const row = resolveScanRow(result, appState, botState);
      return row.hasData;
    };

    const formatScanPrice = (usdPrice, decimals) => {
      if (bridge.formatMarketAssetPrice) return bridge.formatMarketAssetPrice(usdPrice, decimals);
      if (!Number.isFinite(usdPrice)) return "–";
      return `${formatNumber(usdPrice, decimals)} USD`;
    };

    if (dataStatus) {
      const statusClass = scanProgress?.active ? "live" : appState?.initialLoadComplete ? "warning" : "pending";
      const statusTitle = scanProgress?.active
        ? "Adatok: aktív"
        : appState?.initialLoadComplete
          ? "Adatok: leállítva"
          : "Adatok betöltése";
      const statusDetail = scanProgress?.active
        ? scanProgress.complete
          ? `${scanProgress.loaded}/${scanProgress.total} eszköz naprakész`
          : `${scanProgress.loaded}/${scanProgress.total} betöltve · ${scanProgress.pending} várakozik`
        : appState?.initialLoadComplete
          ? "Frissítés újraindítása…"
          : "Első piaci adatok";
      dataStatus.className = `live-data-state ${statusClass}`;
      dataStatus.innerHTML = `<span></span><div><strong>${statusTitle}</strong><small>${statusDetail}</small></div>`;
    }

    if (heading) {
      const totalAssets = Catalog.ALL_KEYS.length;
      heading.textContent = marketWide
        ? `Piaci szkenner – ${totalAssets} eszköz`
        : "Követett eszközök";
    }

    const results = Bot.scanMarketOpportunities(botState, context, Date.now());

    const eligibleCount = results.filter((result) => result.eligible).length;
    const withDataCount = results.filter((result) => hasScannerData(result, appState, botState)).length;
    grid.replaceChildren();
    grid.className = "bot-scan-list";
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
      const header = document.createElement("div");
      header.className = "bot-scan-list-header";
      header.innerHTML =
        "<span>#</span><span>Eszköz</span><span>Jel</span><span>Belépés</span><span>Ár</span><span>Változás</span><span>Trend</span><span>Hangulat</span><span>Részletek</span>";
      grid.append(header);

      results.forEach((result, index) => {
        const isChosen = botState.lastScan?.chosen?.assetKey === result.assetKey;
        const display = resolveScanRow(result, appState, botState);
        const hasData = display.hasData;
        const row = document.createElement("article");
        row.className =
          `bot-scan-row ${display.className}${result.eligible ? " eligible" : ""}${isChosen ? " chosen" : ""}` +
          `${hasData ? "" : " pending-data"}${display.stale ? " stale-data" : ""}`;

        const decimals = Catalog.getAsset(result.assetKey)?.priceDecimals ?? 2;
        const bd = display.scoreBreakdown || result.scoreBreakdown;
        const signalText = hasData
          ? display.signal || result.signal || "KIVÁRÁS"
          : "Betöltés…";
        const detailsText = hasData
          ? `${formatNumber(display.opportunityScore ?? 0, 0)} pt · ${display.confidence ?? "–"}% · jel ${display.score !== null && display.score !== undefined ? formatNumber(display.score, 2) : "–"}${display.entryQuality?.regime ? ` · ${display.entryQuality.regime}` : ""}${display.stale ? " · frissítés" : ""}`
          : "Várakozás adatra…";
        const entryBadgeClass =
          display.entryReadiness === "KÉSZ"
            ? "ready"
            : display.entryReadiness === "VÁR"
              ? "wait"
              : "bad";
        const entryTitle = display.entryReadinessDetail || "Belépési minőség";

        row.innerHTML = `
          <span class="bot-scan-rank">#${index + 1}</span>
          <span class="bot-scan-name">${result.assetName}</span>
          <strong class="bot-scan-signal ${display.className}">${signalText}</strong>
          <span class="bot-scan-entry ${entryBadgeClass}" title="${entryTitle}">${hasData ? display.entryReadiness : "–"}</span>
          <span class="bot-scan-price">${Number.isFinite(display.price) ? formatScanPrice(display.price, decimals) : "–"}</span>
          <span class="bot-scan-change ${bridge.valueClass(display.change || 0)}">${Number.isFinite(display.change) ? `${display.change >= 0 ? "+" : ""}${formatNumber(display.change, 2)}%` : "–"}</span>
          <span class="bot-scan-trend ${display.className}">${hasData ? trendLabel(display.className) : "–"}</span>
          <span class="bot-scan-sentiment">${hasData ? sentimentFor(result.assetKey, result) : "–"}</span>
          <span class="bot-scan-details" title="${hasData ? `Bizalom ${formatNumber(bd?.confidence ?? 0, 0)} + jel ${formatNumber(bd?.signalStrength ?? 0, 1)} + egyezés ${formatNumber(bd?.alignmentBonus ?? 0, 1)}` : ""}">${detailsText}</span>`;

        if (hasData) {
          const reasons = document.createElement("div");
          reasons.className = "bot-scan-row-reasons";
          if (result.eligible) {
            const entryNote = result.entryQuality?.score
              ? `Belépés ${result.entryQuality.score} pt · `
              : "";
            reasons.textContent =
              entryNote + ((result.topReasons || []).join(" · ") || "Minden szűrő teljesül.");
          } else {
            reasons.textContent = result.filterReasons.join(" · ") || "Nem kereskedhető.";
          }
          row.append(reasons);
        }

        grid.append(row);
      });
    }

    if (summary) {
      summary.replaceChildren();
      if (scanProgress) {
        const progressText = scanProgress.active
          ? scanProgress.complete
            ? `Folyamatos frissítés: ${scanProgress.loaded}/${scanProgress.total} eszköz naprakész`
            : `Háttérbetöltés: ${scanProgress.loaded}/${scanProgress.total} eszköz adata érkezett${scanProgress.pending ? ` · ${scanProgress.pending} várakozik` : ""}…`
          : `Frissítés leállítva – ${withDataCount}/${results.length} eszközön van élő adat`;
        summary.append(
          Object.assign(document.createElement("p"), {
            className: "helper-text",
            textContent: progressText,
          }),
        );
      } else if (marketWide && withDataCount < results.length) {
        summary.append(
          Object.assign(document.createElement("p"), {
            className: "helper-text",
            textContent: `${withDataCount}/${results.length} eszközön van élő adat – a többi még betöltődik vagy nem elérhető.`,
          }),
        );
      }
      const chosen = botState.lastScan?.chosen;
      if (chosen?.assetKey) {
        const box = document.createElement("div");
        box.className = "bot-scan-chosen";
        const bd = chosen.scoreBreakdown || {};
        box.innerHTML = `
          <strong>Választott: ${chosen.assetName}</strong>
          <span>${chosen.signal} · ${chosen.confidence}% bizalom · ${chosen.opportunityScore.toFixed(0)} pont · ${chosen.direction?.toUpperCase() || "–"} · belépés ${chosen.entryReadiness || "–"}</span>
          <small>${(chosen.topReasons || []).join(" · ")}</small>
          <small class="bot-scan-breakdown">Pontszám: bizalom ${Math.round(bd.confidence || 0)} + jel ${(bd.signalStrength || 0).toFixed(1)} + egyezés ${(bd.alignmentBonus || 0).toFixed(1)} + momentum ${(bd.momentumBonus || 0).toFixed(1)} + RSI ${Math.round(bd.rsiBonus || 0)}${chosen.entryQuality?.score ? ` · belépés ${chosen.entryQuality.score} pt (${chosen.entryQuality.regime || "?"})` : ""}</small>`;
        summary.append(box);
      } else if (chosen?.reason) {
        summary.append(
          Object.assign(document.createElement("p"), {
            className: "helper-text",
            textContent: chosen.reason,
          }),
        );
      } else if (marketWide && results.length) {
        summary.append(
          Object.assign(document.createElement("p"), {
            className: "helper-text",
            textContent: eligibleCount
              ? `${eligibleCount} kereskedhető lehetőség ${results.length} szkennelt eszközből – a legmagasabb pontszámú nyitható pozíciót választja a bot.`
              : `${results.length} eszköz szkennelve – egyik sem teljesíti a szűrőket ebben a ciklusban.`,
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
    enhanceBotSettingCards();
    bindEvents();
    syncConfigForm();
    switchConfigTab("general");
    switchSection(appBridge?.initialBotSection || "summary", false);
    renderCloudSyncStatus();
    render();
  }

  window.BotLab = {
    init,
    render,
    syncConfigForm,
    resize,
    switchSection,
    getActiveSection,
    renderCloudSyncStatus,
  };
})();
