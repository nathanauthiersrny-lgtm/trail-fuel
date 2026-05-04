import React from 'react';
import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ElevationChart } from '../../src/components/ElevationChart';
import type { GPXTrack } from '../../src/models/gpx-track';

const FIXTURE_FLAT: GPXTrack = {
  total_distance_km: 10,
  total_elevation_gain_m: 0,
  total_elevation_loss_m: 0,
  segments: Array.from({ length: 100 }, (_, i) => ({
    km: i * 0.1,
    elevation_m: 800,
    gradient: 0,
    estimated_time_min: i * 0.5,
  })),
};

const FIXTURE_HILLY: GPXTrack = {
  total_distance_km: 20,
  total_elevation_gain_m: 1200,
  total_elevation_loss_m: 1200,
  segments: Array.from({ length: 200 }, (_, i) => ({
    km: i * 0.1,
    elevation_m: 1000 + Math.sin((i / 200) * Math.PI * 4) * 400,
    gradient: Math.cos((i / 200) * Math.PI * 4) * 15,
    estimated_time_min: i * 0.8,
  })),
};

const FIXTURE_LONG: GPXTrack = {
  total_distance_km: 80,
  total_elevation_gain_m: 4500,
  total_elevation_loss_m: 4500,
  segments: Array.from({ length: 800 }, (_, i) => ({
    km: i * 0.1,
    elevation_m: 1500 + Math.sin((i / 800) * Math.PI * 10) * 600 + (i / 800) * 200,
    gradient: Math.cos((i / 800) * Math.PI * 10) * 20,
    estimated_time_min: i * 1.2,
  })),
};

export default function DevElevationChart() {
  // Hooks must be called unconditionally even though we redirect in production.
  const { width } = useWindowDimensions();

  if (!__DEV__) return <Redirect href="/" />;

  const chartWidth = width - 32;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>ElevationChart — dev sandbox</Text>

      <Text style={styles.label}>Flat (100 segments, no downsampling)</Text>
      <View style={styles.chartBox}>
        <ElevationChart track={FIXTURE_FLAT} width={chartWidth} height={80} />
      </View>

      <Text style={styles.label}>Hilly (200 segments, sin wave)</Text>
      <View style={styles.chartBox}>
        <ElevationChart track={FIXTURE_HILLY} width={chartWidth} height={120} />
      </View>

      <Text style={styles.label}>Long race (800 segs → 200 after downsample)</Text>
      <View style={styles.chartBox}>
        <ElevationChart track={FIXTURE_LONG} width={chartWidth} height={160} />
      </View>

      <Text style={styles.label}>Custom color (blue)</Text>
      <View style={styles.chartBox}>
        <ElevationChart
          track={FIXTURE_HILLY}
          width={chartWidth}
          height={120}
          color="#2563EB"
          fillColor="rgba(37,99,235,0.12)"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  label: { fontSize: 12, color: '#666', marginTop: 12 },
  chartBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
  },
});
