# Odznaky v Claude Design – návod

## Co je ve složce

| Soubor | K čemu |
| --- | --- |
| `PROMPT.md` | Zadání v angličtině. Vkládá se do Claude Design všechno pod čarou. |
| `badges.json` | Všech 20 odznaků a 77 stupňů: název, popis, titulek stupně a úroveň vzhledu 1–5. Vygenerované z kódu, takže sedí s aplikací. |
| `soucasne-1.png`, `soucasne-2.png` | Jak odznaky vypadají teď, všechny stupně i stav „Not yet“. |
| `logo-mark.svg` | Logo s vavřínovým věncem, ze kterého odznak vychází. |

## Postup

1. Otevři [claude.ai/design](https://claude.ai/design) a založ nový projekt.
2. Přilož 4 soubory: `logo-mark.svg`, `soucasne-1.png`, `soucasne-2.png`, `badges.json`.
3. Z `PROMPT.md` zkopíruj všechno pod čarou a odešli to.
4. Dolaďuj v chatu. Pevné zůstává:
   - jen červená `#B91C1C` a šedé, žádné zlato ani bronz
   - čitelnost i na 40 px
   - čisté SVG
5. Až budeš spokojený, napiš v Claude Design: *"Give me the final SVG source for the 6 frame states and the 20 symbols, labelled by badge id."*
6. Výsledek ulož do složky `claude-design-odznaky/hotove/`. Stačí export (HTML nebo SVG soubory), případně zkopírovaný kód do `.txt`. Pak mi napiš a já to přepíšu do aplikace.

## Jak to v aplikaci funguje (ať víš, s čím si můžeš hrát)

- **Úroveň vzhledu 1–5** se počítá z pozice stupně v žebříčku:
  - první stupeň je vždycky úroveň 1, poslední vždycky 5
  - mezi nimi se rozprostře, například Workouts se 7 stupni má úrovně 1, 2, 2, 3, 4, 4, 5
  - takže stačí navrhnout **5 úrovní + zamčený stav**, ne 77 obrázků
- **Bench, Squat a Deadlift** mají uprostřed číslo (kg), ne ikonu.
- **Velikosti v aplikaci:**
  - 40 px: seznam stupňů v detailu
  - 64 px: mřížka na profilu
  - 76 px: karta nového odznaku v souhrnu tréninku
  - 120 px: velký odznak v detailu
- Aktuální kód je v `src/features/badges/Medallion.tsx`.
- Všechny odznaky najednou ukazuje skrytá stránka `/dev/badges`. Na ní nový návrh porovnám se starým.
