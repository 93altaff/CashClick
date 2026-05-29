// In-app tutorial video player. Plays mp4 inline via expo-video with native
// controls. Source can be a local require() or a remote URL.
import React from "react";
import { View, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

type Props = { url: string; height?: number };

export default function TutorialVideo({ url, height = 200 }: Props) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = false;
  });

  return (
    <View style={[styles.wrap, { height }]}>
      <VideoView
        style={StyleSheet.absoluteFillObject}
        player={player}
        nativeControls
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
});
