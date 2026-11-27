/**
 * A grid you build on (Matyáš, 2026-11-27): the training ground of your ludus or your tribe, or
 * your own house (lib/game/grounds.ts). The heart stands in the middle; pick something in Build,
 * then tap a free tile next to what is built. The ludus and the tribe pay from their hours and
 * nothing moves; your house pays from your own hours and you may move its pieces.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Path, Polygon } from 'react-native-svg';

import { FillButton, IconButton } from '@/components/Buttons';
import {
  ChevronLeft,
  Hammer,
  Hourglass,
  Maximize2,
  Minus,
  Move,
  Plus,
  X,
} from '@/components/icons';
import { drawOrder, edgeOfCity, parseTile, STREET, tilesOf } from '@/lib/game/cityGrid';
import {
  buildingDef,
  buildingsFor,
  currentLevel,
  fortressLevel,
  fortressStage,
  levelMinutes,
  repairMinutes,
  timeLeftText,
  underConstruction,
  type Building,
  type BuildingId,
} from '@/lib/game/fortress';
import {
  buildingPicture,
  buyBlock,
  groundFits,
  groundLayout,
  groundMinutes,
  groundSize,
  GROUND_ITEM,
  GROUND_ITEMS,
  isBuilding,
  ROOT,
  rootPicture,
  type GroundGroup,
  type GroundKind,
  type GroundPiece,
} from '@/lib/game/grounds';
import { formatMinutes, houseName } from '@/lib/game/hours';
import { useGym } from '@/features/social/api';
import { confirm, toast } from '@/stores/ui';
import { space } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/motion';
import {
  useBuildOnGround,
  useBuyGroundPiece,
  useFortress,
  useGround,
  useHouse,
  useMoveHomePiece,
  useMyLudus,
  usePlaceOwned,
  useRepairBuilding,
  useStartBuilding,
} from '../api';
import { createMapControl, Drop } from './PaintedCity';
import { CITY_PIECES, CITY_RATIO, CITY_TILE } from './pieces';

const paper = '#F2EBDB';
const paperDeep = '#E8DEC8';
const ink = '#2B2118';
const inkMuted = '#6B5C48';
const card = 'rgba(255,251,243,0.94)';
const line = 'rgba(59,47,34,0.14)';
const red = '#B91C1C';
const display = 'Cinzel_700Bold';

const K = 0.4;
const TW = CITY_TILE * K;
const TH = TW / CITY_RATIO;
const THICK = 12;
const WEB_LAYER = Platform.OS === 'web' ? ({ willChange: 'transform' } as object) : null;

const gridPoint = (i: number, j: number, z: number): [number, number] => [
  (((i - j) * TW) / 2) * z,
  (((i + j) * TH) / 2) * z,
];
const diamond = (i: number, j: number, n: number, z: number) =>
  [gridPoint(i, j, z), gridPoint(i + n, j, z), gridPoint(i + n, j + n, z), gridPoint(i, j + n, z)]
    .map((p) => p.join(','))
    .join(' ');

const TABS: Record<GroundKind, { id: GroundGroup; label: string }[]> = {
  ludus: [
    { id: 'buildings', label: 'Buildings' },
    { id: 'drill', label: 'Drill' },
    { id: 'walls', label: 'Walls' },
    { id: 'decor', label: 'Decor' },
  ],
  gym: [
    { id: 'buildings', label: 'Buildings' },
    { id: 'drill', label: 'Drill' },
    { id: 'walls', label: 'Walls' },
    { id: 'decor', label: 'Decor' },
  ],
  home: [
    { id: 'house', label: 'By the house' },
    { id: 'drill', label: 'Training' },
    { id: 'decor', label: 'Decor' },
  ],
};

/** Something in the Build palette. */
interface Offer {
  id: string;
  name: string;
  picture: string;
  /** "6 h", "Free" (owned before the grids). */
  price: string;
  /** Why not now. */
  block: string | null;
  how: 'buy' | 'build' | 'place';
}

export function PaintedGround({ kind, id }: { kind: GroundKind; id?: string | null }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const ground = useGround(kind, id);
  const fortress = useFortress(kind === 'home' ? 'ludus' : kind, kind === 'home' ? null : id);
  const house = useHouse();
  const ludus = useMyLudus().data;
  const gym = useGym(kind === 'gym' ? id : null).data?.gym;
  const buy = useBuyGroundPiece();
  const buildOn = useBuildOnGround();
  const placeOwned = usePlaceOwned();
  const moveHome = useMoveHomePiece();
  const startBuilding = useStartBuilding();
  const repair = useRepairBuilding();

  const now = new Date();
  const pieces: GroundPiece[] = ground.data ?? [];
  const buildings: Building[] = kind === 'home' ? [] : (fortress.data?.buildings ?? []);
  const minutes = kind === 'home' ? (house.data?.minutes ?? 0) : (fortress.data?.treasury ?? 0);
  const houseLevel = house.data?.level ?? 1;
  const stage = fortressStage(fortressLevel(buildings, now));
  const busy = buildings.some((b) => underConstruction(b, now));

  const [mode, setMode] = useState<'view' | 'build'>('view');
  const [tab, setTab] = useState<GroundGroup>(kind === 'home' ? 'house' : 'buildings');
  const [selected, setSelected] = useState<number | null>(null);
  const [placing, setPlacing] = useState<{ offer: Offer; moving?: string } | null>(null);
  const [ghost, setGhost] = useState<{ i: number; j: number; ok: boolean } | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [fitted, setFitted] = useState(false);
  const [z, setZ] = useState(1);
  const [map] = useState(createMapControl);
  const rootRef = useRef<View>(null);

  const sizeOf = (x: string) => groundSize(kind, x);
  const pictureOf = (piece: string) => {
    const pic =
      piece === ROOT
        ? rootPicture(kind, stage, houseLevel)
        : isBuilding(piece)
          ? buildingPicture(
              buildings.find((b) => b.building === piece),
              now,
            )
          : piece;
    return CITY_PIECES[pic] ? pic : `plot-${sizeOf(piece)}`;
  };
  const nameOf = (piece: string) =>
    piece === ROOT
      ? kind === 'home'
        ? houseName(houseLevel)
        : kind === 'gym'
          ? 'Arena'
          : 'School'
      : isBuilding(piece)
        ? buildingDef(piece).name
        : (GROUND_ITEM[piece]?.name ?? piece);

  /** Where a piece's picture goes: a little in from its plot. */
  const spriteBox = (p: { i: number; j: number; id: string }, picture: string, zoom: number) => {
    const s = sizeOf(p.id);
    const pic = CITY_PIECES[picture];
    const scale = ((s - 2 * STREET) / s) * K * zoom;
    const [bx, by] = gridPoint(p.i + s - STREET, p.j + s - STREET, zoom);
    return {
      left: bx - pic.anchor[0] * scale,
      top: by - pic.anchor[1] * scale,
      width: pic.width * scale,
      height: pic.height * scale,
    };
  };

  const layout = groundLayout(pieces);
  const uuidOf = (key: number) => (key > 0 ? pieces[key - 1]?.id : undefined);

  // ── fitting it into the screen ──
  const topSpace = insets.top + 100;
  const sheetSpace = insets.bottom + space.tabBarBottom + space.tabBarHeight + 170;
  const fit = (w = box.w, h = box.h) => {
    if (!w || !h) return;
    const boxes = layout.map((p) => spriteBox(p, pictureOf(p.id), 1));
    const x0 = Math.min(...boxes.map((b) => b.left)) - 30;
    const x1 = Math.max(...boxes.map((b) => b.left + b.width)) + 30;
    const y0 = Math.min(...boxes.map((b) => b.top)) - 20;
    const y1 = Math.max(...boxes.map((b) => b.top + b.height)) + THICK + 30;
    const availH = Math.max(160, h - topSpace - sheetSpace);
    const zoom = Math.min(1.5, Math.max(0.3, Math.min(w / (x1 - x0), availH / (y1 - y0))));
    setZ(zoom);
    map.set(w / 2 - ((x0 + x1) / 2) * zoom, topSpace + availH / 2 - ((y0 + y1) / 2) * zoom);
  };
  // the map is drawn once its data is in, so its first layout can fit it
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
    rootRef.current?.measureInWindow((x, y) => map.setOrigin(x, y));
    if (!fitted && width && height) {
      setFitted(true);
      fit(width, height);
    }
  };
  const ready = !!ground.data && (kind === 'home' ? !!house.data : !!fortress.data);
  const zoomBy = (f: number, cx = box.w / 2, cy = box.h / 2) => {
    const next = Math.min(2.5, Math.max(0.3, z * f));
    const p = map.at();
    map.set(cx - ((cx - p.x) / z) * next, cy - ((cy - p.y) / z) * next);
    setZ(next);
  };

  // ── a point on the screen to a tile ──
  const tileAt = (sx: number, sy: number): [number, number] => {
    const p = map.at();
    const x = (sx - p.x) / z;
    const y = (sy - p.y) / z;
    const a = x / (TW / 2);
    const b = y / (TH / 2);
    return [Math.floor((a + b) / 2), Math.floor((b - a) / 2)];
  };
  const ghostAt = (sx: number, sy: number, piece: string, moving?: string) => {
    const [ti, tj] = tileAt(sx, sy);
    const n = sizeOf(piece);
    const i = ti - Math.floor((n - 1) / 2);
    const j = tj - Math.floor((n - 1) / 2);
    return { i, j, ok: groundFits(kind, pieces, piece, i, j, moving) };
  };

  // ── buying, building, placing, moving ──
  const put = async (offer: Offer, i: number, j: number, moving?: string) => {
    const ok = moving
      ? true
      : await confirm({
          title: offer.how === 'place' ? `Put ${offer.name} here?` : `Build ${offer.name} here?`,
          message:
            offer.how === 'place'
              ? 'It is yours already, so it is free.'
              : kind === 'home'
                ? `It costs ${offer.price} of your own hours. You can move it later.`
                : `It costs ${offer.price} of the hours. Nothing moves once it stands.`,
          confirmLabel: offer.how === 'place' ? 'Put it here' : 'Build',
        });
    if (!ok) return;
    const spot = { kind, id, i, j };
    const after = {
      onSuccess: () => {
        setDropped(`${offer.id}:${i}:${j}`);
        toast(moving ? `${offer.name} moved` : `${offer.name} is yours`, true);
      },
      onError: (e: Error) => toast(e.message),
    };
    if (moving) moveHome.mutate({ pieceId: moving, i, j }, after);
    else if (offer.how === 'buy') buy.mutate({ ...spot, piece: offer.id }, after);
    else if (offer.how === 'place') placeOwned.mutate({ ...spot, piece: offer.id }, after);
    else buildOn.mutate({ ...spot, building: offer.id as BuildingId }, after);
  };
  const tap = (sx: number, sy: number) => {
    if (placing) {
      const g = ghostAt(sx, sy, placing.offer.id, placing.moving);
      setGhost(g);
      if (!g.ok) return toast('It has to touch what is built, on free tiles.');
      const { offer, moving } = placing;
      setPlacing(null);
      setGhost(null);
      void put(offer, g.i, g.j, moving);
      return;
    }
    const [ti, tj] = tileAt(sx, sy);
    const key = tilesOf(layout, sizeOf).get(`${ti},${tj}`) ?? null;
    setSelected(key);
  };
  const hover = (sx: number, sy: number) => {
    if (!placing) return;
    const g = ghostAt(sx, sy, placing.offer.id, placing.moving);
    if (!ghost || g.i !== ghost.i || g.j !== ghost.j) setGhost(g);
  };
  useEffect(() => {
    map.use({ tap, zoom: zoomBy, hover, z });
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = rootRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = node.getBoundingClientRect();
      map.zoom(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = node.getBoundingClientRect();
      map.hover(e.clientX - r.left, e.clientY - r.top);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    node.addEventListener('pointermove', move);
    return () => {
      node.removeEventListener('wheel', wheel);
      node.removeEventListener('pointermove', move);
    };
  }, [map]);

  // ── what can be built ──
  const offers: Offer[] =
    tab === 'buildings' && kind !== 'home'
      ? buildingsFor(kind).flatMap((def): Offer[] => {
          if (pieces.some((p) => p.piece === def.id)) return [];
          const b = buildings.find((x) => x.building === def.id);
          const owned = !!b && (b.level > 0 || !!b.target_level);
          const cost = levelMinutes(def.id, 1, kind);
          return [
            {
              id: def.id,
              name: def.name,
              picture: `${def.id === 'palisade' ? 'gate' : def.id}-1`,
              price: owned ? 'Free' : formatMinutes(cost),
              block: owned
                ? null
                : busy
                  ? 'One building at a time'
                  : minutes < cost
                    ? `Needs ${formatMinutes(cost)}`
                    : null,
              how: owned ? 'place' : 'build',
            },
          ];
        })
      : GROUND_ITEMS.filter((x) => x.group === tab && x.kinds.includes(kind) && CITY_PIECES[x.id])
          .filter((x) => !(x.once && pieces.some((p) => p.piece === x.id)))
          .map((x): Offer => {
            const owned =
              kind === 'home' && !!x.once && (house.data?.items ?? []).includes(x.id as never);
            return {
              id: x.id,
              name: x.name,
              picture: x.id,
              price: owned ? 'Free' : formatMinutes(groundMinutes(kind, x.id) ?? 0),
              block: owned ? null : buyBlock(kind, pieces, x.id, minutes),
              how: owned ? 'place' : 'buy',
            };
          });

  // ── what is drawn ──
  const shown = layout.filter((p) => uuidOf(p.key) == null || uuidOf(p.key) !== placing?.moving);
  const tiles = tilesOf(shown, sizeOf);
  const edge = placing ? edgeOfCity(shown, sizeOf) : new Set<string>();
  const sprites = [
    ...shown,
    ...(placing && ghost ? [{ key: -1, id: placing.offer.id, i: ghost.i, j: ghost.j }] : []),
  ];
  const ordered = drawOrder(sprites, sizeOf);
  const groundKeys = [...tiles.keys(), ...edge];
  const corners = groundKeys.flatMap((k) => {
    const [i, j] = parseTile(k);
    return [
      gridPoint(i, j, z),
      gridPoint(i + 1, j + 1, z),
      gridPoint(i + 1, j, z),
      gridPoint(i, j + 1, z),
    ];
  });
  const gx = Math.min(0, ...corners.map((c) => c[0])) - 4;
  const gy = Math.min(0, ...corners.map((c) => c[1])) - 4;
  const gw = Math.max(1, ...corners.map((c) => c[0])) - gx + 4;
  const gh = Math.max(1, ...corners.map((c) => c[1])) - gy + THICK + 4;
  const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  let groundPath = '';
  let earthLeft = '';
  let earthRight = '';
  for (const k of tiles.keys()) {
    const [i, j] = parseTile(k);
    const T = gridPoint(i, j, z);
    const L = gridPoint(i, j + 1, z);
    const B = gridPoint(i + 1, j + 1, z);
    const R = gridPoint(i + 1, j, z);
    groundPath += `M${pt(T)}L${pt(R)}L${pt(B)}L${pt(L)}Z`;
    if (!tiles.has(`${i},${j + 1}`))
      earthLeft += `M${pt(L)}L${pt(B)}L${pt([B[0], B[1] + THICK])}L${pt([L[0], L[1] + THICK])}Z`;
    if (!tiles.has(`${i + 1},${j}`))
      earthRight += `M${pt(B)}L${pt(R)}L${pt([R[0], R[1] + THICK])}L${pt([B[0], B[1] + THICK])}Z`;
  }
  const groundColor = kind === 'home' ? '#A8A56E' : '#D6C291';
  const sel = layout.find((p) => p.key === selected) ?? null;
  const panelBottom = insets.bottom + space.tabBarBottom + space.tabBarHeight + 12;

  const title =
    kind === 'home'
      ? { eyebrow: 'YOUR DOMUS', name: houseName(houseLevel) }
      : kind === 'gym'
        ? { eyebrow: 'TRIBE · TRAINING GROUND', name: gym?.name ?? 'Your tribe' }
        : { eyebrow: 'LUDUS · TRAINING GROUND', name: ludus?.name ?? 'Your ludus' };

  return (
    <View style={styles.root}>
      {!ready ? (
        <Text style={[styles.text, styles.loading]}>
          {ground.isError ? 'Could not load. Are you online?' : 'Loading…'}
        </Text>
      ) : null}
      {ready ? (
        <View
          ref={rootRef}
          style={StyleSheet.absoluteFill}
          onLayout={onLayout}
          {...map.panHandlers}
        >
          <Animated.View
            style={[
              styles.layer,
              WEB_LAYER,
              { transform: [{ translateX: map.pan.x }, { translateY: map.pan.y }] },
            ]}
          >
            <Svg width={gw} height={gh} style={{ position: 'absolute', left: gx, top: gy }}>
              <G transform={`translate(${-gx} ${-gy})`}>
                <Path d={earthLeft} fill="#7A5A3A" />
                <Path d={earthRight} fill="#5E4329" />
                <Path d={groundPath} fill={groundColor} stroke={groundColor} strokeWidth={0.8} />
                {[...edge].map((k) => {
                  const [i, j] = parseTile(k);
                  return (
                    <Polygon
                      key={k}
                      points={diamond(i, j, 1, z)}
                      fill="#FFFFFF"
                      fillOpacity={0.5}
                      stroke={inkMuted}
                      strokeOpacity={0.55}
                      strokeDasharray="5 4"
                    />
                  );
                })}
                {sel && !placing ? (
                  <Polygon
                    points={diamond(sel.i, sel.j, sizeOf(sel.id), z)}
                    fill="none"
                    stroke={red}
                    strokeWidth={2.5}
                  />
                ) : null}
                {placing && ghost ? (
                  <Polygon
                    points={diamond(ghost.i, ghost.j, sizeOf(placing.offer.id), z)}
                    fill={ghost.ok ? '#34C759' : '#FF3B30'}
                    fillOpacity={0.35}
                    stroke={ghost.ok ? '#1E7B34' : red}
                    strokeWidth={2.5}
                  />
                ) : null}
              </G>
            </Svg>
            {ordered.map((p) => {
              const picture = p.key === -1 ? placing!.offer.picture : pictureOf(p.id);
              if (!CITY_PIECES[picture]) return null;
              const b = spriteBox(p, picture, z);
              const tag = `${p.id}:${p.i}:${p.j}`;
              return (
                <View
                  key={p.key === -1 ? 'ghost' : `${p.key}:${p.id}`}
                  style={{
                    position: 'absolute',
                    left: b.left,
                    top: b.top,
                    width: b.width,
                    height: b.height,
                  }}
                  pointerEvents="none"
                >
                  <Drop on={dropped === tag && !reduced}>
                    <Image
                      source={CITY_PIECES[picture].image}
                      style={{ width: b.width, height: b.height, opacity: p.key === -1 ? 0.72 : 1 }}
                      contentFit="fill"
                      accessible={false}
                    />
                  </Drop>
                </View>
              );
            })}
          </Animated.View>
        </View>
      ) : null}

      <View style={[styles.top, { top: insets.top + 10 }]}>
        <IconButton
          icon={ChevronLeft}
          size={40}
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/city'))}
        />
        <View style={{ flex: 1, gap: 2 }} pointerEvents="none">
          <Text style={styles.eyebrow}>{title.eyebrow}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {title.name}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {formatMinutes(minutes)} {kind === 'home' ? 'of your own hours' : 'to build with'}
          </Text>
        </View>
      </View>
      <View style={[styles.zoom, { bottom: panelBottom + 190 }]}>
        <IconButton
          icon={Plus}
          size={40}
          accessibilityLabel="Zoom in"
          onPress={() => zoomBy(1.25)}
        />
        <IconButton
          icon={Minus}
          size={40}
          accessibilityLabel="Zoom out"
          onPress={() => zoomBy(0.8)}
        />
        <IconButton
          icon={Maximize2}
          size={40}
          accessibilityLabel="Whole ground"
          onPress={() => fit()}
        />
      </View>

      <View style={[styles.panel, { bottom: panelBottom }]}>
        {placing ? (
          <View style={styles.row}>
            <Text style={[styles.text, { flex: 1 }]}>
              {placing.moving
                ? `Tap where ${placing.offer.name} should go.`
                : `Tap a free tile next to what is built for ${placing.offer.name}.`}
            </Text>
            <IconButton
              icon={X}
              size={36}
              accessibilityLabel="Cancel"
              onPress={() => {
                setPlacing(null);
                setGhost(null);
              }}
            />
          </View>
        ) : mode === 'build' ? (
          <View style={{ gap: 10 }}>
            <View style={styles.row}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {TABS[kind].map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setTab(t.id)}
                    style={[styles.tab, tab === t.id && styles.tabOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === t.id }}
                  >
                    <Text style={styles.tabText}>{t.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <FillButton label="Done" size="sm" onPress={() => setMode('view')} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {offers.length ? (
                offers.map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      if (o.block) return toast(o.block);
                      setSelected(null);
                      setPlacing({ offer: o });
                    }}
                    style={[styles.card, o.block && { opacity: 0.5 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${o.name}, ${o.price}${o.block ? `, ${o.block}` : ''}`}
                  >
                    {CITY_PIECES[o.picture] ? (
                      <Image
                        source={CITY_PIECES[o.picture].image}
                        style={styles.cardImg}
                        contentFit="contain"
                      />
                    ) : (
                      <View style={styles.cardImg} />
                    )}
                    <Text style={styles.cardName} numberOfLines={1}>
                      {o.name}
                    </Text>
                    <Text
                      style={[styles.cardPrice, o.price === 'Free' && { color: red }]}
                      numberOfLines={1}
                    >
                      {o.block ?? o.price}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.text}>Everything here stands already.</Text>
              )}
            </ScrollView>
          </View>
        ) : sel ? (
          <Selected
            kind={kind}
            piece={sel.id}
            name={nameOf(sel.id)}
            picture={pictureOf(sel.id)}
            building={isBuilding(sel.id) ? buildings.find((b) => b.building === sel.id) : undefined}
            busy={busy}
            minutes={minutes}
            onUpgrade={(building) =>
              startBuilding.mutate(
                { kind: kind as 'ludus' | 'gym', id: id!, building },
                {
                  onSuccess: () => toast('Building started', true),
                  onError: (e) => toast(e.message),
                },
              )
            }
            onRepair={(building) =>
              repair.mutate(
                { kind: kind as 'ludus' | 'gym', id: id!, building },
                { onSuccess: () => toast('Repaired', true), onError: (e) => toast(e.message) },
              )
            }
            onMove={
              kind === 'home' && sel.key > 0
                ? () => {
                    const uuid = uuidOf(sel.key)!;
                    setPlacing({
                      offer: {
                        id: sel.id,
                        name: nameOf(sel.id),
                        picture: pictureOf(sel.id),
                        price: '',
                        block: null,
                        how: 'buy',
                      },
                      moving: uuid,
                    });
                    setSelected(null);
                  }
                : undefined
            }
            onClose={() => setSelected(null)}
          />
        ) : (
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.panelTitle}>
                {kind === 'home' ? 'Around your house' : 'Your training ground'}
              </Text>
              <Text style={styles.text}>
                {pieces.length} built · {formatMinutes(minutes)}
                {kind === 'home' ? ' of your own' : ' to build with'}
              </Text>
            </View>
            <FillButton label="Build" icon={Hammer} size="sm" onPress={() => setMode('build')} />
          </View>
        )}
      </View>
    </View>
  );
}

/** The chosen piece: what it is, its level and what the next one costs. */
function Selected({
  kind,
  piece,
  name,
  picture,
  building,
  busy,
  minutes,
  onUpgrade,
  onRepair,
  onMove,
  onClose,
}: {
  kind: GroundKind;
  piece: string;
  name: string;
  picture: string;
  building?: Building;
  busy: boolean;
  minutes: number;
  onUpgrade: (b: BuildingId) => void;
  onRepair: (b: BuildingId) => void;
  onMove?: () => void;
  onClose: () => void;
}) {
  const now = new Date();
  const def = isBuilding(piece) ? buildingDef(piece) : null;
  const level = building ? currentLevel(building, now) : 0;
  const top = def ? level >= def.maxLevel : true;
  const fortressKind = kind === 'home' ? 'ludus' : kind;
  const next = def ? levelMinutes(def.id, level + 1, fortressKind) : 0;
  const repairCost =
    def && building?.damaged ? repairMinutes(def.id, Math.max(1, level), fortressKind) : 0;
  const text = def
    ? building?.damaged
      ? 'Damaged in a war: no effect until repaired'
      : underConstruction(building, now) && building?.ready_at
        ? `Level ${building.target_level} in ${timeLeftText(building.ready_at, now)}`
        : def.effect(Math.max(1, level), fortressKind)
    : piece === ROOT
      ? kind === 'home'
        ? 'Upgrade it in Your domus with your own hours'
        : 'Grows with the fortress: every building level counts'
      : kind === 'home'
        ? 'Yours. You can move it.'
        : 'It stands for good.';
  return (
    <View style={styles.sheet}>
      <View style={styles.thumb}>
        {CITY_PIECES[picture] ? (
          <Image source={CITY_PIECES[picture].image} style={styles.thumbImg} contentFit="contain" />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {name}
          {def ? <Text style={styles.sheetLevel}>{`  lv ${level}`}</Text> : null}
        </Text>
        <Text style={styles.text} numberOfLines={2}>
          {text}
        </Text>
        <View style={styles.row}>
          {def && building?.damaged ? (
            <FillButton
              label={`Repair · ${formatMinutes(repairCost)}`}
              size="sm"
              icon={Hammer}
              disabled={minutes < repairCost}
              onPress={() => onRepair(def.id)}
            />
          ) : def && !top && !underConstruction(building, now) ? (
            <FillButton
              label={`Lv ${level + 1} · ${formatMinutes(next)}`}
              size="sm"
              icon={Hammer}
              disabled={busy || minutes < next}
              onPress={() => onUpgrade(def.id)}
            />
          ) : null}
          {def && busy && !underConstruction(building, now) && !top ? (
            <View style={styles.row}>
              <Hourglass size={13} color={inkMuted} />
              <Text style={styles.small}>One building at a time</Text>
            </View>
          ) : null}
          {onMove ? <FillButton label="Move" size="sm" icon={Move} onPress={onMove} /> : null}
        </View>
      </View>
      <IconButton icon={X} size={36} accessibilityLabel="Close" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper, overflow: 'hidden' },
  loading: { position: 'absolute', top: '45%', alignSelf: 'center' },
  layer: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
  top: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: { fontFamily: display, fontSize: 11, letterSpacing: 2.4, color: red },
  name: { fontFamily: display, fontSize: 22, color: ink, letterSpacing: 0.4 },
  sub: { fontSize: 13, color: inkMuted },
  zoom: { position: 'absolute', right: 16, gap: 8 },
  panel: {
    position: 'absolute',
    left: space.tabBarSide - 8,
    right: space.tabBarSide - 8,
    maxWidth: 640,
    alignSelf: 'center',
    marginHorizontal: 'auto',
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: line,
    padding: 14,
    boxShadow: '0 6px 24px rgba(59,47,34,0.12)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  panelTitle: { fontFamily: display, fontSize: 16, color: ink },
  text: { fontSize: 13.5, lineHeight: 19, color: inkMuted },
  small: { fontSize: 12, color: inkMuted },
  sheet: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: paper,
    borderWidth: 1,
    borderColor: line,
  },
  thumbImg: { width: '100%', height: '100%', transform: [{ scale: 1.35 }] },
  sheetTitle: { fontFamily: display, fontSize: 17, color: ink },
  sheetLevel: { fontFamily: undefined, fontSize: 13, color: inkMuted },
  tab: { paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center' },
  tabOn: { backgroundColor: paperDeep },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: inkMuted,
    textTransform: 'uppercase',
  },
  card: {
    width: 100,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: line,
    backgroundColor: paper,
    gap: 2,
  },
  cardImg: { width: '100%', height: 58 },
  cardName: { fontSize: 12.5, fontWeight: '600', color: ink },
  cardPrice: { fontSize: 11.5, color: inkMuted },
});
