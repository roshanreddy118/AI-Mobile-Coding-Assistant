// Voice input hook - uses Web Speech API on web
import { useState, useRef, useCallback } from "react";
import { Platform } from "react-native";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recognitionRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<string>("");
  const stoppedByUserRef = useRef(false);
  const resolveRef = useRef<((text: string | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    setIsRecording(false);
    setRecordingDuration(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    recognitionRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (Platform.OS !== "web") {
      throw new Error("Voice requires the native app.");
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Speech recognition not supported in this browser. Use Chrome.");
    }

    transcriptRef.current = "";
    stoppedByUserRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

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
        if (event.error === "not-allowed") {
          cleanup();
          reject(new Error("Microphone permission denied"));
        }
        // Ignore other errors like "no-speech" — keep listening
      };

      recognition.onend = () => {
        // If user stopped, resolve with collected transcript
        if (stoppedByUserRef.current) {
          if (resolveRef.current) {
            resolveRef.current(transcriptRef.current || null);
            resolveRef.current = null;
          }
          cleanup();
        } else {
          // Browser auto-stopped (silence timeout) — restart to keep listening
          try {
            recognition.start();
          } catch (e) {
            if (resolveRef.current) {
              resolveRef.current(transcriptRef.current || null);
              resolveRef.current = null;
            }
            cleanup();
          }
        }
      };

      recognition.onresult = (event: any) => {
        // Accumulate all results
        let full = "";
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript + " ";
        }
        transcriptRef.current = full.trim();
      };

      recognitionRef.current = recognition;
      recognition.start();
    });
  }, [cleanup]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    stoppedByUserRef.current = true;
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      } else {
        resolve(transcriptRef.current || null);
      }
    });
  }, []);

  return { isRecording, recordingDuration, startRecording, stopRecording };
}
