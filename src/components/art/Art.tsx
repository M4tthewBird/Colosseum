/**
 * Game illustrations: the gladiator for each rank, the fortress as it grows and the gladiator's
 * home. Hand-drawn SVG from the design (direction E), drawn with SvgXml so web and native match.
 */
import { Image } from 'expo-image';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop, SvgXml } from 'react-native-svg';

import type { RankId } from '@/lib/game/levels';
import type { FortressStage } from '@/lib/game/fortress';
import type { HomeStage } from '@/lib/game/attributes';
import type { StyleId } from '@/lib/game/styles';
import { shadows } from '@/theme/tokens';
import { DRESS, DRESS_SIZE, PAINTED_FIGURES, PAINTED_GEAR } from './painted';
import * as svgs from './svgs';
import * as svgsF from './svgsF';

/** Laurel leaves fanned along an arc across the helmet. */
function laurel(): string {
  let leaves = '';
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = (128 + t * 44).toFixed(1);
    const y = 52 - Math.sin(t * Math.PI) * 5;
    const turn = ((t - 0.5) * 100).toFixed(0);
    leaves += `<ellipse cx="${x}" cy="${(y - 4).toFixed(1)}" rx="3" ry="7" transform="rotate(${turn} ${x} ${y.toFixed(1)})"/>`;
  }
  return `<path d="M126,53 Q150,44 174,53" fill="none" stroke="#3B2F22" stroke-width="2"/><g fill="#7C8A3E" stroke="#3B2F22" stroke-width="1.1">${leaves}</g>`;
}

/** The Primus Palus figure made legend: a laurel on the helmet and a gold rim on the plinth. */
const RUDIARIUS = svgs.gladiator_primus.replace(
  '</svg>',
  `${laurel()}<ellipse cx="150" cy="294" rx="62" ry="12" fill="none" stroke="#C9A13B" stroke-width="3"/></svg>`,
);

const GLADIATORS: Record<RankId, string> = {
  tiro: svgs.gladiator_tiro,
  gladiator: svgs.gladiator_gladiator,
  veteranus: svgs.gladiator_veteranus,
  primus: svgs.gladiator_primus,
  rudiarius: RUDIARIUS,
};
const FORTRESSES = [svgs.fortress_0, svgs.fortress_1, svgs.fortress_2, svgs.fortress_3];
const HOMES = [svgs.home_0, svgs.home_1, svgs.home_2, svgs.home_3];

/** All pictures share the 300 × 330 canvas of the design. */
const RATIO = 330 / 300;

const Picture = memo(function Picture({ xml, width }: { xml: string; width: number }) {
  return <SvgXml xml={xml} width={width} height={width * RATIO} />;
});

/** A painted picture in the same box as the drawn one, when it has been painted. */
function Painted({ source, width }: { source: unknown; width: number }) {
  return (
    <Image
      source={source as number}
      style={{ width, height: width * RATIO }}
      contentFit="contain"
      accessible={false}
    />
  );
}

export function GladiatorArt({ rank, width = 190 }: { rank: RankId; width?: number }) {
  const painted = PAINTED_FIGURES[`rank-${rank}`];
  if (painted) return <Painted source={painted} width={width} />;
  return <Picture xml={GLADIATORS[rank]} width={width} />;
}

/** What the gladiator wears (slot → gear id), drawn bottom to top. */
export interface Outfit {
  armour?: string | null;
  guard?: string | null;
  helmet?: string | null;
  weapon?: string | null;
  shield?: string | null;
}
const DRESS_ORDER: (keyof Outfit)[] = ['armour', 'guard', 'helmet', 'weapon', 'shield'];

/** Whether the painted dressing-up pictures exist. */
export const CAN_DRESS = !!DRESS.base;

/**
 * The painted gladiator wearing his gear (Matyáš, 2026-11-27): the base and every worn piece
 * cut out in the same frame (scripts/dress-layers.mjs), stacked. Null before it is painted.
 */
export function DressedGladiator({ outfit, width = 190 }: { outfit: Outfit; width?: number }) {
  if (!DRESS.base) return null;
  const height = (width * DRESS_SIZE.height) / DRESS_SIZE.width;
  const layers = DRESS_ORDER.map((slot) => outfit[slot]).filter(
    (id): id is string => !!id && !!DRESS[id],
  );
  return (
    <View style={{ width, height }} accessible={false}>
      {['base', ...layers].map((id) => (
        <Image
          key={id}
          source={DRESS[id] as number}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          accessible={false}
        />
      ))}
    </View>
  );
}

export function FortressArt({ stage, width = 230 }: { stage: FortressStage; width?: number }) {
  return <Picture xml={FORTRESSES[stage]} width={width} />;
}

export function HomeArt({ stage, width = 220 }: { stage: HomeStage; width?: number }) {
  return <Picture xml={HOMES[stage]} width={width} />;
}

const STYLES: Record<StyleId, string> = {
  murmillo: svgsF.style_murmillo,
  thraex: svgsF.style_thraex,
  retiarius: svgsF.style_retiarius,
  secutor: svgsF.style_secutor,
  hoplomachus: svgsF.style_hoplomachus,
  bestiarius: svgsF.style_bestiarius,
};

/** The gladiator dressed in a fighting style (Forge → Style, the forge, enemy tribes). */
export function StyleArt({ style, width = 190 }: { style: StyleId; width?: number }) {
  const painted = PAINTED_FIGURES[`style-${style}`];
  if (painted) return <Painted source={painted} width={width} />;
  return <Picture xml={STYLES[style]} width={width} />;
}

/** One piece of gear, drawn on a square tile (ids from lib/game/gear.ts). */
export const GearArt = memo(function GearArt({ id, size = 76 }: { id: string; size?: number }) {
  const painted = PAINTED_GEAR[id];
  if (painted)
    return (
      <Image
        source={painted as number}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessible={false}
      />
    );
  const xml = (svgsF as Record<string, string>)[`gear_${id}`];
  if (!xml) return <View style={{ width: size, height: size }} />;
  return <SvgXml xml={xml} width={size} height={size} />;
});

/** The city around the Colosseum (1140 × 722). */
export function CityArt({ width = 350 }: { width?: number }) {
  return <SvgXml xml={svgsF.city} width={width} height={(width * 722) / 1140} />;
}

/**
 * The white-to-grey stage a picture stands on (the hero card at the top of Gladiator, Home,
 * Ludus and Tribe). Children are the picture; `overlay` sits on top for chips and names.
 */
export function ArtStage({
  height = 210,
  children,
  overlay,
  style,
}: {
  height?: number;
  children: ReactNode;
  overlay?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.stage, { height }, style]}>
      {/* Layers in Views: a bare absolute <svg> on web would paint over the picture. */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="art-stage" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor="#E9E9EE" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#art-stage)" />
        </Svg>
      </View>
      <View>{children}</View>
      {overlay ? <View style={[StyleSheet.absoluteFill, styles.overlay]}>{overlay}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: '#FFFFFF',
    boxShadow: shadows.glass,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  overlay: { padding: 14, pointerEvents: 'box-none' },
});
