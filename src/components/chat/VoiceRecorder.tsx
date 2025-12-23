import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "~/convex/_generated/api";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import { Mic, Loader2, Square } from "lucide-react";
import { cn } from "~/lib/utils";

interface VoiceRecorderProps {
  threadId: string | null;
}

export function VoiceRecorder({ threadId }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Mutations
  const generateUploadUrl = useMutation(api.voiceNotes.generateUploadUrl);
  const saveVoiceNote = useMutation(api.voiceNotes.saveVoiceNote);

  const startRecording = useCallback(async () => {
    if (!threadId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Process the recording
        if (chunksRef.current.length > 0) {
          setIsProcessing(true);
          try {
            const blob = new Blob(chunksRef.current, {
              type: mediaRecorder.mimeType,
            });

            // Upload to Convex storage
            const uploadUrl = await generateUploadUrl();
            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: {
                "Content-Type": blob.type,
              },
              body: blob,
            });

            if (!response.ok) {
              throw new Error("Failed to upload audio");
            }

            const { storageId } = await response.json();

            // Save voice note and trigger transcription
            await saveVoiceNote({
              threadId: threadId!,
              storageId,
            });
          } catch (error) {
            console.error("Failed to process voice note:", error);
          } finally {
            setIsProcessing(false);
            setDuration(0);
          }
        }
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setDuration(0);

      // Start duration timer
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, [threadId, generateUploadUrl, saveVoiceNote]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!threadId) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {isRecording && (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-muted-foreground">
            {formatDuration(duration)}
          </span>
        </div>
      )}

      <PromptInputButton
        onClick={toggleRecording}
        disabled={isProcessing}
        className={cn(
          isRecording && "bg-red-500 text-white hover:bg-red-600",
          isProcessing && "opacity-50"
        )}
        title={isRecording ? "Stop recording" : "Record voice note"}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </PromptInputButton>
    </div>
  );
}
