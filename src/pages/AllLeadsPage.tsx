import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLeads, LeadWithProfile } from '@/hooks/useLeads';
import { useCampaigns } from '@/hooks/useCampaigns';
import { formatRelativeTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Phone, Mail, MapPin, FileText, CheckCircle, ExternalLink, Download,
  Send, XCircle, Filter, Users,
} from 'lucide-react';
import { format } from 'date-fns';

type TabId = 'review' | 'contacted' | 'replied' | 'self-generated';

const tabs: { id: TabId; label: string; locked?: boolean }[] = [
  { id: 'review', label: 'Review New Leads' },
  { id: 'contacted', label: 'Contacted Leads' },
  { id: 'replied', label: 'Replied Leads' },
  { id: 'self-generated', label: 'Self-Generated', locked: true },
];

export default function AllLeadsPage() {
  const { data: leads = [], isLoading } = useLeads();
  const { data: campaigns = [] } = useCampaigns();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('review');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [recentFilter, setRecentFilter] = useState<'all' | 'accepted' | 'rejected'>('all');

  // Filter leads by tab
  const filteredLeads = useMemo(() => {
    switch (activeTab) {
      case 'review':
        return leads.filter((l) => l.status === 'new');
      case 'contacted':
        return leads.filter((l) => l.status === 'contacted');
      case 'replied':
        return leads.filter((l) => l.status === 'viewing' || l.status === 'viewed');
      case 'self-generated':
        return [];
      default:
        return leads;
    }
  }, [leads, activeTab]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredLeads.length) setSelectedIds([]);
    else setSelectedIds(filteredLeads.map((l) => l.id));
  };

  // Completed exports (simulated from campaigns data)
  const completedExports = campaigns.filter((c) => c.total_leads > 0).slice(0, 5);

  return (
    <MainLayout>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-primary/10 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold italic text-primary">All Leads</h1>
            <p className="text-sm text-muted-foreground">Manage and track all your leads</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 animate-fade-in">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.locked && setActiveTab(tab.id)}
              className={cn(
                'px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : tab.locked
                  ? 'text-muted-foreground/60 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background'
              )}
            >
              {tab.label}
              {tab.locked && <span className="text-xs">🔒</span>}
            </button>
          ))}
        </div>

        {/* Self-Generated tab shows upload prompt */}
        {activeTab === 'self-generated' ? (
          <Card className="border-2 border-dashed border-primary/20">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-primary/40" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Self-Generated Leads</h3>
              <p className="text-muted-foreground text-center max-w-md mb-2">
                Manually add and manage your own leads with full control over contact information and campaign assignments.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Available on: <span className="text-primary font-medium">Basic</span>, <span className="text-primary font-medium">Business</span>, <span className="text-primary font-medium">Enterprise</span> plans
              </p>
              <Button className="bg-primary hover:bg-primary/90 rounded-full px-6">
                🔒 Upload Google Sheet or File
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Completed Lead Exports section */}
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Completed Lead Exports</h2>
              <p className="text-sm text-muted-foreground mb-4">Recent completed exports from lead searches</p>

              {completedExports.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    No completed exports yet
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {completedExports.map((exp) => (
                    <Card key={exp.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">{exp.name}</p>
                              <Badge className="bg-success/10 text-success border-success/20 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                completed
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(exp.created_at), 'MMM d, yyyy \'at\' h:mm a')} · {exp.total_leads} leads
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 rounded-full px-4">
                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                            Contact
                          </Button>
                          <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Review Leads Table (when in review tab) */}
            {activeTab === 'review' && filteredLeads.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Review Leads from CRM</h3>
                    <p className="text-sm text-muted-foreground">{filteredLeads.length} leads · {selectedIds.length} selected</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                      <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select campaign *" /></SelectTrigger>
                      <SelectContent>
                        {campaigns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-3 mb-4">
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 rounded-full"
                    disabled={selectedIds.length === 0}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    Send for Outreach ({selectedIds.length})
                  </Button>
                  <span className="text-xs text-muted-foreground">Email connection required</span>
                  <Button variant="ghost" size="sm" disabled={selectedIds.length === 0}>
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Reject Selected
                  </Button>
                </div>

                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedIds.length === filteredLeads.length && filteredLeads.length > 0}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.map((lead) => (
                        <TableRow
                          key={lead.id}
                          className={cn('cursor-pointer hover:bg-muted/30', selectedIds.includes(lead.id) && 'bg-primary/5')}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.includes(lead.id)}
                              onCheckedChange={() => toggleSelect(lead.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{lead.name}</p>
                              {lead.email && (
                                <p className="text-xs text-muted-foreground font-mono">{lead.email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.lead_type && (
                              <Badge variant="outline" className="text-xs capitalize">{lead.lead_type}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{lead.phone}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {lead.area_name || (lead.locations && lead.locations[0]) || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground capitalize">{lead.source.replace(/_/g, ' ')}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Contacted / Replied tabs show simple lead lists */}
            {(activeTab === 'contacted' || activeTab === 'replied') && (
              <div>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground font-medium">No {activeTab} leads yet</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Contact</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeads.map((lead) => (
                          <TableRow
                            key={lead.id}
                            className="cursor-pointer hover:bg-muted/30"
                            onClick={() => navigate(`/leads/${lead.id}`)}
                          >
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{lead.name}</p>
                                {lead.email && <p className="text-xs text-muted-foreground">{lead.email}</p>}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.phone}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {lead.area_name || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs">{lead.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {/* Recently Reviewed Leads */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Recently Reviewed Leads</h3>
                  <p className="text-xs text-muted-foreground">Leads reviewed in the last 24 hours · Can be modified before auto-deletion</p>
                </div>
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
                  <button className="p-1.5 rounded hover:bg-background">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  {(['all', 'accepted', 'rejected'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setRecentFilter(f)}
                      className={cn(
                        'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                        recentFilter === f
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)} (0)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
