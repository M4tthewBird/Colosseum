/**
 * The map of the city and tribe attacks (docs/GAME.md §10): the tribes of the city with their
 * territory, an enemy tribe up close, comparing gear, a running attack and its result.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { ArtStage, FortressArt, GladiatorArt, StyleArt } from '@/components/art/Art';
import { FillButton, Tap } from '@/components/Buttons';
import { GlassCard } from '@/components/Glass';
import { Flame, Hammer, Shield, Swords, Users } from '@/components/icons';
import { EmptyState, ListGroup, ListRow } from '@/components/List';
import { Header, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { useGym } from '@/features/social/api';
import { TRIBE_WAR, WAR } from '@/lib/game/config';
import { fortressStage } from '@/lib/game/fortress';
import {
  gearInSlot,
  GEAR_SLOTS,
  owns,
  unlockText,
  weakestSlot,
  worn,
  type Loadout,
} from '@/lib/game/gear';
import { rankFor } from '@/lib/game/levels';
import { styleDef, type StyleId } from '@/lib/game/styles';
import {
  cityPlaces,
  compareStrength,
  countdownText,
  distanceKm,
  placeGyms,
  revengeUntil,
  tribeSpoils,
  tribeWarPhase,
} from '@/lib/game/tribes';
import { useNow } from '@/lib/useNow';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { accentA, colors, tabular, type } from '@/theme/tokens';
import {
  useCityMap,
  useDeclareTribeWar,
  useGladiator,
  usePledgeDefence,
  useTribeInfo,
  useTribeWarMe,
  useTribeWars,
  type CityTribeRow,
  type TribeWar,
} from './cityApi';
import { CityTopBar, DenariiPill } from './CityViews';
import { useGearProgress, useMyGame } from './hooks';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

/** My home gym, its city and the city's tribes. */
function useMyCity() {
  const gymId = useData((s) => s.profile?.home_gym_id ?? null);
  const gym = useGym(gymId).data?.gym ?? null;
  const map = useCityMap(gym?.city);
  const wars = useTribeWars(gymId);
  return { gymId, gym, tribes: map.data, loading: map.isLoading, wars: wars.data ?? [] };
}

type Filter = 'all' | 'war' | 'weaker' | 'stronger';

// ───────────── The map ─────────────

export function MapScreen() {
  const { gymId, gym, tribes, wars } = useMyCity();
  const [filter, setFilter] = useState<Filter>('all');
  const [picked, setPicked] = useState<string | null>(null);
  const [width, setWidth] = useState(350);
  const me = tribes?.find((t) => t.id === gymId);
  const places = useMemo(() => cityPlaces(tribes ?? []), [tribes]);

  if (!gymId || !gym?.city)
    return (
      <Screen glow="center" gap={16}>
        <CityTopBar title="Map" fallback="/arena" />
        <EmptyState
          title="No home gym in a city"
          text="The map shows the tribes of your city. Pick your home gym (with its city) in Settings."
        />
      </Screen>
    );

  const enemies = (tribes ?? []).filter((t) => t.id !== gymId);
  const shown = (t: CityTribeRow) => {
    if (t.id === gymId || filter === 'all') return true;
    if (filter === 'war') return t.at_war;
    const s = compareStrength(me?.strength ?? 0, t.strength);
    return filter === 'weaker' ? s === 'weaker' : s === 'stronger';
  };
  const defaultPick =
    enemies.find((t) => t.at_war) ??
    enemies
      .filter((t) => compareStrength(me?.strength ?? 0, t.strength) !== 'stronger')
      .sort((a, b) => b.treasury - a.treasury)[0] ??
    enemies[0];
  const sel = enemies.find((t) => t.id === picked) ?? defaultPick;

  return (
    <Screen glow="center" gap={14}>
      <Header
        above={
          me
            ? `Territory: ${me.territories} of ${tribes?.length ?? 0} · ${ordinal(places.get(me.id) ?? 0)} in the city`
            : gym.name
        }
        title={gym.city}
        right={<DenariiPill />}
      />
      <Segmented
        options={[
          { value: 'all', label: 'All' },
          { value: 'war', label: 'At war' },
          { value: 'weaker', label: 'Weaker' },
          { value: 'stronger', label: 'Stronger' },
        ]}
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Show tribes"
      />
      <View
        style={styles.map}
        onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}
      >
        {tribes ? (
          <CityMap
            size={width}
            tribes={tribes}
            mine={gymId}
            wars={wars}
            selected={sel?.id ?? null}
            shown={shown}
            onPick={setPicked}
          />
        ) : null}
      </View>
      {sel ? <TribeCard tribe={sel} me={me} /> : null}
    </Screen>
  );
}

const PARCH = '#EDE6D3';
const INK = '#3B2F22';

function CityMap({
  size,
  tribes,
  mine,
  wars,
  selected,
  shown,
  onPick,
}: {
  size: number;
  tribes: CityTribeRow[];
  mine: string;
  wars: TribeWar[];
  selected: string | null;
  shown: (t: CityTribeRow) => boolean;
  onPick: (id: string) => void;
}) {
  const h = Math.round(size * 1.06);
  const pts = placeGyms(tribes, size).map((p) => ({ ...p, y: Math.round((p.y * h) / size) }));
  const at = (id: string) => pts.find((p) => p.id === id);
  const center = pts.reduce((c, p) => ({ x: c.x + p.x / pts.length, y: c.y + p.y / pts.length }), {
    x: 0,
    y: 0,
  });
  const running = wars.filter((w) => !w.settled_at);
  // A label goes above the gym when another gym sits right under it.
  const above = (p: { id: string; x: number; y: number }) =>
    pts.some((o) => o.id !== p.id && Math.abs(o.x - p.x) < 70 && o.y > p.y && o.y - p.y < 46);
  return (
    <View>
      <Svg width={size} height={h}>
        <Rect
          x={1}
          y={1}
          width={size - 2}
          height={h - 2}
          rx={18}
          fill={PARCH}
          stroke={INK}
          strokeWidth={1.5}
        />
        {/* Parks and the river, drawn the same for every city. */}
        <Ellipse
          cx={size * 0.22}
          cy={h * 0.08}
          rx={size * 0.2}
          ry={h * 0.06}
          fill="#C9D3A1"
          stroke={INK}
          strokeWidth={0.8}
          opacity={0.8}
        />
        <Ellipse
          cx={size * 0.06}
          cy={h * 0.62}
          rx={size * 0.07}
          ry={h * 0.16}
          fill="#C9D3A1"
          stroke={INK}
          strokeWidth={0.8}
          opacity={0.8}
        />
        <Ellipse
          cx={size * 0.95}
          cy={h * 0.84}
          rx={size * 0.09}
          ry={h * 0.08}
          fill="#C9D3A1"
          stroke={INK}
          strokeWidth={0.8}
          opacity={0.8}
        />
        <Path
          d={`M${size * 0.62},0 C${size * 0.58},${h * 0.3} ${size * 0.68},${h * 0.5} ${size * 0.6},${h * 0.7} S${size * 0.5},${h * 0.92} ${size * 0.54},${h}`}
          fill="none"
          stroke="#8FB0C2"
          strokeWidth={5}
          strokeLinecap="round"
        />
        {/* Roads to the middle. */}
        {pts.map((p) => (
          <Line
            key={`r${p.id}`}
            x1={p.x}
            y1={p.y}
            x2={center.x}
            y2={center.y}
            stroke="#D6C7A1"
            strokeWidth={3}
            opacity={0.7}
          />
        ))}
        {tribes.map((t) => {
          const p = at(t.id)!;
          const own = t.id === mine;
          return (
            <Circle
              key={`t${t.id}`}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={own ? accentA(0.2) : 'rgba(120,108,88,0.14)'}
              stroke={own ? colors.accent : '#8A7F6A'}
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={shown(t) ? 1 : 0.25}
            />
          );
        })}
        {running.map((w) => {
          const a = at(w.attacker.id);
          const d = at(w.defender.id);
          if (!a || !d) return null;
          const mineAttacks = w.attacker.id === mine;
          const k = 1 - (d.r * 0.55) / Math.max(1, Math.hypot(d.x - a.x, d.y - a.y));
          const ex = a.x + (d.x - a.x) * k;
          const ey = a.y + (d.y - a.y) * k;
          return (
            <G key={w.id}>
              <Line
                x1={a.x}
                y1={a.y}
                x2={ex}
                y2={ey}
                stroke={mineAttacks ? colors.accent : colors.text}
                strokeWidth={2.5}
                strokeDasharray={mineAttacks ? undefined : '5 4'}
              />
              <Circle cx={ex} cy={ey} r={4} fill={mineAttacks ? colors.accent : colors.text} />
            </G>
          );
        })}
        {tribes.map((t) => {
          const p = at(t.id)!;
          const own = t.id === mine;
          const weak = t.level <= 2;
          const flag = own ? colors.accent : weak ? '#8E8E93' : colors.text;
          const war = t.at_war;
          return (
            <G key={`g${t.id}`} opacity={shown(t) ? 1 : 0.3}>
              {selected === t.id ? (
                <Circle
                  cx={p.x}
                  cy={p.y + 2}
                  r={17}
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth={2}
                />
              ) : null}
              <Ellipse
                cx={p.x}
                cy={p.y + 6}
                rx={12}
                ry={4.5}
                fill="#B9A27E"
                stroke={INK}
                strokeWidth={1}
              />
              <Rect
                x={p.x - 12}
                y={p.y - 2}
                width={24}
                height={8}
                fill="#D8C39B"
                stroke={INK}
                strokeWidth={1}
              />
              <Ellipse
                cx={p.x}
                cy={p.y - 2}
                rx={12}
                ry={4.5}
                fill="#EBDDB8"
                stroke={INK}
                strokeWidth={1}
              />
              <Line
                x1={p.x + 6}
                y1={p.y - 3}
                x2={p.x + 6}
                y2={p.y - 17}
                stroke={INK}
                strokeWidth={1.2}
              />
              <Path
                d={`M${p.x + 6},${p.y - 17} L${p.x + 14},${p.y - 14} L${p.x + 6},${p.y - 11} Z`}
                fill={flag}
              />
              <SvgText
                x={p.x}
                y={above(p) ? p.y - 30 : p.y + 21}
                fontSize={9.5}
                fontWeight="700"
                textAnchor="middle"
                fill={own ? colors.accent : colors.text}
              >
                {own ? 'YOUR GYM' : t.name.toUpperCase()}
              </SvgText>
              <SvgText
                x={p.x}
                y={above(p) ? p.y - 21 : p.y + 31}
                fontSize={8}
                textAnchor="middle"
                fill={colors.text2}
              >
                {own
                  ? `${t.name} · lv ${t.level}`
                  : `lv ${t.level}${war ? ' · at war' : weak ? ' · easy prey' : ''}`}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      {tribes.map((t) => {
        const p = at(t.id)!;
        if (t.id === mine) return null;
        return (
          <Pressable
            key={`p${t.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Tribe ${t.name}, level ${t.level}`}
            onPress={() => onPick(t.id)}
            style={[styles.hit, { left: p.x - 26, top: p.y - 24 }]}
          />
        );
      })}
    </View>
  );
}

function TribeCard({ tribe, me }: { tribe: CityTribeRow; me: CityTribeRow | undefined }) {
  const km = me ? distanceKm(me, tribe) : null;
  return (
    <GlassCard radius={24} style={styles.tribeCard}>
      <View style={styles.tribeHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.rpg, { fontSize: 18 }]} numberOfLines={1}>
            Tribe {tribe.name}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            lv {tribe.level} · walls +{Math.round(TRIBE_WAR.wallBonus * tribe.palisade * 100)} %
            {km != null ? ` · ${km} km from you` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={type.small}>spoils up to</Text>
          <Text style={[styles.loot, tabular]}>{fmt(tribeSpoils(tribe.treasury))} den.</Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <FillButton
          label="Explore"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/tribe/[id]', params: { id: tribe.id } })}
        />
        <AttackButton tribe={tribe} style={{ flex: 1 }} label="Attack" />
      </View>
    </GlassCard>
  );
}

function AttackButton({
  tribe,
  label,
  style,
}: {
  tribe: CityTribeRow;
  label: string;
  style?: object;
}) {
  const declare = useDeclareTribeWar();
  const game = useMyGame();
  return (
    <FillButton
      label={label}
      icon={Swords}
      ready
      style={style}
      loading={declare.isPending}
      onPress={() =>
        declare.mutate(
          { target: tribe, level: game.level },
          {
            onSuccess: () => toast(`Attack on ${tribe.name} declared. The battle starts in 24 h.`),
            onError: (e) => toast(e.message),
          },
        )
      }
    />
  );
}

// ───────────── An enemy tribe ─────────────

export function EnemyScreen({ id }: { id: string }) {
  const { gymId, tribes } = useMyCity();
  const tribe = tribes?.find((t) => t.id === id);
  const me = tribes?.find((t) => t.id === gymId);
  const info = useTribeInfo(id).data;
  if (!tribe)
    return (
      <Screen glow="center" tabs={false} gap={16}>
        <CityTopBar title="Tribe" fallback="/city/map" pill={false} />
        {tribes ? (
          <EmptyState title="Not in your city" text="This tribe is not on your map." />
        ) : null}
      </Screen>
    );
  const chance = compareStrength(tribe.strength, me?.strength ?? 0);
  const weekend = info?.weekendShare;
  const weakSpot =
    weekend != null && weekend < 0.2
      ? `only ${Math.round(weekend * 100)} % of their workouts are at the weekend. An attack declared on Friday catches them unready.`
      : tribe.palisade === 0
        ? 'no walls. Their defence gets no bonus.'
        : null;

  return (
    <Screen glow="center" tabs={false} gap={14}>
      <CityTopBar title={`Tribe ${tribe.name}`} fallback="/city/map" pill={false} />
      <ArtStage
        height={200}
        overlay={
          <View style={styles.enemyChips}>
            <View style={styles.darkPill}>
              <Text style={styles.darkPillText}>ENEMY · lv {tribe.level}</Text>
            </View>
            <Text style={type.captionStrong}>{tribe.members} gladiators</Text>
          </View>
        }
      >
        <FortressArt stage={fortressStage(tribe.level)} width={200} />
      </ArtStage>
      <View style={styles.tiles}>
        <Tile value={fmt(tribe.strength)} label="total strength" />
        <Tile
          value={`+${Math.round(TRIBE_WAR.wallBonus * tribe.palisade * 100)} %`}
          label={`walls lv ${tribe.palisade}`}
        />
        <Tile value={fmt(tribeSpoils(tribe.treasury))} label="spoils in den." accent />
      </View>
      {weakSpot ? (
        <View style={styles.note}>
          <Text style={type.body}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Weak spot: </Text>
            {weakSpot}
          </Text>
        </View>
      ) : null}
      <GlassCard radius={24} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
        <View style={styles.bestHead}>
          <Text style={type.section}>Their best</Text>
          <Text style={type.caption}>
            {info?.best.length ?? 0} of {tribe.members}
          </Text>
        </View>
        {(info?.best ?? []).map((b, i) => (
          <View key={b.user_id} style={[styles.bestRow, i > 0 && styles.sepTop]}>
            <View style={styles.thumb}>
              <Figure style={b.style} level={b.level} width={40} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong}>{b.name}</Text>
              <Text style={type.caption} numberOfLines={1}>
                {rankFor(b.level).name}
                {b.style ? ` · ${styleDef(b.style).name}` : ''}
              </Text>
            </View>
            <Tap
              accessibilityRole="button"
              accessibilityLabel={`Compare with ${b.name}`}
              onPress={() =>
                router.push({ pathname: '/tribe/compare', params: { gym: id, user: String(i) } })
              }
              style={{ alignItems: 'flex-end' }}
            >
              <Text style={[type.bodyStrong, tabular]}>{b.power}</Text>
              <Text style={type.small}>gear power</Text>
            </Tap>
          </View>
        ))}
      </GlassCard>
      <View style={styles.buttons}>
        <FillButton
          label="Compare"
          style={{ flex: 1 }}
          onPress={() =>
            router.push({ pathname: '/tribe/compare', params: { gym: id, user: '0' } })
          }
        />
        <AttackButton tribe={tribe} label="Declare attack" style={{ flex: 1.2 }} />
      </View>
      <Text style={[type.caption, { textAlign: 'center' }]}>
        Your strength {fmt(me?.strength ?? 0)} · chance to win{' '}
        {chance === 'weaker' ? 'high' : chance === 'even' ? 'even' : 'low'}
      </Text>
    </Screen>
  );
}

function Figure({ style, level, width }: { style: StyleId | null; level: number; width: number }) {
  return style ? (
    <StyleArt style={style} width={width} />
  ) : (
    <GladiatorArt rank={rankFor(level).id} width={width} />
  );
}

function Tile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <GlassCard radius={20} style={styles.tile}>
      <Text
        style={[styles.tileValue, tabular, accent && { color: colors.accent }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={type.small} numberOfLines={1}>
        {label}
      </Text>
    </GlassCard>
  );
}

// ───────────── Comparing gear ─────────────

export function CompareScreen({ gym, user }: { gym: string; user: number }) {
  const game = useMyGame();
  const mine = useGladiator().data;
  const progress = useGearProgress();
  const info = useTribeInfo(gym).data;
  const them = info?.best[user] ?? info?.best[0];
  const myLoadout: Loadout = mine?.loadout ?? {};
  const weak = weakestSlot(myLoadout);
  const next = gearInSlot(weak.slot)
    .filter((g) => g.power > worn(myLoadout, weak.slot).power && !owns(g, progress))
    .sort((a, b) => a.power - b.power)[0];

  return (
    <Screen glow="center" tabs={false} gap={14}>
      <CityTopBar title="Compare" fallback="/city/map" pill={false} />
      <GlassCard radius={24} style={styles.vs}>
        <Side
          name="You"
          sub={`${game.rank.name} · lv ${game.level}`}
          power={mine?.power ?? 0}
          mine
          figure={<Figure style={mine?.style ?? null} level={game.level} width={130} />}
        />
        <Text style={[type.rpg, styles.vsText]}>vs</Text>
        <Side
          name={them?.name ?? '—'}
          sub={them ? `${rankFor(them.level).name} · lv ${them.level}` : ''}
          power={them?.power ?? 0}
          figure={them ? <Figure style={them.style} level={them.level} width={130} /> : null}
        />
      </GlassCard>
      <Text style={[type.caption, { textAlign: 'center', marginTop: -6 }]}>gear power</Text>
      <ListGroup>
        {GEAR_SLOTS.map((s) => {
          const a = worn(myLoadout, s.id);
          const b = them ? worn(them.loadout, s.id) : null;
          return (
            <View key={s.id} style={styles.cmpRow}>
              <Text
                style={[styles.cmpSide, a.power < (b?.power ?? 0) && { color: colors.accent }]}
                numberOfLines={1}
              >
                {a.name} · {a.power}
              </Text>
              <Text style={styles.cmpSlot}>{s.name}</Text>
              <Text style={[styles.cmpSide, { textAlign: 'right' }]} numberOfLines={1}>
                {b ? `${b.name} · ${b.power}` : '—'}
              </Text>
            </View>
          );
        })}
      </ListGroup>
      <View style={styles.note}>
        <Text style={type.body}>
          Gear adds up to 15 % to your points in a war.{' '}
          {next ? (
            <>
              <Text style={{ fontWeight: '700' }}>
                Most to gain: {GEAR_SLOTS.find((x) => x.id === weak.slot)!.name.toLowerCase()}.
              </Text>{' '}
              The {next.name} opens with {unlockText(next.unlock).toLowerCase()}.
            </>
          ) : (
            'You wear the best you can get now.'
          )}
        </Text>
      </View>
      <FillButton label="To the forge" icon={Hammer} ready onPress={() => router.push('/forge')} />
    </Screen>
  );
}

function Side({
  name,
  sub,
  power,
  mine,
  figure,
}: {
  name: string;
  sub: string;
  power: number;
  mine?: boolean;
  figure: React.ReactNode;
}) {
  return (
    <View style={styles.side}>
      <View style={{ height: 143, justifyContent: 'flex-end' }}>{figure}</View>
      <Text style={type.bodyStrong}>{name}</Text>
      <Text style={type.small} numberOfLines={1}>
        {sub}
      </Text>
      <Text style={[styles.sidePower, tabular, mine && { color: colors.accent }]}>{power}</Text>
    </View>
  );
}

// ───────────── A tribe attack ─────────────

export function TribeWarScreen({ id }: { id: string }) {
  const { gymId, tribes, wars } = useMyCity();
  const war = wars.find((w) => w.id === id);
  const now = new Date(useNow(true, 30000));
  if (!war || !gymId)
    return (
      <Screen glow="center" tabs={false} gap={16}>
        <CityTopBar title="War" fallback="/city/map" pill={false} />
        <EmptyState title="No such war" text="It is not a war of your tribe." />
      </Screen>
    );
  const phase = tribeWarPhase(war, now);
  return phase === 'over' ? (
    <WarResult war={war} gymId={gymId} tribes={tribes ?? []} now={now} />
  ) : (
    <WarRunning war={war} gymId={gymId} tribes={tribes ?? []} now={now} />
  );
}

function WarRunning({
  war,
  gymId,
  tribes,
  now,
}: {
  war: TribeWar;
  gymId: string;
  tribes: CityTribeRow[];
  now: Date;
}) {
  const pledge = usePledgeDefence();
  const defending = war.defender.id === gymId;
  const enemyId = defending ? war.attacker.id : war.defender.id;
  const enemy = tribes.find((t) => t.id === enemyId);
  const me = tribes.find((t) => t.id === gymId);
  const places = cityPlaces(tribes);
  const warning = tribeWarPhase(war, now) === 'warning';
  const strongest = [...tribes].sort((a, b) => b.strength - a.strength)[0]?.id === enemyId;
  const mine = defending ? war.defender_score : war.attacker_score;
  const theirs = defending ? war.attacker_score : war.defender_score;
  const myStrength = me?.strength ?? 0;
  const theirStrength = enemy?.strength ?? 0;
  const short = theirStrength - myStrength;
  // What the loser's place would become if it lost all its territories.
  const placeAfter = (() => {
    if (!me || !enemy) return null;
    const loser = defending ? me : enemy;
    const winner = defending ? enemy : me;
    const after = cityPlaces(
      tribes.map((t) =>
        t.id === loser.id
          ? { ...t, territories: 0 }
          : t.id === winner.id
            ? { ...t, territories: t.territories + loser.territories }
            : t,
      ),
    );
    return { before: places.get(me.id) ?? 0, after: after.get(me.id) ?? 0 };
  })();
  const myMembers = me?.members ?? 0;

  return (
    <Screen glow="center" tabs={false} gap={14}>
      <CityTopBar title="" fallback="/city/map" pill={false} />
      <View style={styles.hero}>
        <View style={styles.heroKicker}>
          <Swords size={16} color={colors.white} strokeWidth={2.4} />
          <Text style={styles.heroKickerText}>
            {defending ? 'YOU ARE UNDER ATTACK' : 'YOUR ATTACK'}
          </Text>
        </View>
        <Text style={[type.rpg, styles.heroName]} numberOfLines={1}>
          Tribe {enemy?.name ?? (defending ? war.attacker.name : war.defender.name)}
        </Text>
        <Text style={styles.heroSub}>
          lv {enemy?.level ?? '?'}
          {strongest ? ` · the strongest tribe in the city` : ''}
          {war.revenge ? ' · revenge' : ''}
        </Text>
        <Text style={[styles.heroTime, tabular]}>
          {countdownText(warning ? war.starts_at : war.ends_at, now)}
        </Text>
        <Text style={styles.heroSub}>
          {warning
            ? `until the battle · it lasts ${TRIBE_WAR.days} days`
            : 'until the battle ends · verified workouts count'}
        </Text>
      </View>

      <GlassCard radius={24} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
        <Text style={[type.section, { paddingTop: 10, paddingBottom: 4 }]}>
          {defending ? 'At stake' : 'If you win'}
        </Text>
        <StakeRow
          label={defending ? 'Your territories' : 'Their territories'}
          value={
            defending
              ? (me?.territories ?? 0)
                ? me?.territories === 1
                  ? 'you lose it'
                  : `all ${me?.territories} lost`
                : 'none to lose'
              : `${enemy?.territories ?? 0} for you`
          }
        />
        <StakeRow
          label="Treasury"
          value={`${defending ? '−' : '+'}${fmt(tribeSpoils((defending ? me : enemy)?.treasury ?? 0))} denarii`}
        />
        <StakeRow label="Walls" value={defending ? 'damaged' : 'theirs damaged'} />
        {placeAfter && defending ? (
          <StakeRow
            label="Place in the city"
            value={`${placeAfter.before}. → ${placeAfter.after}.`}
            last
          />
        ) : null}
      </GlassCard>

      <GlassCard radius={22} style={{ padding: 16, gap: 8 }}>
        {warning ? (
          <>
            <View style={styles.rowBetween}>
              <Text style={type.bodyStrong}>Strength: you {fmt(myStrength)}</Text>
              <Text style={type.bodyStrong}>them {fmt(theirStrength)}</Text>
            </View>
            <SplitBar a={myStrength} b={theirStrength} />
            <Text style={type.caption}>
              {short > 0
                ? `You are ${fmt(short)} short. Every verified workout in the battle counts, and better gear adds up to 15 %.`
                : 'You are stronger now. Keep it that way: train at the gym during the battle.'}
            </Text>
          </>
        ) : (
          <>
            <View style={styles.rowBetween}>
              <Text style={type.bodyStrong}>Score: you {mine}</Text>
              <Text style={type.bodyStrong}>them {theirs}</Text>
            </View>
            <SplitBar a={mine} b={theirs} />
            <Text style={type.caption}>
              Points per active member: {WAR.perWorkout} a verified workout, +{WAR.pr} a PR, +
              {WAR.perDay} a day trained.
            </Text>
          </>
        )}
      </GlassCard>

      <GlassCard radius={22} style={styles.pledges}>
        <Users size={18} color={colors.text2} strokeWidth={2} />
        <Text style={[type.body, { flex: 1 }]}>
          <Text style={{ fontWeight: '700' }}>
            {war.pledges} of {myMembers}
          </Text>{' '}
          pledged to {defending ? 'defend' : 'fight'}
        </Text>
        <Text style={[type.captionStrong, { color: war.pledged ? colors.success : colors.accent }]}>
          {war.pledged ? 'you too' : 'not you yet'}
        </Text>
      </GlassCard>

      <FillButton
        label={war.pledged ? 'You pledged to train' : 'I pledge to train within 24 h'}
        icon={Shield}
        ready={!war.pledged}
        disabled={war.pledged}
        loading={pledge.isPending}
        onPress={() =>
          pledge.mutate(war, {
            onSuccess: () => toast('Pledged. Check in at the gym and train.'),
            onError: (e) => toast(e.message),
          })
        }
      />
      <View style={styles.buttons}>
        <FillButton
          label="Call the ludus"
          icon={Users}
          style={{ flex: 1 }}
          onPress={() => {
            router.navigate('/city/ludus');
          }}
        />
        <FillButton
          label="To the forge"
          icon={Hammer}
          style={{ flex: 1 }}
          onPress={() => router.push('/forge')}
        />
      </View>
    </Screen>
  );
}

function WarResult({
  war,
  gymId,
  tribes,
  now,
}: {
  war: TribeWar;
  gymId: string;
  tribes: CityTribeRow[];
  now: Date;
}) {
  const me = useTribeWarMe(war).data;
  const enemyTribe = tribes.find(
    (t) => t.id === (war.defender.id === gymId ? war.attacker.id : war.defender.id),
  );
  const defending = war.defender.id === gymId;
  const won = war.winner_gym === gymId;
  const mine = defending ? war.defender_score : war.attacker_score;
  const theirs = defending ? war.attacker_score : war.defender_score;
  const enemyName = defending ? war.attacker.name : war.defender.name;
  const myName = defending ? war.defender.name : war.attacker.name;
  const active = defending ? war.defender_active : war.attacker_active;
  const gap = Math.max(0, theirs - mine);
  const workouts = Math.ceil(
    (gap * Math.max(TRIBE_WAR.minActive, active)) / (WAR.perWorkout + WAR.perDay),
  );
  const until = revengeUntil(war.ends_at);
  const canRevenge = !won && defending && until > now;

  return (
    <Screen glow="center" tabs={false} gap={14}>
      <CityTopBar title="" fallback="/city/map" pill={false} />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text style={styles.kicker}>THE WAR IS OVER</Text>
        <Text style={[type.rpg, styles.verdict, won && { color: colors.accent }]}>
          {won ? 'Victory' : 'Defeat'}
        </Text>
        <Text style={type.body}>
          {won
            ? defending
              ? `${myName} held off ${enemyName}`
              : `You took ${enemyName}`
            : defending
              ? `${enemyName} took ${myName}`
              : `${enemyName} held you off`}
        </Text>
      </View>
      <GlassCard radius={24} style={{ padding: 18, gap: 10 }}>
        <View style={styles.rowBetween}>
          <Text style={[styles.score, tabular]}>{mine}</Text>
          <Text style={[type.rpg, { fontSize: 12, color: colors.text2 }]}>you · them</Text>
          <Text style={[styles.score, tabular, { color: colors.accent }]}>{theirs}</Text>
        </View>
        <SplitBar a={mine} b={theirs} dark />
        <Text style={type.caption}>
          {won
            ? `You won by ${Math.round((mine - theirs) * 10) / 10} points a member.`
            : `You were ${Math.round(gap * 10) / 10} points a member short. That is about ${workouts} verified workout${workouts === 1 ? '' : 's'}.`}
        </Text>
      </GlassCard>
      <GlassCard radius={24} style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
        <StakeRow
          label="Treasury"
          value={`${won ? '+' : '−'}${fmt(war.spoils ?? 0)} denarii`}
          good={won}
        />
        {!won && war.damaged_building ? (
          <StakeRow
            label="Damaged"
            value={
              war.damaged_building === 'palisade' ? 'the walls' : `the ${war.damaged_building}`
            }
          />
        ) : null}
        <StakeRow
          label="Territory"
          value={
            won
              ? defending
                ? 'held'
                : `${enemyName} is yours`
              : defending
                ? `${myName} lost`
                : 'nothing lost'
          }
          good={won}
        />
        <StakeRow
          label="Your part"
          value={
            me
              ? `${fmt(me.points)} points${me.place ? ` · ${me.place}. of ${me.members}` : ''}`
              : '—'
          }
          neutral
          last
        />
      </GlassCard>
      {canRevenge && enemyTribe ? (
        <GlassCard radius={24} style={styles.revenge}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Flame size={18} color={colors.accent} strokeWidth={2.2} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.bodyStrong}>Revenge</Text>
              <Text style={type.caption}>
                Within {countdownText(until, now)} with +{Math.round(TRIBE_WAR.revengeBonus * 100)}{' '}
                % points and no cost.
              </Text>
            </View>
          </View>
          <AttackButton tribe={enemyTribe} label="Declare revenge" />
        </GlassCard>
      ) : null}
      <View style={styles.buttons}>
        <FillButton
          label="Better gear"
          icon={Hammer}
          style={{ flex: 1 }}
          onPress={() => router.push('/forge')}
        />
        <FillButton
          label="Repair walls"
          icon={Shield}
          style={{ flex: 1 }}
          onPress={() => {
            router.navigate({ pathname: '/city/colosseum', params: { mode: 'bellum' } });
          }}
        />
      </View>
    </Screen>
  );
}

function StakeRow({
  label,
  value,
  last,
  good,
  neutral,
}: {
  label: string;
  value: string;
  last?: boolean;
  good?: boolean;
  neutral?: boolean;
}) {
  return (
    <View style={[styles.stake, !last && styles.sepBottom]}>
      <Text style={type.body}>{label}</Text>
      <Text
        style={[
          type.bodyStrong,
          tabular,
          { color: neutral ? colors.text : good ? colors.success : colors.accent },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function SplitBar({ a, b, dark }: { a: number; b: number; dark?: boolean }) {
  const total = a + b;
  const share = total > 0 ? a / total : 0.5;
  return (
    <View style={styles.split}>
      <View style={{ flex: share, backgroundColor: dark ? colors.text : colors.accent }} />
      <View style={{ width: 3 }} />
      <View style={{ flex: 1 - share, backgroundColor: dark ? colors.accent : colors.text }} />
    </View>
  );
}

// ───────────── On Today ─────────────

/** A running war of my tribe: a red card on Today that opens it. */
export function TribeWarAlert() {
  const gymId = useData((s) => s.profile?.home_gym_id ?? null);
  const wars = useTribeWars(gymId).data;
  const now = new Date(useNow(true, 60000));
  const war = wars?.find((w) => !w.settled_at && tribeWarPhase(w, now) !== 'over');
  if (!war || !gymId) return null;
  const defending = war.defender.id === gymId;
  const warning = tribeWarPhase(war, now) === 'warning';
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel="Open the war"
      onPress={() => router.push({ pathname: '/tribe/war/[id]', params: { id: war.id } })}
    >
      <View style={styles.alert}>
        <Swords size={20} color={colors.white} strokeWidth={2.4} />
        <View style={{ flex: 1 }}>
          <Text style={styles.alertTitle} numberOfLines={1}>
            {defending ? `${war.attacker.name} attacks you` : `Your attack on ${war.defender.name}`}
          </Text>
          <Text style={styles.alertSub} numberOfLines={1}>
            {warning
              ? `The battle starts in ${countdownText(war.starts_at, now)}`
              : `${countdownText(war.ends_at, now)} left · you ${defending ? war.defender_score : war.attacker_score} · them ${defending ? war.attacker_score : war.defender_score}`}
          </Text>
        </View>
      </View>
    </Tap>
  );
}

/** City → Colosseum → Bellum: the way to the map. */
export function MapRow() {
  const gymId = useData((s) => s.profile?.home_gym_id ?? null);
  const gym = useGym(gymId).data?.gym;
  if (!gym?.city) return null;
  return (
    <ListGroup>
      <ListRow
        title={`Map of ${gym.city}`}
        subtitle="Tribes, territories and attacks"
        left={<Swords size={20} color={colors.accent} strokeWidth={2} />}
        onPress={() => router.push('/city/map')}
      />
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: 20, overflow: 'hidden' },
  hit: { position: 'absolute', width: 52, height: 52, borderRadius: 26 },
  tribeCard: { padding: 16, gap: 14 },
  tribeHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  loot: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  buttons: { flexDirection: 'row', gap: 10 },
  enemyChips: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  darkPill: {
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  darkPillText: { color: colors.white, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, padding: 12, gap: 2 },
  tileValue: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  note: { backgroundColor: colors.fill, borderRadius: 18, padding: 14 },
  bestHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 10,
  },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  sepTop: { borderTopWidth: 0.5, borderTopColor: colors.separator },
  sepBottom: { borderBottomWidth: 0.5, borderBottomColor: colors.separator },
  thumb: {
    width: 44,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vs: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  vsText: { fontSize: 13, color: colors.text2 },
  side: { flex: 1, alignItems: 'center', gap: 1 },
  sidePower: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.text,
    marginTop: 4,
  },
  cmpRow: { flexDirection: 'row', alignItems: 'center', minHeight: 46, gap: 6 },
  cmpSide: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  cmpSlot: { width: 62, textAlign: 'center', fontSize: 12, color: colors.text2 },
  hero: { backgroundColor: colors.accent, borderRadius: 24, padding: 18, gap: 4 },
  heroKicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroKickerText: { color: colors.white, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  heroName: { color: colors.white, fontSize: 24, marginTop: 2 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13 },
  heroTime: {
    color: colors.white,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 6,
  },
  stake: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    gap: 10,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  split: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  pledges: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: colors.text2 },
  verdict: { fontSize: 40, letterSpacing: 3 },
  score: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, color: colors.text },
  revenge: { padding: 16, gap: 12, borderWidth: 1.5, borderColor: colors.accent },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accent,
    borderRadius: 22,
    padding: 16,
  },
  alertTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  alertSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13 },
});
