import { useCallback, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, LayoutChangeEvent } from "react-native";

/* Whether a scroll box has more to see past each edge - the web marked the
 * element with data-more-start / data-more-end and faded those edges on
 * phones. Here it is state the caller renders a fade from (an
 * expo-linear-gradient over the edge). Spread the returned handlers onto a
 * ScrollView or FlatList. */
export function useScrollEdges(axis: "x" | "y") {
  const [edges, setEdges] = useState({ start: false, end: false });
  const [box, setBox] = useState(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const at = axis === "y" ? contentOffset.y : contentOffset.x;
      const max = axis === "y" ? contentSize.height - layoutMeasurement.height : contentSize.width - layoutMeasurement.width;
      const start = at > 2;
      const end = max - at > 2;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    },
    [axis],
  );

  const onContentSizeChange = useCallback(
    (w: number, h: number) => {
      const size = axis === "y" ? h : w;
      setEdges((prev) => {
        const end = size - box > 2;
        return prev.end === end ? prev : { ...prev, end };
      });
    },
    [axis, box],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => setBox(axis === "y" ? e.nativeEvent.layout.height : e.nativeEvent.layout.width),
    [axis],
  );

  return {
    moreStart: edges.start,
    moreEnd: edges.end,
    scrollProps: { onScroll, onContentSizeChange, onLayout, scrollEventThrottle: 32 },
  };
}
