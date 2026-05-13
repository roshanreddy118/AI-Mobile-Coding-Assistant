import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState("http://localhost:8000");
  const [providers, setProviders] = useState<any>(null);
  const [status, setStatus] = useState<"checking" | "connected" | "error">("checking");

  const checkConnection = async () => {
    setStatus("checking");
    try {
      api.setBaseUrl(serverUrl);
      const p = await api.getProviders();
      setProviders(p);
      setStatus("connected");
    } catch (e) {
      setStatus("error");
      setProviders(null);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 20 }}>
      {/* Provider info */}
      {providers && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LLM Providers</Text>
          <Text style={styles.label}>Default: {providers.default}</Text>
          {Object.entries(providers.providers || {}).map(([name, info]: any) => (
            <View key={name} style={styles.providerCard}>
              <View style={styles.providerHeader}>
                <Text style={styles.providerName}>{name.toUpperCase()}</Text>
                <View style={[styles.statusDot, info.configured ? styles.dotGreen : styles.dotRed]} />
              </View>
              <Text style={styles.providerModel}>Model: {info.model}</Text>
              <Text style={styles.providerFeatures}>Features: {info.features?.join(", ")}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0e1a" },
  section: { gap: 12 },
  sectionTitle: {
    color: "#00ffc8",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: "rgba(0, 255, 200, 0.06)",
    color: "#e0e0e0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "monospace",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 200, 0.2)",
  },
  connectBtn: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "rgba(0, 255, 200, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#00ffc8",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#334" },
  dotGreen: { backgroundColor: "#00ffc8" },
  dotRed: { backgroundColor: "#ff4466" },
  dotYellow: { backgroundColor: "#ffaa00" },
  statusText: { color: "#8899aa", fontSize: 13 },
  label: { color: "#8899aa", fontSize: 13 },
  providerCard: {
    backgroundColor: "rgba(0, 255, 200, 0.04)",
    borderRadius: 10,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 200, 0.12)",
  },
  providerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  providerName: { color: "#00ffc8", fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  providerModel: { color: "#668877", fontSize: 12, fontFamily: "monospace" },
  providerFeatures: { color: "#556666", fontSize: 11 },
});
