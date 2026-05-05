import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export type SwipeAction = 'done' | 'skipped';

export type IntakeSwipeCardProps = {
  title: string;
  subtitle?: string;
  /** When set, the card is rendered in its locked state (no gesture, badge visible). */
  alreadyLogged?: SwipeAction;
  onDone: () => void;
  onSkip: () => void;
};

const SWIPE_THRESHOLD_RATIO = 0.3;
const SPRING_CONFIG = { damping: 18, stiffness: 220 };

const COLOR_DONE = '#1f9d55';
const COLOR_SKIP = '#cc3333';
const COLOR_LOGGED_BG = '#f4f4f4';
const COLOR_CARD = '#ffffff';

function triggerHapticsMedium(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function IntakeSwipeCard({
  title,
  subtitle,
  alreadyLogged,
  onDone,
  onSkip,
}: IntakeSwipeCardProps) {
  const { width: windowWidth } = useWindowDimensions();
  const threshold = useMemo(
    () => windowWidth * SWIPE_THRESHOLD_RATIO,
    [windowWidth],
  );

  const translateX = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(alreadyLogged === undefined)
        .activeOffsetX([-12, 12])
        .onUpdate((e) => {
          translateX.value = e.translationX;
        })
        .onEnd((e) => {
          if (e.translationX > threshold) {
            runOnJS(triggerHapticsMedium)();
            runOnJS(onDone)();
          } else if (e.translationX < -threshold) {
            runOnJS(triggerHapticsMedium)();
            runOnJS(onSkip)();
          }
          translateX.value = withSpring(0, SPRING_CONFIG);
        }),
    [alreadyLogged, threshold, translateX, onDone, onSkip],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const doneOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, threshold], [0, 1], 'clamp'),
  }));

  const skipOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-threshold, 0], [1, 0], 'clamp'),
  }));

  if (alreadyLogged) {
    return <LoggedCard title={title} subtitle={subtitle} status={alreadyLogged} />;
  }

  return (
    <View style={styles.outer}>
      <Animated.View style={[styles.overlay, styles.overlayDone, doneOverlayStyle]}>
        <Text style={styles.overlayText}>✓ Fait</Text>
      </Animated.View>
      <Animated.View style={[styles.overlay, styles.overlaySkip, skipOverlayStyle]}>
        <Text style={styles.overlayText}>✗ Passer</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <Text style={styles.hint}>← passer · valider →</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function LoggedCard({
  title,
  subtitle,
  status,
}: {
  title: string;
  subtitle?: string;
  status: SwipeAction;
}) {
  const badge = status === 'done' ? '✓ Pris' : '✗ Passé';
  const badgeColor = status === 'done' ? COLOR_DONE : COLOR_SKIP;
  return (
    <View style={[styles.card, styles.cardLogged]}>
      <View style={styles.loggedHeader}>
        <Text style={[styles.title, styles.titleLogged]}>{title}</Text>
        <Text style={[styles.badge, { color: badgeColor, borderColor: badgeColor }]}>
          {badge}
        </Text>
      </View>
      {subtitle ? <Text style={[styles.subtitle, styles.subtitleLogged]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'relative',
    marginVertical: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  overlayDone: {
    left: 0,
    backgroundColor: COLOR_DONE,
    alignItems: 'flex-start',
  },
  overlaySkip: {
    right: 0,
    backgroundColor: COLOR_SKIP,
    alignItems: 'flex-end',
  },
  overlayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLOR_CARD,
    borderRadius: 12,
    padding: 20,
    minHeight: 120,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardLogged: {
    backgroundColor: COLOR_LOGGED_BG,
    elevation: 0,
    shadowOpacity: 0,
    minHeight: 80,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  titleLogged: {
    color: '#666',
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },
  subtitleLogged: {
    color: '#888',
    marginBottom: 0,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  loggedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 6,
  },
});
