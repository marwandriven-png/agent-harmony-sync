import { CalledCall, useEvaluateCall } from '@/hooks/useCalls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, Brain, Star, AlertTriangle, Loader2, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CallDetailPanelProps {
  call: CalledCall;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  answered: 'bg-green-500/15 text-green-400 border-green-500/30',
  missed: 'bg-red-500/15 text-red-400 border-red-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  busy: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  rejected: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

function ScoreGauge({ label, score, color }: { label: string; score: number | null; color: string }) {
  const s = score ?? 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{s}/100</span>
      </div>
      <Progress value={s} className={`h-2 ${color}`} />
    </div>
  );
}

export function CallDetailPanel({ call, onClose }: CallDetailPanelProps) {
  const evaluateCall = useEvaluateCall();
  const hasEvaluation = call.ai_evaluation_status === 'completed';
  const canEvaluate = call.transcript_text && call.ai_evaluation_status !== 'processing';

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="border-l border-border bg-card h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          {call.direction === 'outbound' ? (
            <PhoneOutgoing className="w-5 h-5 text-blue-400" />
          ) : (
            <PhoneIncoming className="w-5 h-5 text-green-400" />
          )}
          <h3 className="font-semibold">Call Details</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Basic Info */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Phone</span>
                <span className="font-mono text-sm">{call.phone_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Status</span>
                <Badge variant="outline" className={statusColors[call.status] || ''}>
                  {call.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Direction</span>
                <span className="capitalize text-sm">{call.direction}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Date</span>
                <span className="text-sm">{format(new Date(call.call_date), 'MMM d, yyyy HH:mm')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Duration</span>
                <span className="text-sm flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(call.duration_seconds || 0)}
                </span>
              </div>
              {call.lead && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Lead</span>
                  <span className="text-sm font-medium">{call.lead.name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Evaluation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                AI Evaluation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasEvaluation ? (
                <>
                  <ScoreGauge label="Overall Score" score={call.ai_overall_score} color="" />
                  <ScoreGauge label="Confidence" score={call.ai_confidence_score} color="" />
                  <ScoreGauge label="Lead Intent" score={call.ai_lead_intent_score} color="" />
                  <ScoreGauge label="Closing Probability" score={call.ai_closing_probability} color="" />
                </>
              ) : (
                <div className="text-center py-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    {call.ai_evaluation_status === 'processing'
                      ? 'AI is analyzing the call...'
                      : 'No AI evaluation yet'}
                  </p>
                  {canEvaluate && (
                    <Button
                      size="sm"
                      onClick={() => evaluateCall.mutate(call.id)}
                      disabled={evaluateCall.isPending}
                    >
                      {evaluateCall.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Evaluating...</>
                      ) : (
                        <><Brain className="w-4 h-4 mr-1" /> Run AI Evaluation</>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strengths & Weaknesses */}
          {hasEvaluation && (
            <div className="grid grid-cols-1 gap-3">
              {call.ai_strengths?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-400">
                      <Star className="w-4 h-4" /> Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {call.ai_strengths.map((s, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-green-400 mt-0.5">✓</span> {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {call.ai_weaknesses?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-orange-400">
                      <AlertTriangle className="w-4 h-4" /> Areas to Improve
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {call.ai_weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-orange-400 mt-0.5">!</span> {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Transcript */}
          {call.transcript_text && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {call.transcript_text}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {call.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{call.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
