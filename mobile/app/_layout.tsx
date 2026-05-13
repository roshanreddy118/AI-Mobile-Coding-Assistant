import { Stack } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "@/lib/SessionContext";

function GlowTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={headerStyles.row}>
      <Text style={headerStyles.icon}>{icon}</Text>
      <Text style={headerStyles.title}>{label}</Text>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: {
    fontSize: 22,
    ...Platform.select({
      web: { textShadow: "0 0 12px rgba(0, 255, 200, 0.8), 0 0 30px rgba(0, 255, 200, 0.4)" },
    }),
  },
  title: {
    color: "#00ffc8",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
    ...Platform.select({
      web: { textShadow: "0 0 10px rgba(0, 255, 200, 0.7), 0 0 25px rgba(0, 255, 200, 0.35), 0 0 50px rgba(0, 255, 200, 0.15)" },
    }),
  },
});

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#0a0e1a",
            borderBottomWidth: 1,
            borderBottomColor: "rgba(0, 255, 200, 0.15)",
            ...Platform.select({
              web: { boxShadow: "0 2px 20px rgba(0, 255, 200, 0.1)" },
            }),
          },
          headerTintColor: "#00ffc8",
          headerTitleStyle: { fontWeight: "800", letterSpacing: 1 },
          contentStyle: { backgroundColor: "#0a0e1a" },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ headerTitle: () => <GlowTitle icon="⚡" label="Coding Assistant" /> }}
        />
        <Stack.Screen
          name="terminal"
          options={{ headerTitle: () => <GlowTitle icon="⬢" label="Terminal" /> }}
        />
        <Stack.Screen
          name="files"
          options={{ headerTitle: () => <GlowTitle icon="◈" label="Files" /> }}
        />
        <Stack.Screen
          name="settings"
          options={{ headerTitle: () => <GlowTitle icon="⚙" label="Settings" /> }}
        />
      </Stack>
    </SessionProvider>
  );
}
