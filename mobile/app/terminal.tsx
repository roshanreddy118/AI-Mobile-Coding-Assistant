import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useSession } from "@/lib/SessionContext";

export default function TerminalScreen() {
  const { sessionId } = useSession();
  const [lines, setLines] = useState<Array<{ type: string; text: string }>>([
    { type: "system", text: "Terminal connected. Type commands below.\n" },
  ]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (sessionId) {
      addLine("system", `Session: ${sessionId}\n$ `);
    }
  }, [sessionId]);

  const addLine = (type: string, text: string) => {
    setLines((prev) => [...prev, { type, text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const runCommand = async () => {
    const cmd = input.trim();
    if (!cmd || !sessionId) return;

    setInput("");
    addLine("stdin", `$ ${cmd}\n`);
    setIsRunning(true);

    try {
      const result = await api.execute(sessionId, cmd);
      if (result.stdout) addLine("stdout", result.stdout);
      if (result.stderr) addLine("stderr", result.stderr);
      addLine("system", `[exit: ${result.exit_code}]\n$ `);
    } catch (e: any) {
      addLine("stderr", `Error: ${e.message}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} style={styles.output} contentContainerStyle={{ padding: 12 }}>
        {lines.map((line, i) => (
          <Text
            key={i}
            style={[
              styles.line,
              line.type === "stderr" && styles.stderr,
              line.type === "stdin" && styles.stdin,
              line.type === "system" && styles.sysLine,
            ]}
          >
            {line.text}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <Text style={styles.prompt}>$</Text>
        <TextInput
          style={styles.textInput}
          placeholder="command..."
          placeholderTextColor="#555"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={runCommand}
          returnKeyType="go"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.runBtn} onPress={runCommand} disabled={isRunning}>
          <Ionicons name="play" size={20} color="#00ffc8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0e1a" },
  output: { flex: 1 },
  line: {
    color: "#00ffc8",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    lineHeight: 20,
    ...Platform.select({ web: { textShadow: "0 0 8px rgba(0, 255, 200, 0.5)" } }),
  },
  stderr: {
    color: "#ff4466",
    ...Platform.select({ web: { textShadow: "0 0 8px rgba(255, 68, 102, 0.5)" } }),
  },
  stdin: {
    color: "#66bbff",
    ...Platform.select({ web: { textShadow: "0 0 8px rgba(102, 187, 255, 0.5)" } }),
  },
  sysLine: {
    color: "#666699",
    ...Platform.select({ web: { textShadow: "0 0 4px rgba(102, 102, 153, 0.3)" } }),
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10, 14, 26, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 255, 200, 0.15)",
    gap: 8,
  },
  prompt: {
    color: "#00ffc8",
    fontFamily: "monospace",
    fontSize: 18,
    fontWeight: "bold",
    ...Platform.select({ web: { textShadow: "0 0 10px rgba(0, 255, 200, 0.7)" } }),
  },
  textInput: {
    flex: 1,
    color: "#e0e0e0",
    fontFamily: "monospace",
    fontSize: 14,
    backgroundColor: "rgba(0, 255, 200, 0.05)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 200, 0.2)",
  },
  runBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0, 255, 200, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#00ffc8",
    ...Platform.select({
      web: { boxShadow: "0 0 16px rgba(0, 255, 200, 0.4)" },
    }),
  },
});
