# Malovaná hra v Gemini

Hotovo **63 z 136**. Zbývá 73 obrázků v 12 dávkách.
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

## Zkouška hradeb a akvaduktu

Úseky hradeb a akvaduktu se kladou za sebe přes dlaždice, takže musí navazovat: zeď běží **středem parcely** z poloviny jedné hrany do poloviny protější a končí rovně přesně na okraji. Úsek `-a` stoupá doprava (/), úsek `-b` doleva (\). Po importu v `nahled-mesto.png` uvidíš, jestli dva úseky vedle sebe tvoří jednu zeď. Než uděláš dávky „Hradby“ a „Akvadukt“, napiš mi, jak to vypadá.

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
| [davka-01.txt](davky/davka-01.txt) | Výzbroj: přilby a štíty | 12 | `vzor-mesto.jpg` | Výzbroj: Galea, Výzbroj: Murmillo, Výzbroj: Secutor, Výzbroj: Thraex, Výzbroj: Hoplomachus, Výzbroj: Provocator, Výzbroj: Zlatá galea, Výzbroj: Vavřínový věnec, Výzbroj: Parmula, Výzbroj: Parma, Výzbroj: Bronzový štít, Výzbroj: Scutum |
| [davka-02.txt](davky/davka-02.txt) | Výzbroj: zbraně a chrániče | 12 | `vzor-mesto.jpg` | Výzbroj: Rudis, Výzbroj: Pugio, Výzbroj: Sica, Výzbroj: Rete (síť), Výzbroj: Fuscina (trojzubec), Výzbroj: Hasta (kopí), Výzbroj: Gladius, Výzbroj: Dva gladii, Výzbroj: Fasciae, Výzbroj: Ocreae, Výzbroj: Galerus, Výzbroj: Manica |
| [davka-03.txt](davky/davka-03.txt) | Výzbroj: zbroj a oděv, ikony | 10 | `vzor-mesto.jpg` | Výzbroj: Tunika, Výzbroj: Exomis, Výzbroj: Subligaculum, Výzbroj: Kožené řemeny, Výzbroj: Leopardí kožešina, Výzbroj: Cardiophylax, Výzbroj: Rudý plášť, Výzbroj: Lorica, Ikona: denár, Ikona: vavříny |
| [davka-04.txt](davky/davka-04.txt) | Cvičiště ludusu: střed 3×3 a vybavení | 7 | `vzor-mesto.jpg` a `sablona-parcely.png` | Ludus 1: malá škola gladiátorů, Ludus 2: kamenný ludus, Ludus 3: Ludus Magnus, Palus: kůl na nácvik, Stojan se zbraněmi, Žárová mísa, Koryto s vodou |
| [davka-05.txt](davky/davka-05.txt) | Cvičiště: činky a hrazda (3 úrovně) | 6 | `vzor-mesto.jpg` a `sablona-parcely.png` | Činky (halteres) úroveň 1, Činky (halteres) úroveň 2, Činky (halteres) úroveň 3, Hrazda úroveň 1, Hrazda úroveň 2, Hrazda úroveň 3 |
| [davka-06.txt](davky/davka-06.txt) | Zkouška: úseky hradeb a akvaduktu (navazují na sebe?) | 5 | `vzor-mesto.jpg` a `sablona-parcely.png` | Hradby 1: palisáda, úsek /, Hradby 1: palisáda, úsek \, Hradby 1: palisáda, věž, Akvadukt, úsek /, Akvadukt, úsek \ |
| [davka-07.txt](davky/davka-07.txt) | Hradby: kamenná a opevněná | 6 | `vzor-mesto.jpg` a `sablona-parcely.png` | Hradby 2: kamenná zeď, úsek /, Hradby 2: kamenná zeď, úsek \, Hradby 2: kamenná zeď, věž, Hradby 3: opevněná zeď, úsek /, Hradby 3: opevněná zeď, úsek \, Hradby 3: opevněná zeď, věž |
| [davka-08.txt](davky/davka-08.txt) | Tvůj dům: nový domus 2, palác a vylepšení | 7 | `vzor-mesto.jpg` a `sablona-parcely.png` | Domus 2: malý kamenný dům, Domus 5: palác, Zahrada (hortus), Fontána, Pergola s vínem, Domácí oltář (lararium), Domácí cvičiště |
| [davka-09.txt](davky/davka-09.txt) | Akvadukt: nároží a vodojem | 2 | `vzor-mesto.jpg` a `sablona-parcely.png` | Akvadukt, nároží, Akvadukt: vodojem |
| [davka-10.txt](davky/davka-10.txt) | Mapa Česka | 1 | `vzor-mesto.jpg` a `sablona-cesko.png` | Mapa Česka |
| [davka-11.txt](davky/davka-11.txt) | Mapa Brna | 1 | `vzor-mesto.jpg` a `sablona-brno.png` | Mapa Brna |
| [davka-12.txt](davky/davka-12.txt) | Ligové znaky | 4 | `vzor-mesto.jpg` | Bronzová liga, Stříbrná liga, Zlatá liga, Imperátorova aréna |
