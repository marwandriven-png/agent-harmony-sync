import { useState, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Phone, FileText, CheckCircle, Download, XCircle, Filter, ExternalLink, AlertCircle, Upload, Link2, Sheet, UserPlus, Loader2, Linkedin,
} from 'lucide-react';
import { useLeadExportsStore, type LeadExport, type ExportedLead } from '@/store/leadExportsStore';
import { useLeads } from '@/hooks/useLeads';
import { useCampaigns } from '@/hooks/useCampaigns';
import { toast } from 'sonner';

type TabId = 'review' | 'contacted' | 'replied' | 'self-generated';

const tabs: { id: TabId; label: string }[] = [
  { id: 'review', label: 'Review New Leads' },
  { id: 'contacted', label: 'Contacted Leads' },
  { id: 'replied', label: 'Replied Leads' },
  { id: 'self-generated', label: 'Self-Generated' },
];

function downloadCSV(leads: ExportedLead[], fileName: string) {
  const headers = ['Name', 'Email', 'Job Title', 'Company', 'Phone', 'Location', 'LinkedIn'];
  const rows = leads.map(l => [
    l.name, l.email, l.jobTitle, l.company, l.phone, l.location, l.linkedin ? 'Yes' : 'No',
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV downloaded successfully');
}

export default function AllLeadsPage() {
  const storeExports = useLeadExportsStore((s) => s.exports);
  const { data: leads, isLoading: leadsLoading } = useLeads();
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();

  const [activeTab, setActiveTab] = useState<TabId>('review');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [recentFilter, setRecentFilter] = useState<'all' | 'accepted' | 'rejected'>('all');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewExport, setReviewExport] = useState<LeadExport | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>('all');
  const [uploadSource, setUploadSource] = useState<'google-sheet' | 'apollo'>('google-sheet');

  // Backend-powered leads by status
  const contactedLeads = useMemo(() =>
    (leads || []).filter(l => l.status === 'contacted'),
    [leads]
  );

  const repliedLeads = useMemo(() =>
    (leads || []).filter(l => l.status === 'negotiation' || l.status === 'viewing' || l.status === 'viewed'),
    [leads]
  );

  const selfGeneratedLeads = useMemo(() =>
    (leads || []).filter(l => l.source === 'walk_in' || l.source === 'other'),
    [leads]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const reviewLeads = reviewExport?.leads || [];

  // Job title counts for filter dropdown
  const jobTitleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    reviewLeads.forEach(l => {
      const title = l.jobTitle || 'Unknown';
      counts[title] = (counts[title] || 0) + 1;
    });
    return counts;
  }, [reviewLeads]);

  const filteredReviewLeads = useMemo(() => {
    if (selectedJobTitle === 'all') return reviewLeads;
    return reviewLeads.filter(l => l.jobTitle === selectedJobTitle);
  }, [reviewLeads, selectedJobTitle]);

  const toggleAll = () => {
    if (selectedIds.length === filteredReviewLeads.length) setSelectedIds([]);
    else setSelectedIds(filteredReviewLeads.map((l) => l.id));
  };

  const openReviewModal = (exportId: string) => {
    const exp = storeExports.find(e => e.id === exportId);
    setReviewExport(exp || null);
    setSelectedIds([]);
    setReviewModalOpen(true);
  };

  const handleDownload = useCallback((exp: LeadExport) => {
    if (exp.leads.length > 0) {
      downloadCSV(exp.leads, exp.name);
    } else {
      toast.error('No leads data to download');
    }
  }, []);

  return (
    <MainLayout>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-primary/10">
        <h1 className="text-xl font-bold italic text-primary">Leads Exports</h1>
        <p className="text-sm text-muted-foreground">Manage and track all your leads exports</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-0 bg-muted/40 p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Self-Generated tab */}
        {activeTab === 'self-generated' && (
          <>
            <Card>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-1">Self-Generated Leads</h3>
                  <p className="text-sm text-muted-foreground">Upload your own leads via Google Sheet link or Apollo export</p>
                </div>

                {/* Source Toggle */}
                <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl w-fit">
                  <button
                    onClick={() => setUploadSource('google-sheet')}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                      uploadSource === 'google-sheet'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background'
                    )}
                  >
                    <Sheet className="w-4 h-4" />
                    Google Sheet
                  </button>
                  <button
                    onClick={() => setUploadSource('apollo')}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                      uploadSource === 'apollo'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background'
                    )}
                  >
                    <UserPlus className="w-4 h-4" />
                    Apollo Data
                  </button>
                </div>

                {/* Upload Area */}
                <div className="border-2 border-dashed border-primary/20 rounded-xl p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Link2 className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {uploadSource === 'google-sheet' ? 'Paste your Google Sheet link' : 'Paste your Apollo export Google Sheet link'}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {uploadSource === 'google-sheet'
                        ? 'Share your Google Sheet with view access and paste the link below'
                        : 'Export your Apollo leads to Google Sheets and paste the link below'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 max-w-lg mx-auto">
                    <Input
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button className="bg-primary hover:bg-primary/90 gap-2" disabled={!sheetUrl.trim()}>
                      <Upload className="w-4 h-4" />
                      Import
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Make sure the sheet is shared as "Anyone with the link can view"
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Self-generated leads from backend */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Self-Generated Leads ({selfGeneratedLeads.length})</h3>
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : selfGeneratedLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4">No self-generated leads yet.</p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Contact</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selfGeneratedLeads.map((lead) => (
                          <TableRow key={lead.id} className="hover:bg-muted/30">
                            <TableCell>
                              <p className="font-medium text-foreground">{lead.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{lead.email || '—'}</p>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.phone}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.locations?.join(', ') || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs">{lead.source?.replace('_', ' ')}</Badge>
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
              </CardContent>
            </Card>
          </>
        )}

        {/* Review / Contacted / Replied tabs */}
        {activeTab !== 'self-generated' && (
          <>
            {/* Completed Lead Exports */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-1">Completed Lead Exports</h2>
                <p className="text-sm text-muted-foreground mb-5">Recent completed exports from lead searches</p>

                {storeExports.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4">No exports yet. Use Lead Generation to create exports.</p>
                ) : (
                  <div className="space-y-0 divide-y divide-border">
                    {storeExports.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">{exp.name}</p>
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                completed
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {exp.date} · {exp.leads.length} leads
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-primary hover:bg-primary/90 rounded-full px-5 gap-1.5"
                            onClick={() => openReviewModal(exp.id)}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Review
                          </Button>
                          <button
                            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            onClick={() => handleDownload(exp)}
                            title="Download CSV"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contacted tab list */}
            {activeTab === 'contacted' && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Contacted Leads ({contactedLeads.length})</h3>
                  {leadsLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                    </div>
                  ) : contactedLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4">No contacted leads yet.</p>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Contact</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactedLeads.map((lead) => (
                            <TableRow key={lead.id} className="hover:bg-muted/30">
                              <TableCell>
                                <p className="font-medium text-foreground">{lead.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{lead.email || '—'}</p>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{lead.phone}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{lead.locations?.join(', ') || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize text-xs">{lead.priority}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize text-xs">contacted</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Replied tab list */}
            {activeTab === 'replied' && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Replied Leads ({repliedLeads.length})</h3>
                  {leadsLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                    </div>
                  ) : repliedLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4">No replied leads yet.</p>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Contact</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {repliedLeads.map((lead) => (
                            <TableRow key={lead.id} className="hover:bg-muted/30">
                              <TableCell>
                                <p className="font-medium text-foreground">{lead.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{lead.email || '—'}</p>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{lead.phone}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{lead.locations?.join(', ') || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize text-xs">{lead.priority}</Badge>
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
                </CardContent>
              </Card>
            )}

            {/* Recently Reviewed Leads */}
            <Card>
              <CardContent className="p-6">
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
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Review Leads Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-[1100px] max-h-[85vh] overflow-y-auto p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-1">
              <div>
                <DialogTitle className="text-xl font-bold">Review Leads</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{filteredReviewLeads.length} leads · {selectedIds.length} selected</p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
                  <SelectTrigger className="w-[220px] bg-background">
                    <SelectValue placeholder="All Job Titles" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    <SelectItem value="all">All Job Titles ({reviewLeads.length})</SelectItem>
                    {Object.entries(jobTitleCounts).sort(([a], [b]) => a.localeCompare(b)).map(([title, count]) => (
                      <SelectItem key={title} value={title}>{title} ({count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1.5 text-primary">
                  <Phone className="w-4 h-4" />
                  <span className="font-bold italic text-sm">5 Calling Credits</span>
                </div>
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger className="w-[200px] bg-background"><SelectValue placeholder="Select campaign *" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {(campaigns || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                    {(!campaigns || campaigns.length === 0) && (
                      <SelectItem value="_none" disabled>No campaigns yet</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Warning banner */}
            <div className="flex items-center gap-2 bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-2.5 my-4">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">
                Connect your Gmail or Outlook in <span className="font-medium underline cursor-pointer">Settings</span> to send outreach.
              </p>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-3 mb-4">
              <Button size="sm" className="bg-primary hover:bg-primary/90 rounded-full gap-1.5" disabled={selectedIds.length === 0}>
                <CheckCircle className="w-3.5 h-3.5" />
                Send for Outreach ({selectedIds.length})
              </Button>
              <span className="text-xs text-muted-foreground">Email connection required</span>
              <Button variant="ghost" size="sm" disabled={selectedIds.length === 0} className="gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Reject Selected
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border-t border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={selectedIds.length === filteredReviewLeads.length && filteredReviewLeads.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>LinkedIn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviewLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No leads in this export
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReviewLeads.map((lead) => (
                    <TableRow key={lead.id} className={cn('hover:bg-muted/20', selectedIds.includes(lead.id) && 'bg-primary/5')}>
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedIds.includes(lead.id)}
                          onCheckedChange={() => toggleSelect(lead.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{lead.name}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{lead.email}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.jobTitle}</TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{lead.company}</p>
                        {lead.companyUrl && (
                          <a href={`https://${lead.companyUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                            {lead.companyUrl} <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.phone}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lead.location}</TableCell>
                      <TableCell>
                        {lead.linkedin && (
                          <a
                            href={lead.linkedinUrl || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(lead.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-muted transition-colors inline-flex"
                            title="View LinkedIn Profile"
                            onClick={e => e.stopPropagation()}
                          >
                            <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
