// Web fallback for LogoVideo.
// Metro's web dev-server does not serve raw .mp4 via the require() pipeline,
// so on web we render a styled coin badge that matches the CashClick brand.
// On Expo Go / iOS / Android, ./LogoVideo.tsx (using expo-video) is used and
// the actual animated MP4 plays correctly.
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";

type Props = {
  size?: number;
  borderRadius?: number;
  backgroundColor?: string;
  style?: ViewStyle;
  testID?: string;
};

const BRAND = "#059669";

export default function LogoVideo({
  size = 40,
  borderRadius,
  backgroundColor,
  style,
  testID,
}: Props) {
  const radius = borderRadius ?? Math.round(size * 0.28);
  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: backgroundColor || BRAND,
        },
        style,
      ]}
    >
      <Feather name="dollar-sign" size={Math.round(size * 0.55)} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
