import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCalls, CalledCall } from '@/hooks/useCalls';
import { LogCallDialog } from '@/components/calls/LogCallDialog';
import { CallDetailPanel } from '@/components/calls/CallDetailPanel';
import { CallAnalyticsDashboard } from '@/components/calls/CallAnalyticsDashboard';
import { format } from 'date-fns';
import {
  Phone, PhoneIncoming, PhoneOutgoing, Plus, Search, Clock,
  Brain, TrendingUp, PhoneMissed, CheckCircle, BarChart3
} from 'lucide-react';

const statusColors: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  answered: 'bg-green-500/15 text-green-400 border-green-500/30',
  missed: 'bg-red-500/15 text-red-400 border-red-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  busy: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  rejected: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

export default function CallsPage() {
  const { data: calls = [], isLoading } = useCalls();
  const [search, setSearch] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CalledCall | null>(null);

  const filtered = calls.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.phone_number.includes(term) ||
      c.lead?.name?.toLowerCase().includes(term) ||
      c.status.includes(term) ||
      c.direction.includes(term)
    );
  });

  // Quick stats
  const totalCalls = calls.length;
  const answeredCalls = calls.filter((c) => ['completed', 'answered'].includes(c.status)).length;
  const missedCalls = calls.filter((c) => c.status === 'missed').length;
  const avgScore = (() => {
    const scored = calls.filter((c) => c.ai_overall_score != null);
    if (!scored.length) return 0;
    return Math.round(scored.reduce((sum, c) => sum + (c.ai_overall_score || 0), 0) / scored.length);
  })();

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const [activeTab, setActiveTab] = useState('calls');

  return (
    <MainLayout>
      <div className="flex h-full">
        <div className={`flex-1 p-6 space-y-6 overflow-y-auto ${selectedCall ? 'max-w-[calc(100%-400px)]' : ''}`}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Called Calls</h1>
              <p className="text-sm text-muted-foreground">AI-powered call tracking & evaluation</p>
            </div>
            <Button onClick={() => setLogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Log Call
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="calls" className="gap-1.5">
                <Phone className="w-4 h-4" /> Call Log
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5">
                <BarChart3 className="w-4 h-4" /> Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calls" className="mt-4 space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/15">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalCalls}</p>
                      <p className="text-xs text-muted-foreground">Total Calls</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/15">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{answeredCalls}</p>
                      <p className="text-xs text-muted-foreground">Answered</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-destructive/15">
                      <PhoneMissed className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{missedCalls}</p>
                      <p className="text-xs text-muted-foreground">Missed</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/15">
                      <Brain className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{avgScore || '–'}</p>
                      <p className="text-xs text-muted-foreground">Avg AI Score</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search calls..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Calls Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Direction</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>AI Score</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Loading calls...
                          </TableCell>
                        </TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No calls found. Click "Log Call" to add one.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((call) => (
                          <TableRow
                            key={call.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedCall(call)}
                          >
                            <TableCell>
                              {call.direction === 'outbound' ? (
                                <PhoneOutgoing className="w-4 h-4 text-primary" />
                              ) : (
                                <PhoneIncoming className="w-4 h-4 text-green-500" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{call.phone_number}</TableCell>
                            <TableCell className="text-sm">
                              {call.lead?.name || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${statusColors[call.status] || ''}`}>
                                {call.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="flex items-center gap-1">
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
                                  {Math.round(call.ai_overall_score)}
                                </span>
                              ) : call.ai_evaluation_status === 'processing' ? (
                                <span className="text-xs text-primary animate-pulse">Processing...</span>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(call.call_date), 'MMM d, HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-4">
              <CallAnalyticsDashboard />
            </TabsContent>
          </Tabs>
        </div>

        {/* Detail Panel */}
        {selectedCall && (
          <div className="w-[400px] border-l border-border">
            <CallDetailPanel call={selectedCall} onClose={() => setSelectedCall(null)} />
          </div>
        )}
      </div>

      <LogCallDialog open={logOpen} onOpenChange={setLogOpen} />
    </MainLayout>
  );
}
