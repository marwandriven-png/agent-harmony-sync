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

// Inline expandable call row
function CallLogRow({ call }: { call: CalledCall }) {
  const [expanded, setExpanded] = useState(false);
  const evaluateCall = useEvaluateCall();
  const queryClient = useQueryClient();
  const [transcribing, setTranscribing] = useState(false);
  const hasEvaluation = call.ai_evaluation_status === 'completed';
  const canEvaluate = call.transcript_text && call.ai_evaluation_status !== 'processing';
  const canTranscribe = !call.transcript_text && call.notes;

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
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            {call.direction === 'outbound' ? (
              <PhoneOutgoing className="w-4 h-4 text-primary" />
            ) : (
              <PhoneIncoming className="w-4 h-4 text-green-500" />
            )}
            <span className="font-mono text-sm">{call.phone_number}</span>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm">{call.lead?.name || '—'}</span>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-xs ${callStatusColors[call.status] || ''}`}>
            {call.status.replace('_', ' ')}
          </Badge>
        </TableCell>
        <TableCell>
          <span className="text-sm flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            {formatDuration(call.duration_seconds || 0)}
          </span>
        </TableCell>
        <TableCell>
          {call.ai_overall_score != null ? (
            <span className={`font-semibold text-sm ${
              call.ai_overall_score >= 70 ? 'text-green-500' :
              call.ai_overall_score >= 50 ? 'text-yellow-500' : 'text-destructive'
            }`}>
              {Math.round(call.ai_overall_score)}/100
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {format(new Date(call.call_date), 'MMM d, HH:mm')}
        </TableCell>
        <TableCell>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </TableCell>
      </TableRow>

      {/* Expanded Detail Row */}
      {expanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={7} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* KPI Scores */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    AI Evaluation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {hasEvaluation ? (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Overall</span>
                          <span className="font-semibold">{call.ai_overall_score ?? 0}/100</span>
                        </div>
                        <Progress value={call.ai_overall_score ?? 0} className="h-1.5" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Confidence</span>
                          <span className="font-semibold">{call.ai_confidence_score ?? 0}/100</span>
                        </div>
                        <Progress value={call.ai_confidence_score ?? 0} className="h-1.5" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Lead Intent</span>
                          <span className="font-semibold">{call.ai_lead_intent_score ?? 0}/100</span>
                        </div>
                        <Progress value={call.ai_lead_intent_score ?? 0} className="h-1.5" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Closing Probability</span>
                          <span className="font-semibold">{call.ai_closing_probability ?? 0}/100</span>
                        </div>
                        <Progress value={call.ai_closing_probability ?? 0} className="h-1.5" />
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {call.ai_evaluation_status === 'processing' ? 'AI analyzing...' : 'No evaluation yet'}
                      </p>
                      {canTranscribe && !canEvaluate && (
                        <Button size="sm" variant="outline" onClick={handleTranscribe} disabled={transcribing} className="text-xs">
                          {transcribing ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Generating...</> : <><FileText className="w-3 h-3 mr-1" /> Generate Transcript</>}
                        </Button>
                      )}
                      {canEvaluate && (
                        <Button size="sm" onClick={() => evaluateCall.mutate(call.id)} disabled={evaluateCall.isPending} className="text-xs">
                          {evaluateCall.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Evaluating...</> : <><Brain className="w-3 h-3 mr-1" /> Run AI Evaluation</>}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Strengths & Weaknesses */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Strengths & Weaknesses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {hasEvaluation ? (
                    <>
                      {call.ai_strengths?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-400 flex items-center gap-1 mb-1">
                            <Star className="w-3 h-3" /> Strengths
                          </p>
                          <ul className="space-y-0.5">
                            {call.ai_strengths.map((s, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                                <span className="text-green-400 mt-0.5">✓</span> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {call.ai_weaknesses?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-orange-400 flex items-center gap-1 mb-1">
                            <AlertTriangle className="w-3 h-3" /> Weaknesses
                          </p>
                          <ul className="space-y-0.5">
                            {call.ai_weaknesses.map((w, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                                <span className="text-orange-400 mt-0.5">!</span> {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!call.ai_strengths?.length && !call.ai_weaknesses?.length && (
                        <p className="text-xs text-muted-foreground">No strengths/weaknesses data</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Run AI evaluation to see analysis</p>
                  )}
                </CardContent>
              </Card>

              {/* Transcript */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Transcript & Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {call.transcript_text ? (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
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
          </TableCell>
        </TableRow>
      )}
    </>
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
  const [activeView, setActiveView] = useState<'cold-calls' | 'exported' | 'call-log'>(
    searchParams.get('view') === 'exported' ? 'exported' : 'cold-calls'
  );

  useEffect(() => {
    if (exportedLeads.length > 0 && searchParams.get('view') === 'exported') {
      setActiveView('exported');
    }
  }, [exportedLeads.length, searchParams]);

  const [searchQuery, setSearchQuery] = useState('');
  const [callLogSearch, setCallLogSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ColdCallStatus | 'all'>('all');
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedColdCall, setSelectedColdCall] = useState<ColdCallWithProfile | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const filteredCalls = useMemo(() => {
    return coldCalls.filter((call) => {
      const matchesSearch = 
        call.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.phone.includes(searchQuery);
      const matchesStatus = filterStatus === 'all' || call.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [coldCalls, searchQuery, filterStatus]);

  const filteredCalledCalls = useMemo(() => {
    if (!callLogSearch) return calledCalls;
    const term = callLogSearch.toLowerCase();
    return calledCalls.filter((c) =>
      c.phone_number.includes(term) ||
      c.lead?.name?.toLowerCase().includes(term) ||
      c.status.includes(term)
    );
  }, [calledCalls, callLogSearch]);

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
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            )}
          >
            <Phone className="w-4 h-4" />
            Cold Calls ({coldCalls.length})
          </button>
          <button
            onClick={() => setActiveView('call-log')}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              activeView === 'call-log'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background'
            )}
          >
            <PhoneCall className="w-4 h-4" />
            Call Log ({calledCalls.length})
          </button>
          <button
            onClick={() => setActiveView('exported')}
            className={cn(
              'px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              activeView === 'exported'
                ? 'bg-primary text-primary-foreground shadow-sm'
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
                        ? "bg-primary text-primary-foreground"
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
                        
                        return (
                          <motion.tr
                            key={call.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                  <span className="text-sm font-semibold text-foreground">
                                    {call.name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{call.name}</p>
                                  {call.email && (
                                    <p className="text-xs text-muted-foreground">{call.email}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-foreground">{call.phone}</span>
                            </td>
                            <td className="py-4 px-4">
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
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-muted-foreground">
                                {call.location || '-'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm font-medium text-foreground">
                                {call.budget ? formatCurrency(call.budget) : '-'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-muted-foreground">
                                {agentName}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-muted-foreground">
                                {call.last_call_date ? formatDate(call.last_call_date) : 'Never'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-end gap-2">
                                {call.status !== 'converted' ? (
                                  <>
                                    <CallRecorder
                                      phoneNumber={call.phone}
                                      leadName={call.name}
                                      variant="icon"
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

        {/* Call Log Tab */}
        {activeView === 'call-log' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search calls..."
                value={callLogSearch}
                onChange={(e) => setCallLogSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>AI Score</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Loading calls...
                        </TableCell>
                      </TableRow>
                    ) : filteredCalledCalls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <PhoneCall className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium">No call logs yet</p>
                          <p className="text-sm">Click "Log Call" or use the recorder to add calls</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCalledCalls.map((call) => (
                        <CallLogRow key={call.id} call={call} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
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
