# Colosseum – návod ke spuštění

## 1. Spuštění na počítači

```powershell
npm install
npx expo start
```

V terminálu stiskni `w` a aplikace se otevře v prohlížeči.

Bez souboru `.env` běží aplikace v **demo režimu**:

- Data zůstávají jen v tomto prohlížeči.
- Arena a přátelé ukazují ukázková data.
- Na obrazovce Sign in stačí kliknout na **Sign in** a načte se ukázkový účet s historií tréninků.

Užitečné příkazy:

| Příkaz | Co dělá |
|---|---|
| `npm test` | unit testy vzorců (objem, e1RM, PR, týdny, streak) |
| `npm run typecheck` | kontrola TypeScriptu |
| `npm run lint` | ESLint |
| `npx expo export -p web` | statický web build do `dist/` |

## 2. Supabase (skutečná data, přihlášení, Arena)

1. Na [supabase.com](https://supabase.com) si založ účet a nový projekt (free plan). Heslo k databázi si ulož.
2. V projektu otevři **SQL Editor → New query**:
   1. Vlož celý obsah `supabase/schema.sql` a klikni na **Run**.
   2. Pak stejně vlož a spusť `supabase/seed.sql` (40 základních cviků).
3. **Authentication → Sign In / Providers → Email**: vypni **Confirm email**.
   - Aplikace používá jen uživatelské jméno a heslo. E-mail se vytváří na pozadí a uživatel ho nikdy neuvidí.
4. **Project Settings → API**: zkopíruj **Project URL** a **anon public** klíč.
5. V kořeni projektu zkopíruj `.env.example` na `.env` a doplň hodnoty:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

6. Restartuj `npx expo start`. Demo režim zmizí a registrace vytvoří skutečný účet.

> Free projekt se po **1 týdnu bez aktivity uspí**. Na testování to nevadí, před veřejným spuštěním je potřeba to vyřešit.

## 3. Nasazení na GitHub Pages

1. Na GitHubu vytvoř nový repozitář (např. `colosseum`) a nahraj do něj projekt:

   ```powershell
   git remote add origin https://github.com/<tvuj-ucet>/colosseum.git
   git push -u origin main
   ```

2. V repozitáři otevři **Settings → Pages → Source** a vyber **GitHub Actions**.
3. **Settings → Secrets and variables → Actions → New repository secret** – přidej dva secrets:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Každý push do `main` teď aplikaci sestaví a nasadí na `https://<tvuj-ucet>.github.io/colosseum/`.
   - Průběh uvidíš v záložce **Actions**.

## 4. iPhone – přidání na plochu

1. Otevři adresu z GitHub Pages v **Safari**.
2. Klepni na **Sdílet → Přidat na plochu**.
3. Aplikace se spustí na celou obrazovku s ikonou Colosseum.

Offline: aplikaci jednou otevři online (uloží se do mezipaměti). Potom jde otevřít a zapsat trénink i bez signálu. Zápisy se odešlou, jakmile bude telefon zase online. Dokud se neodešlou, u tréninku svítí „Not synced yet“.

Co je dobré na iPhonu vyzkoušet:

- [ ] Spuštění z plochy na celou obrazovku, správná ikona
- [ ] Obsah nezasahuje pod výřez ani pod domovskou lištu
- [ ] Režim Letadlo → spustit trénink, odškrtat série, dokončit → vypnout Letadlo → trénink se synchronizuje

## 5. Nativní aplikace (později)

iOS a Android se budou stavět v cloudu přes **EAS Build** (`eas build -p ios` / `eas build -p android`), takže Mac není potřeba.

Pro zveřejnění v obchodech je potřeba:

- placený **Apple Developer** účet (ročně)
- **Google Play Developer** účet (jednorázový poplatek)

## Co se oproti návrhu změnilo v databázi

Soubor `supabase/schema.sql` je oproti původní verzi doplněný:

- `programs.training_days` – tréninkové dny programu
- `workout_sessions.volume_kg / set_count / pr_count` – součty pro feed a Arenu
- `set_entries.is_pr` – označení PR sérií (pro „Friends' PRs“)
- `get_leaderboard(..., p_tz)` – „tento týden“ začíná v pondělí podle místního času, ne podle UTC
- `get_leaderboard` umí i DOTS (`dots:<id cviku>`) a funkce `dots_coefficient` – váhu jen použije k výpočtu skóre, nikdy ji nevrátí
- funkce `username_available`, `delete_my_account`, `friends_prs`, `gym_training_now`, `gym_challenge_progress`
- bucket `avatars` s pravidly (každý smí zapisovat jen do své složky)
- seznam posiloven je čitelný i před registrací (výběr posilovny v onboardingu)
