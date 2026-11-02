# Generátor tréninku: pravidla a výzkum

Průzkum 2. 11. 2026. Pravidla jsou v `src/lib/generator.ts` a `src/lib/muscleGroups.ts`.

Jak číst sílu důkazů: **silné** = meta-analýza v odborném časopise. **Střední** = menší studie, nebo
primární článek četl jen někdo jiný (souhrn). **Úsudek** = výzkum to přímo neřeší, je to naše rozhodnutí.

## Pravidla

| Pravidlo | Důkaz | Síla |
| --- | --- | --- |
| Víc sérií na sval za týden = víc svalů, s klesajícím přínosem; aspoň 10 je lepší než méně | Pelland 2026, Schoenfeld 2017, Baz-Valle 2022 | silné |
| Pomocné svaly se počítají 0,5 série | Pelland 2026: tenhle způsob seděl na data nejlépe | silné |
| Aspoň 2 série na cvik | Krieger 2009 (o 46 % větší nárůst síly než 1 série), Currier 2023 přes souhrn | silné |
| Max. 10 sérií na sval za trénink | Remmert 2025: přínos se ztrácí kolem 11 sérií; autoři sami žádají opatrnost | střední, preprint |
| Začátečník: 2–3 série, 8–12 opakování i při cíli síla | Currier 2023 přes souhrn: střední váhy a víc sérií 2× týdně dají u netrénovaných většinu efektu (asi 77 % nárůstu síly oproti nejnáročnější variantě) | střední, primární článek nečten |
| Dost je skončit 2–3 opakování před selháním | ACSM 2026 přes souhrn. Pozor: Robinson 2024 ukazuje, že svaly rostou o něco víc blíž k selhání, síla ne. Pro začátečníka volíme bezpečnější stranu | střední, důkazy nejsou jednotné |
| Když jsou jen 2 série na cvik, jet je těžší: nechat v sobě 1–2 opakování (návrh Matyáše) | Nippard: když je sérií málo, musí být náročné a nemá v nich zůstat víc než 1–2 opakování (Generation Iron). Robinson 2024: blíž k selhání rostou svaly víc | střední |
| Posun ze začátečníka: dotaz po 10 workoutech (rozhodnutí Matyáše) | Výzkum konkrétní hranici nedává | úsudek |
| Velké partie a vícekloubové cviky první | Nunes 2021: síla roste nejvíc u cviků na začátku tréninku; na svaly pořadí nemá jasný vliv. ACSM 2026 přes souhrn: prioritní cviky na začátek | střední |
| Výchozí pauza 3:00 na velké cviky, 2:00 na malé (rozhodnutí Matyáše), uživatel si může vybrat 1:30, 2:00 nebo 3:00. Cíl vytrvalost si nechává krátké pauzy | Singer 2024: nad 60 s malý přínos, nad 90 s žádný znatelný rozdíl v růstu svalů (většina účastníků netrénovaná). Delší pauzy jsou tedy spíš kvůli těžším sériím a pohodlí než kvůli růstu | střední |
| Málo času: nejdřív zkrátit pauzy na 2:00, až pak ubrat série. Neplatí pro pokročilé s cílem síla a pro pauzu zvolenou ručně | Stejný zdroj | střední |
| Rozcvička: lehčí série samotného cviku | Ribeiro 2020: jedna až dvě série po 6 opakováních, 40 % a 80 % pracovní váhy, pomohly dřepu a benchi; velmi lehká krátká rozcvička nestačila. Ribeiro 2014: ani rozcvička, ani kardio počet opakování nezměnily | slabé až střední, důkazy nejednotné, malé studie trénovaných mužů |
| Rozcvička jen před prvním cvikem na nohy, tlaky a tahy (dřep rozehřeje i zadní stehna) | Žádný zdroj neříká, že ji potřebuje každý cvik | úsudek |
| Málo času i při 2 sériích: ramena, triceps a biceps ztratí vlastní cvik, pokud je zapojí tlaky nebo tahy | Pelland 2026 počítá nepřímé série jako 0,5, takže sval dál trénuje; aplikace to napíše | úsudek opřený o data |
| Začátečník: bez strojů, které má málokterý gym, a bez technicky náročných cviků | Výběr je náš, viz výčty `RARE` a `HARD_TO_LEARN` v kódu | úsudek |
| Záda: tahy a přítahy, ruce a malé svaly: izolované cviky, ramena: nejdřív boční hlava | Běžná trenérská praxe, přímý výzkum jsem nehledal | úsudek |
| Výpady a cviky na jednu nohu nikdy pod 6 opakování | Omezuje je rovnováha, ne sval | úsudek |
| Začátečník: přednostně stroje, bez technicky náročných cviků | Haugen 2023: stroje a volné váhy dávají podobné výsledky, takže stroj nic nestojí. Že jsou snazší a bezpečnější, je tvrzení ACSM citované tamtéž, přímá data o zraněních začátečníků jsem nenašel | střední |
| Vybavení: činky, vlastní váha (s hrazdou a bradly) a doma (nanejvýš židle nebo ručník) z ručních seznamů, ne z názvů cviků. Vlastní váha a doma 8–20 opakování (shyby a dipy 5–12), činky aspoň 6. Cviky s hrazdou se doma nevybírají samy, jsou jen na výměnu | Seznamy jsou náš výběr. Široký rozsah opakování: Schoenfeld 2021, ACSM 2026 přes souhrn. Bez činek nejsou rozcvičovací série, není z čeho je spočítat | úsudek |
| Výběr cviků podle Nippardových tierů (v aplikaci ho nejmenujeme) | Videa, **ne recenzovaný výzkum**. Výzkum žádné pořadí cviků nedává | úsudek |
| Každý sval aspoň 2× týdně | Pelland 2026: frekvence pomáhá síle, u svalů při stejném objemu skoro nic. ACSM 2026 přes souhrn: aspoň 2× týdně pro sílu | silné pro sílu |

## Co jsem nemohl ověřit

- **ACSM 2026 (Currier a kol., MSSE 58(4):851–872):** plný text jsem nečetl. Stránky ACSM potvrzují jen,
  že vyšel. Čísla jsou ze souhrnu lékařského asistenta (Propst), ne přímo z článku.
- **Currier 2023 (BJSM):** znám ho přes článek Petera Attii; citaci mi navíc dal jen automatický souhrn té stránky.
- **Iversen 2021 („No Time to Lift“):** stránka se nenačetla, znám jen shrnutí z vyhledávače.
- **Remmert 2025:** preprint, zatím neprošel recenzí.
- Odhad délky tréninku (45 s na sérii, 1 min na přechod, 3 min na rozcvičku u cviku) je náš odhad, ne výzkum.
  Trénink proto může přetéct zvolený čas až o 7 %.

## Co generátor záměrně nedělá

- **Supersety pro úsporu času:** šetří čas (Zhang 2025), ale jsou náročnější a pro začátečníka složitější.
- **Zdravotní omezení:** generátor o nich neví. Kdo má zranění nebo potíže, patří k odborníkovi.

## Zdroje

- Nippard, leg workout (Generation Iron). https://generationiron.com/jeff-nippard-leg-workout/
- Pelland a kol. 2026, Sports Med 56(2):481–505. https://pubmed.ncbi.nlm.nih.gov/41343037/
- Remmert a kol. 2025, preprint. https://sportrxiv.org/index.php/server/preprint/view/537
- Schoenfeld a kol. 2017, J Sports Sci (objem). https://researchgate.net/publication/305455324
- Baz-Valle a kol. 2022, J Hum Kinet 81:199–210. https://doi.org/10.2478/hukin-2022-0017
- Krieger 2009, meta-regrese (počet sérií). https://pubmed.ncbi.nlm.nih.gov/19661829/
- Currier a kol. 2023, BJSM, přes souhrn. https://peterattiamd.com/lowering-the-barrier-to-entry-for-resistance-training/
- ACSM 2026: https://acsm.org/science-spotlight-acsm-releases-new-position-stand-on-resistance-training/ ,
  souhrn čísel: https://propstmetabolichealth.substack.com/p/the-resistance-training-guidelines
- Robinson a kol. 2024, Sports Med (blízkost selhání). https://rke.abertay.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/
- Nunes a kol. 2021, Eur J Sport Sci (pořadí). https://search.pedro.org.au/search-results/record-detail/60626
- Singer a kol. 2024, Front Sports Act Living (pauzy). https://pubmed.ncbi.nlm.nih.gov/39205815/
- Ribeiro a kol. 2020, IJERPH (rozcvička). https://pmc.ncbi.nlm.nih.gov/articles/PMC7558980/
- Ribeiro a kol. 2014, Percept Mot Skills (rozcvička). https://pubmed.ncbi.nlm.nih.gov/25153744/
- Haugen a kol. 2023, BMC Sports Sci Med Rehabil (stroje). https://pmc.ncbi.nlm.nih.gov/articles/PMC10426227/
- Zhang, Weakley a kol. 2025 (supersety). https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12011898/
