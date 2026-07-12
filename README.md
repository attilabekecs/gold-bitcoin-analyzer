# Aurum & Satoshi

Ingyenes, statikus Bitcoin- és aranypiaci figyelő több kereskedhető eszközzel,
technikai indikátorokkal, gyakorló résszel, virtuális bot kereskedéssel és
Stratégialabor backtesttel.

## Funkciók

- 7, 30, 90 és 365 napos időtávok Bitcoin, arany és további eszközökre
- **Kiemelt fülek:** Bitcoin és Arany továbbra is külön navigációs menüpont
- **Bővített piacok:** Ethereum, Solana, EUR/USD, WTI olaj, S&P 500 (SPY) proxy
- 1 perces intraday diagramok (Kraken kriptó, Yahoo Finance forex/olaj/részvény)
- 1, 5 és 15 perces, valamint 1 órás idősíkok és trendegyezési pontszám
- Opcionális 1 perces XAU/USD diagram Twelve Data API-kulccsal
- Külön Áttekintés, Bitcoin, Arany, Piacok, Hírek, Portfólió, Gyakorló, **Virtuális bot**, Szimulátor, Stratégialabor és AI nézet
- **Gyakorló rész:** jelzés-értelmezési forgatókönyvek pontszámmal (localStorage)
- **Virtuális bot labor:** külön fülön, almenükkel (Összegzés, Beállítások, Ügyletek, Tapasztalatok), teljes kézi konfigurációval és opcionális auto-tanulással
- **Professzionális mód (alapértelmezett):** intelligens cooldown – nyertes ügylet után magas pontszámú lehetőségnél azonnal belép, vesztes után pihen; gyorsabb szkennelés (15–30 mp); kockázati limitek változatlanok
- Bot beállítható: eszközök, irány, idősíkok, EMA/RSI/MACD küszöbök, kockázat, stop/cél, cooldown, max pozíció, díj/spread/slippage, kereskedési óra, pro küszöbök
- **Összes eszköz (piaci mód):** minden ciklusban az összes katalógus-eszközt szkenneli, pontozza (bizalom, jel, idősík-egyezés, momentum, RSI) és a legjobb lehetőséget választja
- Kézi módban továbbra is rögzíthetők konkrét eszközök; piaci mód felülírja és az egész piacot figyeli
- **Auto-tanulás:** a lezárt ügyletek alapján biztonságos határokon belül finomhangol (csak bekapcsolt módban alkalmaz)
- Bot dashboard: élő státusz, rangsorolt piaci szkenner, választott lehetőség indoklással, PnL, win rate, drawdown, ügylet/óra, lehetőség-kihasználás, kihagyott lehetőségek napló, ügyletnapló okokkal, tanulási diff és előzmény
- Helyi papírkereskedési számla LONG/SHORT pozíciókkal minden támogatott eszközön
- Kereskedési napló, találati arány, profit factor, visszaesés és egyenleggörbe
- EMA/RSI/ATR backtest választható idősíkkal és állítható kereskedési díjjal
- Több idősíkú backtest és két gyertyával megerősített jelzésváltások
- Konfigurálható Stratégialabor spread-, slippage- és kockázatmodellezéssel
- Időrendi tanuló/ellenőrző szétválasztás és Buy & Hold benchmark
- EMA-paraméter-hőtérkép, túlillesztési figyelmeztetések és CSV ügyletnapló
- Moduláris EMA/RSI/MACD/momentum/volumen szabályrendszer és több idősíkú megerősítés
- Walk-forward validáció, tanuló adatos optimalizálás, Sharpe-, expectancy- és kitettségmérés
- Trailing stop, break-even, cooldown, LONG/SHORT szűrés és menthető stratégia-presetek
- Helyi OHLCV CSV-import, CSV/JSON eredményexport és külön drawdown diagram
- Jóváhagyásos Gemini AI-paraméterjavaslat strukturált, validált válasszal
- Helyi jelzéstörténet és böngészős értesítés stabil VÉTEL/ELADÁS váltáskor
- Interaktív intraday ár-, RSI-, MACD- és volumendiagramok
- Fokozatos adatbetöltés: a gyors piaci adatok nem várnak a lassabb hírforrásokra
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
- Egyedi, aranyszínű `favicon.svg` A&S motívummal

## Ingyenes adatforrások

- [CoinGecko](https://www.coingecko.com/en/api) – Bitcoin, Ethereum, Solana (napi)
- [Kraken](https://docs.kraken.com/api/) – kriptó intraday OHLC (BTC, ETH, SOL)
- [Yahoo Finance](https://finance.yahoo.com/) – EUR/USD, WTI olaj (CL=F), SPY intraday/napi
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

A Stratégialabor AI-kártyája ugyanazt a biztonságos Workert használja a `/strategy`
végponton. A javaslat csak engedélyezett technikai paramétereket tartalmazhat; a tőke,
költség és kockázati százalék nem módosítható AI-ból. A paraméterek alkalmazása és a
backtest futtatása két külön felhasználói művelet.

## Stratégialabor adatformátum

A saját OHLCV CSV első sora fejléc legyen. Kötelező oszlopok: `time`, `open`, `high`,
`low`, `close`; opcionális a `volume`. A `time` lehet ISO dátum, Unix másodperc vagy
Unix ezredmásodperc. Az importált fájl kizárólag a böngésző memóriájában marad.

A számítási logika a böngészőben futó, tiszta `strategy-engine.js` modulban található.
A `strategy-lab.js` kizárólag a nézetet, mentést, import/export folyamatot és az
AI-javaslat jóváhagyását kezeli. A `virtual-bot.js` a papírbot motorja és auto-tanulása;
a `bot-lab.js` a bot vezérlőközpont UI-ját kezeli. A `favicon.svg` a repository gyökerében található,
és az `index.html` közvetlenül hivatkozik rá.

## Beállítások és adatvédelem

A pénznem, frissítési idő, portfólió, riasztások, gyakorló pontszám, virtuális bot
állapota és opcionális API-beállítások a böngésző `localStorage` tárhelyén maradnak. Nem kerülnek a GitHub repositoryba. A böngészőben
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
