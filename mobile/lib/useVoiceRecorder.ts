// Voice recording hook using expo-av (native only, no-op on web)
import { useState, useRef } from "react";
import { Platform } from "react-native";

let Audio: any = null;
if (Platform.OS !== "web") {
  Audio = require("expo-av").Audio;
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    if (Platform.OS === "web") {
      throw new Error("Voice recording is not supported on web");
    }
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Microphone permission denied");
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      intervalRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      throw err;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    try {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      return uri;
    } catch (err) {
      console.error("Failed to stop recording:", err);
      setIsRecording(false);
      return null;
    }
  };

  return { isRecording, recordingDuration, startRecording, stopRecording };
}
