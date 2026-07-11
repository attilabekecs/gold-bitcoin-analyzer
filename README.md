# Aurum & Satoshi

Ingyenes, statikus Bitcoin- és aranypiaci figyelő. Aktuális árfolyamokat, technikai
indikátorokat, friss híreket, portfóliókövetést és kockázatkezelési eszközöket jelenít meg.

## Funkciók

- 7, 30, 90 és 365 napos Bitcoin-időtávok
- Aktuális aranyár és opcionális Twelve Data történeti adatok
- USD, EUR és HUF megjelenítés
- RSI(14), SMA7/SMA21, momentum, MACD, Bollinger-sáv és árszintek
- Vétel / tartás / eladás algoritmikus jelzés
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
- [Gold API](https://gold-api.com/) – aktuális aranyár
- [Free Gold API](https://freegoldapi.com/) – korábbi aranyárak
- [GDELT Project](https://www.gdeltproject.org/) – hírek
- [Frankfurter](https://frankfurter.app/) – devizaárfolyamok
- [Twelve Data](https://twelvedata.com/) – opcionális XAU/USD történeti adatok

Az adatforrások korlátozhatják a lekérések számát, késhetnek vagy átmenetileg
elérhetetlenné válhatnak. Az oldal ilyenkor részleges adatokat vagy hibaüzenetet mutat.

## GitHub Pages

A `.github/workflows/deploy.yml` minden `main` ágra történő feltöltés után automatikusan
publikálja az oldalt. A repository `Settings → Pages → Source` beállításánál a
`GitHub Actions` lehetőséget kell kiválasztani.

## ChatGPT Plus

A ChatGPT Plus előfizetés nem tartalmaz OpenAI API-hozzáférést. Az oldalon található
gomb az aktuális adatokból elemzési kérést készít, amely kézzel bemásolható a ChatGPT-be.
Automatikus AI-elemzéshez külön OpenAI API-kulcs és biztonságos backend szükséges.

## Beállítások és adatvédelem

A pénznem, frissítési idő, portfólió, riasztások és opcionális API-beállítások a böngésző
`localStorage` tárhelyén maradnak. Nem kerülnek a GitHub repositoryba. A böngészőben
tárolt kulcsok nem tekinthetők teljesen titkosnak, ezért csak korlátozott, visszavonható
ingyenes kulcs használata javasolt.

OpenAI API-kulcsot az oldal szándékosan nem kér. Az automatikus AI-elemzés a beállítható
backend URL-en keresztül működik; a backend feladata a titkos kulcs védelme.

Az árriasztások csak nyitott oldal mellett ellenőrizhetők. Háttérben futó e-mail- vagy
Telegram-riasztáshoz külön szerver szükséges.

## Kockázati figyelmeztetés

Ez a projekt kizárólag oktatási és tájékoztatási célú. Nem pénzügyi vagy befektetési
tanácsadás. Az algoritmikus jelzések tévedhetnek, és nem garantálnak nyereséget.
