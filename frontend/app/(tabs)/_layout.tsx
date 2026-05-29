// Bottom tabs layout with custom styling.
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform } from "react-native";
import { colors, fonts } from "@/src/theme";
import { AdBanner } from "@/src/components/Ads";

function TabIcon({ name, focused, label }: { name: any; focused: boolean; label: string }) {
  return (
    <View style={styles.tabItem}>
      <Feather name={name} size={22} color={focused ? colors.primary : colors.textTertiary} />
      <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.textTertiary, fontFamily: focused ? fonts.heading : fonts.body }]}>
        {label}
      </Text>
      {focused ? <View style={styles.dot} /> : <View style={{ height: 4 }} />}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: Platform.OS === "ios" ? 88 : 64,
              paddingTop: 6,
            },
          }}
        >
          <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} label="Home" /> }} />
          <Tabs.Screen name="earn" options={{ tabBarIcon: ({ focused }) => <TabIcon name="trending-up" focused={focused} label="Earn" /> }} />
          <Tabs.Screen name="refer" options={{ tabBarIcon: ({ focused }) => <TabIcon name="users" focused={focused} label="Refer" /> }} />
          <Tabs.Screen name="wallet" options={{ tabBarIcon: ({ focused }) => <TabIcon name="credit-card" focused={focused} label="Wallet" /> }} />
          <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} label="Profile" /> }} />
        </Tabs>
      </View>
      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: "center", justifyContent: "center", width: 72 },
  tabLabel: { fontSize: 10, marginTop: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 4 },
});
