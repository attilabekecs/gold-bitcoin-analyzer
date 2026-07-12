(function () {
  "use strict";

  const STORAGE_KEY = "aurum-practice-progress";

  const SCENARIOS = [
    {
      id: "rsi-overbought",
      title: "Túlvett RSI emelkedő trendben",
      prompt:
        "Bitcoin 1 perces: EMA9 > EMA21, RSI 74, MACD pozitív, de az 5 és 15 perces idősík vegyes. Mit teszel?",
      context: { rsi: 74, ema: "bullish", macd: "positive", alignment: "mixed" },
      options: [
        { id: "buy", label: "Vétel – a trend erős", correct: false, feedback: "Túlvett RSI mellett a kockázat/hozam gyenge; várj visszahúzódást." },
        { id: "wait", label: "Kivárás – nincs tiszta belépő", correct: true, feedback: "Helyes: vegyes idősíkok + túlvett RSI = fegyelmezett kivárás." },
        { id: "short", label: "Short – fordulat jön", correct: false, feedback: "Az EMA és MACD még nem ad short jelet; túl korai." },
      ],
    },
    {
      id: "aligned-bull",
      title: "Egységes emelkedő idősíkok",
      prompt:
        "Ethereum: 1p, 5p, 15p EMA9 mind a 21 felett, RSI 58, lendület +0.2%. Megfelelő LONG setup?",
      context: { rsi: 58, ema: "bullish", alignment: "strong-bull" },
      options: [
        { id: "buy", label: "Igen – vételi zóna a stop mellett", correct: true, feedback: "Jó: több idősík megerősít, RSI nem túlvett, stop-loss kötelező." },
        { id: "wait", label: "Nem – várjunk több adatra", correct: false, feedback: "Az egyező idősíkok éppen azt jelzik, hogy van edge – a stop a kulcs." },
        { id: "all-in", label: "Max pozíció azonnal", correct: false, feedback: "Soha ne lépj túl a kockázati limiten, még erős jelnél sem." },
      ],
    },
    {
      id: "bear-reversal",
      title: "Eladási jel meglévő LONG mellett",
      prompt:
        "Arany LONG pozíciód van. Új 1 perces jelzés: ELADÁSI, RSI 42, EMA9 keresztezte lefelé az EMA21-et. Teendő?",
      context: { signal: "sell", position: "long" },
      options: [
        { id: "hold", label: "Tartom – a napi trend még jó", correct: false, feedback: "A rövid távú fordulat és a stop fontosabb, mint a remény." },
        { id: "reduce", label: "Kockázat csökkentése / zárás", correct: true, feedback: "Helyes: rövid távú ellenjel esetén védd a tőkét." },
        { id: "add", label: "Átlagolok – olcsóbb lesz", correct: false, feedback: "Átlagolás ellenirányú jelzésnél veszélyes." },
      ],
    },
    {
      id: "rr-check",
      title: "Kockázat/hozam értékelés",
      prompt:
        "SOL belépő: $145, stop: $142 (2%), cél: $148.5 (2.4%). R/R ≈ 1.2. Nyitsz pozíciót 1% kockázattal?",
      context: { entry: 145, stop: 142, target: 148.5 },
      options: [
        { id: "yes", label: "Igen – elég közel a cél", correct: false, feedback: "1.2 R/R gyenge edge díjak mellett; keress legalább 1.5–2 R-t." },
        { id: "adjust", label: "Cél/stop módosítása vagy kihagyás", correct: true, feedback: "Professzionális: gyenge R/R esetén ne kereskedj, vagy igazítsd a tervet." },
        { id: "wider-stop", label: "Szélesebb stop, ugyanaz a cél", correct: false, feedback: "Szélesebb stop tovább rontja az R/R arányt." },
      ],
    },
    {
      id: "eurusd-range",
      title: "Forex oldalazó piac",
      prompt: "EUR/USD: RSI 50 körül, EMA9 és EMA21 szorosan egymás mellett, nincs momentum. Bot jelzés: KIVÁRÁS.",
      context: { asset: "eurusd", signal: "neutral" },
      options: [
        { id: "scalp", label: "Gyors scalp – kis profit is profit", correct: false, feedback: "Oldalazó piacon a scalp gyakran eszik meg a spreadet." },
        { id: "wait", label: "Kivárás – nincs edge", correct: true, feedback: "Helyes: a bot is kivár – nincs iránybeli előny." },
        { id: "force", label: "Kényszerített belépő a gyakorlás miatt", correct: false, feedback: "A gyakorló célja a fegyelem, nem a kereskedés erőltetése." },
      ],
    },
    {
      id: "oil-volatility",
      title: "Olaj magas volatilitás",
      prompt: "WTI olaj: ATR magas, 1 perces gyertya ±1.2%. Stop 1.5×ATR, de a hírnap közelít. Mit figyelsz?",
      context: { asset: "oil", volatility: "high" },
      options: [
        { id: "normal-risk", label: "Normál 1% kockázat – nincs különbség", correct: false, feedback: "Híreknél és magas ATR-nél csökkentsd a pozícióméretet." },
        { id: "reduce", label: "Kisebb kockázat vagy kivárás", correct: true, feedback: "Helyes: volatilitás és hír kockázat együtt áll." },
        { id: "widen", label: "Szélesebb stop, ugyanakkora méret", correct: false, feedback: "Szélesebb stop ugyanakkora mérettel több dollár kockázat." },
      ],
    },
  ];

  let progress = loadProgress();
  let activeScenario = SCENARIOS[0];

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return createProgress();
      saved.answers = saved.answers || {};
      saved.score = Number.isFinite(saved.score) ? saved.score : 0;
      saved.attempts = Number.isFinite(saved.attempts) ? saved.attempts : 0;
      return saved;
    } catch {
      return createProgress();
    }
  }

  function createProgress() {
    return { score: 0, attempts: 0, answers: {}, completedAt: null };
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore.
    }
  }

  function bindEvents() {
    document.getElementById("practiceScenarioSelect")?.addEventListener("change", (event) => {
      const scenario = SCENARIOS.find((item) => item.id === event.target.value);
      if (scenario) {
        activeScenario = scenario;
        renderScenario();
      }
    });
    document.getElementById("practiceCheckButton")?.addEventListener("click", checkAnswer);
    document.getElementById("practiceNextButton")?.addEventListener("click", nextScenario);
    document.getElementById("practiceResetButton")?.addEventListener("click", resetProgress);
  }

  function renderScenario() {
    const prompt = document.getElementById("practicePrompt");
    const options = document.getElementById("practiceOptions");
    const feedback = document.getElementById("practiceFeedback");
    const select = document.getElementById("practiceScenarioSelect");
    if (!prompt || !options) return;

    if (select) {
      select.replaceChildren(
        ...SCENARIOS.map((scenario) => {
          const option = document.createElement("option");
          option.value = scenario.id;
          option.textContent = scenario.title;
          if (scenario.id === activeScenario.id) option.selected = true;
          return option;
        }),
      );
    }

    prompt.textContent = activeScenario.prompt;
    options.replaceChildren();
    activeScenario.options.forEach((option) => {
      const label = document.createElement("label");
      label.className = "practice-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "practiceAnswer";
      input.value = option.id;
      label.append(input, document.createTextNode(` ${option.label}`));
      options.append(label);
    });
    if (feedback) {
      feedback.hidden = true;
      feedback.textContent = "";
      feedback.className = "practice-feedback";
    }
    document.getElementById("practiceCheckButton")?.removeAttribute("disabled");
    document.getElementById("practiceNextButton")?.setAttribute("hidden", "");
  }

  function checkAnswer() {
    const selected = document.querySelector('input[name="practiceAnswer"]:checked');
    const feedback = document.getElementById("practiceFeedback");
    if (!selected || !feedback) return;
    const option = activeScenario.options.find((item) => item.id === selected.value);
    if (!option) return;
    progress.attempts += 1;
    const previous = progress.answers[activeScenario.id];
    if (option.correct && !previous?.correct) {
      progress.score += 1;
    }
    progress.answers[activeScenario.id] = {
      choice: option.id,
      correct: option.correct,
      at: Date.now(),
    };
    if (Object.keys(progress.answers).length === SCENARIOS.length) {
      progress.completedAt = Date.now();
    }
    saveProgress();
    feedback.hidden = false;
    feedback.className = `practice-feedback ${option.correct ? "positive" : "negative"}`;
    feedback.textContent = option.feedback;
    document.getElementById("practiceCheckButton")?.setAttribute("disabled", "");
    document.getElementById("practiceNextButton")?.removeAttribute("hidden");
    renderProgress();
  }

  function nextScenario() {
    const index = SCENARIOS.findIndex((item) => item.id === activeScenario.id);
    activeScenario = SCENARIOS[(index + 1) % SCENARIOS.length];
    renderScenario();
  }

  function resetProgress() {
    progress = createProgress();
    saveProgress();
    renderProgress();
    renderScenario();
  }

  function renderProgress() {
    const scoreEl = document.getElementById("practiceScore");
    const attemptsEl = document.getElementById("practiceAttempts");
    const progressEl = document.getElementById("practiceProgressBar");
    const completed = Object.keys(progress.answers).length;
    if (scoreEl) scoreEl.textContent = String(progress.score);
    if (attemptsEl) attemptsEl.textContent = String(progress.attempts);
    if (progressEl) {
      progressEl.style.width = `${(completed / SCENARIOS.length) * 100}%`;
    }
    const summary = document.getElementById("practiceSummary");
    if (summary) {
      summary.textContent =
        completed === SCENARIOS.length
          ? `Minden forgatókönyv kipróbálva. Pontszám: ${progress.score}/${SCENARIOS.length}.`
          : `${completed}/${SCENARIOS.length} forgatókönyv megválaszolva.`;
    }
  }

  function init() {
    bindEvents();
    renderScenario();
    renderProgress();
  }

  window.PracticeLab = {
    SCENARIOS,
    init,
    renderProgress,
    loadProgress,
  };
})();
