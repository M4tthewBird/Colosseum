/**
 * Choosing what a profile picture shows: drag to move, pinch or + and − to zoom, inside a circle.
 * Reports the part of the photo to keep. Built here because the photo picker's own cropping does
 * not exist on the web.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Stepper } from '@/components/Form';
import {
  clampOffset,
  clampZoom,
  cropRect,
  MIN_ZOOM,
  photoScale,
  pinchDistance,
  type Offset,
  type Size,
} from '@/lib/avatarCrop';
import { colors, type } from '@/theme/tokens';

const FRAME = 280;
const ZOOM_STEP = 0.25;

export type CropArea = ReturnType<typeof cropRect>;

export function PhotoCropper({
  uri,
  photo,
  onChange,
}: {
  uri: string;
  photo: Size;
  onChange: (area: CropArea) => void;
}) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  // Where the current gesture started. `distance` is set while two fingers pinch.
  const start = useRef({ pageX: 0, pageY: 0, offset, zoom, distance: 0 });

  useEffect(() => {
    onChange(cropRect(photo, FRAME, zoom, offset));
  }, [photo, zoom, offset, onChange]);

  const applyZoom = (next: number) => {
    const z = clampZoom(next);
    setZoom(z);
    setOffset((o) => clampOffset(o, photo, FRAME, z));
  };

  const begin = (e: GestureResponderEvent, distance = 0) => {
    const { pageX, pageY } = e.nativeEvent;
    start.current = { pageX, pageY, offset, zoom, distance };
  };

  const move = (e: GestureResponderEvent) => {
    const { touches, pageX, pageY } = e.nativeEvent;
    if (touches?.length >= 2) {
      const distance = pinchDistance(touches[0], touches[1]);
      if (!start.current.distance) begin(e, distance);
      else applyZoom((start.current.zoom * distance) / start.current.distance);
      return;
    }
    // One finger of a pinch lifted: carry on from here instead of jumping back.
    if (start.current.distance) {
      begin(e);
      return;
    }
    setOffset(
      clampOffset(
        {
          x: start.current.offset.x + pageX - start.current.pageX,
          y: start.current.offset.y + pageY - start.current.pageY,
        },
        photo,
        FRAME,
        zoom,
      ),
    );
  };

  const s = photoScale(photo, FRAME, zoom);
  const width = photo.width * s;
  const height = photo.height * s;

  return (
    <View style={styles.root}>
      <View
        style={styles.frame}
        accessibilityLabel="Photo. Drag to move it, pinch to zoom."
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => begin(e)}
        onResponderMove={move}
      >
        <View style={styles.photo}>
          <Image
            source={{ uri }}
            style={{
              position: 'absolute',
              width,
              height,
              left: (FRAME - width) / 2 + offset.x,
              top: (FRAME - height) / 2 + offset.y,
            }}
          />
        </View>
        {/* What falls outside the circle stays visible, dimmed. */}
        <Svg width={FRAME} height={FRAME} style={styles.mask} aria-hidden>
          <Path
            d={`M0 0H${FRAME}V${FRAME}H0Z M${FRAME / 2} 0A${FRAME / 2} ${FRAME / 2} 0 1 0 ${FRAME / 2} ${FRAME}A${FRAME / 2} ${FRAME / 2} 0 1 0 ${FRAME / 2} 0Z`}
            fill="rgb(242,242,247)"
            fillOpacity={0.72}
            fillRule="evenodd"
          />
        </Svg>
      </View>
      <View style={styles.zoom}>
        <Text style={type.caption}>Drag to move. Pinch or use + and − to zoom.</Text>
        <Stepper
          onMinus={() => applyZoom(zoom - ZOOM_STEP)}
          onPlus={() => applyZoom(zoom + ZOOM_STEP)}
          minusLabel="Zoom out"
          plusLabel="Zoom in"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 12 },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.fill,
    // Dragging here moves the photo, not the page.
    ...(Platform.OS === 'web'
      ? ({ touchAction: 'none', cursor: 'grab', userSelect: 'none' } as object)
      : null),
  },
  photo: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' },
  mask: { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' },
  zoom: { alignItems: 'center', gap: 8 },
});
