# Garmin – průzkum (23. 10. 2026)

Stav: **zatím jen prozkoumáno, nic neimplementováno.** Matyáš chce jít přes oficiální API.

## Oficiální cesta: Garmin Connect Developer Program

- **Zdarma, ale jen se schválením.** Garmin přijímá hlavně firmy: chce registrovanou právnickou
  osobu, veřejný web a veřejné zásady ochrany osobních údajů. Doporučuje se žádat jako firma
  z e-mailu na firemní doméně. Žádost se podává přes Access Request Form na developer portálu.
- **Přihlášení přes OAuth 2.0 s PKCE.** Garmin nepoužívá scopes: co aplikace smí, si uživatel
  vybere na obrazovce souhlasu.
- **Části API, které by se nám hodily:**
  - *Activity API*: aktivity z hodinek, u silového tréninku tep, kalorie a délka.
  - *Health API*: tep, spánek, stres. Mohlo by se hodit k hodnocení „How did it feel?“.
  - *Training API*: poslat trénink do Garmin Connect a do hodinek (jako plánovaný trénink).
- **Potřebuje server.** Výměna tokenů a webhooky (Garmin posílá data na náš endpoint) nejde
  udělat jen v prohlížeči. Bylo by to přes Supabase Edge Functions (free plán stačí) a tabulku
  s tokeny (jen pro vlastníka).

### Důležité: program je teď pozastavený

Podle několika zdrojů z poslední doby Garmin **pozastavil přijímání nových vývojářů**. V květnu 2026
psal žadatelům o „redesignu a modernizaci API programu“ a žádosti z jara byly v září stále bez
odpovědi. Stávající partneři fungují dál. Oficiální oznámení jsem nenašel, takže je potřeba to ověřit
přímo na developer portálu.

## Co by bylo potřeba od Matyáše

1. Ověřit na [developer.garmin.com](https://developer.garmin.com/gc-developer-program/), jestli jde
   podat žádost, a případně ji podat.
2. Mít veřejný web a privacy policy (můžu připravit jako stránky na GitHub Pages).
3. Rozhodnout, za koho se žádá (firma / OSVČ). Jako jednotlivec jsou šance malé.

## Kolik práce po schválení (odhad)

| Část | Co to obnáší |
| --- | --- |
| Propojení účtu | Settings → Connect Garmin: OAuth PKCE, Edge Function na výměnu a obnovu tokenů, tabulka `garmin_tokens` s RLS |
| Tep a kalorie k tréninku | Webhook z Activity API, spárování aktivity s tréninkem podle času, zobrazení v souhrnu a detailu |
| Trénink do hodinek | Training API: převod cviků na Garmin kategorie a cviky (Garmin neznámé názvy tiše smaže), váhy v kg, ověřit na hodinkách |
| Trénink z hodinek | Nejtěžší: Garmin silové sety přes API vrací nespolehlivě; až po ověření na reálných datech |

## Náhradní cesty (bez schválení Garminem)

- **Import souboru .FIT.** Uživatel si v Garmin Connect stáhne aktivitu a nahraje ji k tréninku;
  Colosseum z ní vytáhne tep a kalorie. Funguje hned a i v PWA.
- **Apple Health / Health Connect.** Garmin Connect do nich data posílá. Funguje až v nativní
  aplikaci (EAS Build). Zároveň pokryje i jiné hodinky (Apple Watch, Samsung, Polar…).
- **Neoficiální knihovny** (např. python-garminconnect) se přihlašují uživatelským heslem a obchází
  API. Pro veřejnou aplikaci je **nedoporučuju** (porušuje podmínky Garminu, může přestat fungovat).

## Zdroje

- Garmin OAuth2 PKCE spec: https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf
- Registrace aplikace (Nango): https://nango.dev/docs/api-integrations/garmin-oauth2/how-to-register-your-own-garmin-oauth2-api-oauth-app
- Požadavky na přístup: https://openwearables.io/docs/providers/garmin-api-integration.md
- Pozastavení programu: https://the5krunner.com/2026/09/14/garmin-developer-api-access-paused/ ,
  https://tryterra.co/blog/garmin-connect-developer-program-pause ,
  https://forums.garmin.com/developer/connect-iq/f/discussion/440200/connect-developer-program-activity-api-access-no-response-is-the-program-still-paused
- Silové tréninky přes API (zkušenosti komunity): https://forums.garmin.com/developer/connect-iq/f/discussion/441539/has-anyone-been-able-to-map-strength-exercises-to-garmin-connect/2055031 ,
  https://forum.intervals.icu/t/advanced-strength-workout-builder/115495?page=2
