// Animated CashClick logo (looping muted MP4). Drop-in replacement for the
// static dollar-sign brand mark, used in TopBar, splash, login and the
// profile-tab top-right mascot.
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

const LOGO_SOURCE = require("../../assets/videos/cashclick-logo.mp4");

type Props = {
  size?: number;
  borderRadius?: number;
  backgroundColor?: string;
  style?: ViewStyle;
  testID?: string;
};

export default function LogoVideo({
  size = 40,
  borderRadius,
  backgroundColor = "transparent",
  style,
  testID,
}: Props) {
  const player = useVideoPlayer(LOGO_SOURCE, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const radius = borderRadius ?? Math.round(size * 0.28);

  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: radius, backgroundColor },
        style,
      ]}
    >
      <VideoView
        style={{ width: size, height: size }}
        player={player}
        nativeControls={false}
        contentFit="cover"
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
