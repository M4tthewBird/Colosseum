/**
 * The City tab as a painted, modular city (docs/PAINTED-UI.md, docs/GAME.md §9): the player's
 * buildings on an isometric grid, pins with what each place is doing, and a sheet to enter it.
 * "Edit city" shows the grid: a new piece goes on free tiles touching the city; pieces can be
 * upgraded, moved and removed as long as the city stays in one piece. The ground under the city
 * is paved and every piece stands a little in from its plot, so streets run between neighbours
 * and change with the city.
 */
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  Path,
  Pattern,
  Polygon,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { FillButton, IconButton } from '@/components/Buttons';
import { ChevronRight, Hammer, Maximize2, Minus, Plus, X } from '@/components/icons';
import { space } from '@/theme/tokens';
import { useReducedMotion } from '@/theme/motion';
import {
  drawOrder,
  edgeOfCity,
  fits,
  parseTile,
  STREET,
  staysWhole,
  tilesOf,
  type Placed,
} from '@/lib/game/cityGrid';
import { homeStage } from '@/lib/game/attributes';
import { fortressLevel, fortressStage } from '@/lib/game/fortress';
import { GEAR_ITEMS, owns } from '@/lib/game/gear';
import { useGym } from '@/features/social/api';
import { useData } from '@/stores/data';
import { toast } from '@/stores/ui';
import { useFortress, useMyLudus } from '../api';
import { useTribeWars } from '../cityApi';
import { DenariiPill } from '../CityViews';
import { chooseGame, useGameOn } from '../gameMode';
import { useGearProgress, useMyGame } from '../hooks';
import { startingCity, useCityLayout } from './layout';
import { CITY_PAVING, CITY_PIECES, CITY_RATIO, CITY_TILE } from './pieces';
import {
  EFFECTS,
  GROWS,
  levelsOf,
  PALETTE,
  PIECE,
  placeOf,
  sizeOf,
  type CityGroup,
  type Effect,
  type Place,
} from './places';

// The painted world's own palette (docs/PAINTED-UI.md §4), used only here.
const paper = '#F2EBDB';
const paperDeep = '#E8DEC8';
const ink = '#2B2118';
const inkMuted = '#6B5C48';
const card = 'rgba(255,251,243,0.94)';
const line = 'rgba(59,47,34,0.14)';
const red = '#B91C1C';
const display = 'Cinzel_700Bold';

/** Screen px per picture px at zoom 1: a tile is 128 px wide. */
const K = 0.4;
const TW = CITY_TILE * K;
const TH = TW / CITY_RATIO;
const THICK = 12;
const PAVE = 512;
const BUILD_MS = 1300;
/** On the web the panned map gets its own compositor layer, so dragging it repaints nothing. */
const WEB_LAYER = Platform.OS === 'web' ? ({ willChange: 'transform' } as object) : null;

type Mode = 'view' | 'build';

const gridPoint = (i: number, j: number, z: number): [number, number] => [
  (((i - j) * TW) / 2) * z,
  (((i + j) * TH) / 2) * z,
];
const diamond = (i: number, j: number, n: number, z: number) =>
  [gridPoint(i, j, z), gridPoint(i + n, j, z), gridPoint(i + n, j + n, z), gridPoint(i, j + n, z)]
    .map((p) => p.join(','))
    .join(' ');

/** Where a piece's picture goes: a little in from its plot, so the street shows around it. */
function spriteBox(p: { i: number; j: number; id: string }, picture: string, z: number) {
  const s = sizeOf(p.id);
  const pic = CITY_PIECES[picture];
  const scale = ((s - 2 * STREET) / s) * K * z;
  const [bx, by] = gridPoint(p.i + s - STREET, p.j + s - STREET, z);
  return {
    left: bx - pic.anchor[0] * scale,
    top: by - pic.anchor[1] * scale,
    width: pic.width * scale,
    height: pic.height * scale,
    scale,
  };
}

/** What each place is doing, from the player's own game. */
function useStatuses(): Record<string, { text: string; hot?: boolean }> {
  const gymId = useData((s) => s.profile?.home_gym_id ?? null);
  const tribe = useFortress('gym', gymId).data;
  const ludus = useMyLudus().data;
  const game = useMyGame();
  const progress = useGearProgress();
  const wars = useTribeWars(gymId).data;
  const now = new Date();
  const level = (b?: { level: number }) => b?.level ?? 0;
  const tribeLevel = tribe ? fortressLevel(tribe.buildings, now) : 0;
  const atWar = wars?.some((w) => !w.settled_at);
  return {
    colosseum: atWar
      ? { text: 'War on', hot: true }
      : { text: gymId ? `Tribe lv ${tribeLevel}` : 'No home gym' },
    temple: {
      text: gymId
        ? `Temple lv ${level(tribe?.buildings.find((b) => b.building === 'temple'))}`
        : 'No home gym',
    },
    walls: {
      text: gymId
        ? `Palisade lv ${level(tribe?.buildings.find((b) => b.building === 'palisade'))}`
        : 'No home gym',
    },
    forge: { text: `${GEAR_ITEMS.filter((g) => owns(g, progress)).length} pieces of gear` },
    market: { text: 'Soon' },
    baths: { text: 'Soon' },
    home: { text: `${game.rank.name} · stage ${homeStage(game.rank.id) + 1}` },
    ludus: ludus
      ? { text: `${ludus.name} · lv ${fortressLevel(ludus.buildings, now)}` }
      : { text: 'Join a ludus' },
  };
}

/**
 * The map's pan and gestures, kept outside React: a PanResponder has to stay the same object for
 * a whole drag, so it reads the screen's latest handlers from here (`use`, after each render).
 */
function createMapControl() {
  const pan = new Animated.ValueXY({ x: 0, y: 0 });
  let at = { x: 0, y: 0 };
  let origin = { x: 0, y: 0 };
  let handlers = {
    tap: (_x: number, _y: number) => {},
    zoom: (_f: number, _cx?: number, _cy?: number) => {},
    hover: (_x: number, _y: number) => {},
    z: 1,
  };
  let drag: {
    start: { x: number; y: number };
    moved: boolean;
    pinch?: { d: number; z: number };
  } | null = null;
  const set = (x: number, y: number) => {
    at = { x, y };
    pan.setValue(at);
  };
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
    onPanResponderGrant: () => {
      drag = { start: { ...at }, moved: false };
    },
    onPanResponderMove: (e, g) => {
      if (!drag) return;
      const touches = e.nativeEvent.touches;
      if (touches && touches.length === 2) {
        const d = Math.hypot(
          touches[0].pageX - touches[1].pageX,
          touches[0].pageY - touches[1].pageY,
        );
        if (!drag.pinch) drag.pinch = { d, z: handlers.z };
        else handlers.zoom((drag.pinch.z * d) / drag.pinch.d / handlers.z);
        drag.moved = true;
        return;
      }
      if (!drag.moved && Math.abs(g.dx) + Math.abs(g.dy) > 6) drag.moved = true;
      if (drag.moved && !drag.pinch) set(drag.start.x + g.dx, drag.start.y + g.dy);
    },
    onPanResponderRelease: (e) => {
      const d = drag;
      drag = null;
      if (!d || d.moved) return;
      handlers.tap(e.nativeEvent.pageX - origin.x, e.nativeEvent.pageY - origin.y);
    },
    onPanResponderTerminationRequest: () => false,
  });
  return {
    pan,
    panHandlers: responder.panHandlers,
    at: () => at,
    set,
    setOrigin: (x: number, y: number) => {
      origin = { x, y };
    },
    use: (next: typeof handlers) => {
      handlers = next;
    },
    zoom: (f: number, cx?: number, cy?: number) => handlers.zoom(f, cx, cy),
    hover: (x: number, y: number) => handlers.hover(x, y),
  };
}

export function PaintedCity() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const gameOn = useGameOn();
  const gymId = useData((s) => s.profile?.home_gym_id ?? null);
  const gym = useGym(gymId).data?.gym;
  const game = useMyGame();
  const statuses = useStatuses();
  const focused = useIsFocused();
  const tribe = useFortress('gym', gymId).data;
  // the arena and the home are drawn as the game has them: the tribe's fortress, the player's rank
  const arenaId = `arena-${fortressStage(tribe ? fortressLevel(tribe.buildings, new Date()) : 0) + 1}`;
  const homeId = `home-${homeStage(game.rank.id) + 1}`;
  const pictureOf = (id: string) => {
    const family = PIECE[id]?.family;
    if (family === 'arena' && CITY_PIECES[arenaId]) return arenaId;
    if (family === 'home' && CITY_PIECES[homeId]) return homeId;
    return id;
  };
  const [city, setCity] = useCityLayout();
  const root = useMemo(() => city.find((p) => PIECE[p.id]?.family === 'arena') ?? city[0], [city]);

  const [mode, setMode] = useState<Mode>('view');
  const [selected, setSelected] = useState<number | null>(null);
  const [placing, setPlacing] = useState<{ id: string; moving?: number } | null>(null);
  const [ghost, setGhost] = useState<{ i: number; j: number; ok: boolean } | null>(null);
  const [building, setBuilding] = useState<Record<number, number>>({});
  const [dropped, setDropped] = useState<number | null>(null);
  const [tab, setTab] = useState<CityGroup>('building');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [fitted, setFitted] = useState(false);
  const [z, setZ] = useState(1);
  const [map] = useState(createMapControl);
  const rootRef = useRef<View>(null);
  const wide = box.w >= 700;
  // the arena is the chosen place until the player picks another
  const chosen = selected ?? (mode === 'view' ? (root?.key ?? null) : null);

  // ── fitting the city into the screen ──
  const sheetSpace = insets.bottom + space.tabBarBottom + space.tabBarHeight + 150;
  const topSpace = insets.top + 96;
  const fit = (list = city, w = box.w, h = box.h) => {
    if (!w || !h || !list.length) return;
    const boxes = list.map((p) => spriteBox(p, p.id, 1));
    const x0 = Math.min(...boxes.map((b) => b.left)) - 20;
    const x1 = Math.max(...boxes.map((b) => b.left + b.width)) + 20;
    const y0 = Math.min(...boxes.map((b) => b.top)) - 10;
    const y1 = Math.max(...boxes.map((b) => b.top + b.height)) + THICK + 20;
    const availH = Math.max(160, h - topSpace - sheetSpace);
    const zoom = Math.min(1.4, Math.max(0.3, Math.min(w / (x1 - x0), availH / (y1 - y0))));
    setZ(zoom);
    map.set(w / 2 - ((x0 + x1) / 2) * zoom, topSpace + availH / 2 - ((y0 + y1) / 2) * zoom);
  };
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
    rootRef.current?.measureInWindow((x, y) => map.setOrigin(x, y));
    if (!fitted && width && height) {
      setFitted(true);
      fit(city, width, height);
    }
  };
  const zoomBy = (f: number, cx = box.w / 2, cy = box.h / 2) => {
    const next = Math.min(2.5, Math.max(0.3, z * f));
    const p = map.at();
    map.set(cx - ((cx - p.x) / z) * next, cy - ((cy - p.y) / z) * next);
    setZ(next);
  };

  // ── turning a point on the screen into a tile ──
  const toWorld = (sx: number, sy: number): [number, number] => {
    const p = map.at();
    return [(sx - p.x) / z, (sy - p.y) / z];
  };
  const tileAt = (sx: number, sy: number): [number, number] => {
    const [x, y] = toWorld(sx, sy);
    const a = x / (TW / 2);
    const b = y / (TH / 2);
    return [Math.floor((a + b) / 2), Math.floor((b - a) / 2)];
  };
  const ghostAt = (sx: number, sy: number, id: string, moving?: number) => {
    const [ti, tj] = tileAt(sx, sy);
    const n = sizeOf(id);
    const i = ti - Math.floor((n - 1) / 2);
    const j = tj - Math.floor((n - 1) / 2);
    return { i, j, ok: fits(city, sizeOf, id, i, j, moving) };
  };

  // ── building ──
  const build = (key: number, next: Placed[]) => {
    setCity(next);
    if (reduced) return;
    setBuilding((b) => ({ ...b, [key]: Date.now() }));
    setTimeout(() => {
      setBuilding(({ [key]: _, ...rest }) => rest);
      setDropped(key);
    }, BUILD_MS);
  };
  const place = (i: number, j: number) => {
    if (!placing) return;
    if (placing.moving) {
      setCity(city.map((p) => (p.key === placing.moving ? { ...p, i, j } : p)));
      setDropped(placing.moving);
    } else {
      const key = Math.max(0, ...city.map((p) => p.key)) + 1;
      build(key, [...city, { key, id: placing.id, i, j }]);
    }
    setPlacing(null);
    setGhost(null);
  };
  const tap = (sx: number, sy: number) => {
    if (placing) {
      const g = ghostAt(sx, sy, placing.id, placing.moving);
      setGhost(g);
      if (g.ok) place(g.i, g.j);
      else toast('It has to touch the city, on free tiles.');
      return;
    }
    const [ti, tj] = tileAt(sx, sy);
    let key = tilesOf(city, sizeOf).get(`${ti},${tj}`) ?? null;
    if (key == null) {
      const [x, y] = toWorld(sx, sy);
      for (const p of [...drawOrder(city, sizeOf)].reverse()) {
        const b = spriteBox(p, p.id, 1);
        if (x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height) {
          key = p.key;
          break;
        }
      }
    }
    const piece = city.find((p) => p.key === key);
    if (mode === 'view' && piece && !placeOf(piece.id)) return;
    setSelected(key);
  };
  // the ghost follows the mouse while placing (web)
  const hover = (sx: number, sy: number) => {
    if (!placing) return;
    const g = ghostAt(sx, sy, placing.id, placing.moving);
    if (!ghost || g.i !== ghost.i || g.j !== ghost.j) setGhost(g);
  };
  useEffect(() => {
    map.use({ tap, zoom: zoomBy, hover, z });
  });

  // on the web: the mouse wheel zooms, and the pointer moves the ghost
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

  // ── what is drawn ──
  const shown = city.filter((p) => !(placing?.moving === p.key));
  const tiles = tilesOf(shown, sizeOf);
  const edge = placing ? edgeOfCity(shown, sizeOf) : new Set<string>();
  const sprites = [
    ...shown,
    ...(placing && ghost ? [{ key: -1, id: placing.id, i: ghost.i, j: ghost.j }] : []),
  ];
  const ordered = drawOrder(sprites, sizeOf);

  // the ground's box on screen (the Svg cannot draw at negative coordinates)
  const groundKeys = [...tiles.keys(), ...edge];
  if (ghost && placing) {
    const n = sizeOf(placing.id);
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++) groundKeys.push(`${ghost.i + a},${ghost.j + b}`);
  }
  const corners = groundKeys.flatMap((k) => {
    const [i, j] = parseTile(k);
    return [
      gridPoint(i, j, z),
      gridPoint(i + 1, j, z),
      gridPoint(i + 1, j + 1, z),
      gridPoint(i, j + 1, z),
    ];
  });
  const gx = Math.min(0, ...corners.map((c) => c[0])) - 4;
  const gy = Math.min(0, ...corners.map((c) => c[1])) - 4;
  const gw = Math.max(1, ...corners.map((c) => c[0])) - gx + 4;
  const gh = Math.max(1, ...corners.map((c) => c[1])) - gy + THICK + 4;
  const sel = city.find((p) => p.key === chosen) ?? null;

  // the ground as single paths: every tile's diamond, and the earth under the outer front edges
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
  const pave = (TW * z) / 2 / PAVE;

  // the places with a pin, back to front by where they stand, the chosen one on top
  const pins: Pin[] = shown
    .flatMap((p) => {
      const place = placeOf(p.id);
      if (!place || building[p.key] != null) return [];
      const b = spriteBox(p, pictureOf(p.id), z);
      const status = statuses[place.id];
      const title =
        place.id === 'ludus' && status?.text && !status.text.startsWith('Join')
          ? status.text.split(' · ')[0]
          : place.title;
      return [
        {
          key: p.key,
          place,
          title,
          status,
          on: p.key === chosen,
          x: b.left + b.width / 2,
          y: b.top + b.height * 0.18,
          depth: p.i + p.j + sizeOf(p.id),
        },
      ];
    })
    .sort((a, b) => Number(a.on) - Number(b.on) || a.depth - b.depth);

  // ── the bottom panel ──
  const panelBottom = insets.bottom + space.tabBarBottom + space.tabBarHeight + 12;
  const enterPlace = (place: Place) => {
    if (place.to) router.push(place.to);
    else toast(`${place.title} is coming soon.`);
  };

  return (
    <View style={styles.root}>
      <View ref={rootRef} style={StyleSheet.absoluteFill} onLayout={onLayout} {...map.panHandlers}>
        <Animated.View
          style={[
            styles.layer,
            WEB_LAYER,
            { transform: [{ translateX: map.pan.x }, { translateY: map.pan.y }] },
          ]}
        >
          <Svg width={gw} height={gh} style={{ position: 'absolute', left: gx, top: gy }}>
            <Defs>
              {CITY_PAVING ? (
                <Pattern
                  id="pave"
                  patternUnits="userSpaceOnUse"
                  width={PAVE}
                  height={PAVE}
                  patternTransform={`matrix(${pave} ${pave / CITY_RATIO} ${-pave} ${pave / CITY_RATIO} 0 0)`}
                >
                  <SvgImage href={CITY_PAVING} width={PAVE} height={PAVE} />
                </Pattern>
              ) : null}
            </Defs>
            <G transform={`translate(${-gx} ${-gy})`}>
              {/* the earth sides and the paving, each one shape: cheap to paint while panning */}
              <Path d={earthLeft} fill="#7A5A3A" />
              <Path d={earthRight} fill="#5E4329" />
              <Path d={groundPath} fill="#B9AE9B" stroke="#B9AE9B" strokeWidth={0.8} />
              {CITY_PAVING ? <Path d={groundPath} fill="url(#pave)" /> : null}
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
              {sel && mode === 'build' ? (
                <Polygon
                  points={diamond(sel.i, sel.j, sizeOf(sel.id), z)}
                  fill="none"
                  stroke={red}
                  strokeWidth={2.5}
                />
              ) : null}
              {placing && ghost ? (
                <Polygon
                  points={diamond(ghost.i, ghost.j, sizeOf(placing.id), z)}
                  fill={ghost.ok ? '#34C759' : '#FF3B30'}
                  fillOpacity={0.35}
                  stroke={ghost.ok ? '#1E7B34' : red}
                  strokeWidth={2.5}
                />
              ) : null}
            </G>
          </Svg>

          {ordered.map((p) => {
            const scaffold = building[p.key] != null;
            const picture =
              scaffold && CITY_PIECES[`scaffold-${sizeOf(p.id)}`]
                ? `scaffold-${sizeOf(p.id)}`
                : pictureOf(p.id);
            const b = spriteBox(p, picture, z);
            return (
              <View
                key={p.key}
                style={{
                  position: 'absolute',
                  left: b.left,
                  top: b.top,
                  width: b.width,
                  height: b.height,
                }}
                pointerEvents="none"
              >
                <Drop on={dropped === p.key && !reduced}>
                  <Image
                    source={CITY_PIECES[picture].image}
                    style={{ width: b.width, height: b.height, opacity: p.key === -1 ? 0.72 : 1 }}
                    contentFit="fill"
                    accessible={false}
                  />
                </Drop>
                {scaffold ? <BuildBar width={b.width} /> : null}
                {/* light, fire and smoke only while the city is on screen and not being edited */}
                {!scaffold && p.key !== -1 && !reduced && focused && mode === 'view'
                  ? (EFFECTS[picture] ?? []).map((fx, n) => (
                      <EffectView key={n} fx={fx} scale={b.scale} />
                    ))
                  : null}
              </View>
            );
          })}

          {/* pins: every icon first, then every label above them (back to front, the chosen
              one last), so no icon ever covers a label. A phone shows no labels: the sheet below
              names the chosen building, and a label there would cover its neighbours' icons */}
          {mode === 'view'
            ? pins.map((pin) => <PinDot key={`dot${pin.key}`} pin={pin} onPress={setSelected} />)
            : null}
          {mode === 'view' && wide
            ? pins.map((pin) => (
                <PinLabel key={`label${pin.key}`} pin={pin} onPress={setSelected} />
              ))
            : null}
        </Animated.View>
      </View>

      {/* the city's name, top left */}
      <View style={[styles.title, { top: insets.top + 14 }]} pointerEvents="none">
        <Text style={styles.eyebrow}>
          {mode === 'view' ? 'COLOSSEUM · CITY' : 'COLOSSEUM · BUILD'}
        </Text>
        <Text style={[styles.cityName, !wide && { fontSize: 21 }]} numberOfLines={1}>
          {mode === 'view' ? (gym ? `Tribe ${gym.name}` : 'Your city') : 'Edit city'}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {mode === 'view'
            ? `Level ${game.level} · ${game.rank.name}`
            : 'A new building has to touch the city'}
        </Text>
        <View style={styles.testing}>
          <Text style={styles.testingText} numberOfLines={1}>
            IN TESTING PHASE, THINGS WILL CHANGE
          </Text>
        </View>
      </View>
      <View style={[styles.topRight, { top: insets.top + 12 }]}>
        <DenariiPill />
      </View>
      <View style={[styles.zoom, { bottom: panelBottom + 168 }]}>
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
          accessibilityLabel="Whole city"
          onPress={() => fit()}
        />
      </View>

      {/* bottom: the chosen place, or the builder */}
      <View style={[styles.panel, { bottom: panelBottom }]}>
        {!gameOn ? (
          <View style={styles.row}>
            <Text style={[styles.text, { flex: 1 }]}>
              The game is off. Your workouts still count in the background.
            </Text>
            <FillButton label="Turn it on" size="sm" onPress={() => chooseGame('on')} />
          </View>
        ) : mode === 'view' ? (
          <ViewSheet
            narrow={!wide}
            piece={sel}
            picture={sel ? pictureOf(sel.id) : null}
            statuses={statuses}
            onEnter={enterPlace}
            onEdit={() => {
              setMode('build');
              setSelected(null);
            }}
          />
        ) : sel ? (
          <BuildActions
            piece={sel}
            busy={building[sel.key] != null}
            isRoot={sel.key === root?.key}
            onUpgrade={() => {
              const levels = levelsOf(sel.id);
              const next = levels[levels.findIndex((l) => l.id === sel.id) + 1];
              if (next)
                build(
                  sel.key,
                  city.map((p) => (p.key === sel.key ? { ...p, id: next.id } : p)),
                );
            }}
            onMove={() => {
              if (!staysWhole(city, sizeOf, root.key, sel.key))
                return toast(
                  'It holds part of the city together. Move the buildings behind it first.',
                );
              setPlacing({ id: sel.id, moving: sel.key });
              setSelected(null);
            }}
            onRemove={() => {
              if (!staysWhole(city, sizeOf, root.key, sel.key))
                return toast(
                  'It holds part of the city together. Remove the buildings behind it first.',
                );
              setCity(city.filter((p) => p.key !== sel.key));
              setSelected(null);
            }}
            onClose={() => setSelected(null)}
          />
        ) : (
          <Palette
            tab={tab}
            onTab={setTab}
            picking={placing && !placing.moving ? placing.id : null}
            onPick={(id) => {
              setGhost(null);
              setPlacing(placing?.id === id && !placing.moving ? null : { id });
            }}
            onDone={() => {
              setMode('view');
              setPlacing(null);
              setGhost(null);
              setSelected(root?.key ?? null);
            }}
            onReset={() => {
              setCity(startingCity());
              setPlacing(null);
              setGhost(null);
              fit(startingCity());
            }}
          />
        )}
      </View>
    </View>
  );
}

// ───────────── pieces of the screen ─────────────

interface Pin {
  key: number;
  place: Place;
  title: string;
  status?: { text: string; hot?: boolean };
  on: boolean;
  /** Where the icon's centre goes, on the map. */
  x: number;
  y: number;
  depth: number;
}

function PinDot({ pin, onPress }: { pin: Pin; onPress: (key: number) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pin.title}, ${pin.status?.text ?? ''}`}
      onPress={() => onPress(pin.key)}
      style={[styles.pin, { left: pin.x - 17, top: pin.y - 17 }]}
    >
      <View
        style={[
          styles.pinDot,
          pin.on && styles.pinDotOn,
          pin.status?.hot && !pin.on && { borderColor: red },
        ]}
      >
        <PlaceIcon place={pin.place} color={pin.on ? '#fff' : red} />
      </View>
    </Pressable>
  );
}

/** The label right of its icon, in the layer above every icon. */
function PinLabel({ pin, onPress }: { pin: Pin; onPress: (key: number) => void }) {
  return (
    <Pressable
      accessible={false}
      onPress={() => onPress(pin.key)}
      style={[
        styles.pinLabel,
        pin.on && styles.pinLabelOn,
        { position: 'absolute', left: pin.x + 25, top: pin.y - 19 },
      ]}
    >
      <Text style={[styles.pinTitle, pin.on && { color: paper }]} numberOfLines={1}>
        {pin.title}
      </Text>
      {pin.status ? (
        <Text
          style={[
            styles.pinStatus,
            pin.on && { color: 'rgba(242,235,219,0.75)' },
            pin.status.hot && !pin.on && { color: red },
          ]}
          numberOfLines={1}
        >
          {pin.status.text}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** The place's icon, drawn like lucide's (24 × 24, stroke 2). */
function PlaceIcon({ place, color }: { place: Place; color: string }) {
  const paths: Record<string, string[]> = {
    colosseum: [
      'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
      'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
      'M4 22h16',
      'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
      'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
      'M18 2H6v7a6 6 0 0 0 12 0V2Z',
    ],
    temple: ['M3 22h18', 'M6 18v-7', 'M10 18v-7', 'M14 18v-7', 'M18 18v-7', 'm12 2 8 5H4Z'],
    forge: [
      'm15 12-8.4 8.4a2.12 2.12 0 0 1-3-3L12 9',
      'M17.64 15 22 10.64',
      'm20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91',
    ],
    market: ['M3 9h18l-1.5-5h-15Z', 'M5 9v11h14V9', 'M9 20v-6h6v6'],
    baths: [
      'M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.68 3 4 3.68 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5',
      'M2 12h20',
      'M7 19v2',
      'M17 19v2',
    ],
    home: [
      'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
      'M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    ],
    ludus: [
      'M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z',
      'M18 11V4H6v7',
      'M15 22v-4a3 3 0 0 0-6 0v4',
      'M22 11V9',
      'M2 11V9',
      'M6 4V2',
      'M18 4V2',
      'M10 4V2',
      'M14 4V2',
    ],
    walls: [
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    ],
  };
  return (
    <Svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(paths[place.id] ?? []).map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

function ViewSheet({
  piece,
  picture,
  statuses,
  onEnter,
  onEdit,
  narrow,
}: {
  narrow: boolean;
  piece: Placed | null;
  /** The picture drawn for it (the arena and the home follow the game). */
  picture: string | null;
  statuses: Record<string, { text: string; hot?: boolean }>;
  onEnter: (p: Place) => void;
  onEdit: () => void;
}) {
  const place = piece ? placeOf(piece.id) : null;
  const levels = piece ? levelsOf(piece.id) : [];
  const at = piece ? levels.findIndex((l) => l.id === (picture ?? piece.id)) : -1;
  return (
    <View style={[styles.sheet, narrow && { flexDirection: 'column', alignItems: 'stretch' }]}>
      {piece && place ? (
        <View style={styles.sheetMain}>
          <View style={styles.thumb}>
            <Image
              source={CITY_PIECES[picture ?? piece.id].image}
              style={styles.thumbImg}
              contentFit="cover"
              contentPosition="center"
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {place.title}
              {levels.length > 1 ? <Text style={styles.sheetLevel}>{`  lv ${at + 1}`}</Text> : null}
            </Text>
            <Text style={styles.text} numberOfLines={2}>
              {place.text}
            </Text>
            {statuses[place.id] ? (
              <Text
                style={[styles.status, !statuses[place.id].hot && { color: inkMuted }]}
                numberOfLines={1}
              >
                {statuses[place.id].text}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={[styles.text, { flex: 1 }]}>Tap a building to see what it does.</Text>
      )}
      <View style={[styles.sheetActions, narrow && { marginLeft: 0 }]}>
        {place ? (
          <FillButton
            label="Enter"
            icon={ChevronRight}
            size="sm"
            ready
            onPress={() => onEnter(place)}
            style={narrow ? { flex: 1 } : undefined}
          />
        ) : null}
        <FillButton
          label="Edit city"
          icon={Hammer}
          size="sm"
          onPress={onEdit}
          style={narrow ? { flex: 1 } : undefined}
        />
      </View>
    </View>
  );
}

function BuildActions({
  piece,
  busy,
  isRoot,
  onUpgrade,
  onMove,
  onRemove,
  onClose,
}: {
  piece: Placed;
  busy: boolean;
  isRoot: boolean;
  onUpgrade: () => void;
  onMove: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const levels = levelsOf(piece.id);
  const at = levels.findIndex((l) => l.id === piece.id);
  const grows = GROWS[PIECE[piece.id]?.family ?? ''];
  const canUp = !grows && levels.length > 1 && at < levels.length - 1 && !busy;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {PIECE[piece.id].name}
          </Text>
          <Text style={styles.text}>
            {`${sizeOf(piece.id)}×${sizeOf(piece.id)}`}
            {grows
              ? ` · ${grows}`
              : levels.length > 1
                ? ` · level ${at + 1} of ${levels.length}`
                : ''}
          </Text>
        </View>
        <IconButton icon={X} size={40} accessibilityLabel="Close" onPress={onClose} />
      </View>
      <View style={styles.row}>
        <FillButton
          label="Upgrade"
          size="sm"
          disabled={!canUp}
          onPress={onUpgrade}
          style={{ flex: 1, opacity: canUp ? 1 : 0.45 }}
        />
        <FillButton
          label="Move"
          size="sm"
          disabled={isRoot}
          onPress={onMove}
          style={{ flex: 1, opacity: isRoot ? 0.45 : 1 }}
        />
        <FillButton
          label="Remove"
          size="sm"
          disabled={isRoot}
          onPress={onRemove}
          style={{ flex: 1, opacity: isRoot ? 0.45 : 1 }}
          labelStyle={{ color: red }}
        />
      </View>
    </View>
  );
}

const TABS: { id: CityGroup; label: string }[] = [
  { id: 'building', label: 'Buildings' },
  { id: 'decor', label: 'Decor' },
];
function Palette({
  tab,
  onTab,
  picking,
  onPick,
  onDone,
  onReset,
}: {
  tab: CityGroup;
  onTab: (t: CityGroup) => void;
  picking: string | null;
  onPick: (id: string) => void;
  onDone: () => void;
  onReset: () => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: t.id === tab }}
            onPress={() => onTab(t.id)}
            style={[styles.tab, t.id === tab && styles.tabOn]}
          >
            <Text style={[styles.tabText, t.id === tab && { color: ink }]}>{t.label}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" onPress={onReset} style={styles.tab}>
          <Text style={styles.tabText}>Reset</Text>
        </Pressable>
        <FillButton label="Done" size="sm" onPress={onDone} />
      </View>
      <Text style={styles.text}>
        {picking
          ? 'Tap a free tile next to the city: green fits, red does not.'
          : 'Pick a building, then tap a free tile next to the city. Tap a building to upgrade, move or remove it.'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {PALETTE.filter((p) => p.group === tab).map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityState={{ selected: picking === p.id }}
            accessibilityLabel={`${p.label}, ${sizeOf(p.id)} by ${sizeOf(p.id)}`}
            onPress={() => onPick(p.id)}
            style={[styles.card, picking === p.id && styles.cardOn]}
          >
            <Image source={CITY_PIECES[p.id].image} style={styles.cardImg} contentFit="contain" />
            <Text style={styles.cardName} numberOfLines={1}>
              {p.label}
            </Text>
            <Text style={styles.cardSize}>{`${sizeOf(p.id)}×${sizeOf(p.id)}`}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** A new or upgraded building drops into place. */
function Drop({ on, children }: { on: boolean; children: React.ReactNode }) {
  const [v] = useState(() => new Animated.Value(on ? 0 : 1));
  useEffect(() => {
    if (!on) return;
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 440,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [on, v]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** The scaffolding's progress bar. */
function BuildBar({ width }: { width: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: BUILD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [v]);
  return (
    <View style={[styles.bar, { left: width / 2 - 40 }]}>
      <Animated.View
        style={[
          styles.barFill,
          { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

/**
 * Light, fire and smoke over a picture (PAINTED-UI §5). On the web they are CSS animations, which
 * the browser runs off the main thread; JavaScript-driven loops there made the whole app stutter.
 */
function EffectView(props: { fx: Effect; scale: number }) {
  return Platform.OS === 'web' ? <WebEffect {...props} /> : <NativeEffect {...props} />;
}

type Frames = Record<string, { opacity?: number; transform?: object[] }>;
const move = (x: number, y: number, s: number) => [
  { translateX: x },
  { translateY: y },
  { scale: s },
];

/**
 * The web's keyframes. React Native Web turns `animationKeyframes` into CSS only in StyleSheet
 * styles, so they live here at one size; a wrapper scales the smoke with the map.
 */
const WEB_FX =
  Platform.OS === 'web'
    ? StyleSheet.create({
        puffA: {
          animationKeyframes: [
            {
              '0%': { opacity: 0, transform: move(0, 0, 0.4) },
              '8%': { opacity: 0.8 },
              '40%': { opacity: 0.6, transform: move(18, -66, 1.4) },
              '70%': { opacity: 0.35, transform: move(44, -118, 2.3) },
              '100%': { opacity: 0, transform: move(72, -170, 3.3) },
            } satisfies Frames,
          ],
          animationDuration: '6s',
          animationTimingFunction: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
          animationIterationCount: 'infinite',
        } as unknown as ViewStyle,
        puffB: {
          animationKeyframes: [
            {
              '0%': { opacity: 0, transform: move(0, 0, 0.35) },
              '10%': { opacity: 0.7 },
              '35%': { transform: move(4, -58, 1.2) },
              '65%': { opacity: 0.35, transform: move(30, -112, 2.1) },
              '100%': { opacity: 0, transform: move(58, -176, 3.1) },
            } satisfies Frames,
          ],
          animationDuration: '6.8s',
          animationTimingFunction: 'cubic-bezier(0.3, 0.1, 0.6, 1)',
          animationIterationCount: 'infinite',
        } as unknown as ViewStyle,
        glow: {
          animationKeyframes: [
            {
              '0%': { opacity: 0.35, transform: [{ scale: 0.96 }] },
              '100%': { opacity: 0.9, transform: [{ scale: 1.04 }] },
            },
          ],
          animationDuration: '2.6s',
          animationDirection: 'alternate',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        } as unknown as ViewStyle,
        fire: {
          animationKeyframes: [
            {
              '0%': { opacity: 0.55 },
              '18%': { opacity: 1 },
              '33%': { opacity: 0.45 },
              '52%': { opacity: 0.95 },
              '71%': { opacity: 0.6 },
              '86%': { opacity: 0.85 },
              '100%': { opacity: 0.55 },
            },
          ],
          animationDuration: '1.3s',
          animationTimingFunction: 'steps(1)',
          animationIterationCount: 'infinite',
        } as unknown as ViewStyle,
      })
    : null;

function WebEffect({ fx, scale }: { fx: Effect; scale: number }) {
  if (!WEB_FX) return null;
  if (fx.kind === 'smoke') {
    // the puffs at one size, around the chimney; the wrapper grows them with the map
    const k = scale * 2.4;
    return (
      <View
        style={{
          position: 'absolute',
          left: fx.x * scale,
          top: fx.y * scale,
          width: 0,
          height: 0,
          transform: [{ scale: k }],
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
          const s = [9, 11, 14][n % 3];
          return (
            <View
              key={n}
              style={[
                {
                  position: 'absolute',
                  left: -s / 2,
                  top: -s / 2,
                  width: s,
                  height: s,
                  opacity: 0,
                },
                n % 2 ? WEB_FX.puffB : WEB_FX.puffA,
                { animationDelay: `${-0.72 * n}s` } as unknown as ViewStyle,
              ]}
            >
              <Soft color="#A09E98" size={s} />
            </View>
          );
        })}
      </View>
    );
  }
  const w = fx.w * scale;
  const h = fx.h * scale;
  return (
    <View
      style={[
        {
          position: 'absolute',
          left: fx.x * scale - w / 2,
          top: fx.y * scale - h / 2,
          width: w,
          height: h,
        },
        fx.kind === 'glow' ? WEB_FX.glow : WEB_FX.fire,
      ]}
    >
      <Glow kind={fx.kind} w={w} h={h} />
    </View>
  );
}

function Glow({ kind, w, h }: { kind: 'glow' | 'fire'; w: number; h: number }) {
  return (
    <Svg width={w} height={h}>
      <Defs>
        <RadialGradient id={`g${kind}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={kind === 'glow' ? '#FFD682' : '#FFC85A'} stopOpacity={0.85} />
          <Stop
            offset="0.55"
            stopColor={kind === 'glow' ? '#FFAA46' : '#FF781E'}
            stopOpacity={0.45}
          />
          <Stop offset="1" stopColor="#FFAA46" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#g${kind})`} />
    </Svg>
  );
}

/** The phone apps: the same effects with the native driver, off the JavaScript thread. */
function NativeEffect({ fx, scale }: { fx: Effect; scale: number }) {
  const [clock] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(clock, {
        toValue: 1,
        duration: 6000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [clock]);
  if (fx.kind === 'smoke') {
    return (
      <>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
          const t = Animated.modulo(Animated.add(clock, n / 8), 1);
          const s = [9, 11, 14][n % 3] * scale * 2.4;
          const drift = n % 2 ? 0.9 : 1;
          return (
            <Animated.View
              key={n}
              style={{
                position: 'absolute',
                left: fx.x * scale - s / 2,
                top: fx.y * scale - s / 2,
                width: s,
                height: s,
                opacity: t.interpolate({
                  inputRange: [0, 0.08, 0.4, 0.7, 1],
                  outputRange: [0, 0.8, 0.6, 0.35, 0],
                }),
                transform: [
                  {
                    translateX: t.interpolate({
                      inputRange: [0, 0.4, 0.7, 1],
                      outputRange: [0, 18, 44, 72].map((v) => v * scale * 2.4 * drift),
                    }),
                  },
                  {
                    translateY: t.interpolate({
                      inputRange: [0, 0.4, 0.7, 1],
                      outputRange: [0, -66, -118, -170].map((v) => v * scale * 2.4),
                    }),
                  },
                  {
                    scale: t.interpolate({
                      inputRange: [0, 0.4, 0.7, 1],
                      outputRange: [0.4, 1.4, 2.3, 3.3],
                    }),
                  },
                ],
              }}
            >
              <Soft color="#A09E98" size={s} />
            </Animated.View>
          );
        })}
      </>
    );
  }
  const w = fx.w * scale;
  const h = fx.h * scale;
  const opacity =
    fx.kind === 'glow'
      ? clock.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [0.35, 0.9, 0.35, 0.9, 0.35],
        })
      : clock.interpolate({
          inputRange: [0, 0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.21, 1],
          outputRange: [0.55, 1, 0.45, 0.95, 0.6, 0.85, 0.55, 1, 0.55],
        });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: fx.x * scale - w / 2,
        top: fx.y * scale - h / 2,
        width: w,
        height: h,
        opacity,
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id={`g${fx.kind}`} cx="50%" cy="50%" r="50%">
            <Stop
              offset="0"
              stopColor={fx.kind === 'glow' ? '#FFD682' : '#FFC85A'}
              stopOpacity={0.85}
            />
            <Stop
              offset="0.55"
              stopColor={fx.kind === 'glow' ? '#FFAA46' : '#FF781E'}
              stopOpacity={0.45}
            />
            <Stop offset="1" stopColor="#FFAA46" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#g${fx.kind})`} />
      </Svg>
    </Animated.View>
  );
}

function Soft({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="soft" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.75} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={size / 2} cy={size / 2} rx={size / 2} ry={size / 2} fill="url(#soft)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: paper, overflow: 'hidden' },
  layer: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
  title: { position: 'absolute', left: 20, right: 120, gap: 2 },
  eyebrow: { fontFamily: display, fontSize: 11, letterSpacing: 2.4, color: red },
  cityName: { fontFamily: display, fontSize: 26, color: ink, letterSpacing: 0.4 },
  sub: { fontSize: 13, color: inkMuted },
  testing: {
    alignSelf: 'flex-start',
    // the box may run under the denarii pill, which sits higher; one line on a phone
    marginRight: -104,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: red,
    backgroundColor: 'rgba(185,28,28,0.08)',
  },
  testingText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, color: red },
  topRight: { position: 'absolute', right: 16, flexDirection: 'row', gap: 8 },
  zoom: { position: 'absolute', right: 16, gap: 8 },
  pin: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: line,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(59,47,34,0.22)',
  },
  pinDotOn: { backgroundColor: red, borderColor: red, transform: [{ scale: 1.15 }] },
  pinLabel: {
    backgroundColor: card,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    boxShadow: '0 2px 8px rgba(59,47,34,0.12)',
  },
  pinLabelOn: { backgroundColor: ink, borderColor: ink },
  pinTitle: { fontFamily: display, fontSize: 12.5, color: ink, letterSpacing: 0.3 },
  pinStatus: { fontSize: 11.5, color: inkMuted },
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
  sheet: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetActions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
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
  sheetTitle: { fontFamily: display, fontSize: 18, color: ink },
  sheetLevel: { fontFamily: undefined, fontSize: 13, color: inkMuted },
  text: { fontSize: 13.5, lineHeight: 19, color: inkMuted },
  status: { fontSize: 13, fontWeight: '600', color: red },
  tab: { paddingHorizontal: 12, height: 36, borderRadius: 18, justifyContent: 'center' },
  tabOn: { backgroundColor: paperDeep },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: inkMuted,
    textTransform: 'uppercase',
  },
  card: {
    width: 96,
    padding: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: line,
    backgroundColor: paper,
    gap: 2,
  },
  cardOn: { borderColor: red, borderWidth: 2 },
  cardImg: { width: '100%', height: 58 },
  cardName: { fontSize: 12.5, fontWeight: '600', color: ink },
  cardSize: { fontSize: 11.5, color: inkMuted },
  bar: {
    position: 'absolute',
    bottom: '30%',
    width: 80,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(59,47,34,0.2)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#A87B24' },
});
