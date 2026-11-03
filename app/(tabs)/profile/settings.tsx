import { router } from 'expo-router';
import { ChevronRight, LogOut, Trash2 } from '@/components/icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BackLink } from '@/components/BackLink';
import { FillButton } from '@/components/Buttons';
import { FieldHint, FormField, FormGroup, FormRow } from '@/components/Form';
import { Header, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { deleteAccount, signOut } from '@/features/auth/auth';
import { GymPicker, type GymChoice } from '@/features/gyms/GymPicker';
import { uploadAvatar } from '@/features/profile/avatar';
import { AvatarPicker } from '@/features/profile/AvatarPicker';
import { ChangePassword } from '@/features/profile/ChangePassword';
import { ExperiencePicker, GoalsPicker, SexSwitch } from '@/features/profile/ProfileFields';
import { PRIVACY_CONTACT } from '@/data/privacy';
import { createGym, useGym } from '@/features/social/api';
import { formatKg, parseNumber } from '@/lib/formulas';
import { limitNameWords, MAX_NAME_WORDS, nameWords } from '@/lib/names';
import { useIsAdmin } from '@/features/admin/api';
import { FeedbackSheet } from '@/features/feedback/FeedbackSheet';
import { isDemo } from '@/lib/supabase';
import { retrySync, syncRow } from '@/lib/sync';
import type { Profile } from '@/lib/types';
import { useData } from '@/stores/data';
import { usePrefs } from '@/stores/prefs';
import { useQueue } from '@/stores/queue';
import { confirm, toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';

export default function Settings() {
  const profile = useData((s) => s.profile)!;
  const priv = useData((s) => s.priv);
  const saveProfile = useData((s) => s.saveProfile);
  const savePrivate = useData((s) => s.savePrivate);
  const queued = useQueue((s) => s.items.length);
  const refused = useQueue((s) => s.items.filter((i) => i.failed).length);
  const syncError = useQueue((s) => s.lastError);
  const isAdmin = useIsAdmin();
  const restSound = usePrefs((s) => s.restSound);
  const setRestSound = usePrefs((s) => s.setRestSound);

  const [draft, setDraft] = useState<Profile>(profile);
  const [height, setHeight] = useState(priv?.height_cm ? formatKg(priv.height_cm) : '');
  const [gymChoice, setGymChoice] = useState<GymChoice | null>(null);
  const [gymOpen, setGymOpen] = useState(false);
  /** The picture being saved, shown until it is done. */
  const [photo, setPhoto] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentGym = useGym(draft.home_gym_id);

  const heightCm = parseNumber(height);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(profile) ||
    (heightCm ?? null) !== (priv?.height_cm ?? null) ||
    !!gymChoice;

  // A picture is saved as soon as it is chosen: the preview looks done, so nobody would look for a
  // Save button further down. Name and the rest of the form stay as they are until saved.
  const savePicture = async (value: string) => {
    setError(null);
    setPhoto(value);
    setBusy(true);
    try {
      const avatar_url = await uploadAvatar(profile.id, value);
      const current = useData.getState().profile ?? profile;
      saveProfile({ ...current, avatar_url });
      setDraft((d) => ({ ...d, avatar_url }));
      const synced = isDemo || (await syncRow('profiles', profile.id));
      toast(
        synced ? 'Picture saved' : 'Picture saved. It reaches your friends once you are online.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhoto(null);
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft.display_name.trim()) return setError('Enter your name.');
    // Older accounts may have a longer name; it only has to fit once it is changed.
    if (
      draft.display_name !== profile.display_name &&
      nameWords(draft.display_name).length > MAX_NAME_WORDS
    )
      return setError('Use at most two words for your name.');
    setError(null);
    setBusy(true);
    try {
      const next = { ...draft, display_name: draft.display_name.trim() };
      if (gymChoice) {
        next.home_gym_id =
          'id' in gymChoice ? gymChoice.id : (await createGym(gymChoice.name, gymChoice.city)).id;
      }
      saveProfile(next);
      if ((heightCm ?? null) !== (priv?.height_cm ?? null))
        savePrivate({ user_id: profile.id, height_cm: heightCm });
      setDraft(next);
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
        accessibilityLabel="Change profile picture"
        onPress={() => setPicking(true)}
        style={styles.photoRow}
      >
        <Avatar name={draft.display_name} url={photo ?? draft.avatar_url} size={62} />
        <Text style={{ fontSize: 16, color: colors.accent, fontWeight: '600' }}>
          Change picture
        </Text>
      </Pressable>
      <AvatarPicker
        visible={picking}
        name={draft.display_name}
        current={photo ?? draft.avatar_url}
        onClose={() => setPicking(false)}
        onPick={(value) => void savePicture(value)}
      />

      <FormGroup>
        <FormField
          label="Name"
          value={draft.display_name}
          onChangeText={(t) => setDraft({ ...draft, display_name: limitNameWords(t) })}
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
      <FieldHint text="Name is what your friends see in the Arena, at most two words. Height is private: only you can see it." />

      <ExperiencePicker
        value={draft.experience}
        onChange={(experience) => setDraft({ ...draft, experience })}
      />
      <GoalsPicker value={draft.goals} onChange={(goals) => setDraft({ ...draft, goals })} />

      <View style={{ gap: 6 }}>
        <FormGroup>
          <FormRow label="Global leaderboard">
            <Segmented
              compact
              height={30}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on', label: 'On' },
              ]}
              value={draft.global_ranking ? 'on' : 'off'}
              onChange={(v) => setDraft({ ...draft, global_ranking: v === 'on' })}
              accessibilityLabel="Global leaderboard"
            />
          </FormRow>
        </FormGroup>
        <FieldHint text="On: everyone who joined sees your name, photo and ranked numbers in Arena → Global. Bodyweight is never shown." />
      </View>

      {error ? <FieldHint text={error} error /> : null}
      <FillButton label="Save changes" onPress={save} disabled={!dirty || busy} loading={busy} />

      <View style={{ gap: 6 }}>
        <Text style={[type.caption, { paddingHorizontal: 16 }]}>Account</Text>
        <FormGroup>
          <FormRow label="Change password" onPress={() => setChangingPassword(true)}>
            <ChevronRight size={14} color={colors.text3} strokeWidth={3} />
          </FormRow>
        </FormGroup>
      </View>
      <ChangePassword visible={changingPassword} onClose={() => setChangingPassword(false)} />
      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      <View style={{ gap: 6 }}>
        <Text style={[type.caption, { paddingHorizontal: 16 }]}>During a workout</Text>
        <FormGroup>
          <FormRow label="Sound when rest ends">
            <Segmented
              compact
              height={30}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on', label: 'On' },
              ]}
              value={restSound ? 'on' : 'off'}
              onChange={(v) => setRestSound(v === 'on')}
              accessibilityLabel="Sound when rest ends"
            />
          </FormRow>
        </FormGroup>
        <FieldHint text="The screen stays on during a workout, so the timer can reach you. On iPhone, the silent switch mutes the sound." />
      </View>

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
                onPress={() => void retrySync()}
              >
                Sync now
              </Text>
            ) : null}
          </FormRow>
        </FormGroup>
        {syncError ? <FieldHint text={`Last error: ${syncError}`} error /> : null}
        {refused ? (
          <>
            <FieldHint
              text={`The server refused ${refused} change${refused === 1 ? '' : 's'}. Everything else still syncs. Try again later, or discard them if this keeps happening.`}
            />
            <FillButton
              label="Discard refused changes"
              icon={Trash2}
              onPress={async () => {
                const ok = await confirm({
                  title: 'Discard these changes?',
                  message: 'They will never reach your account, and can disappear from this phone.',
                  confirmLabel: 'Discard',
                  destructive: true,
                });
                if (ok) useQueue.getState().discardFailed();
              }}
            />
          </>
        ) : null}
        {isDemo ? (
          <FieldHint text="Add your Supabase keys to .env to sync and use the Arena for real." />
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <Text style={[type.caption, { paddingHorizontal: 16 }]}>Help</Text>
        <FormGroup>
          <FormRow
            label="Show the app tour"
            onPress={() => {
              usePrefs.getState().setTourPending(true);
              router.navigate('/');
            }}
          >
            <ChevronRight size={14} color={colors.text3} strokeWidth={3} />
          </FormRow>
          <FormRow label="What’s new" onPress={() => router.push('/profile/whats-new')}>
            <ChevronRight size={14} color={colors.text3} strokeWidth={3} />
          </FormRow>
          <FormRow label="Send feedback" onPress={() => setFeedbackOpen(true)}>
            <ChevronRight size={14} color={colors.text3} strokeWidth={3} />
          </FormRow>
          {PRIVACY_CONTACT ? (
            <FormRow label="Privacy" onPress={() => router.push('/privacy')}>
              <ChevronRight size={14} color={colors.text3} strokeWidth={3} />
            </FormRow>
          ) : null}
        </FormGroup>
      </View>

      {isAdmin ? (
        <View style={{ gap: 6 }}>
          <Text style={[type.caption, { paddingHorizontal: 16 }]}>Admin</Text>
          <FormGroup>
            <FormRow
              label="Stats, reports and feedback"
              onPress={() => router.push('/profile/admin')}
            >
              <ChevronRight size={14} color={colors.text3} strokeWidth={3} />
            </FormRow>
          </FormGroup>
        </View>
      ) : null}

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
