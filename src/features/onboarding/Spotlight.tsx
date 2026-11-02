/**
 * Lighting up one part of a screen: the screen dims, the TourTarget stays bright inside a red
 * outline. Used by the app tour, and on its own by What's new ("Show me" opens the screen and
 * lights up where a new feature lives, with a short card and Got it). A guide does the same for a
 * few steps in a row, moving between screens to walk through how a feature works.
 */
import { router, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { create } from 'zustand';

import { FillButton, TextButton } from '@/components/Buttons';
import { MAX_WIDTH } from '@/components/Screen';
import { dur, useReducedMotion } from '@/theme/motion';
import { colors, space, type } from '@/theme/tokens';
import { measureTarget, scrollTargetIntoView, type TargetRect } from './TourTarget';

/** Space between a lit-up element and its outline. */
export const HALO = 6;

export interface Halo {
  x: number;
  y: number;
  width: number;
  height: number;
  r: number;
}

export function haloAround(target: TargetRect | null, radius = 16): Halo | null {
  return target
    ? {
        x: target.x - HALO,
        y: target.y - HALO,
        width: target.width + HALO * 2,
        height: target.height + HALO * 2,
        r: radius + HALO,
      }
    : null;
}

/** Where a TourTarget sits; re-measured while it is shown (screens settle, scroll). */
export function useTargetRect(id: string | undefined): TargetRect | null {
  // Tagged with the id it belongs to, so the last target's rect never shows for the next one.
  const [found, setFound] = useState<{ id: string; rect: TargetRect | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    const tick = () =>
      measureTarget(id, (r) => {
        if (!alive) return;
        setFound((prev) => {
          const p = prev?.id === id ? prev.rect : undefined;
          const same =
            p === r ||
            (!!p &&
              !!r &&
              p.x === r.x &&
              p.y === r.y &&
              p.width === r.width &&
              p.height === r.height);
          return same && prev ? prev : { id, rect: r };
        });
      });
    tick();
    const timer = setInterval(tick, 250);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);
  return id && found?.id === id ? found.rect : null;
}

/** A rounded rectangle as an SVG subpath. */
export function roundRect(x: number, y: number, w: number, h: number, radius: number): string {
  const r = Math.min(radius, w / 2, h / 2);
  return (
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}` +
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

/** Dims the whole screen except the given cut-outs (SVG subpaths). */
export function Scrim({ width, height, holes }: { width: number; height: number; holes: string }) {
  return (
    <Svg width={width} height={height} style={styles.scrim} aria-hidden>
      <Path
        d={`M0 0H${width}V${height}H0Z${holes}`}
        fill="rgb(28,28,30)"
        fillOpacity={0.22}
        fillRule="evenodd"
      />
    </Svg>
  );
}

/** The red outline around a lit-up element. */
export function SpotRing({ halo, k }: { halo: Halo; k?: string | number }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      key={k}
      aria-hidden
      entering={reduced ? undefined : FadeIn.duration(dur.state)}
      style={[
        styles.ring,
        { left: halo.x, top: halo.y, width: halo.width, height: halo.height, borderRadius: halo.r },
      ]}
    />
  );
}

// ───────────── A spotlight or a guide (What's new → Show me) ─────────────

export interface SpotlightRequest {
  /** TourTarget id to light up, and its corner radius. No target: only the card. */
  target?: string;
  radius?: number;
  title: string;
  body: string;
  /** Something to show in the card, for what cannot be pointed at on a screen. */
  preview?: ReactNode;
}

/** One step of a guide: the screen it happens on, and what to point at there. */
export interface GuideStep extends SpotlightRequest {
  route: Href;
  /** The screen under it, when it sits on top of another. */
  via?: Href;
}

export const useSpotlight = create<{
  current: SpotlightRequest | null;
  /** The steps of a running guide, and which one is showing. */
  steps: GuideStep[];
  index: number;
}>()(() => ({
  current: null,
  steps: [],
  index: 0,
}));

function goToStep(steps: GuideStep[], index: number) {
  const step = steps[index];
  if (step.via) router.navigate(step.via);
  router.navigate(step.route);
  useSpotlight.setState({ current: step, steps, index });
}

/** Walks through a feature, screen by screen. */
export function showGuide(steps: GuideStep[]) {
  goToStep(steps, 0);
}

/** Opens `route` (after `via`, when the screen sits on top of another) and lights up a target. */
export function showSpotlight(request: SpotlightRequest, route: Href, via?: Href) {
  if (via) router.navigate(via);
  router.navigate(route);
  useSpotlight.setState({ current: request, steps: [], index: 0 });
}

export function SpotlightHost() {
  const current = useSpotlight((s) => s.current);
  return current ? <SpotlightOverlay request={current} /> : null;
}

function SpotlightOverlay({ request }: { request: SpotlightRequest }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [cardHeight, setCardHeight] = useState(0);
  const halo = haloAround(useTargetRect(request.target), request.radius);
  const steps = useSpotlight((s) => s.steps);
  const index = useSpotlight((s) => s.index);
  const guide = steps.length > 1;
  const last = index >= steps.length - 1;
  const close = () => useSpotlight.setState({ current: null, steps: [], index: 0 });
  const next = () => (last ? close() : goToStep(steps, index + 1));

  // The next screen needs a moment before what it points at can be scrolled to.
  useEffect(() => {
    if (!request.target) return;
    const id = request.target;
    const timer = setTimeout(() => scrollTargetIntoView(id), 350);
    return () => clearTimeout(timer);
  }, [request.target]);

  const cardWidth = Math.min(width - 32, MAX_WIDTH - 32);
  const cardLeft = (width - cardWidth) / 2;
  const cardBottom = insets.bottom + space.tabBarBottom + space.tabBarHeight + 18;
  // A card that would cover the lit-up element moves to the top of the screen.
  const atTop =
    !!halo && cardHeight > 0 && halo.y + halo.height + 12 > height - cardBottom - cardHeight;
  const hole = halo ? roundRect(halo.x, halo.y, halo.width, halo.height, halo.r) : '';

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Scrim width={width} height={height} holes={hole} />
      {/* A tap anywhere closes it, like Got it. A guide waits for Next or Skip. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessible={false}
        onPress={guide ? undefined : close}
      />
      {halo ? <SpotRing halo={halo} /> : null}
      <Animated.View
        entering={reduced ? undefined : FadeIn.duration(dur.state)}
        onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
        style={[
          styles.card,
          { left: cardLeft, width: cardWidth },
          atTop ? { top: insets.top + 16 } : { bottom: cardBottom },
        ]}
        accessibilityLiveRegion="polite"
      >
        {request.preview ? <View style={styles.preview}>{request.preview}</View> : null}
        <View style={{ gap: 4 }}>
          {guide ? (
            <Text style={type.captionStrong}>
              Step {index + 1} of {steps.length}
            </Text>
          ) : null}
          <Text style={type.title} accessibilityRole="header">
            {request.title}
          </Text>
          <Text style={styles.body}>{request.body}</Text>
        </View>
        <View style={styles.actions}>
          {guide && !last ? <TextButton label="Skip" onPress={close} /> : null}
          <FillButton
            label={guide && !last ? 'Next' : 'Got it'}
            size="sm"
            onPress={next}
            style={styles.done}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
    pointerEvents: 'none',
  },
  card: {
    position: 'absolute',
    padding: 18,
    gap: 14,
    borderRadius: 26,
    backgroundColor: colors.glassFallback,
    borderWidth: 0.5,
    borderColor: colors.glassBorder,
    boxShadow: '0 2px 4px rgba(0,0,0,0.06), 0 18px 40px rgba(0,0,0,0.16)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(30px) saturate(180%)' } as object) : null),
  },
  body: { fontSize: 15, lineHeight: 21, color: colors.text2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  done: { minWidth: 96, height: 44 },
  preview: { alignItems: 'center' },
});
