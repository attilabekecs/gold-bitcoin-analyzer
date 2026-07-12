const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

let cachedDiscoveredModel = "";
let cachedModelExpiresAt = 0;
let strategyRequestTimes = [];

const SYSTEM_INSTRUCTION = `Te az Aurum & Satoshi oktatási célú piaci elemzője vagy.
Magyarul válaszolj, tömören és jól tagoltan.

Kötelező szabályok:
- Kizárólag a felhasználói kérésben kapott adatokra támaszkodj.
- Ne állítsd, hogy valós idejű adatokat látsz, és ne találj ki híreket vagy árfolyamokat.
- Ne ígérj nyereséget, biztos hozamot vagy kockázatmentes ügyletet.
- Ne adj személyre szabott pénzügyi tanácsot.
- Különítsd el a tényeket, a bizonytalanságokat és a lehetséges forgatókönyveket.
- Jelezd, ha hiányos, elavult vagy ellentmondásos az adat.
- Minden válasz végén szerepeljen: "Ez oktatási célú elemzés, nem befektetési tanács."`;

const STRATEGY_SYSTEM_INSTRUCTION = `Te az Aurum & Satoshi oktatási célú stratégia-paraméter asszisztense vagy.
Kizárólag a kapott piaci összefoglalásra és jelenlegi beállításokra támaszkodj.
Ne ígérj nyereséget, ne adj élő kereskedési utasítást, és ne módosíts költség- vagy tőkekockázati paramétert.
Csak érvényes JSON-objektumot adj vissza a kért mezőkkel.`;

const STRATEGY_BOUNDS = {
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
};

const STRATEGY_BOOLEAN_FIELDS = [
  "useMacd",
  "useVolume",
  "useHigherTimeframe",
  "useTrailingStop",
  "useBreakEven",
];

const STRATEGY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  required: ["suggestion", "rationale", "confidence", "warnings"],
  properties: {
    suggestion: {
      type: "OBJECT",
      required: [
        "direction",
        "fastEma",
        "slowEma",
        "rsiPeriod",
        "rsiMin",
        "rsiMax",
        "atrMultiplier",
        "rewardRatio",
      ],
      properties: {
        direction: { type: "STRING", enum: ["long", "short", "both"] },
        fastEma: { type: "NUMBER" },
        slowEma: { type: "NUMBER" },
        rsiPeriod: { type: "NUMBER" },
        rsiMin: { type: "NUMBER" },
        rsiMax: { type: "NUMBER" },
        momentumLookback: { type: "NUMBER" },
        momentumThreshold: { type: "NUMBER" },
        useMacd: { type: "BOOLEAN" },
        useVolume: { type: "BOOLEAN" },
        volumeMultiplier: { type: "NUMBER" },
        useHigherTimeframe: { type: "BOOLEAN" },
        atrPeriod: { type: "NUMBER" },
        atrMultiplier: { type: "NUMBER" },
        rewardRatio: { type: "NUMBER" },
        useTrailingStop: { type: "BOOLEAN" },
        trailingAtrMultiplier: { type: "NUMBER" },
        useBreakEven: { type: "BOOLEAN" },
        breakEvenR: { type: "NUMBER" },
        cooldownBars: { type: "NUMBER" },
      },
    },
    rationale: { type: "STRING" },
    confidence: { type: "STRING", enum: ["low", "medium", "high"] },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
  },
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = buildCorsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin, env)) {
        return jsonResponse({ error: "Nem engedélyezett eredet." }, 403, corsHeaders);
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(
        {
          ok: true,
          service: "aurum-satoshi-ai",
          model: env.GEMINI_MODEL || "gemini-2.5-flash",
        },
        200,
        corsHeaders,
      );
    }

    const isAnalysisRequest = request.method === "POST" && url.pathname === "/analyze";
    const isStrategyRequest = request.method === "POST" && url.pathname === "/strategy";
    if (!isAnalysisRequest && !isStrategyRequest) {
      return jsonResponse({ error: "Ismeretlen végpont." }, 404, corsHeaders);
    }

    if (!isAllowedOrigin(origin, env)) {
      return jsonResponse({ error: "Nem engedélyezett eredet." }, 403, corsHeaders);
    }

    if (!env.GEMINI_API_KEY || !env.AI_ACCESS_TOKEN) {
      return jsonResponse({ error: "A backend titkos kulcsai nincsenek beállítva." }, 503, corsHeaders);
    }

    const authorization = request.headers.get("Authorization") || "";
    if (authorization !== `Bearer ${env.AI_ACCESS_TOKEN}`) {
      return jsonResponse({ error: "Érvénytelen hozzáférési token." }, 401, corsHeaders);
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 25000) {
      return jsonResponse({ error: "A kérés túl nagy." }, 413, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Érvénytelen JSON-kérés." }, 400, corsHeaders);
    }

    if (isStrategyRequest) {
      return handleStrategyRequest(body, env, corsHeaders);
    }

    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 50 || prompt.length > 12000) {
      return jsonResponse(
        { error: "Az elemzési kérés hossza nem megfelelő." },
        400,
        corsHeaders,
      );
    }

    try {
      let model =
        cachedDiscoveredModel && Date.now() < cachedModelExpiresAt
          ? cachedDiscoveredModel
          : env.GEMINI_MODEL || "gemini-2.5-flash";
      let { response: geminiResponse, data: geminiData } = await callGemini(
        env.GEMINI_API_KEY,
        model,
        prompt,
      );

      if (!geminiResponse.ok && geminiData.error?.status === "NOT_FOUND") {
        const discoveredModel = await discoverAvailableFlashModel(env.GEMINI_API_KEY);
        if (discoveredModel && discoveredModel !== model) {
          model = discoveredModel;
          cachedDiscoveredModel = discoveredModel;
          cachedModelExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
          ({ response: geminiResponse, data: geminiData } = await callGemini(
            env.GEMINI_API_KEY,
            model,
            prompt,
          ));
        }
      }

      if (!geminiResponse.ok) {
        const providerCode = geminiData.error?.status || `HTTP_${geminiResponse.status}`;
        const providerMessage = sanitizeProviderMessage(geminiData.error?.message);
        const status = geminiResponse.status === 429 ? 429 : 502;
        return jsonResponse(
          {
            error: explainProviderError(providerCode),
            code: providerCode,
            providerStatus: geminiResponse.status,
            details: providerMessage,
          },
          status,
          corsHeaders,
        );
      }

      let analysis = geminiData.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

      if (!analysis) {
        return jsonResponse({ error: "Az AI üres választ adott." }, 502, corsHeaders);
      }

      const disclaimer = "Ez oktatási célú elemzés, nem befektetési tanács.";
      if (!analysis.includes(disclaimer)) {
        analysis = `${analysis}\n\n${disclaimer}`;
      }

      return jsonResponse(
        {
          analysis,
          model,
          generatedAt: new Date().toISOString(),
        },
        200,
        corsHeaders,
      );
    } catch (error) {
      return jsonResponse(
        {
          error: "A backend nem tudott kapcsolódni az AI-szolgáltatóhoz.",
          code: "BACKEND_FETCH_FAILED",
          details: sanitizeProviderMessage(error?.message),
        },
        502,
        corsHeaders,
      );
    }
  },
};

async function handleStrategyRequest(body, env, corsHeaders) {
  const now = Date.now();
  strategyRequestTimes = strategyRequestTimes.filter((time) => now - time < 15 * 60 * 1000);
  if (strategyRequestTimes.length >= 20) {
    return jsonResponse(
      { error: "Túl sok stratégiajavaslat-kérés. Próbáld újra később.", code: "RATE_LIMITED" },
      429,
      corsHeaders,
    );
  }
  strategyRequestTimes.push(now);

  const riskProfile = ["low", "medium", "high"].includes(body?.riskProfile)
    ? body.riskProfile
    : "medium";
  const goal = ["robustness", "drawdown", "return"].includes(body?.goal)
    ? body.goal
    : "robustness";
  const interval = [1, 5, 15, 60].includes(Number(body?.interval))
    ? Number(body.interval)
    : 1;
  const candleCount = Math.max(0, Math.min(1000000, Number(body?.candleCount) || 0));
  if (candleCount < 120) {
    return jsonResponse(
      { error: "A stratégiajavaslathoz legalább 120 gyertya szükséges." },
      400,
      corsHeaders,
    );
  }
  const currentConfig = normalizeStrategySuggestion(body?.currentConfig || {});
  const safeContext = {
    asset: String(body?.asset || "bitcoin").slice(0, 20),
    interval,
    candleCount,
    riskProfile,
    goal,
    currentConfig,
    marketSnapshot: sanitizeNumericObject(body?.marketSnapshot),
    lastResult: body?.lastResult ? sanitizeNumericObject(body.lastResult) : null,
  };
  const prompt = `Adj oktatási célú stratégia-paraméter javaslatot az alábbi JSON kontextus alapján:
${JSON.stringify(safeContext)}

Kizárólag ilyen JSON-t adj:
{
  "suggestion": {
    "direction": "long|short|both",
    "fastEma": number,
    "slowEma": number,
    "rsiPeriod": number,
    "rsiMin": number,
    "rsiMax": number,
    "momentumLookback": number,
    "momentumThreshold": number,
    "useMacd": boolean,
    "useVolume": boolean,
    "volumeMultiplier": number,
    "useHigherTimeframe": boolean,
    "atrPeriod": number,
    "atrMultiplier": number,
    "rewardRatio": number,
    "useTrailingStop": boolean,
    "trailingAtrMultiplier": number,
    "useBreakEven": boolean,
    "breakEvenR": number,
    "cooldownBars": number
  },
  "rationale": "legfeljebb 500 karakteres magyar indoklás",
  "confidence": "low|medium|high",
  "warnings": ["legfeljebb 4 rövid magyar figyelmeztetés"]
}

Ne javasolj tőkét, kockázati százalékot, díjat, spreadet, slippage-et vagy train/test arányt.`;

  try {
    let model =
      cachedDiscoveredModel && Date.now() < cachedModelExpiresAt
        ? cachedDiscoveredModel
        : env.GEMINI_MODEL || "gemini-2.5-flash";
    let { response, data } = await callGemini(env.GEMINI_API_KEY, model, prompt, {
      systemInstruction: STRATEGY_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: STRATEGY_RESPONSE_SCHEMA,
      temperature: 0.15,
      maxOutputTokens: 1400,
    });
    if (!response.ok && data.error?.status === "NOT_FOUND") {
      const discoveredModel = await discoverAvailableFlashModel(env.GEMINI_API_KEY);
      if (discoveredModel && discoveredModel !== model) {
        model = discoveredModel;
        cachedDiscoveredModel = discoveredModel;
        cachedModelExpiresAt = Date.now() + 6 * 60 * 60 * 1000;
        ({ response, data } = await callGemini(env.GEMINI_API_KEY, model, prompt, {
          systemInstruction: STRATEGY_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: STRATEGY_RESPONSE_SCHEMA,
          temperature: 0.15,
          maxOutputTokens: 1400,
        }));
      }
    }
    if (!response.ok) {
      const code = data.error?.status || `HTTP_${response.status}`;
      return jsonResponse(
        {
          error: explainProviderError(code),
          code,
          details: sanitizeProviderMessage(data.error?.message),
        },
        response.status === 429 ? 429 : 502,
        corsHeaders,
      );
    }
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    const parsed = parseStrategyJson(text);
    if (!parsed?.suggestion) {
      return jsonResponse(
        { error: "Az AI nem adott érvényes stratégiajavaslatot.", code: "INVALID_AI_JSON" },
        502,
        corsHeaders,
      );
    }
    const suggestion = normalizeStrategySuggestion(parsed.suggestion);
    return jsonResponse(
      {
        suggestion,
        rationale: String(parsed.rationale || "").replace(/\s+/g, " ").trim().slice(0, 500),
        confidence: ["low", "medium", "high"].includes(parsed.confidence)
          ? parsed.confidence
          : "low",
        warnings: Array.isArray(parsed.warnings)
          ? parsed.warnings.map((warning) => String(warning).slice(0, 180)).slice(0, 4)
          : [],
        model,
        generatedAt: new Date().toISOString(),
        disclaimer: "Ez oktatási célú paraméterjavaslat, nem befektetési tanács.",
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    return jsonResponse(
      {
        error: "A backend nem tudta elkészíteni a stratégiajavaslatot.",
        code: "STRATEGY_SUGGESTION_FAILED",
        details: sanitizeProviderMessage(error?.message),
      },
      502,
      corsHeaders,
    );
  }
}

function normalizeStrategySuggestion(input) {
  const output = {};
  Object.entries(STRATEGY_BOUNDS).forEach(([key, [min, max]]) => {
    const value = Number(input?.[key]);
    if (Number.isFinite(value)) output[key] = Math.min(max, Math.max(min, value));
  });
  [
    "fastEma",
    "slowEma",
    "rsiPeriod",
    "momentumLookback",
    "atrPeriod",
    "cooldownBars",
  ].forEach((key) => {
    if (key in output) output[key] = Math.round(output[key]);
  });
  if ("fastEma" in output && "slowEma" in output) {
    output.slowEma = Math.max(output.slowEma, output.fastEma + 2);
  }
  if ("rsiMin" in output && "rsiMax" in output) {
    output.rsiMax = Math.max(output.rsiMax, output.rsiMin + 1);
  }
  STRATEGY_BOOLEAN_FIELDS.forEach((key) => {
    if (typeof input?.[key] === "boolean") output[key] = input[key];
  });
  if (["long", "short", "both"].includes(input?.direction)) {
    output.direction = input.direction;
  }
  return output;
}

function sanitizeNumericObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .slice(0, 20)
      .map(([key, value]) => [String(key).slice(0, 40), Number(value)])
      .filter(([, value]) => Number.isFinite(value)),
  );
}

function parseStrategyJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function isAllowedOrigin(origin, env) {
  if (origin === env.ALLOWED_ORIGIN) return true;
  if (env.ALLOW_LOCAL === "true") {
    return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  }
  return false;
}

function buildCorsHeaders(origin, env) {
  const headers = {
    ...JSON_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (isAllowedOrigin(origin, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(payload, status, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function explainProviderError(code) {
  const messages = {
    API_KEY_INVALID: "A Gemini API-kulcs érvénytelen.",
    PERMISSION_DENIED: "A Gemini API-hozzáférés nincs engedélyezve ehhez a projekthez.",
    NOT_FOUND: "A beállított Gemini modell nem érhető el.",
    INVALID_ARGUMENT: "A Gemini elutasította a kérés formátumát.",
    RESOURCE_EXHAUSTED: "Az ingyenes Gemini-kvóta elfogyott.",
    UNAUTHENTICATED: "A Gemini API-kulcs hitelesítése sikertelen.",
    NO_COMPATIBLE_MODEL: "A projekthez nem található használható Gemini Flash modell.",
  };
  return messages[code] || "A Gemini szolgáltató hibát jelzett.";
}

function sanitizeProviderMessage(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  return value
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[API_KEY_REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

async function callGemini(apiKey, model, prompt, options = {}) {
  const generationConfig = {
    temperature: options.temperature ?? 0.25,
    topP: 0.9,
    maxOutputTokens: options.maxOutputTokens ?? 2200,
  };
  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }
  if (options.responseSchema) {
    generationConfig.responseSchema = options.responseSchema;
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: options.systemInstruction || SYSTEM_INSTRUCTION }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig,
      }),
    },
  );
  let data;
  try {
    data = await response.json();
  } catch {
    data = {
      error: {
        status: `HTTP_${response.status}`,
        message: "A Gemini nem JSON-formátumú választ adott.",
      },
    };
  }
  return { response, data };
}

async function discoverAvailableFlashModel(apiKey) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",
    {
      headers: {
        Accept: "application/json",
        "x-goog-api-key": apiKey,
      },
    },
  );
  if (!response.ok) return "";
  const data = await response.json();
  const available = (data.models || [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => String(model.name || "").replace(/^models\//, ""))
    .filter((name) => /gemini.*flash/i.test(name))
    .filter((name) => !/(image|tts|live|audio|embedding)/i.test(name));

  const preferred = [
    "gemini-3-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
  ];
  available.sort((left, right) => modelPreference(left, preferred) - modelPreference(right, preferred));
  return available[0] || "";
}

function modelPreference(name, preferred) {
  const exactIndex = preferred.indexOf(name);
  if (exactIndex >= 0) return exactIndex;
  const stableBonus = /(preview|exp|\d{2}-\d{2})/i.test(name) ? 20 : 0;
  const litePenalty = /lite/i.test(name) ? 5 : 0;
  return 100 + stableBonus + litePenalty;
}
