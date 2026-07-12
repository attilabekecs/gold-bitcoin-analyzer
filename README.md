# Aurum & Satoshi

Ingyenes, statikus Bitcoin- és aranypiaci figyelő. Aktuális árfolyamokat, technikai
indikátorokat, friss híreket, portfóliókövetést és kockázatkezelési eszközöket jelenít meg.

## Funkciók

- 7, 30, 90 és 365 napos Bitcoin-időtávok
- 1 perces Bitcoin intraday diagram Kraken-adatokkal és percenkénti frissítéssel
- Opcionális 1 perces XAU/USD diagram Twelve Data API-kulccsal
- Aktuális aranyár és opcionális Twelve Data történeti adatok
- USD, EUR és HUF megjelenítés
- RSI(14), SMA7/SMA21, momentum, MACD, Bollinger-sáv és árszintek
- Kiemelt vétel / kivárás / eladás technikai döntési központ
- EMA9/EMA21, intraday RSI, MACD, ATR és 15 perces momentum
- Feltételes belépési zóna, stop-loss, célár és kockázat/hozam terv
- GDELT hírek egyszerű kulcsszavas hangulatelemzése
- Helyben tárolt portfólió és nyereség/veszteség számítás
- Pozícióméret- és kockázat/hozam kalkulátor
- Böngészős árriasztások
- Adatforrás-állapot és makrogazdasági naptárak
- Automatikus frissítés és személyre szabható beállítások
- ChatGPT-be másolható elemzési kérés
- Biztonságos AI backend integrációjára előkészített végpont
- Mobilbarát kialakítás és automatikus GitHub Pages telepítés

## Ingyenes adatforrások

- [CoinGecko](https://www.coingecko.com/en/api) – Bitcoin
- [Kraken](https://docs.kraken.com/api/) – 1 perces Bitcoin OHLC-adatok
- [Gold API](https://gold-api.com/) – aktuális aranyár
- [Free Gold API](https://freegoldapi.com/) – korábbi aranyárak
- [GDELT Project](https://www.gdeltproject.org/) – hírek
- [Frankfurter](https://frankfurter.app/) – devizaárfolyamok
- [Twelve Data](https://twelvedata.com/) – opcionális XAU/USD történeti adatok

Az adatforrások korlátozhatják a lekérések számát, késhetnek vagy átmenetileg
elérhetetlenné válhatnak. Az oldal ilyenkor részleges adatokat vagy hibaüzenetet mutat.
Az intraday jelzés technikai forgatókönyv, nem automatikus kereskedési utasítás.

## GitHub Pages

A `.github/workflows/deploy.yml` minden `main` ágra történő feltöltés után automatikusan
publikálja az oldalt. A repository `Settings → Pages → Source` beállításánál a
`GitHub Actions` lehetőséget kell kiválasztani.

## AI-elemzés

A ChatGPT Plus előfizetés nem tartalmaz OpenAI API-hozzáférést. Az oldalon található
gomb az aktuális adatokból elemzési kérést készít, amely kézzel bemásolható a ChatGPT-be.

Az `ai-backend` könyvtár egy ingyenes Cloudflare Worker + Gemini 2.5 Flash integrációt
tartalmaz. Telepítés után az oldal automatikusan lekérheti és megjelenítheti a magyar
nyelvű AI-elemzést. A részletes beállítási útmutató az
[`ai-backend/README.md`](ai-backend/README.md) fájlban található.

## Beállítások és adatvédelem

A pénznem, frissítési idő, portfólió, riasztások és opcionális API-beállítások a böngésző
`localStorage` tárhelyén maradnak. Nem kerülnek a GitHub repositoryba. A böngészőben
tárolt kulcsok nem tekinthetők teljesen titkosnak, ezért csak korlátozott, visszavonható
ingyenes kulcs használata javasolt.

Gemini- vagy OpenAI API-kulcsot az oldal szándékosan nem kér. Az automatikus AI-elemzés
a beállítható backend URL-en keresztül működik; a backend feladata a titkos kulcs
védelme. A Workerhez tartozó külön hozzáférési token a böngésző helyi tárhelyén marad,
és bármikor lecserélhető.

Az árriasztások csak nyitott oldal mellett ellenőrizhetők. Háttérben futó e-mail- vagy
Telegram-riasztáshoz külön szerver szükséges.

## Kockázati figyelmeztetés

Ez a projekt kizárólag oktatási és tájékoztatási célú. Nem pénzügyi vagy befektetési
tanácsadás. Az algoritmikus jelzések tévedhetnek, és nem garantálnak nyereséget.
