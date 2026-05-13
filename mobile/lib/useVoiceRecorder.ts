// Voice recording hook - stub for web, real implementation needs native app
import { useState } from "react";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const startRecording = async () => {
    throw new Error("Voice recording requires the native app. Use text input on web.");
  };

  const stopRecording = async (): Promise<string | null> => {
    return null;
  };

  return { isRecording, recordingDuration, startRecording, stopRecording };
}
