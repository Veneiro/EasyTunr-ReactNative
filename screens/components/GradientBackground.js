import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../styles/theme";

export default function GradientBackground({ children, style }) {
  return (
    <LinearGradient
      colors={theme.gradients.page}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.background, style]}
    >
      <View style={styles.blobTopLeft} pointerEvents="none" />
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
  },
  content: {
    flex: 1,
  },
  blobTopLeft: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -100,
    left: -90,
    backgroundColor: "rgba(147, 101, 255, 0.22)",
  },
  blobTopRight: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -120,
    right: -120,
    backgroundColor: "rgba(179, 133, 255, 0.18)",
  },
  blobBottom: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    bottom: -180,
    left: "30%",
    backgroundColor: "rgba(124, 88, 244, 0.14)",
  },
});
