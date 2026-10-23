# Obrázky cviků v Gemini

Hotovo **1 z 152**. Zbývá 151 obrázků v 11 dávkách po 15.
Tenhle soubor i dávky se po každém importu přegenerují jen se zbývajícími cviky.

## Co je v téhle složce

| Co | K čemu |
| --- | --- |
| `vzor-bench-press.jpg` | Vzor stylu. Přikládej ho ke každé dávce. |
| `davky/` | Prompty, jeden soubor = jedna dávka. Nahoře hlavní prompt, dole záložní prompty po jednom. |
| `stazene/` | Sem stahuj obrázky z Gemini. |
| `importovat.cmd` | Dvojklik: obrázky ze `stazene/` pojmenuje, ořízne na 16:9, zmenší a napojí do aplikace. |

## Postup pro jednu dávku

1. Otevři **nový chat** v Gemini (model **Pro**, s generováním obrázků).
2. **Přilož `vzor-bench-press.jpg`.**
3. Otevři `davky/davka-01.txt`, zkopíruj **všechno nad čarou „ZÁLOHA“** a odešli.
4. Gemini udělá obrázek 1. **Hned ho stáhni** (tlačítko stáhnout u obrázku) do složky `stazene/`.
5. Napiš `next` → obrázek 2 → stáhni. Takhle až do konce dávky.
   - Nepovedený obrázek: napiš `redo` a co opravit (např. `redo, the bar must be on the back`), stáhni až opravený.
   - Gemini se ztratí nebo změní styl: otevři nový chat, přilož vzor a pošli **záložní prompt** toho cviku ze spodní části souboru.
6. Na konci dávky dvojklikni na **`importovat.cmd`**. Ve výpisu zkontroluj, že každý soubor dostal správný název cviku.
7. Pokračuj další dávkou (`davka-02.txt` …). Po importu se čísla dávek posunou, takže vždy začínej od `davka-01.txt`.

## Důležité

- **Pořadí stahování = pořadí v dávce.** Import přiřazuje názvy podle času stažení.
  Když obrázek přeskočíš, přejmenuj ho v `stazene/` ručně podle názvu v závorce v záložních promptech
  (např. `hack-squat.png`). Pojmenovaný soubor import pozná sám.
- Špatně pojmenovaný obrázek po importu: přejmenuj ho v `assets/exercises/` a spusť `npm run images`.
- Obrázky se ořezávají na střed na 16:9. Když Gemini dá čtverec, ořízne se nahoře a dole, proto prompt chce postavu uprostřed.
- Kdyby Gemini do rohu dávalo viditelný vodoznak, dej vědět a import ho bude odřezávat.
- Import potřebuje Node.js a v projektu jednou `npm install` (už je hotové).

## Dávky

| Soubor | Počet | Cviky |
| --- | --- | --- |
| [davka-01.txt](davky/davka-01.txt) | 15 | Incline Bench Press, Incline Dumbbell Press, Dumbbell Bench Press, Dips, Push Up, Overhead Press, Dumbbell Shoulder Press, Lateral Raise, Face Pull, Triceps Pushdown, Skull Crusher, Squat, Front Squat, Leg Press, Lunge |
| [davka-02.txt](davky/davka-02.txt) | 15 | Bulgarian Split Squat, Leg Extension, Deadlift, Romanian Deadlift, Leg Curl, Hip Thrust, Calf Raise, Barbell Row, Dumbbell Row, Pull Up, Chin Up, Lat Pulldown, Seated Cable Row, Shrug, Biceps Curl |
| [davka-03.txt](davky/davka-03.txt) | 15 | Hammer Curl, Preacher Curl, Cable Fly, Plank, Hanging Leg Raise, Cable Crunch, Farmers Carry, Good Morning, Arnold Press, Cable Lateral Raise, Cable Y Raise, Behind the Back Cuffed Cable Lateral Raise, Reverse Pec Deck, Reverse Cable Crossover, Machine Shoulder Press |
| [davka-04.txt](davky/davka-04.txt) | 15 | Standing Machine Lateral Raise, Lean In Dumbbell Lateral Raise, Side Lying Dumbbell Lateral Raise, Bent Over Reverse Dumbbell Fly, Seated Machine Lateral Raise, Lean Away Dumbbell Lateral Raise, Super ROM Dumbbell Lateral Raise, Seated Barbell Overhead Press, Upright Row, Hack Squat, Pendulum Squat, Smith Machine Squat, Low Bar Squat, Reverse Nordic, Goblet Squat |
| [davka-05.txt](davky/davka-05.txt) | 15 | Sissy Squat, Machine Chest Press, Seated Cable Pec Fly, Deficit Push Up, Dumbbell Guillotine Press, Smith Machine Bench Press, Incline Smith Machine Bench Press, Cable Crossover, Pec Deck, Dumbbell Fly, Cable Press Around, Decline Bench Press, Decline Dumbbell Press, Banded Push Up, Neutral Grip Lat Pulldown |
| [davka-06.txt](davky/davka-06.txt) | 15 | One Arm Lat Pulldown, Cross Body One Arm Lat Pulldown, Meadows Row, Chest Supported Row, Wide Grip Cable Row, Neutral Grip Pull Up, Deficit Pendlay Row, Pendlay Row, Kroc Row, Cable Lat Prayer, Dumbbell Pullover, Overhead Cable Triceps Extension, Katana Cable Triceps Extension, One Arm Dumbbell Overhead Extension, Dumbbell Skull Crusher |
| [davka-07.txt](davky/davka-07.txt) | 15 | Smith Machine JM Press, JM Press, Cable Triceps Kickback, Close Grip Bench Press, Rope Triceps Pushdown, Dumbbell French Press, Machine Dips, Diamond Push Up, Bayesian Cable Curl, Dumbbell Preacher Curl, Machine Preacher Curl, Preacher Hammer Curl, EZ Bar Curl, Incline Dumbbell Curl, Lying Dumbbell Curl |
| [davka-08.txt](davky/davka-08.txt) | 15 | Cable Curl, Inverse Zottman Curl, Barbell Curl, Flat Bench Dumbbell Curl, Walking Lunge, Machine Hip Abduction, 45 Degree Back Extension, Front Foot Elevated Smith Machine Lunge, Smith Machine Lunge, Machine Hip Thrust, Single Leg Dumbbell Hip Thrust, Cable Glute Kickback, Step Up, Glute Bridge, Cable Hip Abduction |
| [davka-09.txt](davky/davka-09.txt) | 15 | Curtsy Lunge, Sumo Deadlift, Cable Pull Through, Machine Seated Row, Machine High Row, Machine Lat Pulldown, Machine Incline Chest Press, Machine Decline Chest Press, Machine Biceps Curl, Machine Triceps Extension, Lying Leg Curl, Seated Calf Raise, Machine Hip Adduction, Machine Crunch, Machine Shrug |
| [davka-10.txt](davky/davka-10.txt) | 15 | T Bar Row, Machine Pullover, Machine Back Extension, Reverse Hyperextension, Machine Glute Kickback, Smith Machine Shoulder Press, Smith Machine Row, Belt Squat, V Squat, Reverse Hack Squat, Horizontal Leg Press, Standing Leg Curl, Chest Supported T Bar Row, Smith Machine Romanian Deadlift, Smith Machine Calf Raise |
| [davka-11.txt](davky/davka-11.txt) | 1 | Assisted Dip |
