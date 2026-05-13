// Voice input hook - uses Web Speech API on web, stub on native
import { useState, useRef, useCallback } from "react";
import { Platform } from "react-native";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recognitionRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((text: string | null) => void) | null>(null);

  const startRecording = useCallback(async () => {
    if (Platform.OS !== "web") {
      throw new Error("Voice requires the native app.");
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Speech recognition not supported in this browser. Use Chrome.");
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    return new Promise<void>((resolve, reject) => {
      recognition.onstart = () => {
        setIsRecording(true);
        setRecordingDuration(0);
        intervalRef.current = setInterval(() => {
          setRecordingDuration((d) => d + 1);
        }, 1000);
        resolve();
      };

      recognition.onerror = (event: any) => {
        cleanup();
        if (event.error === "not-allowed") {
          reject(new Error("Microphone permission denied"));
        } else {
          reject(new Error(`Speech error: ${event.error}`));
        }
      };

      recognition.onend = () => {
        // If no result came, resolve with null
        if (resolveRef.current) {
          resolveRef.current(null);
          resolveRef.current = null;
        }
        cleanup();
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (resolveRef.current) {
          resolveRef.current(transcript);
          resolveRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    });
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      } else {
        resolve(null);
      }
    });
  }, []);

  const cleanup = () => {
    setIsRecording(false);
    setRecordingDuration(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    recognitionRef.current = null;
  };

  return { isRecording, recordingDuration, startRecording, stopRecording };
}
