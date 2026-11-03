/**
 * Admin → Users: password help requests from the sign-in screen, and finding anyone by username
 * to set a temporary password. The temporary one is shown once, to send to the user; the app asks
 * them for their own right after they sign in with it.
 */
import { useState } from 'react';
import { Platform, Share as RNShare, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { FillButton } from '@/components/Buttons';
import { Glass } from '@/components/Glass';
import { Check, Copy, KeyRound } from '@/components/icons';
import { EmptyState, SectionHeader } from '@/components/List';
import { SearchField } from '@/components/SearchField';
import { Sheet } from '@/components/Sheet';
import { timeAgo } from '@/lib/dates';
import { confirm, toast } from '@/stores/ui';
import { colors, type } from '@/theme/tokens';
import { useFindUsers, usePasswordHelp, usePasswordHelpDone, useResetPassword } from './api';

export function UsersTab() {
  const help = usePasswordHelp();
  const done = usePasswordHelpDone();
  const reset = useResetPassword();
  const [q, setQ] = useState('');
  const found = useFindUsers(q);
  const [result, setResult] = useState<{ username: string; password: string } | null>(null);

  const resetFor = async (userId: string, username: string) => {
    const ok = await confirm({
      title: `Reset @${username}’s password?`,
      message:
        'Their current password stops working. You get a temporary one to send them; they choose their own after signing in.',
      confirmLabel: 'Reset',
      destructive: true,
    });
    if (!ok) return;
    reset.mutate(userId, {
      onSuccess: (password) => setResult({ username, password }),
      onError: (e) => toast(e.message),
    });
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <SectionHeader title="Password help" />
        {help.isPending ? (
          <Text style={type.caption}>Loading…</Text>
        ) : help.error ? (
          <EmptyState title="Could not load the requests" text={help.error.message} />
        ) : !help.data.length ? (
          <EmptyState
            title="No requests"
            text="People who forgot their password and have no recovery code ask here, from the sign-in screen."
          />
        ) : (
          help.data.map((h) => (
            <Glass key={h.id} radius={22} style={styles.card}>
              <View style={styles.row}>
                <Text style={[type.bodyStrong, { flex: 1 }]}>@{h.username}</Text>
                <Text style={type.small}>{timeAgo(h.created_at)}</Text>
              </View>
              <Text style={type.caption}>
                {h.user_id ? h.display_name : 'No account with this username. Check with them.'}
              </Text>
              <Text style={type.body} selectable>
                Reach them: {h.contact}
              </Text>
              <View style={styles.actions}>
                {h.user_id ? (
                  <FillButton
                    label="Reset password"
                    icon={KeyRound}
                    size="sm"
                    disabled={reset.isPending}
                    onPress={() => void resetFor(h.user_id!, h.username)}
                  />
                ) : null}
                <FillButton
                  label="Done"
                  icon={Check}
                  size="sm"
                  disabled={done.isPending}
                  onPress={() => done.mutate(h.id, { onError: (e) => toast(e.message) })}
                />
              </View>
            </Glass>
          ))
        )}
      </View>

      <View style={{ gap: 8 }}>
        <SectionHeader title="Find someone" />
        <SearchField placeholder="Username or name" value={q} onChangeText={setQ} />
        {q.trim().length >= 2 ? (
          found.isPending ? (
            <Text style={type.caption}>Searching…</Text>
          ) : found.error ? (
            <EmptyState title="Could not search" text={found.error.message} />
          ) : !found.data.length ? (
            <EmptyState title="Nobody found" />
          ) : (
            <Glass radius={22} style={{ paddingVertical: 4 }}>
              {found.data.map((u, i) => (
                <View key={u.id} style={[styles.userRow, i > 0 && styles.line]}>
                  <Avatar name={u.display_name} url={u.avatar_url} size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={type.bodyStrong} numberOfLines={1}>
                      {u.display_name}
                    </Text>
                    <Text style={type.caption} numberOfLines={1}>
                      @{u.username}
                    </Text>
                  </View>
                  <FillButton
                    label="Reset"
                    icon={KeyRound}
                    size="sm"
                    disabled={reset.isPending}
                    onPress={() => void resetFor(u.id, u.username)}
                  />
                </View>
              ))}
            </Glass>
          )
        ) : null}
      </View>

      <TempPasswordSheet result={result} onClose={() => setResult(null)} />
    </View>
  );
}

function TempPasswordSheet({
  result,
  onClose,
}: {
  result: { username: string; password: string } | null;
  onClose: () => void;
}) {
  const message = result
    ? `Your temporary Colosseum password: ${result.password}\nSign in as @${result.username} with it, and the app asks you to choose your own.`
    : '';
  const share = async () => {
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) await navigator.share({ text: message });
        else {
          await navigator.clipboard.writeText(message);
          toast('Copied');
        }
      } else await RNShare.share({ message });
    } catch {
      // Closed the share sheet.
    }
  };
  return (
    <Sheet visible={!!result} onClose={onClose} title="Temporary password">
      {result ? (
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Text style={[type.caption, { fontSize: 15 }]}>
            Send this to @{result.username}. It is shown only now.
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.code} selectable>
              {result.password}
            </Text>
          </View>
          <FillButton label="Copy or share the message" icon={Copy} onPress={() => void share()} />
          <FillButton label="Done" onPress={onClose} />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 60,
  },
  line: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  codeBox: {
    borderRadius: 18,
    backgroundColor: colors.white,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.separator,
  },
  code: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, Menlo, monospace' : 'Menlo',
  },
});
