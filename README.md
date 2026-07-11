# Aurum & Satoshi

Ingyenes, statikus Bitcoin- és aranypiaci figyelő. Aktuális árfolyamokat, egyszerű
technikai indikátorokat, friss híreket és szabályalapú piaci hangulatelemzést jelenít meg.

## Funkciók

- Bitcoin 30 napos árfolyam és technikai elemzés
- Aktuális és korábbi aranyárfolyamok
- RSI(14), SMA7/SMA21 és 7 napos momentum
- Vétel / tartás / eladás algoritmikus jelzés
- GDELT hírek egyszerű kulcsszavas hangulatelemzése
- ChatGPT-be másolható elemzési kérés
- Mobilbarát kialakítás és automatikus GitHub Pages telepítés

## Ingyenes adatforrások

- [CoinGecko](https://www.coingecko.com/en/api) – Bitcoin
- [Gold API](https://gold-api.com/) – aktuális aranyár
- [Free Gold API](https://freegoldapi.com/) – korábbi aranyárak
- [GDELT Project](https://www.gdeltproject.org/) – hírek

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

## Kockázati figyelmeztetés

Ez a projekt kizárólag oktatási és tájékoztatási célú. Nem pénzügyi vagy befektetési
tanácsadás. Az algoritmikus jelzések tévedhetnek, és nem garantálnak nyereséget.
