// Web fallback for TutorialVideo: plain <video> element with controls.
import React from "react";
import { View, StyleSheet } from "react-native";

type Props = { url: string; height?: number };

export default function TutorialVideo({ url, height = 200 }: Props) {
  return (
    <View style={[styles.wrap, { height }]}>
      {/* @ts-expect-error - native video element on web only */}
      <video
        src={url}
        controls
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#000" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
});
