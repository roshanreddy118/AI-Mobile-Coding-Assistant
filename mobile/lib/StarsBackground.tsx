import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions, Platform } from "react-native";

const STAR_COUNT = 40;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface Star {
  x: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

function createStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * SCREEN_W,
    size: Math.random() * 2.5 + 1,
    opacity: Math.random() * 0.6 + 0.2,
    duration: Math.random() * 6000 + 4000,
    delay: Math.random() * 5000,
  }));
}

function AnimatedStar({ star }: { star: Star }) {
  const translateY = useRef(new Animated.Value(-star.size)).current;
  const twinkle = useRef(new Animated.Value(star.opacity)).current;

  useEffect(() => {
    // Fall animation
    const fall = () => {
      translateY.setValue(-star.size - 20);
      Animated.timing(translateY, {
        toValue: SCREEN_H + 20,
        duration: star.duration,
        delay: star.delay,
        useNativeDriver: true,
      }).start(() => {
        star.delay = 0; // no delay on repeat
        fall();
      });
    };
    fall();

    // Twinkle animation
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: Math.min(star.opacity + 0.3, 1),
          duration: 800 + Math.random() * 1200,
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: star.opacity * 0.4,
          duration: 800 + Math.random() * 1200,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();

    return () => shimmer.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: star.x,
        width: star.size,
        height: star.size,
        borderRadius: star.size / 2,
        backgroundColor: "#fff",
        opacity: twinkle,
        transform: [{ translateY }],
        ...(Platform.OS === "web"
          ? { boxShadow: `0 0 ${star.size * 3}px rgba(0, 255, 200, ${star.opacity})` }
          : {}),
      }}
    />
  );
}

export function StarsBackground() {
  const stars = useRef(createStars()).current;

  return (
    <View style={styles.container} pointerEvents="none">
      {stars.map((star, i) => (
        <AnimatedStar key={i} star={star} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },
});
