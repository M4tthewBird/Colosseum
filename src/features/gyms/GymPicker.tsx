import { useQuery } from '@tanstack/react-query';
import { Plus } from '@/components/icons';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { FormField, FormGroup } from '@/components/Form';
import { ListGroup, ListRow } from '@/components/List';
import { SearchField } from '@/components/SearchField';
import { Sheet } from '@/components/Sheet';
import { searchGyms } from '@/features/social/api';
import type { Gym } from '@/lib/types';
import { colors, type } from '@/theme/tokens';

export type GymChoice = Gym | { name: string; city: string };

/** Searchable sheet of gyms with "Add new gym" (name + city). */
export function GymPicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (g: GymChoice) => void;
}) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const gyms = useQuery({
    queryKey: ['gyms', q],
    queryFn: () => searchGyms(q),
    enabled: visible,
  });

  const close = () => {
    setAdding(false);
    onClose();
  };

  if (adding) {
    return (
      <Sheet
        visible={visible}
        onClose={() => setAdding(false)}
        title="New gym"
        doneLabel="Add"
        doneDisabled={name.trim().length < 2}
        onDone={() => {
          onPick({ name: name.trim(), city: city.trim() });
          setAdding(false);
          setName('');
          setCity('');
          onClose();
        }}
      >
        <FormGroup>
          <FormField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Gym name"
            autoFocus
          />
          <FormField label="City" value={city} onChangeText={setCity} placeholder="City" />
        </FormGroup>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={close} title="Home gym">
      <Text style={type.caption}>The place you train at most.</Text>
      <SearchField placeholder="Search gyms" value={q} onChangeText={setQ} />
      {gyms.isLoading ? (
        <ActivityIndicator color={colors.text2} />
      ) : gyms.data && gyms.data.length > 0 ? (
        <ListGroup>
          {gyms.data.map((g) => (
            <ListRow
              key={g.id}
              title={g.name}
              subtitle={g.city ?? undefined}
              height={56}
              chevron={false}
              onPress={() => {
                onPick(g);
                close();
              }}
            />
          ))}
        </ListGroup>
      ) : (
        <View style={{ paddingVertical: 8 }}>
          <Text style={[type.caption, { textAlign: 'center' }]}>
            {gyms.isError ? 'Could not load gyms. Are you online?' : 'No gyms found.'}
          </Text>
        </View>
      )}
      <FillButton
        label="Add new gym"
        icon={Plus}
        onPress={() => {
          setName(q);
          setAdding(true);
        }}
      />
    </Sheet>
  );
}
