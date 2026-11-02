# Obrázky cviků v Gemini

Hotovo **128 z 152**. Zbývá 24 obrázků v 2 dávkách po 15.
Tenhle soubor i dávky se po každém importu přegenerují jen se zbývajícími cviky.

## Co je v téhle složce

| Co | K čemu |
| --- | --- |
| `vzor-styl.jpg` | Vzor stylu. Přikládej ho ke každé dávce. |
| `davky/` | Prompty, jeden soubor = jedna dávka. Nahoře hlavní prompt, dole záložní prompty po jednom. |
| `stazene/` | Sem stahuj obrázky z Gemini. |
| `importovat.cmd` | Dvojklik: obrázky ze `stazene/` (i z podsložek) přiřadí ke cvikům, sjednotí barvy, ořízne na 16:9, zmenší a napojí do aplikace. |
| `hotove/` | Sem import přesune originály. Klidně je smaž, nebo je nech pro případ, že by se import opakoval. |

## Postup pro jednu dávku

1. Otevři **nový chat** v Gemini (model **Pro**, s generováním obrázků).
2. **Přilož `vzor-styl.jpg`.**
3. Otevři `davky/davka-01.txt`, zkopíruj **všechno nad čarou „ZÁLOHA“** a odešli.
4. Gemini udělá obrázek 1. **Hned ho stáhni** (tlačítko stáhnout u obrázku) do složky `stazene/`.
5. Napiš `next` → obrázek 2 → stáhni. Takhle až do konce dávky.
   - Nepovedený obrázek: napiš `redo` a co opravit (např. `redo, the bar must be on the back`), stáhni až opravený.
   - Gemini se ztratí nebo změní styl: otevři nový chat, přilož vzor a pošli **záložní prompt** toho cviku ze spodní části souboru.
6. Na konci dávky dvojklikni na **`importovat.cmd`**. Ve výpisu zkontroluj, že každý soubor dostal správný název cviku.
7. Pokračuj další dávkou (`davka-02.txt` …). Po importu se čísla dávek posunou, takže vždy začínej od `davka-01.txt`.

## Důležité

- **Nejjistější je pojmenovat soubor názvem cviku**, např. `Hack Squat.jpg` (velikost písmen ani drobné překlepy nevadí).
  Nepojmenované soubory dostanou názvy podle pořadí stažení, takže pak musí sedět pořadí v dávce.
- **Nepovedený obrázek** označ v názvu slovem `wrong` (např. `Pec Deck - wrong.jpg`), import ho přeskočí.
- V `stazene/` můžeš mít obrázky klidně v podsložkách po dávkách.
- Špatně pojmenovaný obrázek po importu: přejmenuj ho v `assets/exercises/` a spusť `npm run images`.
- Obrázky se ořezávají na střed na 16:9. Když Gemini dá čtverec, ořízne se nahoře a dole, proto prompt chce postavu uprostřed.
- Kdyby Gemini do rohu dávalo viditelný vodoznak, dej vědět a import ho bude odřezávat.
- Import potřebuje Node.js a v projektu jednou `npm install` (už je hotové).

## Dávky

| Soubor | Počet | Cviky |
| --- | --- | --- |
| [davka-01.txt](davky/davka-01.txt) | 15 | Leg Curl, Lat Pulldown, Seated Cable Row, Hammer Curl, Good Morning, Behind the Back Cuffed Cable Lateral Raise, Reverse Pec Deck, Reverse Cable Crossover, Pendulum Squat, Dumbbell Fly, Neutral Grip Lat Pulldown, Cross Body One Arm Lat Pulldown, Neutral Grip Pull Up, Smith Machine JM Press, JM Press |
| [davka-02.txt](davky/davka-02.txt) | 9 | Cable Curl, Inverse Zottman Curl, Flat Bench Dumbbell Curl, Cable Pull Through, Machine Decline Chest Press, Machine Triceps Extension, Machine Hip Adduction, Reverse Hyperextension, Reverse Hack Squat |
