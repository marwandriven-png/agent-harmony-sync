import { useCalls } from '@/hooks/useCalls';
import { CallRecorder } from './CallRecorder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, Brain } from 'lucide-react';

interface LeadCallHistoryProps {
  leadId: string;
  leadName: string;
  phoneNumber: string;
}

export function LeadCallHistory({ leadId, leadName, phoneNumber }: LeadCallHistoryProps) {
  const { data: calls = [], isLoading } = useCalls({ leadId });

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Call History</h3>
        <CallRecorder
          leadId={leadId}
          leadName={leadName}
          phoneNumber={phoneNumber}
          variant="compact"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading calls...</p>
      ) : calls.length === 0 ? (
        <div className="text-center py-8">
          <Phone className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No calls recorded yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {calls.map((call) => (
            <div
              key={call.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="p-2 rounded-lg bg-muted">
                {call.direction === 'outbound' ? (
                  <PhoneOutgoing className="w-4 h-4 text-blue-500" />
                ) : (
                  <PhoneIncoming className="w-4 h-4 text-green-500" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">{call.direction}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      ['completed', 'answered'].includes(call.status)
                        ? 'text-green-500 border-green-500/30'
                        : call.status === 'missed'
                        ? 'text-red-500 border-red-500/30'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {call.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>{format(new Date(call.call_date), 'MMM d, HH:mm')}</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {formatDuration(call.duration_seconds || 0)}
                  </span>
                </div>
              </div>

              {call.ai_overall_score != null && (
                <div className="flex items-center gap-1 text-sm">
                  <Brain className="w-3.5 h-3.5 text-purple-500" />
                  <span
                    className={`font-semibold ${
                      call.ai_overall_score >= 70
                        ? 'text-green-500'
                        : call.ai_overall_score >= 50
                        ? 'text-yellow-500'
                        : 'text-red-500'
                    }`}
                  >
                    {Math.round(call.ai_overall_score)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
