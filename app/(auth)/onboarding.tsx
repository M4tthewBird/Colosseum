import { Link } from 'expo-router';
import { Camera, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup, FormRow } from '@/components/Form';
import { LogoMark, Wordmark } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { isUsernameAvailable, signUp, useAuth } from '@/features/auth/auth';
import { GymPicker, type GymChoice } from '@/features/gyms/GymPicker';
import { pickImage } from '@/features/profile/avatar';
import { ExperiencePicker, GoalsPicker, SexSwitch } from '@/features/profile/ProfileFields';
import { parseNumber } from '@/lib/formulas';
import { isDemo, USERNAME_RE } from '@/lib/supabase';
import type { Experience, Goal, Sex } from '@/lib/types';
import { colors, type } from '@/theme/tokens';

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'invalid' | 'error';

export default function Onboarding() {
  const accountUsername = useAuth((s) => s.accountUsername);
  const signedIn = useAuth((s) => s.status === 'signedIn');
  // Signed in without a profile (e.g. sign-up was interrupted): only finish the profile.
  const completing = signedIn && !isDemo;

  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState(completing ? (accountUsername ?? '') : '');
  const [password, setPassword] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gym, setGym] = useState<GymChoice | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [gymOpen, setGymOpen] = useState(false);
  const [checked, setChecked] = useState<{ name: string; result: Availability } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uname = username.trim().toLowerCase();

  const formatOk = USERNAME_RE.test(uname);
  const availability: Availability = !uname
    ? 'idle'
    : !formatOk
      ? 'invalid'
      : checked?.name === uname
        ? checked.result
        : 'checking';

  useEffect(() => {
    if (completing || !formatOk) return;
    let live = true;
    const t = setTimeout(() => {
      isUsernameAvailable(uname)
        .then((ok) => live && setChecked({ name: uname, result: ok ? 'free' : 'taken' }))
        .catch(() => live && setChecked({ name: uname, result: 'error' }));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [uname, completing, formatOk]);

  const weightKg = parseNumber(weight);
  const heightCm = parseNumber(height);
  const valid =
    name.trim().length > 0 &&
    (completing || (availability === 'free' && password.length >= 8)) &&
    (weight === '' || (weightKg != null && weightKg > 20 && weightKg < 400)) &&
    (height === '' || (heightCm != null && heightCm > 80 && heightCm < 260));

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError('Enter your name.');
    if (!completing && availability === 'taken') return setError('This username is taken.');
    if (!completing && password.length < 8)
      return setError('The password needs at least 8 characters.');
    setBusy(true);
    try {
      await signUp({
        username: uname,
        password,
        displayName: name,
        sex,
        experience,
        goals,
        bodyweightKg: weightKg,
        heightCm,
        gym: gym && 'id' in gym ? { id: gym.id } : gym,
        photoUri: photo,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const hint: Record<Availability, { text: string; error?: boolean } | null> = {
    idle: { text: '3–20 characters: a–z, 0–9, _ and .' },
    checking: { text: 'Checking…' },
    free: { text: `@${uname} is available` },
    taken: { text: `@${uname} is taken`, error: true },
    invalid: { text: 'Use 3–20 characters: a–z, 0–9, _ and .', error: true },
    error: { text: 'Could not check the username. Are you online?', error: true },
  };

  return (
    <Screen tabs={false} gap={16} glowTop={-140}>
      <View style={styles.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add profile photo"
          onPress={async () => {
            const uri = await pickImage();
            if (uri) setPhoto(uri);
          }}
          style={styles.photo}
        >
          {photo ? (
            <Avatar name={name || '?'} url={photo} size={88} />
          ) : (
            <View style={styles.photoEmpty}>
              <Camera size={30} color={colors.text2} strokeWidth={1.7} />
            </View>
          )}
          <View style={styles.badge} aria-hidden>
            <LogoMark size={22} color="#fff" />
          </View>
        </Pressable>
        <View style={{ gap: 4, alignItems: 'center' }}>
          <Wordmark withMark={false} />
          <Text
            style={[type.largeTitle, { fontSize: 28, letterSpacing: -0.6 }]}
            accessibilityRole="header"
          >
            {completing ? 'Finish your profile' : 'Create your profile'}
          </Text>
          <Text style={[type.caption, { fontSize: 15 }]}>
            Your friends will see this in the arena.
          </Text>
          {isDemo ? (
            <Text style={[type.small, { color: colors.accent, marginTop: 4 }]}>
              Demo mode · data stays on this device
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <FormGroup>
          <FormField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoComplete="name"
          />
          <FormField
            label="Username"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
            placeholder="@username"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!completing}
            autoComplete="username"
          />
          {!completing ? (
            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoComplete="new-password"
            />
          ) : null}
          <FormRow label="Sex">
            <SexSwitch value={sex} onChange={setSex} />
          </FormRow>
          <FormField
            label="Bodyweight"
            value={weight}
            onChangeText={setWeight}
            placeholder="80"
            keyboardType="decimal-pad"
            suffix="kg"
          />
          <FormField
            label="Height"
            value={height}
            onChangeText={setHeight}
            placeholder="180"
            keyboardType="decimal-pad"
            suffix="cm"
          />
          <FormRow label="Gym" onPress={() => setGymOpen(true)}>
            <Text style={[type.body, { fontSize: 16, color: colors.text2 }]} numberOfLines={1}>
              {gym ? gym.name : 'Choose'}
            </Text>
            <ChevronRight size={14} color={colors.text3} strokeWidth={3} />
          </FormRow>
        </FormGroup>
        {!completing && hint[availability] ? (
          <FieldHint text={hint[availability]!.text} error={hint[availability]!.error} />
        ) : null}
      </View>

      <ExperiencePicker value={experience} onChange={setExperience} />
      <GoalsPicker value={goals} onChange={setGoals} />

      <View style={{ gap: 14, marginTop: 10 }}>
        {error ? <FieldHint text={error} error /> : null}
        <FillButton
          label="Continue"
          onPress={submit}
          loading={busy}
          disabled={!valid || busy}
          style={{ height: 52 }}
        />
        {!completing ? (
          <Text style={[type.caption, { textAlign: 'center', fontSize: 14 }]}>
            Already have an account?{' '}
            <Link href="/sign-in" style={{ color: colors.accent, fontWeight: '600' }}>
              Sign in
            </Link>
          </Text>
        ) : null}
      </View>

      <GymPicker visible={gymOpen} onClose={() => setGymOpen(false)} onPick={setGym} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 12 },
  photo: { width: 88, height: 88 },
  photoEmpty: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
