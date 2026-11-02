// Backend smoke test: two throwaway users exercise every table, policy and RPC, then delete
// themselves, cleaning up the test gym too. npm run test:backend
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) throw new Error('Run with: npm run test:backend (needs .env)');
const tag = Date.now().toString(36).slice(-5);
const results = [];
const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, extra]);
const client = () =>
  createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const must = (r, name) => {
  ok(name, !r.error, r.error?.message ?? '');
  return r.error ? null : r.data;
};

async function signUp(username) {
  const c = client();
  const r = await c.auth.signUp({
    email: `${username}@users.colosseum.app`,
    password: 'testpass123',
  });
  ok(
    `signUp ${username}`,
    !r.error && !!r.data.session,
    r.error?.message ?? (r.data.session ? '' : 'no session'),
  );
  return { c, id: r.data.user?.id };
}

const A = await signUp(`zz_a_${tag}`);
const B = await signUp(`zz_b_${tag}`);
if (!A.id || !B.id) {
  console.log(results);
  process.exit(1);
}

try {
  const gym = must(
    await A.c
      .from('gyms')
      .insert({ name: `Test Gym ${tag}`, city: 'Brno', created_by: A.id })
      .select('id')
      .single(),
    'create gym',
  );
  must(
    await A.c.from('profiles').insert({
      id: A.id,
      username: `zz_a_${tag}`,
      display_name: 'Tester A',
      sex: 'male',
      experience: 'intermediate',
      goals: ['strength'],
      home_gym_id: gym?.id,
    }),
    'profile A',
  );
  must(
    await B.c.from('profiles').insert({
      id: B.id,
      username: `zz_b_${tag}`,
      display_name: 'Tester B',
      sex: 'female',
      experience: 'beginner',
      goals: [],
      home_gym_id: gym?.id,
    }),
    'profile B',
  );
  const dupe = await B.c
    .from('profiles')
    .update({ username: `zz_a_${tag}` })
    .eq('id', B.id);
  ok('duplicate username rejected', !!dupe.error, dupe.error?.message ?? 'accepted!');
  const avail = await A.c.rpc('username_available', { p_username: `zz_a_${tag}` });
  ok('username_available false for taken', avail.data === false, JSON.stringify(avail.data));

  must(
    await A.c.from('profile_private').upsert({ user_id: A.id, height_cm: 182 }),
    'private height',
  );
  must(
    await A.c
      .from('bodyweight_logs')
      .upsert({ id: randomUUID(), user_id: A.id, logged_on: '2026-10-01', weight_kg: 82.4 }),
    'bodyweight A',
  );
  must(
    await B.c
      .from('bodyweight_logs')
      .upsert({ id: randomUUID(), user_id: B.id, logged_on: '2026-10-01', weight_kg: 60 }),
    'bodyweight B',
  );
  const peekBw = await B.c.from('bodyweight_logs').select('*').eq('user_id', A.id);
  ok('B cannot read A bodyweight', (peekBw.data ?? []).length === 0, `${peekBw.data?.length} rows`);
  const peekH = await B.c.from('profile_private').select('*').eq('user_id', A.id);
  ok('B cannot read A height', (peekH.data ?? []).length === 0);

  const ex = await A.c.from('exercises').select('id,name').is('created_by', null);
  ok('seed exercises present', (ex.data ?? []).length >= 1000, `${ex.data?.length} built-ins`);
  const bench = ex.data?.find((e) => e.name === 'Bench Press');

  const pid = randomUUID();
  const did = randomUUID();
  must(
    await A.c.from('programs').upsert({
      id: pid,
      owner_id: A.id,
      name: 'PPL',
      weeks: 8,
      training_days: [1, 3, 5],
      phases: [{ name: 'Build', from: 1, to: 8, sets: 1, rpe: 8 }],
      is_active: true,
      started_on: '2026-09-28',
    }),
    'program upsert',
  );
  must(
    await A.c
      .from('program_days')
      .upsert({ id: did, program_id: pid, position: 0, name: 'Push', weekdays: [1] }),
    'program day',
  );
  must(
    await A.c.from('program_exercises').upsert({
      id: randomUUID(),
      program_day_id: did,
      exercise_id: bench?.id,
      position: 0,
      sets: 3,
      reps_min: 6,
      reps_max: 8,
      rest_seconds: 120,
    }),
    'program exercise',
  );
  const peekProg = await B.c.from('programs').select('id').eq('id', pid);
  ok('B cannot read A program', (peekProg.data ?? []).length === 0);

  const sid = randomUUID();
  const now = Date.now();
  const session = {
    id: sid,
    user_id: A.id,
    program_day_id: did,
    name: 'Push',
    started_at: new Date(now - 3600e3).toISOString(),
    finished_at: new Date(now).toISOString(),
    volume_kg: 1600,
    set_count: 2,
    pr_count: 1,
  };
  must(await A.c.from('workout_sessions').upsert(session), 'session upsert');
  must(await A.c.from('workout_sessions').upsert(session), 'session upsert again (idempotent)');
  const sets = [1, 2].map((n) => ({
    id: randomUUID(),
    session_id: sid,
    exercise_id: bench?.id,
    exercise_position: 0,
    set_number: n,
    weight_kg: 100,
    reps: 8,
    done: true,
    is_pr: n === 1,
  }));
  must(await A.c.from('set_entries').upsert(sets, { onConflict: 'id' }), 'sets upsert');
  const sid2 = randomUUID();
  must(
    await B.c.from('workout_sessions').upsert({
      id: sid2,
      user_id: B.id,
      name: 'Legs',
      started_at: new Date(now - 7200e3).toISOString(),
      finished_at: new Date(now - 3600e3).toISOString(),
      volume_kg: 480,
      set_count: 1,
      pr_count: 0,
    }),
    'session B',
  );
  must(
    await B.c.from('set_entries').upsert([
      {
        id: randomUUID(),
        session_id: sid2,
        exercise_id: bench?.id,
        exercise_position: 0,
        set_number: 1,
        weight_kg: 60,
        reps: 8,
        done: true,
        is_pr: false,
      },
    ]),
    'sets B',
  );
  const forge = await B.c.from('workout_sessions').upsert({
    id: randomUUID(),
    user_id: A.id,
    name: 'forged',
    started_at: new Date(now).toISOString(),
  });
  ok('B cannot write A session', !!forge.error);

  must(
    await A.c.from('friendships').insert({ requester_id: A.id, addressee_id: B.id }),
    'friend request',
  );
  must(
    await B.c
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', A.id)
      .eq('addressee_id', B.id),
    'friend accept',
  );
  const fr = await A.c
    .from('friendships')
    .select(
      'requester_id,status, requester:profiles!friendships_requester_id_fkey(username), addressee:profiles!friendships_addressee_id_fkey(username)',
    )
    .or(`requester_id.eq.${A.id},addressee_id.eq.${A.id}`);
  ok(
    'friends query with embeds',
    !fr.error && fr.data?.[0]?.status === 'accepted',
    fr.error?.message ?? '',
  );

  for (const metric of ['volume', 'workouts', bench?.id, `dots:${bench?.id}`]) {
    const lb = await A.c.rpc('get_leaderboard', {
      p_scope: 'friends',
      p_metric: metric,
      p_period: 'week',
      p_tz: 'Europe/Prague',
    });
    ok(
      `leaderboard ${metric?.slice(0, 12)}`,
      !lb.error && lb.data?.length === 2,
      lb.error?.message ??
        JSON.stringify(lb.data?.map((r) => [r.username.slice(0, 4), Number(r.value)])),
    );
  }
  const lbGym = await A.c.rpc('get_leaderboard', {
    p_scope: 'gym',
    p_metric: 'volume',
    p_period: 'all',
    p_tz: 'Europe/Prague',
  });
  ok('leaderboard gym scope', !lbGym.error && lbGym.data?.length === 2, lbGym.error?.message ?? '');

  const prs = await B.c.rpc('friends_prs', { p_limit: 5 });
  ok(
    'friends_prs',
    !prs.error && prs.data?.length === 1,
    prs.error?.message ?? JSON.stringify(prs.data?.[0]?.exercise_name),
  );
  const feed = await B.c
    .from('workout_sessions')
    .select(
      'id,name,volume_kg,pr_count, profiles!workout_sessions_user_id_fkey(username), session_likes(count), session_comments(count)',
    )
    .not('finished_at', 'is', null)
    .neq('user_id', B.id)
    .order('finished_at', { ascending: false });
  ok('feed query', !feed.error && feed.data?.length === 1, feed.error?.message ?? '');
  must(await B.c.from('session_likes').upsert({ session_id: sid, user_id: B.id }), 'like');
  must(
    await B.c.from('session_comments').insert({ session_id: sid, user_id: B.id, body: 'Nice!' }),
    'comment',
  );
  const feed2 = await B.c
    .from('workout_sessions')
    .select('id, session_likes(count), session_comments(count)')
    .eq('id', sid)
    .single();
  ok(
    'like + comment counts',
    feed2.data?.session_likes?.[0]?.count === 1 && feed2.data?.session_comments?.[0]?.count === 1,
    JSON.stringify(feed2.data ?? feed2.error),
  );

  must(await A.c.from('gym_checkins').insert({ user_id: A.id, gym_id: gym?.id }), 'check in');
  const tn = await B.c.rpc('gym_training_now');
  ok(
    'gym_training_now',
    !tn.error && tn.data?.length >= 1,
    tn.error?.message ?? `${tn.data?.length}`,
  );
  const ch = must(
    await A.c
      .from('gym_challenges')
      .insert({
        gym_id: gym?.id,
        title: 'Test',
        metric: 'volume',
        target: 10000,
        starts_on: '2026-09-01',
        ends_on: '2026-12-31',
        created_by: A.id,
      })
      .select('id')
      .single(),
    'create challenge',
  );
  const cp = await A.c.rpc('gym_challenge_progress', { p_challenge: ch?.id });
  ok(
    'challenge progress = 1600 + 480',
    !cp.error && Number(cp.data?.[0]?.gym_total) === 2080,
    cp.error?.message ?? JSON.stringify(cp.data),
  );
  const otherExercise = ex.data?.find((e) => e.name === 'Squat');
  const repsChallenge = async (ids) => {
    const made = await A.c
      .from('gym_challenges')
      .insert({
        gym_id: gym?.id,
        title: 'Reps',
        metric: 'reps',
        exercise_id: ids[0],
        exercise_ids: ids,
        target: 100,
        starts_on: '2026-09-01',
        ends_on: '2026-12-31',
        created_by: A.id,
      })
      .select('id')
      .single();
    const progress = await A.c.rpc('gym_challenge_progress', { p_challenge: made.data?.id });
    await A.c.from('gym_challenges').delete().eq('id', made.data?.id);
    return made.error ? null : Number(progress.data?.[0]?.gym_total);
  };
  const benchReps = await repsChallenge([bench?.id]);
  const bothReps = await repsChallenge([bench?.id, otherExercise?.id]);
  const squatReps = await repsChallenge([otherExercise?.id]);
  ok(
    'a challenge counts only its exercises',
    benchReps > 0 && bothReps === benchReps && squatReps === 0,
    `bench ${benchReps}, both ${bothReps}, squat ${squatReps}; needs 2026-11-02-challenge-edit.sql`,
  );

  const notYours = await B.c
    .from('gym_challenges')
    .update({ title: 'Hacked' })
    .eq('id', ch?.id)
    .select('id');
  ok("can't change someone else's challenge", (notYours.data ?? []).length === 0);
  const edited = await A.c
    .from('gym_challenges')
    .update({ title: 'Changed', target: 3000 })
    .eq('id', ch?.id)
    .select('title');
  ok(
    'creator changes the challenge',
    edited.data?.[0]?.title === 'Changed',
    edited.error?.message ?? 'needs 2026-11-02-challenge-edit.sql',
  );
  const notYours2 = await B.c.from('gym_challenges').delete().eq('id', ch?.id).select('id');
  ok("can't cancel someone else's challenge", (notYours2.data ?? []).length === 0);
  const cancelled = await A.c.from('gym_challenges').delete().eq('id', ch?.id).select('id');
  ok(
    'creator cancels the challenge',
    (cancelled.data ?? []).length === 1,
    cancelled.error?.message ?? 'needs 2026-11-02-challenge-edit.sql',
  );

  const members = await A.c
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('home_gym_id', gym?.id);
  ok('gym member count', members.count === 2, `${members.count}`);

  const otherSets = await B.c
    .from('set_entries')
    .select('*, workout_sessions!inner(user_id,finished_at)')
    .eq('workout_sessions.user_id', A.id);
  ok(
    "B reads A's sets (friend)",
    (otherSets.data ?? []).length === 2,
    otherSets.error?.message ?? `${otherSets.data?.length}`,
  );

  // The generator's hand-made lists must exist in the live catalog (src/data/equipmentExercises.ts).
  const listed = [
    'Goblet Squat',
    'Bulgarian Split Squat',
    'Lunge',
    'Dumbbell Row',
    'Dumbbell Incline Row',
    'Dumbbell Pullover',
    'Shrug',
    'Dumbbell Bench Press',
    'Incline Dumbbell Press',
    'Dumbbell Fly',
    'Push Up',
    'Dumbbell Romanian Deadlift',
    'Dumbbell Single Leg Deadlift',
    'Walking Lunge',
    'Step Up',
    'Glute Bridge',
    'Single Leg Dumbbell Hip Thrust',
    'Dumbbell Shoulder Press',
    'Lateral Raise',
    'Lean In Dumbbell Lateral Raise',
    'Bent Over Reverse Dumbbell Fly',
    'Dumbbell Kickback',
    'One Arm Dumbbell Overhead Extension',
    'Dumbbell French Press',
    'Diamond Push Up',
    'Biceps Curl',
    'Hammer Curl',
    'Incline Dumbbell Curl',
    'Dumbbell Concentration Curl',
    'Dumbbell Standing Calf Raise',
    'Dumbbell Single Leg Calf Raise',
    'Crunch Floor',
    'Reverse Crunch',
    'Russian Twist',
    'Dumbbell Side Bend',
    'Squat to Overhead Reach',
    'Split Squats',
    'Curtsey Squat',
    'Inverted Row',
    'Pull Up',
    'Inverted Row Bent Knees',
    'Chin Up',
    'Neutral Grip Pull Up',
    'Dips',
    'Incline Push Up',
    'Decline Push Up',
    'Archer Push Up',
    'Glute Bridge March',
    'Single Leg Bridge with Outstretched Leg',
    'Low Glute Bridge on Floor',
    'Standing Single Leg Curl',
    'Forward Lunge',
    'Side Hip Abduction',
    'Pike to Cobra Push Up',
    'Shoulder Tap',
    'Kneeling Plank Tap Shoulder',
    'Close Grip Push Up',
    'Bench Dip Knees Bent',
    'Triceps Dips Floor',
    'Bodyweight Side Lying Biceps Curl',
    'Close Grip Chin Up',
    'Bodyweight Standing Calf Raise',
    'One Leg Floor Calf Raise',
    'Standing Calf Raise on a Staircase',
    'Hanging Leg Raise',
    'Dead Bug',
    'Bodyweight Standing Row with Towel',
    'Bodyweight Squatting Row with Towel',
    'Lower Back Curl',
    'One Arm Towel Row',
    'Kneeling Push Up',
    'Wide Hand Push Up',
    'Close Grip Push Up on Knees',
    'Biceps Leg Concentration Curl',
    'Sit Up',
    'Oblique Crunches Floor',
    'Flutter Kicks',
  ];
  const found = await A.c
    .from('exercises')
    .select('name')
    .is('created_by', null)
    .in('name', listed);
  const foundNames = new Set((found.data ?? []).map((e) => e.name));
  const absent = listed.filter((n) => !foundNames.has(n));
  ok('generator lists are in the live catalog', absent.length === 0, absent.join(', '));

  // Training together: plans, invites, and a workout confirmed by QR code.
  const PUB = 'id,username,display_name,avatar_url';
  const planQuery = `id, planned_at, note, invitee_id,
    user:profiles!training_plans_user_id_fkey(${PUB}),
    invitee:profiles!training_plans_invitee_id_fkey(${PUB}),
    gym:gyms(name),
    answers:training_plan_answers(going, user:profiles!training_plan_answers_user_id_fkey(${PUB}))`;
  const soon = new Date(Date.now() + 3600000).toISOString();
  const open = must(
    await A.c
      .from('training_plans')
      .insert({ user_id: A.id, planned_at: soon, note: 'Legs', gym_id: gym?.id })
      .select('id')
      .single(),
    'post a plan',
  );
  const invite = must(
    await A.c
      .from('training_plans')
      .insert({ user_id: A.id, planned_at: soon, invitee_id: B.id })
      .select('id')
      .single(),
    'invite a friend',
  );
  const seen = await B.c.from('training_plans').select(planQuery).eq('user_id', A.id);
  ok(
    'friend sees the plan and the invite',
    (seen.data ?? []).length === 2 && seen.data.some((p) => p.gym?.name),
    seen.error?.message ?? `${seen.data?.length}`,
  );
  must(
    await B.c
      .from('training_plan_answers')
      .upsert({ plan_id: open?.id, user_id: B.id, going: true }, { onConflict: 'plan_id,user_id' }),
    'answer a plan',
  );
  must(
    await B.c
      .from('training_plan_answers')
      .upsert(
        { plan_id: open?.id, user_id: B.id, going: false },
        { onConflict: 'plan_id,user_id' },
      ),
    'change the answer',
  );
  const answers = await A.c.from('training_plans').select(planQuery).eq('id', open?.id).single();
  ok(
    'owner sees the answer',
    answers.data?.answers?.[0]?.going === false && answers.data.answers[0].user?.id === B.id,
    answers.error?.message ?? JSON.stringify(answers.data?.answers),
  );
  const notMine = await B.c.from('training_plans').delete().eq('id', open?.id).select('id');
  ok("can't delete someone else's plan", (notMine.data ?? []).length === 0);
  must(await A.c.from('training_plans').delete().eq('id', invite?.id), 'cancel a plan');

  const togetherId = randomUUID();
  const doneAt = new Date().toISOString();
  must(
    await A.c.from('workout_sessions').upsert({
      id: togetherId,
      user_id: A.id,
      name: 'Together',
      started_at: new Date(Date.now() - 3600000).toISOString(),
      finished_at: doneAt,
      volume_kg: 0,
      set_count: 0,
      pr_count: 0,
      updated_at: doneAt,
    }),
    'finished workout to confirm',
  );
  const info = await B.c.rpc('together_session', { p_session: togetherId });
  ok(
    'code tells who, without numbers',
    info.data?.[0]?.owner_id === A.id && !('volume_kg' in (info.data?.[0] ?? {})),
    info.error?.message ?? JSON.stringify(info.data),
  );
  const own = await A.c.rpc('confirm_together', { p_session: togetherId });
  ok("can't confirm your own workout", !!own.error);
  must(await B.c.rpc('confirm_together', { p_session: togetherId }), 'confirm together');
  must(await B.c.rpc('confirm_together', { p_session: togetherId }), 'confirm again is harmless');
  const again = await B.c.rpc('together_session', { p_session: togetherId });
  ok('code says confirmed', again.data?.[0]?.confirmed === true, JSON.stringify(again.data));
  const pairs = await A.c
    .from('trained_together')
    .select(
      `session_id, confirmed_at,
       owner:profiles!trained_together_owner_id_fkey(${PUB}),
       user:profiles!trained_together_user_id_fkey(${PUB})`,
    )
    .eq('session_id', togetherId);
  ok('feed lists the pair', pairs.data?.[0]?.user?.id === B.id, pairs.error?.message ?? '');
  const forged = await B.c
    .from('trained_together')
    .insert({ session_id: togetherId, owner_id: A.id, user_id: B.id });
  ok("can't write the table directly", !!forged.error);
  const together = await A.c.rpc('get_leaderboard', {
    p_scope: 'friends',
    p_metric: 'together',
    p_period: 'week',
    p_tz: 'Europe/Prague',
  });
  ok(
    'Together board counts both',
    (together.data ?? []).length === 2 && together.data.every((r) => Number(r.value) === 1),
    together.error?.message ?? JSON.stringify(together.data),
  );

  const reported = randomUUID();
  const rep = await B.c
    .from('reports')
    .insert({ reporter_id: B.id, target_type: 'user', target_id: reported });
  ok('report someone', !rep.error, rep.error?.message ?? '');
  const repAgain = await B.c
    .from('reports')
    .insert({ reporter_id: B.id, target_type: 'user', target_id: reported });
  ok('reporting twice is refused as a duplicate', repAgain.error?.code === '23505');
  const repFake = await A.c
    .from('reports')
    .insert({ reporter_id: B.id, target_type: 'user', target_id: randomUUID() });
  ok('reporting in someone else’s name blocked', !!repFake.error);
  const repRead = await B.c.from('reports').select('id');
  ok(
    'reports cannot be read back',
    (repRead.data ?? []).length === 0,
    repRead.error?.message ?? '',
  );

  const newPass = 'changedpass456';
  const pw = await A.c.auth.updateUser({ password: newPass });
  ok('change password', !pw.error, pw.error?.message ?? '');
  const email = `zz_a_${tag}@users.colosseum.app`;
  const oldPw = await client().auth.signInWithPassword({ email, password: 'testpass123' });
  ok('old password no longer works', !!oldPw.error);
  const newPw = await client().auth.signInWithPassword({ email, password: newPass });
  ok('new password works', !newPw.error, newPw.error?.message ?? '');

  const img = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const up = await A.c.storage
    .from('avatars')
    .upload(`${A.id}/avatar.jpg`, img, { contentType: 'image/jpeg', upsert: true });
  ok('avatar upload own folder', !up.error, up.error?.message ?? '');
  const up2 = await A.c.storage
    .from('avatars')
    .upload(`${B.id}/avatar.jpg`, img, { contentType: 'image/jpeg', upsert: true });
  ok('avatar upload to other folder blocked', !!up2.error);
  await A.c.storage.from('avatars').remove([`${A.id}/avatar.jpg`]);
  const delGym = await A.c.from('gyms').delete().eq('id', gym?.id).select('id');
  ok(
    'creator deletes test gym',
    (delGym.data ?? []).length === 1,
    delGym.error?.message ?? 'needs the "gyms delete" policy',
  );
} finally {
  const dA = await A.c.rpc('delete_my_account');
  ok('delete account A', !dA.error, dA.error?.message ?? '');
  const dB = await B.c.rpc('delete_my_account');
  ok('delete account B', !dB.error, dB.error?.message ?? '');
  const gone = await client().rpc('username_available', { p_username: `zz_a_${tag}` });
  ok('username free after delete', gone.data === true);
  for (const [s, n, e] of results) console.log(`${s}  ${n}${e ? '  - ' + e : ''}`);
  console.log(`\n${results.filter((r) => r[0] === 'PASS').length}/${results.length} passed`);
}
