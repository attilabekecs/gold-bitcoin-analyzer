const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

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

    if (request.method !== "POST" || url.pathname !== "/analyze") {
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

    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 50 || prompt.length > 12000) {
      return jsonResponse(
        { error: "Az elemzési kérés hossza nem megfelelő." },
        400,
        corsHeaders,
      );
    }

    try {
      const model = env.GEMINI_MODEL || "gemini-2.5-flash";
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.25,
              topP: 0.9,
              maxOutputTokens: 2200,
            },
          }),
        },
      );

      const geminiData = await geminiResponse.json();
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
