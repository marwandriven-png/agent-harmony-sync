import { useState, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Loader2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCall, useEvaluateCall } from '@/hooks/useCalls';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CallRecorderProps {
  leadId?: string;
  leadName?: string;
  phoneNumber: string;
  variant?: 'icon' | 'button' | 'compact';
  className?: string;
  onCallStarted?: () => void;
}

type CallState = 'idle' | 'ringing' | 'connected' | 'ended' | 'processing';

export function CallRecorder({
  leadId,
  leadName,
  phoneNumber,
  variant = 'button',
  className,
  onCallStarted,
}: CallRecorderProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [notes, setNotes] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const createCall = useCreateCall();
  const evaluateCall = useEvaluateCall();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      toast.error('Microphone access denied. Notes will be used instead.');
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const startCall = async () => {
    setCallState('ringing');
    setDialogOpen(true);
    setDuration(0);
    setNotes('');
    setTranscript('');

    // Simulate ringing -> connected after 2s
    setTimeout(async () => {
      setCallState('connected');
      const id = setInterval(() => setDuration((d) => d + 1), 1000);
      setIntervalId(id);
      await startRecording();
      onCallStarted?.();
    }, 2000);
  };

  const endCall = async () => {
    if (intervalId) clearInterval(intervalId);
    setIntervalId(null);
    setCallState('ended');
    await stopRecording();
  };

  const saveCall = async () => {
    setCallState('processing');
    try {
      // 1. Save the call record
      const callData = await createCall.mutateAsync({
        lead_id: leadId,
        phone_number: phoneNumber,
        direction: 'outbound',
        status: 'completed',
        duration_seconds: duration,
        notes: notes || undefined,
        transcript_text: transcript || undefined,
      });

      // 2. If we have audio, transcribe it
      let audioBase64: string | null = null;
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0) {
          audioBase64 = await blobToBase64(audioBlob);
        }
      }

      if (audioBase64 || notes) {
        // Transcribe via edge function
        toast.info('Generating AI transcript...');
        const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('call-transcribe', {
          body: {
            call_id: callData.id,
            audio_base64: audioBase64,
            notes,
            direction: 'outbound',
            duration_seconds: duration,
          },
        });

        if (transcribeError) {
          console.error('Transcription error:', transcribeError);
          toast.error('Transcription failed, but call was saved.');
        } else if (transcribeData?.has_transcript) {
          toast.success('Transcript generated!');

          // 3. Auto-run AI evaluation
          toast.info('Running AI evaluation...');
          try {
            await evaluateCall.mutateAsync(callData.id);
          } catch (evalErr) {
            console.error('Evaluation error:', evalErr);
            // Don't show error - evaluation can be retried manually
          }
        }
      }

      setDialogOpen(false);
      setCallState('idle');
      setDuration(0);
    } catch (err) {
      console.error('Save call error:', err);
      setCallState('ended');
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const stateColors: Record<CallState, string> = {
    idle: '',
    ringing: 'animate-pulse',
    connected: 'ring-2 ring-green-500/50',
    ended: '',
    processing: '',
  };

  return (
    <>
      {variant === 'icon' ? (
        <Button
          size="icon"
          variant="ghost"
          className={cn('h-8 w-8 text-green-500 hover:bg-green-500/10', className)}
          onClick={startCall}
          title={`Call ${phoneNumber}`}
        >
          <Phone className="w-4 h-4" />
        </Button>
      ) : variant === 'compact' ? (
        <Button
          size="sm"
          variant="outline"
          className={cn('gap-1.5', className)}
          onClick={startCall}
        >
          <Phone className="w-3.5 h-3.5" />
          Call
        </Button>
      ) : (
        <Button
          className={cn('gap-2', className)}
          onClick={startCall}
        >
          <Phone className="w-4 h-4" />
          Call {leadName || phoneNumber}
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              {callState === 'ringing'
                ? 'Calling...'
                : callState === 'connected'
                ? 'Call In Progress'
                : callState === 'processing'
                ? 'Processing...'
                : callState === 'ended'
                ? 'Call Ended'
                : 'Call'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Call info */}
            <div className="text-center py-4">
              <p className="text-lg font-semibold">{leadName || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground font-mono">{phoneNumber}</p>

              {/* Timer */}
              <div className={cn(
                'mt-4 inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted/50',
                stateColors[callState],
              )}>
                {callState === 'ringing' ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : callState === 'processing' ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : (
                  <span className="text-2xl font-mono font-bold">{formatTime(duration)}</span>
                )}
              </div>

              {callState === 'connected' && (
                <div className="mt-2 flex items-center justify-center gap-1 text-sm">
                  {isRecording ? (
                    <span className="flex items-center gap-1 text-green-500">
                      <Mic className="w-3.5 h-3.5" />
                      Recording
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MicOff className="w-3.5 h-3.5" />
                      No microphone
                    </span>
                  )}
                </div>
              )}

              {callState === 'processing' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Saving call & generating AI transcript...
                </p>
              )}
            </div>

            {/* Controls */}
            {callState === 'connected' && (
              <div className="flex justify-center">
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full w-16 h-16"
                  onClick={endCall}
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
              </div>
            )}

            {/* Post-call form */}
            {callState === 'ended' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Call Notes</label>
                  <Textarea
                    placeholder="What was discussed..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Transcript {isRecording ? '(will be auto-generated from recording)' : '(paste or type)'}
                  </label>
                  <Textarea
                    placeholder={audioChunksRef.current.length > 0
                      ? "Audio recorded — AI will transcribe automatically. Or paste your own transcript here."
                      : "Paste call transcript for AI evaluation..."
                    }
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={4}
                  />
                </div>
                {audioChunksRef.current.length > 0 && (
                  <p className="text-xs text-green-500 flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    Audio recorded — AI will auto-transcribe & evaluate after saving
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={saveCall}
                    disabled={createCall.isPending}
                  >
                    {createCall.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : null}
                    Save & Analyze
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      setCallState('idle');
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
