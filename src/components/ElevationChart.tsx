import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Circle, Path, Svg } from 'react-native-svg';

import type { GPXSegment, GPXTrack } from '../models/gpx-track';
import type { PlannedEvent, PlannedEventType } from '../models/planned-event';
import { downsampleForDisplay } from '../engine/gpx/display';

type Props = {
  track: GPXTrack;
  width: number;
  height: number;
  color?: string;
  fillColor?: string;
  events?: PlannedEvent[];
};

const MARKER_COLOR: Record<PlannedEventType, string> = {
  intake: '#FF6B35',
  check_in: '#4A90D9',
  aid_station: '#4CAF50',
  fluid_reminder: '#2196F3',
};

function findIndexForMinute(points: GPXSegment[], minute: number): number {
  if (points.length === 0) return 0;
  let best = 0;
  let bestDiff = Math.abs(points[0].estimated_time_min - minute);
  for (let i = 1; i < points.length; i++) {
    const diff = Math.abs(points[i].estimated_time_min - minute);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

export function ElevationChart({
  track,
  width,
  height,
  color = '#FF6B35',
  fillColor = 'rgba(255,107,53,0.15)',
  events,
}: Props) {
  const points = downsampleForDisplay(track);
  if (points.length < 2) return <View style={{ width, height }} />;

  const elevations = points.map((p) => p.elevation_m);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const eleRange = maxEle - minEle || 1;

  const pad = 4;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const toX = (i: number) => pad + (i / (points.length - 1)) * chartW;
  const toY = (ele: number) =>
    pad + chartH - ((ele - minEle) / eleRange) * chartH;

  // Build SVG path: moveTo first point, lineTo remaining
  const lineParts = points.map((p, i) => {
    const x = toX(i).toFixed(1);
    const y = toY(p.elevation_m).toFixed(1);
    return i === 0 ? `M${x},${y}` : `L${x},${y}`;
  });

  // Close the fill area along the bottom
  const lastX = toX(points.length - 1).toFixed(1);
  const firstX = toX(0).toFixed(1);
  const bottomY = (pad + chartH).toFixed(1);
  const fillPath =
    lineParts.join(' ') +
    ` L${lastX},${bottomY} L${firstX},${bottomY} Z`;

  const linePath = lineParts.join(' ');

  const markers =
    events && events.length > 0
      ? events.map((ev, idx) => {
          const ptIdx = findIndexForMinute(points, ev.scheduled_at_minute);
          const cx = toX(ptIdx);
          const cy = toY(points[ptIdx].elevation_m);
          return (
            <Circle
              key={idx}
              cx={cx}
              cy={cy}
              r={4}
              fill={MARKER_COLOR[ev.type]}
              stroke="#fff"
              strokeWidth={1}
            />
          );
        })
      : null;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Path d={fillPath} fill={fillColor} stroke="none" />
        <Path d={linePath} fill="none" stroke={color} strokeWidth={1.5} />
        {markers}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
