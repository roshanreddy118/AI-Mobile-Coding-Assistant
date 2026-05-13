import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, FileEntry } from "@/lib/api";
import { useSession } from "@/lib/SessionContext";

export default function FilesScreen() {
  const { sessionId } = useSession();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState(".");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) loadFiles();
  }, [sessionId, currentPath]);

  const loadFiles = async () => {
    if (!sessionId) return;
    try {
      const { files: f } = await api.listFiles(sessionId, currentPath);
      setFiles(f);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePress = async (item: FileEntry) => {
    if (item.is_dir) {
      setCurrentPath(item.path);
      setFileContent(null);
      setViewingFile(null);
    } else {
      // Read file via execute cat
      try {
        const result = await api.execute(sessionId!, `cat "${item.path}"`);
        setFileContent(result.stdout || "(empty)");
        setViewingFile(item.name);
      } catch (e) {
        setFileContent("Error reading file");
      }
    }
  };

  const goUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length ? parts.join("/") : ".");
    setFileContent(null);
    setViewingFile(null);
  };

  return (
    <View style={styles.container}>
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <TouchableOpacity onPress={goUp} style={styles.upBtn}>
          <Ionicons name="arrow-up" size={18} color="#00ffc8" />
        </TouchableOpacity>
        <Text style={styles.pathText}>/{currentPath === "." ? "" : currentPath}</Text>
      </View>

      {viewingFile ? (
        // File viewer
        <View style={styles.viewer}>
          <View style={styles.viewerHeader}>
            <Text style={styles.fileName}>{viewingFile}</Text>
            <TouchableOpacity onPress={() => { setFileContent(null); setViewingFile(null); }}>
              <Ionicons name="close" size={22} color="#00ffc8" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={fileContent?.split("\n") || []}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <View style={styles.codeLine}>
                <Text style={styles.lineNum}>{index + 1}</Text>
                <Text style={styles.codeText}>{item}</Text>
              </View>
            )}
          />
        </View>
      ) : (
        // File list
        <FlatList
          data={files}
          keyExtractor={(item) => item.path}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.fileRow} onPress={() => handlePress(item)}>
              <Ionicons
                name={item.is_dir ? "folder" : "document-text"}
                size={20}
                color={item.is_dir ? "#ffd700" : "#00ffc8"}
              />
              <Text style={styles.fileNameList}>{item.name}</Text>
              {item.size !== null && <Text style={styles.fileSize}>{formatSize(item.size)}</Text>}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No files yet. Use voice commands to create some!</Text>}
        />
      )}
    </View>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0e1a" },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 255, 200, 0.1)",
    backgroundColor: "rgba(10, 14, 26, 0.95)",
    gap: 8,
  },
  upBtn: {
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 200, 0.3)",
    backgroundColor: "rgba(0, 255, 200, 0.05)",
  },
  pathText: { color: "#00ffc8", fontSize: 14, fontFamily: "monospace" },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 255, 200, 0.06)",
    gap: 12,
  },
  fileNameList: { color: "#e0e0e0", fontSize: 15, flex: 1 },
  fileSize: { color: "#556677", fontSize: 12, fontFamily: "monospace" },
  empty: { color: "#556677", textAlign: "center", marginTop: 40, fontSize: 14 },
  viewer: { flex: 1, backgroundColor: "#0a0e1a" },
  viewerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 255, 200, 0.15)",
    backgroundColor: "rgba(0, 255, 200, 0.04)",
  },
  fileName: { color: "#00ffc8", fontSize: 15, fontWeight: "700" },
  codeLine: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 3 },
  lineNum: { color: "#334455", width: 35, fontSize: 12, fontFamily: "monospace", textAlign: "right", marginRight: 12 },
  codeText: { color: "#c0e0d0", fontSize: 13, fontFamily: "monospace", flex: 1 },
});
