# Malovaná hra v Gemini

Hotovo **47 z 102**. Zbývá 55 obrázků v 7 dávkách.
Tenhle soubor i dávky se po každém importu přegenerují jen se zbývajícími obrázky.

Město se skládá z kousků: každá stavba stojí na vlastní parcele ve tvaru kosočtverce (1×1, 2×2 nebo 3×3 dlaždice) a appka ji položí na mřížku města tam, kam si ji hráč dá. Proto musí mít všechny stavby **stejný úhel, stejné světlo a plochou parcelu bez boků**.

## Co je v téhle složce

| Co | K čemu |
| --- | --- |
| `vzor-mesto.jpg` | Vzor stylu (tvoje město). Přikládej ho ke každé dávce. |
| `sablona-parcely.png` | Tvar parcel 1×1, 2×2 a 3×3. Přikládej ho k dávkám se stavbami (v tabulce dole je u každé dávky, co přiložit). |
| `davky/` | Prompty, jeden soubor = jedna dávka. Nahoře hlavní prompt, dole záložní prompty po jednom. |
| `stazene/` | Sem stahuj obrázky z Gemini. |
| `importovat.cmd` | Dvojklik: odstraní krémové pozadí, srovná velikost podle parcely, uloží obrázky do appky (`assets/game/painted/`) a nakreslí náhledy. |
| `nahled-mesto.png` | Po importu: všechny stavby poskládané na mřížce. Tady je vidět, jestli k sobě sedí. |
| `nahled-ostatni.png` | Po importu: gladiátoři, výzbroj, ligové znaky, ikony a terén. |
| `hotove/` | Sem import přesune originály. Klidně je smaž, nebo je nech pro případ, že by se import opakoval. |

## Zkouška oblékání

Dávka „Zkouška oblékání“ ověřuje, jestli jde výzbroj kreslit jako vrstvy na jednoho gladiátora (pak by se gladiátor oblékal podle toho, co má hráč na sobě). Obrázek 1 je gladiátor zepředu jen v bederní roušce, obrázky 2–5 jsou **úpravy obrázku 1**, každá s jedním kusem výzbroje.

- Gemini má každou úpravu dělat **z obrázku 1**, ne z předchozí. Když na gladiátorovi zůstane přilba z minula, napiš `redo, start from image 1` nebo obrázek 1 přilož znovu.
- Gladiátor se nesmí pohnout ani zvětšit. Po importu porovnám úpravy se základem a vyříznu z nich jen výzbroj.

## Postup pro jednu dávku

1. Otevři **nový chat** v Gemini (model **Pro**, s generováním obrázků).
2. **Přilož, co je u dávky v tabulce dole** (vždy `vzor-mesto.jpg`, u staveb i `sablona-parcely.png`).
3. Otevři `davky/davka-01.txt`, zkopíruj **všechno nad čarou „ZÁLOHA“** a odešli.
4. Gemini udělá obrázek 1. **Hned ho stáhni** (tlačítko stáhnout u obrázku) do složky `stazene/`.
5. Napiš `next` → obrázek 2 → stáhni. Takhle až do konce dávky.
   - Nepovedený obrázek: napiš `redo` a co opravit (např. `redo, the base must be flat, no earth sides`), stáhni až opravený.
   - Gemini se ztratí nebo změní styl: otevři nový chat, přilož totéž a pošli **záložní prompt** toho obrázku ze spodní části souboru.
6. Na konci dávky dvojklikni na **`importovat.cmd`**. Ve výpisu zkontroluj, že každý soubor dostal správný název, a podívej se na náhled.
7. Pokračuj další dávkou. Po importu se čísla dávek posunou, takže vždy začínej od `davka-01.txt`.

## Na co se dívat u staveb

- Stavba stojí na **ploché parcele ve tvaru kosočtverce**, bez hliněných boků a bez podstavce.
- **Nic nepřečnívá** přes levý, pravý ani přední roh parcely. Nahoru může cokoli (věž, kouř, prapor).
- Pozadí je **rovné krémové**, bez stínu a bez přechodu.
- Import vypíše varování, když úhel nebo souměrnost parcely nesedí. Takový obrázek zkus znovu (`redo`).

## Důležité

- **Nejjistější je pojmenovat soubor jeho id** z dávky (např. `temple-3.png`) nebo českým názvem (`Velký chrám.png`). Velikost písmen ani drobné překlepy nevadí.
  Nepojmenované soubory dostanou názvy podle pořadí stažení, takže pak musí sedět pořadí v dávce. Importuj proto po každé dávce.
- **Nepovedený obrázek** označ v názvu slovem `wrong` (např. `forge - wrong.png`), import ho přeskočí.
- V `stazene/` můžeš mít obrázky klidně v podsložkách po dávkách.
- **Gladiátor**: v jednom chatu drží Gemini stejného muže. Když musíš do nového chatu, přilož k vzoru i jeden povedený obrázek gladiátora.
- **Terén**: import zkontroluje, jestli textura navazuje na krajích. Když ne, vypíše varování.
- Kdyby Gemini do rohu dávalo vodoznak, import ho odstraní (malé samostatné skvrny maže).
- Import potřebuje Node.js a v projektu jednou `npm install` (už je hotové).

## Dávky

| Soubor | Co | Počet | Přiložit | Obrázky |
| --- | --- | --- | --- | --- |
| [davka-01.txt](davky/davka-01.txt) | Malé kousky 1×1: posilovací stroje | 1 | `vzor-mesto.jpg` a `sablona-parcely.png` | Deadlift platforma úroveň 1 |
| [davka-02.txt](davky/davka-02.txt) | Zkouška oblékání: gladiátor zepředu a 4 kusy výzbroje na něm | 5 | `vzor-mesto.jpg` | Oblékání: základní gladiátor, Oblékání: přilba, Oblékání: štít, Oblékání: zbraň, Oblékání: zbroj |
| [davka-03.txt](davky/davka-03.txt) | Gladiátor: hodnosti a styly boje | 11 | `vzor-mesto.jpg` | Hodnost: Tiro, Hodnost: Gladiator, Hodnost: Veteranus, Hodnost: Primus Palus, Hodnost: Rudiarius, Styl: Murmillo, Styl: Thraex, Styl: Retiarius, Styl: Secutor, Styl: Hoplomachus, Styl: Bestiarius |
| [davka-04.txt](davky/davka-04.txt) | Výzbroj: přilby a štíty | 12 | `vzor-mesto.jpg` | Výzbroj: Galea, Výzbroj: Murmillo, Výzbroj: Secutor, Výzbroj: Thraex, Výzbroj: Hoplomachus, Výzbroj: Provocator, Výzbroj: Zlatá galea, Výzbroj: Vavřínový věnec, Výzbroj: Parmula, Výzbroj: Parma, Výzbroj: Bronzový štít, Výzbroj: Scutum |
| [davka-05.txt](davky/davka-05.txt) | Výzbroj: zbraně a chrániče | 12 | `vzor-mesto.jpg` | Výzbroj: Rudis, Výzbroj: Pugio, Výzbroj: Sica, Výzbroj: Rete (síť), Výzbroj: Fuscina (trojzubec), Výzbroj: Hasta (kopí), Výzbroj: Gladius, Výzbroj: Dva gladii, Výzbroj: Fasciae, Výzbroj: Ocreae, Výzbroj: Galerus, Výzbroj: Manica |
| [davka-06.txt](davky/davka-06.txt) | Výzbroj: zbroj a oděv, ikony | 10 | `vzor-mesto.jpg` | Výzbroj: Tunika, Výzbroj: Exomis, Výzbroj: Subligaculum, Výzbroj: Kožené řemeny, Výzbroj: Leopardí kožešina, Výzbroj: Cardiophylax, Výzbroj: Rudý plášť, Výzbroj: Lorica, Ikona: denár, Ikona: vavříny |
| [davka-07.txt](davky/davka-07.txt) | Ligové znaky | 4 | `vzor-mesto.jpg` | Bronzová liga, Stříbrná liga, Zlatá liga, Imperátorova aréna |
