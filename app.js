const state = {
  assets: {
    bitcoin: null,
    gold: null,
  },
  news: [],
  sentiment: { score: 0, label: "Semleges" },
  selectedAsset: "bitcoin",
  charts: {},
};

const endpoints = {
  bitcoin:
    "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily",
  goldSpot: "https://api.gold-api.com/price/XAU",
  goldHistory: "https://freegoldapi.com/data/latest.json",
  news:
    "https://api.gdeltproject.org/api/v2/doc/doc?query=%28bitcoin%20OR%20cryptocurrency%20OR%20gold%20OR%20bullion%29%20sourcelang%3Aenglish&mode=artlist&maxrecords=12&timespan=48h&format=json&sort=datedesc",
};

const positiveWords = [
  "gain", "gains", "growth", "rise", "rises", "rally", "surge", "record", "high",
  "bull", "bullish", "buy", "strong", "recovery", "adoption", "approve", "approved",
  "inflow", "optimism", "breakout", "upside", "boost", "safe haven",
];

const negativeWords = [
  "loss", "losses", "fall", "falls", "drop", "drops", "crash", "low", "bear",
  "bearish", "sell", "weak", "fear", "ban", "hack", "fraud", "outflow", "risk",
  "warning", "decline", "downside", "liquidation", "lawsuit", "uncertainty",
];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  document.getElementById("refreshButton").addEventListener("click", loadDashboard);
  document.getElementById("copyPromptButton").addEventListener("click", copyAnalysisPrompt);
  document.querySelectorAll("[data-indicator-asset]").forEach((button) => {
    button.addEventListener("click", () => selectIndicatorAsset(button.dataset.indicatorAsset));
  });
  loadDashboard();
});

async function loadDashboard() {
  setLoading(true);
  hideError();

  const [bitcoinResult, goldResult, newsResult] = await Promise.allSettled([
    fetchBitcoin(),
    fetchGold(),
    fetchNews(),
  ]);

  const errors = [];

  if (bitcoinResult.status === "fulfilled") {
    state.assets.bitcoin = bitcoinResult.value;
  } else {
    errors.push("A Bitcoin-adatok most nem érhetők el.");
  }

  if (goldResult.status === "fulfilled") {
    state.assets.gold = goldResult.value;
  } else {
    errors.push("Az aranyadatok most nem érhetők el.");
  }

  if (newsResult.status === "fulfilled") {
    state.news = newsResult.value;
    state.sentiment = analyzeSentiment(state.news);
  } else {
    errors.push("A hírfolyam most nem érhető el.");
    state.news = [];
    state.sentiment = { score: 0, label: "Semleges" };
  }

  ["bitcoin", "gold"].forEach((assetKey) => {
    const asset = state.assets[assetKey];
    if (asset) {
      asset.analysis = analyzeAsset(asset, assetSpecificSentiment(assetKey));
      renderAsset(assetKey);
    } else {
      renderUnavailableAsset(assetKey);
    }
  });

  renderSentiment();
  renderNews();
  renderIndicators(state.selectedAsset);

  if (errors.length) showError(errors.join(" "));
  document.getElementById("lastUpdated").textContent = new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date());
  setLoading(false, errors.length === 3);
}

async function fetchJson(url, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBitcoin() {
  const data = await fetchJson(endpoints.bitcoin);
  const points = (data.prices || [])
    .map(([time, price]) => ({ time: Number(time), price: Number(price) }))
    .filter((point) => Number.isFinite(point.price));

  if (points.length < 15) throw new Error("Nincs elegendő Bitcoin-adat");
  return buildAsset("Bitcoin", points, points.at(-1).price);
}

async function fetchGold() {
  const [spotResult, historyResult] = await Promise.allSettled([
    fetchJson(endpoints.goldSpot),
    fetchJson(endpoints.goldHistory, 18000),
  ]);

  let points = [];
  if (historyResult.status === "fulfilled" && Array.isArray(historyResult.value)) {
    points = historyResult.value
      .map((item) => ({
        time: new Date(item.date).getTime(),
        price: Number(item.price),
      }))
      .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price))
      .sort((a, b) => a.time - b.time)
      .slice(-30);
  }

  const spotData = spotResult.status === "fulfilled" ? spotResult.value : null;
  const spotPrice = Number(spotData?.price);

  if (Number.isFinite(spotPrice)) {
    const today = new Date().setHours(12, 0, 0, 0);
    const lastPoint = points.at(-1);
    if (!lastPoint || Math.abs(today - lastPoint.time) > 18 * 60 * 60 * 1000) {
      points.push({ time: today, price: spotPrice });
    } else {
      lastPoint.price = spotPrice;
    }
  }

  if (!points.length) throw new Error("Nincs elérhető aranyadat");
  return buildAsset("Arany", points, Number.isFinite(spotPrice) ? spotPrice : points.at(-1).price);
}

function buildAsset(name, points, currentPrice) {
  const previous = points.at(-2)?.price ?? currentPrice;
  const change = previous ? ((currentPrice - previous) / previous) * 100 : 0;
  return {
    name,
    points,
    prices: points.map((point) => point.price),
    currentPrice,
    change,
  };
}

async function fetchNews() {
  const data = await fetchJson(endpoints.news, 15000);
  return (data.articles || [])
    .filter((article) => article.title && isSafeHttpUrl(article.url))
    .slice(0, 9)
    .map((article) => ({
      title: article.title.trim(),
      url: article.url,
      domain: article.domain || new URL(article.url).hostname.replace("www.", ""),
      date: parseGdeltDate(article.seendate),
    }));
}

function parseGdeltDate(value) {
  if (!value) return new Date();
  const normalized = String(value).replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
    "$1-$2-$3T$4:$5:$6Z",
  );
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function isSafeHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function calculateRsi(prices, period = 14) {
  if (prices.length <= period) return null;
  const recent = prices.slice(-(period + 1));
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < recent.length; index += 1) {
    const difference = recent[index] - recent[index - 1];
    if (difference >= 0) gains += difference;
    else losses += Math.abs(difference);
  }

  if (losses === 0) return 100;
  const relativeStrength = gains / period / (losses / period);
  return 100 - 100 / (1 + relativeStrength);
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function analyzeAsset(asset, sentimentScore) {
  const { prices } = asset;
  const rsi = calculateRsi(prices);
  const sma7 = average(prices.slice(-7));
  const sma21 = prices.length >= 21 ? average(prices.slice(-21)) : null;
  const momentumBase = prices.at(-8);
  const momentum = momentumBase ? ((prices.at(-1) - momentumBase) / momentumBase) * 100 : null;
  let score = 0;
  const reasons = [];

  if (rsi !== null) {
    if (rsi < 35) {
      score += 1;
      reasons.push("RSI: túladott");
    } else if (rsi > 65) {
      score -= 1;
      reasons.push("RSI: túlvett");
    } else {
      reasons.push("RSI: semleges");
    }
  }

  if (sma7 !== null && sma21 !== null) {
    if (sma7 > sma21) {
      score += 1;
      reasons.push("Emelkedő átlagtrend");
    } else {
      score -= 1;
      reasons.push("Csökkenő átlagtrend");
    }
  } else {
    reasons.push("Korlátozott előzmény");
  }

  if (momentum !== null) {
    if (momentum > 1) score += 1;
    else if (momentum < -1) score -= 1;
    reasons.push(`7 nap: ${formatPercent(momentum)}`);
  }

  if (sentimentScore > 0.2) {
    score += 0.5;
    reasons.push("Pozitív hírek");
  } else if (sentimentScore < -0.2) {
    score -= 0.5;
    reasons.push("Negatív hírek");
  }

  let signal = "Tartás";
  let className = "neutral";
  if (score >= 2) {
    signal = "Vételi jelzés";
    className = "positive";
  } else if (score <= -2) {
    signal = "Eladási jelzés";
    className = "negative";
  }

  const dataCompleteness = [rsi, sma21, momentum].filter((value) => value !== null).length / 3;
  const confidence = Math.round(Math.min(86, 44 + Math.abs(score) * 11 + dataCompleteness * 12));

  return { rsi, sma7, sma21, momentum, score, signal, className, confidence, reasons };
}

function analyzeSentiment(articles) {
  if (!articles.length) return { score: 0, label: "Semleges" };
  const scores = articles.map((article) => scoreText(article.title));
  const score = scores.reduce((sum, value) => sum + value, 0) / articles.length;
  return { score, label: sentimentLabel(score) };
}

function assetSpecificSentiment(assetKey) {
  const keywords =
    assetKey === "bitcoin" ? ["bitcoin", "crypto", "btc"] : ["gold", "bullion", "xau"];
  const relevant = state.news.filter((article) => {
    const title = article.title.toLowerCase();
    return keywords.some((keyword) => title.includes(keyword));
  });
  return analyzeSentiment(relevant.length ? relevant : state.news).score;
}

function scoreText(text) {
  const normalized = text.toLowerCase();
  const positive = positiveWords.filter((word) => normalized.includes(word)).length;
  const negative = negativeWords.filter((word) => normalized.includes(word)).length;
  if (positive + negative === 0) return 0;
  return (positive - negative) / (positive + negative);
}

function sentimentLabel(score) {
  if (score > 0.2) return "Pozitív";
  if (score < -0.2) return "Negatív";
  return "Semleges";
}

function renderAsset(assetKey) {
  const asset = state.assets[assetKey];
  const prefix = assetKey === "bitcoin" ? "btc" : "gold";
  document.getElementById(`${prefix}Price`).textContent = formatCurrency(asset.currentPrice);

  const changeElement = document.getElementById(`${prefix}Change`);
  changeElement.textContent = formatPercent(asset.change);
  changeElement.className = `change ${valueClass(asset.change)}`;

  const signalElement = document.getElementById(`${prefix}Signal`);
  signalElement.textContent = asset.analysis.signal;
  signalElement.className = `signal ${asset.analysis.className}`;
  document.getElementById(`${prefix}Confidence`).textContent = `${asset.analysis.confidence}%`;

  const reasonsElement = document.getElementById(`${prefix}Reasons`);
  reasonsElement.replaceChildren(
    ...asset.analysis.reasons.slice(0, 3).map((reason) => {
      const span = document.createElement("span");
      span.textContent = reason;
      return span;
    }),
  );

  renderChart(assetKey, asset);
}

function renderUnavailableAsset(assetKey) {
  const prefix = assetKey === "bitcoin" ? "btc" : "gold";
  document.getElementById(`${prefix}Price`).textContent = "Nem elérhető";
  document.getElementById(`${prefix}Signal`).textContent = "Nincs adat";
  document.getElementById(`${prefix}Confidence`).textContent = "–";
}

function renderChart(assetKey, asset) {
  if (typeof Chart === "undefined") return;
  const canvasId = assetKey === "bitcoin" ? "btcChart" : "goldChart";
  const color = assetKey === "bitcoin" ? "#e2863b" : "#b98a35";
  const context = document.getElementById(canvasId);
  state.charts[assetKey]?.destroy();
  state.charts[assetKey] = new Chart(context, {
    type: "line",
    data: {
      labels: asset.points.map((point) =>
        new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric" }).format(point.time),
      ),
      datasets: [{
        data: asset.prices,
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: createGradient(context, color),
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: { label: (item) => `$${formatCurrency(item.raw)}` },
        },
      },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  });
}

function createGradient(canvas, color) {
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, 150);
  gradient.addColorStop(0, `${color}33`);
  gradient.addColorStop(1, `${color}00`);
  return gradient;
}

function renderIndicators(assetKey) {
  const analysis = state.assets[assetKey]?.analysis;
  if (!analysis) {
    ["indicatorRsi", "indicatorSma", "indicatorMomentum"].forEach((id) => {
      document.getElementById(id).textContent = "–";
    });
    return;
  }

  document.getElementById("indicatorRsi").textContent =
    analysis.rsi === null ? "Nincs adat" : analysis.rsi.toFixed(1);
  setPill(
    "indicatorRsiState",
    analysis.rsi === null ? "Nincs adat" : analysis.rsi < 35 ? "Túladott" : analysis.rsi > 65 ? "Túlvett" : "Semleges",
    analysis.rsi === null ? "neutral" : analysis.rsi < 35 ? "positive" : analysis.rsi > 65 ? "negative" : "neutral",
  );

  const smaDifference =
    analysis.sma7 !== null && analysis.sma21 !== null
      ? ((analysis.sma7 - analysis.sma21) / analysis.sma21) * 100
      : null;
  document.getElementById("indicatorSma").textContent =
    smaDifference === null ? "Nincs adat" : formatPercent(smaDifference);
  setPill(
    "indicatorSmaState",
    smaDifference === null ? "Nincs adat" : smaDifference >= 0 ? "Emelkedő" : "Csökkenő",
    smaDifference === null ? "neutral" : valueClass(smaDifference),
  );

  document.getElementById("indicatorMomentum").textContent =
    analysis.momentum === null ? "Nincs adat" : formatPercent(analysis.momentum);
  setPill(
    "indicatorMomentumState",
    analysis.momentum === null ? "Nincs adat" : analysis.momentum > 1 ? "Erősödik" : analysis.momentum < -1 ? "Gyengül" : "Oldalaz",
    analysis.momentum === null ? "neutral" : valueClass(analysis.momentum, 1),
  );
}

function setPill(id, text, className) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.className = `pill ${className}`;
}

function selectIndicatorAsset(assetKey) {
  state.selectedAsset = assetKey;
  document.querySelectorAll("[data-indicator-asset]").forEach((button) => {
    button.classList.toggle("active", button.dataset.indicatorAsset === assetKey);
  });
  renderIndicators(assetKey);
}

function renderSentiment() {
  const { score, label } = state.sentiment;
  const badge = document.getElementById("sentimentBadge");
  badge.textContent = label;
  badge.className = `sentiment-badge ${valueClass(score, 0.2)}`;
  const position = Math.max(5, Math.min(95, 50 + score * 40));
  document.getElementById("sentimentNeedle").style.left = `${position}%`;

  const count = state.news.length;
  document.getElementById("sentimentSummary").textContent = count
    ? `${count} friss angol nyelvű cím kulcsszavas vizsgálata alapján a hírek összhangulata ${label.toLowerCase()}. Ez egyszerű becslés, nem teljes szövegű AI-elemzés.`
    : "Nem érkezett elemezhető hír. A jelzések most csak az árfolyamadatokra támaszkodnak.";
}

function renderNews() {
  const grid = document.getElementById("newsGrid");
  grid.replaceChildren();

  if (!state.news.length) {
    const fallback = document.createElement("a");
    fallback.className = "news-card";
    fallback.href = "https://news.google.com/search?q=bitcoin%20OR%20gold";
    fallback.target = "_blank";
    fallback.rel = "noopener noreferrer";
    const title = document.createElement("h3");
    title.textContent = "A hírfolyam átmenetileg nem elérhető";
    const action = document.createElement("span");
    action.textContent = "Hírek megnyitása a Google News oldalán ↗";
    fallback.append(title, action);
    grid.append(fallback);
    return;
  }

  state.news.slice(0, 6).forEach((article) => {
    const card = document.createElement("a");
    card.className = "news-card";
    card.href = article.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    const meta = document.createElement("div");
    meta.className = "news-meta";
    const domain = document.createElement("span");
    domain.textContent = article.domain;
    const date = document.createElement("span");
    date.textContent = relativeTime(article.date);
    meta.append(domain, date);

    const title = document.createElement("h3");
    title.textContent = article.title;
    const action = document.createElement("span");
    action.textContent = "Cikk megnyitása ↗";
    card.append(meta, title, action);
    grid.append(card);
  });
}

function relativeTime(date) {
  const hours = Math.max(0, Math.round((Date.now() - date.getTime()) / 3600000));
  if (hours < 1) return "Most";
  if (hours < 24) return `${hours} órája`;
  return `${Math.round(hours / 24)} napja`;
}

function buildAnalysisPrompt() {
  const assetLines = Object.entries(state.assets).map(([key, asset]) => {
    if (!asset?.analysis) return `${key}: nincs elérhető adat`;
    const analysis = asset.analysis;
    return [
      `${asset.name}: $${formatCurrency(asset.currentPrice)}`,
      `napi változás: ${formatPercent(asset.change)}`,
      `RSI(14): ${analysis.rsi?.toFixed(1) ?? "nincs adat"}`,
      `SMA7: ${analysis.sma7?.toFixed(2) ?? "nincs adat"}`,
      `SMA21: ${analysis.sma21?.toFixed(2) ?? "nincs adat"}`,
      `7 napos momentum: ${analysis.momentum === null ? "nincs adat" : formatPercent(analysis.momentum)}`,
      `algoritmikus jelzés: ${analysis.signal} (${analysis.confidence}% becsült bizalom)`,
    ].join(", ");
  });

  const headlines = state.news.slice(0, 8).map((article) => `- ${article.title}`).join("\n");
  return `Elemezd az alábbi Bitcoin- és aranypiaci pillanatképet magyarul.

${assetLines.join("\n")}
Hírek egyszerű kulcsszavas hangulata: ${state.sentiment.label}

Friss hírcímek:
${headlines || "- Nincs elérhető hírcím"}

Kérlek:
1. Külön értékeld a Bitcoin és az arany rövid távú technikai képét.
2. Magyarázd el, mely hírek hathatnak az árfolyamokra, és ellenőrizd a hírek megbízhatóságát.
3. Adj optimista, semleges és pesszimista forgatókönyvet.
4. Ne ígérj biztos hozamot, jelezd az adatok korlátait és a fő kockázatokat.
5. Az értékelés oktatási célú legyen, ne személyre szabott pénzügyi tanács.

Adatok időpontja: ${new Date().toLocaleString("hu-HU")}`;
}

async function copyAnalysisPrompt() {
  const button = document.getElementById("copyPromptButton");
  const prompt = buildAnalysisPrompt();
  try {
    await navigator.clipboard.writeText(prompt);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = prompt;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.remove();
  }
  const original = button.textContent;
  button.textContent = "Másolva ✓";
  setTimeout(() => { button.textContent = original; }, 1800);
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "–";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function valueClass(value, threshold = 0) {
  if (value > threshold) return "positive";
  if (value < -threshold) return "negative";
  return "neutral";
}

function setLoading(isLoading, failed = false) {
  const button = document.getElementById("refreshButton");
  const status = document.getElementById("marketStatus");
  button.disabled = isLoading;
  button.classList.toggle("loading", isLoading);
  if (isLoading) {
    status.className = "status";
    status.innerHTML = "<span></span> Adatok betöltése";
  } else if (failed) {
    status.className = "status error";
    status.innerHTML = "<span></span> Nincs adatkapcsolat";
  } else {
    status.className = "status live";
    status.innerHTML = "<span></span> Adatkapcsolat aktív";
  }
}

function showError(message) {
  const banner = document.getElementById("errorBanner");
  banner.textContent = `${message} Próbáld meg később a frissítés gombbal.`;
  banner.hidden = false;
}

function hideError() {
  document.getElementById("errorBanner").hidden = true;
}
