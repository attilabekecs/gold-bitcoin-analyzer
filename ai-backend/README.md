# Aurum & Satoshi AI backend

Ingyenes Cloudflare Worker, amely a Gemini 2.5 Flash modellt hívja meg. A Gemini API-kulcs
csak a Cloudflare titkos tárhelyén szerepel, soha nem kerül a publikus weboldalba vagy a
GitHub repositoryba.

## Mire van szükség?

1. Ingyenes [Cloudflare-fiók](https://dash.cloudflare.com/sign-up)
2. Ingyenes [Google AI Studio API-kulcs](https://aistudio.google.com/app/apikey)
3. Egy hosszú, véletlenszerű hozzáférési token

A Gemini ingyenes csomagjának kvótája változhat. Az ingyenes csomagba küldött adatok
felhasználhatók a Google szolgáltatásainak fejlesztésére, ezért személyes vagy bizalmas
adatot ne küldj.

## Telepítés Cloudflare Dashboardból

1. Jelentkezz be a Cloudflare Dashboardba.
2. Nyisd meg a `Workers & Pages` részt.
3. Válaszd a `Create application → Import a repository` lehetőséget.
4. Kapcsold össze a GitHub-fiókodat, majd válaszd ki:
   `attilabekecs/gold-bitcoin-analyzer`.
5. A projekt gyökérkönyvtára legyen `ai-backend`.
6. A deploy parancs legyen `npx wrangler deploy`.
7. Telepítés után nyisd meg a Worker `Settings → Variables and Secrets` részét.
8. Vegyél fel két `Secret` típusú változót:
   - `GEMINI_API_KEY`: a Google AI Studio kulcsod
   - `AI_ACCESS_TOKEN`: egy legalább 32 karakteres véletlenszerű token
9. Ellenőrizd, hogy a normál változók értékei:
   - `ALLOWED_ORIGIN=https://attilabekecs.github.io`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `ALLOW_LOCAL=false`
10. Telepítsd újra a Workert.

Az elkészült végpont formája:

```text
https://aurum-satoshi-ai.<cloudflare-subdomain>.workers.dev/analyze
```

Az oldal fogaskerék menüjében add meg ezt a címet és ugyanazt az `AI_ACCESS_TOKEN`
értéket.

## Opcionális CLI telepítés

A parancsokat az `ai-backend` könyvtárban kell futtatni:

```bash
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put AI_ACCESS_TOKEN
npx wrangler deploy
```

A `.dev.vars` helyi teszteléshez használható. Ezt a fájlt a `.gitignore` kizárja.

## API

### `GET /health`

Visszaadja a szolgáltatás állapotát, de nem teszi közzé a titkos kulcsokat.

### `POST /analyze`

Fejlécek:

```text
Content-Type: application/json
Authorization: Bearer <AI_ACCESS_TOKEN>
```

Kérés:

```json
{
  "prompt": "Az elemzendő piaci pillanatkép..."
}
```

Sikeres válasz:

```json
{
  "analysis": "A magyar nyelvű elemzés...",
  "model": "gemini-2.5-flash",
  "generatedAt": "2026-07-11T12:00:00.000Z"
}
```

### `POST /strategy`

A Stratégialabor strukturált paraméterjavaslata. Ugyanazt a Bearer tokent használja,
mint az `/analyze` végpont.

Kérés:

```json
{
  "asset": "bitcoin",
  "interval": 15,
  "candleCount": 720,
  "riskProfile": "medium",
  "goal": "robustness",
  "currentConfig": {
    "fastEma": 9,
    "slowEma": 21,
    "rsiPeriod": 14,
    "rsiMin": 50,
    "rsiMax": 68,
    "atrMultiplier": 1.5,
    "rewardRatio": 2
  },
  "marketSnapshot": {
    "price": 60000,
    "emaGapPercent": 0.12,
    "rsi": 56,
    "atrPercent": 0.4
  }
}
```

Sikeres válasz:

```json
{
  "suggestion": {
    "direction": "both",
    "fastEma": 9,
    "slowEma": 26,
    "rsiPeriod": 14,
    "rsiMin": 50,
    "rsiMax": 67,
    "atrMultiplier": 1.8,
    "rewardRatio": 2
  },
  "rationale": "A volatilitás miatt szélesebb stop és lassabb trendfilter indokolt.",
  "confidence": "medium",
  "warnings": ["A 720 gyertyás minta rövid."],
  "model": "gemini-2.5-flash",
  "generatedAt": "2026-07-12T08:00:00.000Z"
}
```

A Worker whitelisteli és biztonságos tartományra korlátozza a paramétereket. Nem adhat
vissza tőkét, kockázati százalékot, díjat, spreadet, slippage-et vagy train/test arányt.
A frontend csak külön felhasználói kattintásra alkalmazza a javaslatot, és attól még nem
fut le automatikusan backtest.

## Biztonsági korlátok

- Csak a beállított GitHub Pages eredetről fogad böngészős kérést.
- Minden elemzési kéréshez hozzáférési token szükséges.
- A kérés mérete és a prompt hossza korlátozott.
- A stratégiajavaslat strukturált JSON, mező-whitelisttel és szerveroldali határértékekkel.
- A Worker egy példányon belül rövid időablakos stratégiajavaslat-korlátot alkalmaz.
- A válaszok nem gyorsítótárazhatók.
- A Worker nem naplózza a promptot vagy a titkos kulcsokat.

Az eredetvizsgálat önmagában nem hitelesítés, ezért az `AI_ACCESS_TOKEN` kötelező. Ha a
token kiszivárog, cseréld le a Cloudflare beállításaiban és az oldal helyi beállításaiban.
