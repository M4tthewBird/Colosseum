/**
 * The choice to play the game or only track workouts (gameMode.ts): the picker at sign-up, the
 * row in Settings and the answer on What's new for players from before the choice existed.
 */
import { StyleSheet, Text, View } from 'react-native';

import { FillButton } from '@/components/Buttons';
import { ColosseumIcon } from '@/components/ColosseumIcon';
import { FieldHint, FormGroup, FormRow } from '@/components/Form';
import { Check, Dumbbell } from '@/components/icons';
import { ListGroup, ListRow } from '@/components/List';
import { Segmented } from '@/components/Segmented';
import { colors, type } from '@/theme/tokens';
import { chooseGame, useGameChoice, type GameChoice } from './gameMode';

export const GAME_LATER = 'You can change this any time in Profile → Settings.';

const OPTIONS: { value: GameChoice; title: string; text: string }[] = [
  {
    value: 'on',
    title: 'Play the game',
    text: 'XP, ranks, your city and gym wars',
  },
  {
    value: 'off',
    title: 'Just track workouts',
    text: 'Workouts, PRs and leaderboards only',
  },
];

/** Sign-up: one of the two, nothing picked at first. */
export function GameModePicker({
  value,
  onChange,
}: {
  value: GameChoice | null;
  onChange: (v: GameChoice) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[type.caption, styles.label]}>Game</Text>
      <ListGroup>
        {OPTIONS.map((o) => {
          const on = value === o.value;
          const Icon = o.value === 'on' ? ColosseumIcon : Dumbbell;
          return (
            <ListRow
              key={o.value}
              height={64}
              left={<Icon size={22} color={on ? colors.accent : colors.text2} strokeWidth={2} />}
              title={o.title}
              subtitle={o.text}
              chevron={false}
              accessibilityLabel={`${o.title}${on ? ', selected' : ''}`}
              right={on ? <Check size={18} color={colors.accent} strokeWidth={2.6} /> : null}
              onPress={() => onChange(o.value)}
            />
          );
        })}
      </ListGroup>
      <FieldHint text={`The game runs on your real training. ${GAME_LATER}`} />
    </View>
  );
}

/** Settings: off or on, and what each means. */
export function GameModeSetting() {
  const choice = useGameChoice() ?? 'on';
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.caption, styles.label]}>Game</Text>
      <FormGroup>
        <FormRow label="Play the game">
          <Segmented
            compact
            height={30}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'on', label: 'On' },
            ]}
            value={choice}
            onChange={(v) => chooseGame(v as GameChoice)}
            accessibilityLabel="Play the game"
          />
        </FormRow>
      </FormGroup>
      <FieldHint
        text={
          choice === 'on'
            ? 'The City tab: your gladiator, the league, duels, your clan and your gym’s wars.'
            : 'The City tab and the game’s cards are hidden. Your workouts still count in the background, so nothing is lost if you turn it on later.'
        }
      />
    </View>
  );
}

/** What's new, for players from before the choice: answer right on the card. */
export function GameModeAction() {
  const choice = useGameChoice();
  if (choice)
    return (
      <View style={styles.done}>
        <Check size={16} color={colors.accent} strokeWidth={2.6} />
        <Text style={[type.bodyStrong, { flex: 1 }]}>
          {choice === 'on'
            ? 'The game is on. Find it in the City tab.'
            : `The game is off. ${GAME_LATER}`}
        </Text>
      </View>
    );
  return (
    <View style={styles.actions}>
      <FillButton
        label="Play the game"
        size="sm"
        style={styles.button}
        onPress={() => chooseGame('on')}
      />
      <FillButton
        label="Just track"
        size="sm"
        style={styles.button}
        onPress={() => chooseGame('off')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { paddingHorizontal: 16 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { height: 44, paddingHorizontal: 18 },
});
