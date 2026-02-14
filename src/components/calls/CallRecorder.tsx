import { useState } from 'react';
import { Phone, PhoneOff, Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCall } from '@/hooks/useCalls';
import { cn } from '@/lib/utils';

interface CallRecorderProps {
  leadId?: string;
  leadName?: string;
  phoneNumber: string;
  variant?: 'icon' | 'button' | 'compact';
  className?: string;
}

type CallState = 'idle' | 'ringing' | 'connected' | 'ended';

export function CallRecorder({
  leadId,
  leadName,
  phoneNumber,
  variant = 'button',
  className,
}: CallRecorderProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [notes, setNotes] = useState('');
  const [transcript, setTranscript] = useState('');
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);
  const createCall = useCreateCall();

  const startCall = () => {
    setCallState('ringing');
    setDialogOpen(true);
    setDuration(0);
    setNotes('');
    setTranscript('');

    // Simulate ringing -> connected after 2s
    setTimeout(() => {
      setCallState('connected');
      const id = setInterval(() => setDuration((d) => d + 1), 1000);
      setIntervalId(id);
    }, 2000);
  };

  const endCall = async () => {
    if (intervalId) clearInterval(intervalId);
    setIntervalId(null);
    setCallState('ended');
  };

  const saveCall = async () => {
    await createCall.mutateAsync({
      lead_id: leadId,
      phone_number: phoneNumber,
      direction: 'outbound',
      status: 'completed',
      duration_seconds: duration,
      notes: notes || undefined,
      transcript_text: transcript || undefined,
    });
    setDialogOpen(false);
    setCallState('idle');
    setDuration(0);
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
                ) : (
                  <span className="text-2xl font-mono font-bold">{formatTime(duration)}</span>
                )}
              </div>

              {callState === 'connected' && (
                <div className="mt-2 flex items-center justify-center gap-1 text-green-500 text-sm">
                  <Mic className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </div>
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
                    Transcript (paste or type)
                  </label>
                  <Textarea
                    placeholder="Paste call transcript for AI evaluation..."
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={saveCall}
                    disabled={createCall.isPending}
                  >
                    {createCall.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : null}
                    Save Call
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
