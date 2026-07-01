import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Pause, Play } from "lucide-react";
import { toast } from "sonner";

interface VoiceDictationButtonProps {
  onText: (text: string, replace?: boolean) => void;
  className?: string;
  tooltip?: string;
  replace?: boolean;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export default function VoiceDictationButton({ onText, className = "", tooltip = "Hold to record", replace = false }: VoiceDictationButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const isHoldingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionAPI = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;

    if (!SpeechRecognitionAPI) {
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setTranscript(prev => prev + (prev ? " " : "") + transcript);
        } else {
          interimTranscript += transcript;
        }
      }
      if (interimTranscript) {
        setTranscript(prev => {
          const lastSpace = prev.lastIndexOf(" ");
          return prev.slice(0, lastSpace + 1) + interimTranscript;
        });
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        toast.error(`Voice error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (transcript.trim()) {
        onText(transcript.trim(), replace);
        toast.success("Text captured");
      }
      setTranscript("");
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onText, replace, transcript]);

  const handleMouseDown = () => {
    if (!recognitionRef.current) {
      toast.error("Voice recognition not supported in your browser");
      return;
    }
    isHoldingRef.current = true;
    setIsPaused(false);
    recognitionRef.current.start();
  };

  const handleMouseUp = () => {
    isHoldingRef.current = false;
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  const togglePauseResume = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
      if (isPaused) {
        recognitionRef.current.start();
        setIsPaused(false);
      } else {
        recognitionRef.current.abort();
        setIsPaused(true);
      }
    }
  };

  const handleStop = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      if (transcript.trim()) {
        onText(transcript.trim(), replace);
        toast.success("Text captured");
      }
      setTranscript("");
    }
  };

  if (typeof window === "undefined" || (!window.SpeechRecognition && !window.webkitSpeechRecognition)) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant={isRecording ? "destructive" : "outline"}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        title={tooltip}
        className={`h-8 w-8 p-0 rounded-lg ${className}`}
      >
        {isRecording ? (
          <div className="flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </Button>

      {isRecording && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={togglePauseResume}
            className="h-7 px-2 text-xs rounded-lg"
            title={isPaused ? "Resume recording" : "Pause recording"}
          >
            {isPaused ? (
              <Play className="w-3 h-3" />
            ) : (
              <Pause className="w-3 h-3" />
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleStop}
            className="h-7 px-2 text-xs rounded-lg"
            title="Stop and submit"
          >
            <MicOff className="w-3 h-3" />
          </Button>
          <div className="text-xs text-slate-600 dark:text-slate-400 max-w-32 truncate">
            {transcript || "Listening..."}
          </div>
        </div>
      )}
    </div>
  );
}
