# Web push – nastavení

Notifikace posílá Supabase Edge Function `push` (kód v `supabase/functions/push/index.ts`).
Všechno je zdarma: doručují je push služby prohlížečů (Apple, Google, Mozilla), funkce běží
na free plánu Supabase.

## Jednou: nasazení (v Supabase dashboardu)

1. **SQL:** pusť `supabase/updates/2026-11-03-push.sql`.
2. **Tajné klíče:** Edge Functions → **Secrets** → přidej:
   - `VAPID_PUBLIC_KEY` = veřejný klíč (je i v `src/features/push/push.ts`)
   - `VAPID_PRIVATE_KEY` = soukromý klíč (dostaneš ode mě, **nikam ho neukládej do repozitáře**)
   - `VAPID_SUBJECT` = `mailto:` a tvůj e-mail (push služby ho použijí, kdyby byl s notifikacemi problém)
3. **Funkce:** Edge Functions → **Deploy a new function** → **Via Editor** → název `push` →
   vlož celý obsah `supabase/functions/push/index.ts` → **Deploy**. „Verify JWT“ nech zapnuté.
4. **Push při novém feedbacku:** Database → **Webhooks** → **Create a new hook**:
   - Name: `feedback-push`, Table: `feedback`, Events: **Insert**
   - Type: **Supabase Edge Functions**, funkce `push`, metoda POST
   - Přidej hlavičku `Authorization` s hodnotou z tlačítka **Add auth header with service key**
     (v hlavičkách webhooku)

## Vyzkoušení

1. Otevři Colosseum **z plochy** (na iPhonu jinak notifikace nejdou).
2. Settings → Notifications → **On** a povol notifikace.
3. **Send a test notification**. Do pár vteřin má přijít „Notifications are on“.
4. Pošli si feedback z jiného účtu (vlastní feedback ti push neposílá) → přijde „New feedback“.
5. Admin → Users → **Announcement** pošle zprávu všem, kdo mají notifikace zapnuté.

## Když to nejde

- Edge Functions → `push` → **Logs** ukáže chyby odesílání.
- `Unknown request` / `Sign in first`: aplikace je stará, zavři ji a otevři znovu.
- Notifikace nepřijde na iPhonu: aplikace musí být na ploše, iOS 16.4+, a v Nastavení iPhonu →
  Oznámení → Colosseum musí být povolené.
