import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useColdCalls, useUpdateColdCall } from '@/hooks/useColdCalls';
import { useCreateProperty } from '@/hooks/useProperties';
import { useCalls, CalledCall, useEvaluateCall } from '@/hooks/useCalls';
import { CreateColdCallDialog } from '@/components/forms/CreateColdCallDialog';
import { ConvertColdCallDialog } from '@/components/forms/ConvertColdCallDialog';
import { LogCallDialog } from '@/components/calls/LogCallDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Search,
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  ArrowRight,
  Building2,
  Trash2,
  FileText,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Brain,
  Star,
  AlertTriangle,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CallRecorder } from '@/components/calls/CallRecorder';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import type { ColdCallWithProfile } from '@/hooks/useColdCalls';
import { useCallExportsStore, type CallExportedLead } from '@/store/callExportsStore';

type ColdCallStatus = Database['public']['Enums']['cold_call_status'];

const statusConfig: Record<ColdCallStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  new: { label: 'New', color: 'text-status-new', bg: 'bg-pastel-blue', icon: Phone },
  called: { label: 'Called', color: 'text-status-viewing', bg: 'bg-pastel-orange', icon: Clock },
  interested: { label: 'Interested', color: 'text-status-closed', bg: 'bg-pastel-green', icon: CheckCircle },
  not_interested: { label: 'Not Interested', color: 'text-status-lost', bg: 'bg-pastel-red', icon: XCircle },
  converted: { label: 'Converted', color: 'text-status-contacted', bg: 'bg-pastel-purple', icon: UserPlus },
};

const callStatusColors: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  answered: 'bg-green-500/15 text-green-400 border-green-500/30',
  missed: 'bg-red-500/15 text-red-400 border-red-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  busy: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  rejected: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// F-CVS KPI row component
function KPIRow({ name, score, weight, weightedScore, notes }: { name: string; score: number; weight: number; weightedScore: number; notes?: string }) {
  const pct = (score / 5) * 100;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground truncate mr-2" title={name}>{name} <span className="text-muted-foreground/60">×{weight}</span></span>
        <span className="font-semibold whitespace-nowrap">{score}/5 → {weightedScore.toFixed(1)}</span>
      </div>
      <Progress value={pct} className="h-1" />
      {notes && <p className="text-[10px] text-muted-foreground/70 italic truncate" title={notes}>{notes}</p>}
    </div>
  );
}

// Inline call detail card shown inside a cold call row
function InlineCallDetail({ call }: { call: CalledCall }) {
  const evaluateCall = useEvaluateCall();
  const queryClient = useQueryClient();
  const [transcribing, setTranscribing] = useState(false);
  const hasEvaluation = call.ai_evaluation_status === 'completed';
  const canEvaluate = call.transcript_text && call.ai_evaluation_status !== 'processing';
  const canTranscribe = !call.transcript_text && call.notes;

  const analysis = call.ai_full_analysis as any;
  const isFCVS = hasEvaluation && analysis?.call_type;

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('call-transcribe', {
        body: { call_id: call.id, notes: call.notes, direction: call.direction, duration_seconds: call.duration_seconds },
      });
      if (error) throw error;
      if (data?.has_transcript) {
        toast.success('Transcript generated!');
        queryClient.invalidateQueries({ queryKey: ['called_calls'] });
      }
    } catch (err: any) {
      toast.error(`Transcription failed: ${err.message}`);
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        {call.direction === 'outbound' ? (
          <span className="flex items-center gap-1"><PhoneOutgoing className="w-3.5 h-3.5 text-primary" /> Outbound</span>
        ) : (
          <span className="flex items-center gap-1"><PhoneIncoming className="w-3.5 h-3.5 text-green-500" /> Inbound</span>
        )}
        <Badge variant="outline" className={`text-xs ${callStatusColors[call.status] || ''}`}>
          {call.status.replace('_', ' ')}
        </Badge>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {formatDuration(call.duration_seconds || 0)}
        </span>
        <span>{format(new Date(call.call_date), 'MMM d, HH:mm')}</span>
        {isFCVS && (
          <>
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
              {analysis.call_type}
            </Badge>
            <Badge variant="outline" className={`text-xs ${
              analysis.confidence_level === 'High' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
              analysis.confidence_level === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
              'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {analysis.confidence_level} Confidence
            </Badge>
            <span className={`font-bold ${
              call.ai_overall_score != null && call.ai_overall_score >= 70 ? 'text-green-500' :
              call.ai_overall_score != null && call.ai_overall_score >= 40 ? 'text-yellow-500' : 'text-destructive'
            }`}>
              F-CVS: {call.ai_overall_score ?? 0}/100
            </span>
          </>
        )}
        {!isFCVS && call.ai_overall_score != null && (
          <span className={`font-semibold ${
            call.ai_overall_score >= 70 ? 'text-green-500' :
            call.ai_overall_score >= 50 ? 'text-yellow-500' : 'text-destructive'
          }`}>
            Score: {Math.round(call.ai_overall_score)}/100
          </span>
        )}
      </div>

      {/* F-CVS Detailed Breakdown */}
      {isFCVS ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Core KPIs */}
          <Card className="border-border">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                {analysis.call_type === 'SELLER' ? 'Listing KPIs (LCVS)' : 'Buyer KPIs (BCVS)'}
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Core: {analysis.core_cvs?.toFixed(1)} | ×{analysis.aps_multiplier}</p>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1">
              {analysis.core_kpis?.map((kpi: any, i: number) => (
                <KPIRow key={i} name={kpi.name} score={kpi.score} weight={kpi.weight} weightedScore={kpi.weighted_score} notes={kpi.notes} />
              ))}
            </CardContent>
          </Card>

          {/* Agent Performance */}
          <Card className="border-border">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-400" />
                Agent Performance (APS)
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">Score: {analysis.agent_performance_score?.toFixed(1)}/52.5</p>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1">
              {analysis.agent_kpis?.map((kpi: any, i: number) => (
                <KPIRow key={i} name={kpi.name} score={kpi.score} weight={kpi.weight} weightedScore={kpi.weighted_score} notes={kpi.notes} />
              ))}
            </CardContent>
          </Card>

          {/* Risk Flags & Recommendations */}
          <Card className="border-border">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                Risks & Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {analysis.risk_flags?.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-orange-400 mb-0.5">Risk Flags</p>
                  <ul className="space-y-0.5">
                    {analysis.risk_flags.map((f: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1">
                        <span className="text-orange-400">⚠</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.action_recommendations?.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-blue-400 mb-0.5">Recommendations</p>
                  <ul className="space-y-0.5">
                    {analysis.action_recommendations.map((r: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1">
                        <span className="text-blue-400">→</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(!analysis.risk_flags?.length && !analysis.action_recommendations?.length) && (
                <p className="text-xs text-muted-foreground italic">No flags</p>
              )}
            </CardContent>
          </Card>

          {/* Transcript */}
          <Card className="border-border">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs">Transcript & Notes</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {call.transcript_text ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {call.transcript_text}
                </p>
              ) : call.notes ? (
                <p className="text-xs text-muted-foreground">{call.notes}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No transcript or notes</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Fallback for calls without F-CVS */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border-border">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-400" /> AI Evaluation
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1.5">
              {hasEvaluation ? (
                <>
                  {[
                    { label: 'F-CVS', value: call.ai_overall_score },
                    { label: 'Agent (APS)', value: call.ai_confidence_score },
                    { label: 'Core CVS', value: call.ai_lead_intent_score },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold">{value ?? 0}/100</span>
                      </div>
                      <Progress value={value ?? 0} className="h-1" />
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-1 space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    {call.ai_evaluation_status === 'processing' ? 'AI analyzing...' : 'No evaluation yet'}
                  </p>
                  {canTranscribe && !canEvaluate && (
                    <Button size="sm" variant="outline" onClick={handleTranscribe} disabled={transcribing} className="text-xs h-7">
                      {transcribing ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Generating...</> : <><FileText className="w-3 h-3 mr-1" /> Generate Transcript</>}
                    </Button>
                  )}
                  {canEvaluate && (
                    <Button size="sm" onClick={() => evaluateCall.mutate(call.id)} disabled={evaluateCall.isPending} className="text-xs h-7">
                      {evaluateCall.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Evaluating...</> : <><Brain className="w-3 h-3 mr-1" /> Run AI Evaluation</>}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Strengths & Weaknesses</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
              {hasEvaluation ? (
                <>
                  {call.ai_strengths?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-400 flex items-center gap-1 mb-0.5">
                        <Star className="w-3 h-3" /> Strengths
                      </p>
                      <ul className="space-y-0.5">
                        {call.ai_strengths.map((s, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1">
                            <span className="text-green-400">✓</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {call.ai_weaknesses?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-orange-400 flex items-center gap-1 mb-0.5">
                        <AlertTriangle className="w-3 h-3" /> Weaknesses
                      </p>
                      <ul className="space-y-0.5">
                        {call.ai_weaknesses.map((w, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-1">
                            <span className="text-orange-400">!</span> {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Run evaluation to see analysis</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Transcript & Notes</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {call.transcript_text ? (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {call.transcript_text}
                </p>
              ) : call.notes ? (
                <p className="text-xs text-muted-foreground">{call.notes}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No transcript or notes</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ColdCallsPage() {
  const { data: coldCalls = [], isLoading } = useColdCalls();
  const { data: calledCalls = [], isLoading: callsLoading } = useCalls();
  const updateColdCall = useUpdateColdCall();
  const createProperty = useCreateProperty();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const exportedLeads = useCallExportsStore((s) => s.exportedLeads);
  const removeExportedLeads = useCallExportsStore((s) => s.removeLeads);

  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<'cold-calls' | 'exported'>(
    searchParams.get('view') === 'exported' ? 'exported' : 'cold-calls'
  );

  useEffect(() => {
    if (exportedLeads.length > 0 && searchParams.get('view') === 'exported') {
      setActiveView('exported');
    }
  }, [exportedLeads.length, searchParams]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ColdCallStatus | 'all'>('all');
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedColdCall, setSelectedColdCall] = useState<ColdCallWithProfile | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Build a map of phone -> calls for inline display
  const callsByPhone = useMemo(() => {
    const map = new Map<string, CalledCall[]>();
    calledCalls.forEach((c) => {
      const phone = c.phone_number.replace(/\D/g, '');
      const existing = map.get(phone) || [];
      existing.push(c);
      map.set(phone, existing);
    });
    return map;
  }, [calledCalls]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getCallsForColdCall = (coldCall: ColdCallWithProfile): CalledCall[] => {
    const normalized = coldCall.phone.replace(/\D/g, '');
    return callsByPhone.get(normalized) || [];
  };

  const filteredCalls = useMemo(() => {
    return coldCalls.filter((call) => {
      const matchesSearch = 
        call.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.phone.includes(searchQuery);
      const matchesStatus = filterStatus === 'all' || call.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [coldCalls, searchQuery, filterStatus]);

  const handleStatusChange = async (callId: string, status: ColdCallStatus) => {
    await updateColdCall.mutateAsync({
      id: callId,
      status,
      ...(status === 'called' ? { last_call_date: new Date().toISOString() } : {}),
    });
  };

  const handleConvertClick = (coldCall: ColdCallWithProfile) => {
    setSelectedColdCall(coldCall);
    setConvertDialogOpen(true);
  };

  const handleExportedToLead = async (lead: CallExportedLead) => {
    try {
      const { error } = await supabase.from('leads').insert({
        name: lead.name,
        email: lead.email || null,
        phone: lead.phone || 'N/A',
        source: 'other' as const,
        status: 'new' as const,
        priority: 'warm' as const,
        locations: lead.location ? [lead.location] : [],
        created_by: user?.id,
      });
      if (error) throw error;
      removeExportedLeads([lead.id]);
      toast.success(`${lead.name} converted to new lead`);
    } catch (err: any) {
      toast.error(`Failed to convert: ${err.message}`);
    }
  };

  const handleExportedToListing = async (lead: CallExportedLead) => {
    try {
      const property = await createProperty.mutateAsync({
        title: `Property from ${lead.name}`,
        type: 'apartment',
        price: 0,
        currency: 'AED',
        location: lead.location || 'TBD',
        bedrooms: 1,
        bathrooms: 1,
        size: 0,
        size_unit: 'sqft',
        description: `Listing sourced from exported lead: ${lead.name}`,
        features: [],
        images: [],
        status: 'available',
        section: 'database',
        database_status: 'interested',
        owner_name: lead.name,
        owner_mobile: lead.phone,
      });
      removeExportedLeads([lead.id]);
      if (property?.id) {
        navigate(`/properties?convert=${property.id}`);
      }
    } catch (err: any) {
      toast.error(`Failed to convert: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageHeader title="Cold Calls" subtitle="Manage and track your cold call prospects" />
        <PageContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Cold Calls"
        subtitle="Manage and track your cold call prospects"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Log Call
            </Button>
            <CreateColdCallDialog
              trigger={
                <Button className="bg-gradient-primary hover:opacity-90">
                  <Phone className="w-4 h-4 mr-2" />
                  Add Prospect
                </Button>
              }
            />
          </div>
        }
      />

      <PageContent>
        {/* Tab Switcher */}
        <div className="flex items-center gap-0 bg-muted/40 p-1 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveView('cold-calls')}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              activeView === 'cold-calls'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            )}
          >
            <Phone className="w-4 h-4" />
            Cold Calls ({coldCalls.length})
          </button>
          <button
            onClick={() => setActiveView('exported')}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              activeView === 'exported'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            )}
          >
            <FileText className="w-4 h-4" />
            Exported ({exportedLeads.length})
          </button>
        </div>

        {/* Cold Calls Tab */}
        {activeView === 'cold-calls' && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Status:</span>
                {(['all', 'new', 'called', 'interested', 'not_interested'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      filterStatus === status
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {status === 'all' ? 'All' : statusConfig[status].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cold Calls Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl shadow-card overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-4 px-6 text-sm font-semibold text-foreground">Name</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Phone</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Status</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Location</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Budget</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Agent</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-foreground">Last Call</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout">
                      {filteredCalls.map((call, index) => {
                        const StatusIcon = statusConfig[call.status].icon;
                        const agentName = call.profiles?.full_name || 'Unassigned';
                        const relatedCalls = getCallsForColdCall(call);
                        const isExpanded = expandedRows.has(call.id);
                        const hasCallLogs = relatedCalls.length > 0;
                        
                        return (
                          <motion.tr
                            key={call.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              "border-b border-border last:border-0 hover:bg-muted/30 transition-colors",
                              isExpanded && "border-b-0"
                            )}
                          >
                            {/* Main Row */}
                            <td colSpan={8} className="p-0">
                              <div
                                className={cn(
                                  "grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] items-center cursor-pointer",
                                  hasCallLogs && "cursor-pointer"
                                )}
                                onClick={() => hasCallLogs && toggleRow(call.id)}
                              >
                                <div className="py-4 px-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                      <span className="text-sm font-semibold text-foreground">
                                        {call.name.charAt(0)}
                                      </span>
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-foreground">{call.name}</p>
                                        {hasCallLogs && (
                                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                                            <PhoneCall className="w-2.5 h-2.5" />
                                            {relatedCalls.length}
                                          </Badge>
                                        )}
                                      </div>
                                      {call.email && (
                                        <p className="text-xs text-muted-foreground">{call.email}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="py-4 px-4">
                                  <span className="text-sm text-foreground">{call.phone}</span>
                                </div>
                                <div className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="focus:outline-none">
                                        <Badge className={cn(
                                          "gap-1 cursor-pointer hover:opacity-80",
                                          statusConfig[call.status].bg,
                                          statusConfig[call.status].color
                                        )}>
                                          <StatusIcon className="w-3 h-3" />
                                          {statusConfig[call.status].label}
                                        </Badge>
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                      {(['new', 'called', 'interested', 'not_interested'] as ColdCallStatus[]).map((status) => {
                                        const config = statusConfig[status];
                                        const Icon = config.icon;
                                        return (
                                          <DropdownMenuItem
                                            key={status}
                                            onClick={() => handleStatusChange(call.id, status)}
                                            disabled={call.status === 'converted' || updateColdCall.isPending}
                                          >
                                            <Icon className={cn("w-4 h-4 mr-2", config.color)} />
                                            {config.label}
                                          </DropdownMenuItem>
                                        );
                                      })}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                                <div className="py-4 px-4">
                                  <span className="text-sm text-muted-foreground">
                                    {call.location || '-'}
                                  </span>
                                </div>
                                <div className="py-4 px-4">
                                  <span className="text-sm font-medium text-foreground">
                                    {call.budget ? formatCurrency(call.budget) : '-'}
                                  </span>
                                </div>
                                <div className="py-4 px-4">
                                  <span className="text-sm text-muted-foreground">
                                    {agentName}
                                  </span>
                                </div>
                                <div className="py-4 px-4">
                                  <span className="text-sm text-muted-foreground">
                                    {call.last_call_date ? formatDate(call.last_call_date) : 'Never'}
                                  </span>
                                </div>
                                <div className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-2">
                                    {hasCallLogs && (
                                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleRow(call.id)}>
                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                      </Button>
                                    )}
                                    {call.status !== 'converted' ? (
                                      <>
                                        <CallRecorder
                                          phoneNumber={call.phone}
                                          leadName={call.name}
                                          variant="icon"
                                          onCallStarted={() => {
                                            if (call.status === 'new') {
                                              handleStatusChange(call.id, 'called');
                                            }
                                          }}
                                        />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleStatusChange(call.id, 'interested')}
                                          disabled={updateColdCall.isPending}
                                          title="Mark as Interested"
                                        >
                                          <MessageSquare className="w-4 h-4" />
                                        </Button>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              size="sm"
                                              className="bg-gradient-success hover:opacity-90"
                                            >
                                              <ArrowRight className="w-4 h-4 mr-1" />
                                              Convert
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleConvertClick(call)}>
                                              <UserPlus className="w-4 h-4 mr-2" />
                                              Convert to Lead
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleConvertClick(call)}>
                                              <Building2 className="w-4 h-4 mr-2" />
                                              Convert to Listing
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </>
                                    ) : (
                                      <Badge variant="secondary">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Converted
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded call details inline */}
                              <AnimatePresence>
                                {isExpanded && hasCallLogs && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden border-t border-border"
                                  >
                                    <div className="px-6 py-4 space-y-3 bg-muted/10">
                                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Call History ({relatedCalls.length})
                                      </p>
                                      {relatedCalls.map((rc) => (
                                        <InlineCallDetail key={rc.id} call={rc} />
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {filteredCalls.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No cold calls found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* Exported Tab */}
        {activeView === 'exported' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl shadow-card overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Exported Leads from Review</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{exportedLeads.length} lead(s) exported for calling</p>
              </div>
              {exportedLeads.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => {
                    removeExportedLeads(exportedLeads.map((l) => l.id));
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Exported</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportedLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No exported leads</p>
                        <p className="text-sm">Export leads from the Review page to see them here</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    exportedLeads.map((lead) => (
                      <TableRow key={lead.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {lead.name.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{lead.name}</p>
                              <p className="text-xs text-muted-foreground">{lead.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{lead.phone}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.jobTitle}</TableCell>
                        <TableCell className="text-sm text-foreground">{lead.company}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.location}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(lead.exportedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleExportedToLead(lead)}
                              title="Convert to New Lead"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Lead</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleExportedToListing(lead)}
                              disabled={createProperty.isPending}
                              title="Convert to New Listing"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Listing</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 text-destructive hover:text-destructive"
                              onClick={() => removeExportedLeads([lead.id])}
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}
      </PageContent>

      {/* Dialogs */}
      <ConvertColdCallDialog
        coldCall={selectedColdCall}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
      />
      <LogCallDialog open={logOpen} onOpenChange={setLogOpen} />
    </MainLayout>
  );
}
