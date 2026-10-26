# Obrázky cviků v Gemini

Hotovo **53 z 152**. Zbývá 99 obrázků v 7 dávkách po 15.
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
| [davka-01.txt](davky/davka-01.txt) | 15 | Bench Press, Leg Curl, Dumbbell Row, Chin Up, Lat Pulldown, Seated Cable Row, Shrug, Biceps Curl, Hammer Curl, Cable Crunch, Good Morning, Arnold Press, Cable Lateral Raise, Cable Y Raise, Behind the Back Cuffed Cable Lateral Raise |
| [davka-02.txt](davky/davka-02.txt) | 15 | Reverse Pec Deck, Reverse Cable Crossover, Machine Shoulder Press, Standing Machine Lateral Raise, Seated Machine Lateral Raise, Super ROM Dumbbell Lateral Raise, Seated Barbell Overhead Press, Pendulum Squat, Sissy Squat, Machine Chest Press, Seated Cable Pec Fly, Dumbbell Guillotine Press, Incline Smith Machine Bench Press, Cable Crossover, Dumbbell Fly |
| [davka-03.txt](davky/davka-03.txt) | 15 | Decline Bench Press, Decline Dumbbell Press, Banded Push Up, Neutral Grip Lat Pulldown, Cross Body One Arm Lat Pulldown, Meadows Row, Chest Supported Row, Neutral Grip Pull Up, Cable Lat Prayer, Dumbbell Pullover, Overhead Cable Triceps Extension, Katana Cable Triceps Extension, Dumbbell Skull Crusher, Smith Machine JM Press, JM Press |
| [davka-04.txt](davky/davka-04.txt) | 15 | Close Grip Bench Press, Machine Dips, Diamond Push Up, Bayesian Cable Curl, Preacher Hammer Curl, EZ Bar Curl, Incline Dumbbell Curl, Lying Dumbbell Curl, Cable Curl, Inverse Zottman Curl, Barbell Curl, Flat Bench Dumbbell Curl, Walking Lunge, Machine Hip Abduction, 45 Degree Back Extension |
| [davka-05.txt](davky/davka-05.txt) | 15 | Front Foot Elevated Smith Machine Lunge, Smith Machine Lunge, Machine Hip Thrust, Single Leg Dumbbell Hip Thrust, Cable Glute Kickback, Step Up, Glute Bridge, Cable Hip Abduction, Curtsy Lunge, Sumo Deadlift, Cable Pull Through, Machine Seated Row, Machine High Row, Machine Lat Pulldown, Machine Incline Chest Press |
| [davka-06.txt](davky/davka-06.txt) | 15 | Machine Decline Chest Press, Machine Biceps Curl, Machine Triceps Extension, Lying Leg Curl, Seated Calf Raise, Machine Hip Adduction, Machine Crunch, Machine Shrug, T Bar Row, Machine Pullover, Machine Back Extension, Reverse Hyperextension, Machine Glute Kickback, Smith Machine Shoulder Press, Smith Machine Row |
| [davka-07.txt](davky/davka-07.txt) | 9 | Belt Squat, V Squat, Reverse Hack Squat, Horizontal Leg Press, Standing Leg Curl, Chest Supported T Bar Row, Smith Machine Romanian Deadlift, Smith Machine Calf Raise, Assisted Dip |
