import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { appBackground } from '../theme/assetImages';

const dots = Array.from({ length: 25 }, (_, index) => index);

export default function ScreenTexture({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={appBackground}
        resizeMode="cover"
        style={styles.backgroundImage}
      />
      <View style={[styles.topGlow, { backgroundColor: color }]} />
      <View style={[styles.sideGlow, { backgroundColor: color }]} />
      <View style={[styles.bottomGlow, { backgroundColor: color }]} />
      <View style={styles.dotGrid}>
        {dots.map((dot) => (
          <View
            key={dot}
            style={[
              styles.dot,
              {
                backgroundColor: color,
                opacity: dot % 3 === 0 ? 0.17 : 0.09,
              },
            ]}
          />
        ))}
      </View>
      <View style={[styles.ring, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.16,
  },
  topGlow: {
    position: 'absolute',
    top: -125,
    right: -75,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.18,
  },
  sideGlow: {
    position: 'absolute',
    top: 320,
    right: -125,
    width: 210,
    height: 210,
    borderRadius: 105,
    opacity: 0.07,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: 58,
    left: -120,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.12,
  },
  dotGrid: {
    position: 'absolute',
    top: 185,
    right: 28,
    width: 80,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  ring: {
    position: 'absolute',
    right: -28,
    bottom: 190,
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 18,
    opacity: 0.08,
  },
});
