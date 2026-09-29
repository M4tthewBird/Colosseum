import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BackLink } from '@/components/BackLink';
import { FillButton, TextButton } from '@/components/Buttons';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { SearchField } from '@/components/SearchField';
import { searchUsers, useFriendAction, useFriends } from '@/features/social/api';
import type { PublicUser } from '@/lib/types';
import { useData } from '@/stores/data';
import { confirm, toast } from '@/stores/ui';
import { type } from '@/theme/tokens';

function openUser(u: PublicUser) {
  router.push({ pathname: '/user/[id]', params: { id: u.id } });
}

export default function Friends() {
  const myId = useData((s) => s.userId);
  const friends = useFriends();
  const action = useFriendAction();
  const [q, setQ] = useState('');
  const results = useQuery({
    queryKey: ['search-users', q],
    queryFn: () => searchUsers(q),
    enabled: q.trim().length >= 2,
  });

  const data = friends.data ?? { friends: [], incoming: [], outgoing: [] };
  const known = new Map<string, 'friend' | 'incoming' | 'outgoing'>();
  data.friends.forEach((u) => known.set(u.id, 'friend'));
  data.incoming.forEach((u) => known.set(u.id, 'incoming'));
  data.outgoing.forEach((u) => known.set(u.id, 'outgoing'));

  const run = (a: 'request' | 'accept' | 'decline' | 'remove', user: PublicUser, done?: string) =>
    action.mutate(
      { action: a, user },
      { onSuccess: () => done && toast(done), onError: (e) => toast(e.message) },
    );

  return (
    <Screen gap={16}>
      <BackLink label="Arena" fallback="/arena" />
      <Header title="Friends" />
      <SearchField placeholder="Search by username" value={q} onChangeText={setQ} />

      {q.trim().length >= 2 ? (
        <View style={{ gap: 8 }}>
          <SectionHeader title="Results" />
          {results.data && results.data.length > 0 ? (
            <ListGroup>
              {results.data
                .filter((u) => u.id !== myId)
                .map((u) => {
                  const rel = known.get(u.id);
                  return (
                    <ListRow
                      key={u.id}
                      left={<Avatar name={u.display_name} url={u.avatar_url} size={38} />}
                      title={u.display_name}
                      subtitle={`@${u.username}`}
                      chevron={false}
                      rightInteractive
                      onPress={() => openUser(u)}
                      right={
                        rel === 'friend' ? (
                          <Text style={type.caption}>Friend</Text>
                        ) : rel === 'outgoing' ? (
                          <Text style={type.caption}>Requested</Text>
                        ) : rel === 'incoming' ? (
                          <FillButton
                            size="sm"
                            label="Accept"
                            onPress={() => run('accept', u, 'Friend added')}
                          />
                        ) : (
                          <FillButton
                            size="sm"
                            label="Add"
                            onPress={() => run('request', u, 'Request sent')}
                          />
                        )
                      }
                    />
                  );
                })}
            </ListGroup>
          ) : (
            <Text style={[type.caption, { paddingHorizontal: 4 }]}>
              {results.isLoading
                ? 'Searching…'
                : results.isError
                  ? 'Search failed. Are you online?'
                  : 'No users found.'}
            </Text>
          )}
        </View>
      ) : null}

      {data.incoming.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionHeader title="Requests" />
          <ListGroup>
            {data.incoming.map((u) => (
              <ListRow
                key={u.id}
                left={<Avatar name={u.display_name} url={u.avatar_url} size={38} />}
                title={u.display_name}
                subtitle={`@${u.username}`}
                chevron={false}
                rightInteractive
                onPress={() => openUser(u)}
                right={
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <TextButton label="Decline" onPress={() => run('decline', u)} />
                    <FillButton
                      size="sm"
                      label="Accept"
                      onPress={() => run('accept', u, 'Friend added')}
                    />
                  </View>
                }
              />
            ))}
          </ListGroup>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <SectionHeader title={`Friends · ${data.friends.length}`} />
        {data.friends.length > 0 ? (
          <ListGroup>
            {data.friends.map((u) => (
              <ListRow
                key={u.id}
                left={<Avatar name={u.display_name} url={u.avatar_url} size={38} />}
                title={u.display_name}
                subtitle={`@${u.username}`}
                chevron={false}
                rightInteractive
                onPress={() => openUser(u)}
                right={
                  <TextButton
                    label="Remove"
                    onPress={async () => {
                      const ok = await confirm({
                        title: `Remove ${u.display_name}?`,
                        confirmLabel: 'Remove',
                        destructive: true,
                      });
                      if (ok) run('remove', u);
                    }}
                  />
                }
              />
            ))}
          </ListGroup>
        ) : (
          <Text style={[type.caption, { paddingHorizontal: 4 }]}>
            {friends.isLoading ? 'Loading…' : 'Search for your training partners by username.'}
          </Text>
        )}
      </View>

      {data.outgoing.length > 0 ? (
        <View style={{ gap: 8 }}>
          <SectionHeader title="Sent requests" />
          <ListGroup>
            {data.outgoing.map((u) => (
              <ListRow
                key={u.id}
                left={<Avatar name={u.display_name} url={u.avatar_url} size={38} />}
                title={u.display_name}
                subtitle={`@${u.username}`}
                chevron={false}
                right={<TextButton label="Cancel" onPress={() => run('decline', u)} />}
              />
            ))}
          </ListGroup>
        </View>
      ) : null}
    </Screen>
  );
}
