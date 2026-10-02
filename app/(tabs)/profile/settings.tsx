import { ChevronRight, LogOut, Trash2 } from '@/components/icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup, FormRow } from '@/components/Form';
import { Header, Screen } from '@/components/Screen';
import { deleteAccount, signOut } from '@/features/auth/auth';
import { GymPicker, type GymChoice } from '@/features/gyms/GymPicker';
import { pickImage, uploadAvatar } from '@/features/profile/avatar';
import { ExperiencePicker, GoalsPicker, SexSwitch } from '@/features/profile/ProfileFields';
import { createGym, useGym } from '@/features/social/api';
import { formatKg, parseNumber } from '@/lib/formulas';
import { isDemo } from '@/lib/supabase';
import { flush } from '@/lib/sync';
import type { Profile } from '@/lib/types';
import { useData } from '@/stores/data';
import { useQueue } from '@/stores/queue';
import { confirm, toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

export default function Settings() {
  const profile = useData((s) => s.profile)!;
  const priv = useData((s) => s.priv);
  const saveProfile = useData((s) => s.saveProfile);
  const savePrivate = useData((s) => s.savePrivate);
  const queued = useQueue((s) => s.items.length);
  const syncError = useQueue((s) => s.lastError);

  const [draft, setDraft] = useState<Profile>(profile);
  const [height, setHeight] = useState(priv?.height_cm ? formatKg(priv.height_cm) : '');
  const [gymChoice, setGymChoice] = useState<GymChoice | null>(null);
  const [gymOpen, setGymOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentGym = useGym(draft.home_gym_id);

  const heightCm = parseNumber(height);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(profile) ||
    (heightCm ?? null) !== (priv?.height_cm ?? null) ||
    !!photo ||
    !!gymChoice;

  const save = async () => {
    if (!draft.display_name.trim()) return setError('Enter your name.');
    setError(null);
    setBusy(true);
    try {
      const next = { ...draft, display_name: draft.display_name.trim() };
      if (gymChoice) {
        next.home_gym_id =
          'id' in gymChoice ? gymChoice.id : (await createGym(gymChoice.name, gymChoice.city)).id;
      }
      if (photo) next.avatar_url = await uploadAvatar(profile.id, photo);
      saveProfile(next);
      if ((heightCm ?? null) !== (priv?.height_cm ?? null))
        savePrivate({ user_id: profile.id, height_cm: heightCm });
      setDraft(next);
      setPhoto(null);
      setGymChoice(null);
      toast('Profile saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const gymLabel = gymChoice
    ? gymChoice.name
    : (currentGym.data?.gym?.name ?? (draft.home_gym_id ? '…' : 'Choose'));

  return (
    <Screen gap={16}>
      <BackLink label="Profile" fallback="/profile" />
      <Header title="Settings" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        onPress={async () => {
          const uri = await pickImage();
          if (uri) setPhoto(uri);
        }}
        style={styles.photoRow}
      >
        <Avatar name={draft.display_name} url={photo ?? draft.avatar_url} size={62} />
        <Text style={{ fontSize: 16, color: colors.accent, fontWeight: '600' }}>Change photo</Text>
      </Pressable>

      <FormGroup>
        <FormField
          label="Name"
          value={draft.display_name}
          onChangeText={(display_name) => setDraft({ ...draft, display_name })}
        />
        <FormRow label="Username">
          <Text style={[type.body, { fontSize: 16, color: colors.text2 }]}>
            @{profile.username}
          </Text>
        </FormRow>
        <FormRow label="Sex">
          <SexSwitch value={draft.sex} onChange={(sex) => setDraft({ ...draft, sex })} />
        </FormRow>
        <FormField
          label="Height"
          value={height}
          onChangeText={setHeight}
          placeholder="180"
          keyboardType="decimal-pad"
          suffix="cm"
        />
        <FormRow label="Home gym" onPress={() => setGymOpen(true)}>
          <Text style={[type.body, { fontSize: 16, color: colors.text2 }]} numberOfLines={1}>
            {gymLabel}
          </Text>
          <ChevronRight size={14} color={colors.text3} strokeWidth={3} />
        </FormRow>
      </FormGroup>
      <FieldHint text="Height is private. Only you can see it." />

      <ExperiencePicker
        value={draft.experience}
        onChange={(experience) => setDraft({ ...draft, experience })}
      />
      <GoalsPicker value={draft.goals} onChange={(goals) => setDraft({ ...draft, goals })} />

      {error ? <FieldHint text={error} error /> : null}
      <FillButton label="Save changes" onPress={save} disabled={!dirty || busy} loading={busy} />

      <View style={{ gap: 6 }}>
        <Text style={[type.caption, { paddingHorizontal: 16 }]}>Sync</Text>
        <FormGroup>
          <FormRow
            label={
              isDemo
                ? 'Demo mode'
                : queued
                  ? `${queued} change${queued === 1 ? '' : 's'} not synced yet`
                  : 'Everything is synced'
            }
          >
            {!isDemo && queued ? (
              <Text
                style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}
                onPress={() => void flush()}
              >
                Sync now
              </Text>
            ) : null}
          </FormRow>
        </FormGroup>
        {syncError ? <FieldHint text={`Last error: ${syncError}`} error /> : null}
        {isDemo ? (
          <FieldHint text="Add your Supabase keys to .env to sync and use the Arena for real." />
        ) : null}
      </View>

      <View style={{ gap: 10, marginTop: 8 }}>
        <FillButton
          label="Sign out"
          icon={LogOut}
          onPress={async () => {
            const ok = await confirm({
              title: 'Sign out?',
              message: queued
                ? `${queued} changes are not synced yet and will be lost.`
                : undefined,
              confirmLabel: 'Sign out',
              destructive: queued > 0,
            });
            if (ok) await signOut();
          }}
        />
        <FillButton
          label="Delete account"
          icon={Trash2}
          labelStyle={{ color: colors.accent }}
          onPress={async () => {
            const ok = await confirm({
              title: 'Delete your account?',
              message: 'All your workouts, programs and body data are deleted for good.',
              confirmLabel: 'Delete account',
              destructive: true,
            });
            if (!ok) return;
            try {
              await deleteAccount();
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Could not delete the account');
            }
          }}
        />
      </View>

      <GymPicker visible={gymOpen} onClose={() => setGymOpen(false)} onPick={setGymChoice} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
