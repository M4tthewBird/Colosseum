import { useMemo, useState, type ReactNode } from 'react';
import { PanResponder, View, type GestureResponderHandlers } from 'react-native';

/**
 * Fixed-height rows that can be dragged by a handle to reorder. Works with touch and mouse.
 * renderRow gets the pan handlers to spread on the handle view.
 */
export function ReorderList<T extends { id: string }>({
  items,
  rowHeight,
  onReorder,
  renderRow,
}: {
  items: T[];
  rowHeight: number;
  onReorder: (from: number, to: number) => void;
  renderRow: (
    item: T,
    index: number,
    handle: GestureResponderHandlers,
    dragging: boolean,
  ) => ReactNode;
}) {
  const [drag, setDrag] = useState<{ from: number; dy: number } | null>(null);
  const count = items.length;

  const target = drag
    ? Math.max(0, Math.min(items.length - 1, drag.from + Math.round(drag.dy / rowHeight)))
    : -1;

  const handles = useMemo(
    () =>
      Array.from(
        { length: count },
        (_, index) =>
          PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => setDrag({ from: index, dy: 0 }),
            onPanResponderMove: (_e, g) => setDrag({ from: index, dy: g.dy }),
            onPanResponderRelease: (_e, g) => {
              const to = Math.max(0, Math.min(count - 1, index + Math.round(g.dy / rowHeight)));
              setDrag(null);
              if (to !== index) onReorder(index, to);
            },
            onPanResponderTerminate: () => setDrag(null),
          }).panHandlers,
      ),
    // Dragging only re-renders this list, so onReorder stays the same during a drag.
    [count, rowHeight, onReorder],
  );

  return (
    <View>
      {items.map((item, i) => {
        let shift = 0;
        if (drag) {
          if (i === drag.from) shift = drag.dy;
          else if (drag.from < target && i > drag.from && i <= target) shift = -rowHeight;
          else if (drag.from > target && i < drag.from && i >= target) shift = rowHeight;
        }
        const dragging = drag?.from === i;
        return (
          <View
            key={item.id}
            style={{
              height: rowHeight,
              transform: [{ translateY: shift }],
              zIndex: dragging ? 10 : 0,
              backgroundColor: dragging ? 'rgba(255,255,255,0.96)' : undefined,
              borderRadius: dragging ? 12 : 0,
              boxShadow: dragging ? '0 6px 18px rgba(0,0,0,0.12)' : undefined,
            }}
          >
            {renderRow(item, i, handles[i], dragging)}
          </View>
        );
      })}
    </View>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}
