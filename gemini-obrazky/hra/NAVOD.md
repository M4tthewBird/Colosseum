# Malovaná hra v Gemini

Hotovo **166 z 168**. Zbývá 2 obrázků v 2 dávkách.
Tenhle soubor i dávky se po každém importu přegenerují jen se zbývajícími obrázky.

Město se skládá z kousků: každá stavba stojí na vlastní parcele ve tvaru kosočtverce (1×1, 2×2 nebo 3×3 dlaždice) a appka ji položí na mřížku města tam, kam si ji hráč dá. Proto musí mít všechny stavby **stejný úhel, stejné světlo a plochou parcelu bez boků**.

## Co je v téhle složce

| Co | K čemu |
| --- | --- |
| `vzor-mesto.jpg` | Vzor stylu (tvoje město). Přikládej ho ke každé dávce. |
| `sablona-parcely.png` | Tvar parcel 1×1, 2×2 a 3×3. Přikládej ho k dávkám se stavbami (v tabulce dole je u každé dávky, co přiložit). |
| `sablona-cesko.png`, `sablona-brno.png` | Skutečná hranice Česka a Brna (řeky modře, města tečkou). Přikládej ke své mapě. |
| `nahled-map-*.png` | Po importu mapy: skutečná hranice červeně přes namalovanou mapu. Musí sedět, jinak gymy nebudou na správném místě. |
| `davky/` | Prompty, jeden soubor = jedna dávka. Nahoře hlavní prompt, dole záložní prompty po jednom. |
| `stazene/` | Sem stahuj obrázky z Gemini. |
| `importovat.cmd` | Dvojklik: odstraní krémové pozadí, srovná velikost podle parcely, uloží obrázky do appky (`assets/game/painted/`) a nakreslí náhledy. |
| `nahled-mesto.png` | Po importu: všechny stavby poskládané na mřížce. Tady je vidět, jestli k sobě sedí. |
| `nahled-ostatni.png` | Po importu: gladiátoři, výzbroj, ligové znaky, ikony a terén. |
| `hotove/` | Sem import přesune originály. Klidně je smaž, nebo je nech pro případ, že by se import opakoval. |

## Mapy

Ke každé mapě přilož vzor stylu **a její šablonu** (`sablona-cesko.png` nebo `sablona-brno.png`). Gemini musí nechat hranici přesně tam, kde je na šabloně, a stejný poměr stran (Česko 16:9, Brno čtverec). Jinak gymy na mapě nebudou na svém místě. Po importu otevři `nahled-map-cz.png` / `nahled-map-brno.png`: červená čára je skutečná hranice. Když se s namalovanou hranicí rozchází, napiš `redo, keep the outline exactly where the template has it`.

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
| [davka-01.txt](davky/davka-01.txt) | Hradby: kamenná a opevněná | 1 | `vzor-mesto.jpg` a `sablona-parcely.png` | Hradby 2: kamenná zeď, úsek \ |
| [davka-02.txt](davky/davka-02.txt) | Mapa Brna | 1 | `vzor-mesto.jpg` a `sablona-brno.png` | Mapa Brna (celé město, skutečné ulice) |
