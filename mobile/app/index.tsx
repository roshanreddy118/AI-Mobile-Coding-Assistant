import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, CommandResponse } from "@/lib/api";
import { useVoiceRecorder } from "@/lib/useVoiceRecorder";
import { useSession } from "@/lib/SessionContext";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  results?: CommandResponse["results"];
  previewUrl?: string | null;
}

export default function HomeScreen() {
  const router = useRouter();
  const { sessionId, provider, setProvider, initSession } = useSession();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "👋 Welcome! Tap the mic to give voice commands, or type below.\n\nExamples:\n• \"Create a React todo app\"\n• \"Add authentication with JWT\"\n• \"Fix the bug in server.py\"",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { isRecording, recordingDuration, startRecording, stopRecording } = useVoiceRecorder();

  // Create session on mount
  useEffect(() => {
    (async () => {
      try {
        const sid = await initSession("my-project");
        addMessage("system", `✅ Workspace ready (session: ${sid})`);
      } catch (e: any) {
        addMessage("system", `⚠️ Could not connect to backend: ${e.message}\n\nMake sure the server is running.`);
      }
    })();
  }, []);

  const addMessage = useCallback(
    (role: Message["role"], content: string, results?: CommandResponse["results"], previewUrl?: string | null) => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role, content, timestamp: new Date(), results, previewUrl },
      ]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    },
    []
  );

  // Send text command
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !sessionId) return;

    setInputText("");
    addMessage("user", text);
    setIsLoading(true);

    try {
      const resp = await api.sendCommand(sessionId, text, provider);
      const summary = formatResponse(resp);
      addMessage("assistant", summary, resp.results, resp.preview_url);
    } catch (e: any) {
      addMessage("assistant", `❌ Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice command
  const handleVoice = async () => {
    if (isRecording) {
      const uri = await stopRecording();
      if (!uri || !sessionId) return;

      addMessage("user", "🎤 (voice command)");
      setIsLoading(true);

      try {
        const resp = await api.sendVoice(sessionId, uri, provider);
        addMessage("user", `🎤 "${resp.transcript}"`);
        const summary = formatResponse(resp);
        addMessage("assistant", summary, resp.results, resp.preview_url);
      } catch (e: any) {
        addMessage("assistant", `❌ Voice error: ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      await startRecording();
    }
  };

  const formatResponse = (resp: CommandResponse): string => {
    let text = resp.description || resp.intent || "Done";
    for (const r of resp.results || []) {
      if (r.type === "write_file") text += `\n📄 Created: ${r.path}`;
      if (r.type === "patch_file") text += `\n✏️ Updated: ${r.path}`;
      if (r.type === "run_shell") {
        text += `\n💻 Ran: ${r.command}`;
        if (r.exit_code === 0) text += " ✅";
        else text += ` ❌ (exit ${r.exit_code})`;
        if (r.stdout) text += `\n${r.stdout.slice(0, 500)}`;
        if (r.stderr) text += `\n⚠️ ${r.stderr.slice(0, 300)}`;
      }
      if (r.type === "respond") text += `\n${r.content}`;
    }
    if (resp.preview_url) {
      text += `\n\n🌐 Preview ready!`;
    }
    return text;
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const isSystem = item.role === "system";

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : isSystem ? styles.systemBubble : styles.assistantBubble,
        ]}
      >
        <Text style={[styles.messageText, isSystem && styles.systemText]}>{item.content}</Text>
        {item.previewUrl && (
          <TouchableOpacity
            style={styles.previewBtn}
            onPress={() => {
              const fullUrl = api.getPreviewUrl(item.previewUrl!);
              if (Platform.OS === "web") {
                window.open(fullUrl, "_blank");
              } else {
                Linking.openURL(fullUrl);
              }
            }}
          >
            <Ionicons name="open-outline" size={16} color="#00ffc8" />
            <Text style={styles.previewBtnText}>Open Preview</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.timestamp}>
          {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Top bar with nav */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push("/files")}>
          <Ionicons name="folder-outline" size={22} color="#00ffc8" />
          <Text style={styles.navText}>Files</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push("/terminal")}>
          <Ionicons name="terminal-outline" size={22} color="#00ffc8" />
          <Text style={styles.navText}>Terminal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.providerBtn}
          onPress={() => {
            const providers = ["groq", "openrouter", "gemini"];
            const idx = providers.indexOf(provider);
            setProvider(providers[(idx + 1) % providers.length]);
          }}
        >
          <Ionicons name="hardware-chip-outline" size={18} color="#00ffc8" />
          <Text style={styles.providerText}>{provider}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={22} color="#00ffc8" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isLoading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator color="#00ffc8" size="small" />
          <Text style={styles.loadingText}>AI is thinking...</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a command..."
          placeholderTextColor="#666"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity
          style={[styles.micBtn, isRecording && styles.micBtnActive]}
          onPress={handleVoice}
        >
          <Ionicons name={isRecording ? "stop" : "mic"} size={28} color="#fff" />
          {isRecording && <Text style={styles.recDuration}>{recordingDuration}s</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
        >
          <Ionicons name="send" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0e1a" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 255, 200, 0.1)",
    backgroundColor: "rgba(10, 14, 26, 0.95)",
    gap: 8,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 200, 0.2)",
    backgroundColor: "rgba(0, 255, 200, 0.05)",
  },
  navText: { color: "#00ffc8", fontSize: 13, fontWeight: "600" },
  providerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 255, 200, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginLeft: "auto",
    borderWidth: 1,
    borderColor: "#00ffc8",
    ...Platform.select({
      web: { boxShadow: "0 0 12px rgba(0, 255, 200, 0.4)" },
    }),
  },
  providerText: { color: "#00ffc8", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  messageList: { padding: 12, paddingBottom: 8 },
  messageBubble: {
    maxWidth: "85%",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(233, 69, 96, 0.15)",
    borderColor: "rgba(233, 69, 96, 0.5)",
    ...Platform.select({
      web: { boxShadow: "0 0 15px rgba(233, 69, 96, 0.3)" },
    }),
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0, 255, 200, 0.06)",
    borderColor: "rgba(0, 255, 200, 0.25)",
    ...Platform.select({
      web: { boxShadow: "0 0 15px rgba(0, 255, 200, 0.15)" },
    }),
  },
  systemBubble: {
    alignSelf: "center",
    backgroundColor: "rgba(100, 100, 255, 0.08)",
    borderColor: "rgba(100, 100, 255, 0.3)",
    maxWidth: "95%",
    ...Platform.select({
      web: { boxShadow: "0 0 12px rgba(100, 100, 255, 0.2)" },
    }),
  },
  messageText: { color: "#e0e0e0", fontSize: 15, lineHeight: 22 },
  systemText: { color: "#9999cc", fontSize: 13 },
  timestamp: { color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 6, alignSelf: "flex-end" },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 255, 200, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#00ffc8",
    ...Platform.select({
      web: { boxShadow: "0 0 16px rgba(0, 255, 200, 0.5)" },
    }),
  },
  previewBtnText: { color: "#00ffc8", fontSize: 14, fontWeight: "700" },
  loadingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: { color: "#00ffc8", fontSize: 13, letterSpacing: 0.5 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 255, 200, 0.1)",
    backgroundColor: "rgba(10, 14, 26, 0.95)",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "rgba(0, 255, 200, 0.06)",
    color: "#e0e0e0",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 200, 0.2)",
  },
  micBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(233, 69, 96, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e94560",
    ...Platform.select({
      web: { boxShadow: "0 0 20px rgba(233, 69, 96, 0.5)" },
    }),
  },
  micBtnActive: {
    backgroundColor: "rgba(255, 34, 68, 0.35)",
    borderColor: "#ff2244",
    ...Platform.select({
      web: { boxShadow: "0 0 30px rgba(255, 34, 68, 0.7), 0 0 60px rgba(255, 34, 68, 0.3)" },
    }),
  },
  recDuration: { color: "#ff6688", fontSize: 10, position: "absolute", bottom: 1, fontWeight: "700" },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0, 255, 200, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#00ffc8",
    ...Platform.select({
      web: { boxShadow: "0 0 16px rgba(0, 255, 200, 0.4)" },
    }),
  },
  sendBtnDisabled: { opacity: 0.3 },
});
