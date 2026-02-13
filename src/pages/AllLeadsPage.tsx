import { useState, useMemo } from 'react';
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
  Phone, FileText, CheckCircle, Download, XCircle, Filter, Lock, ExternalLink, AlertCircle, Upload, Link2, Sheet, UserPlus,
} from 'lucide-react';
import { useLeadExportsStore, type LeadExport, type ExportedLead } from '@/store/leadExportsStore';

type TabId = 'review' | 'contacted' | 'replied' | 'self-generated';

const tabs: { id: TabId; label: string; locked?: boolean }[] = [
  { id: 'review', label: 'Review New Leads' },
  { id: 'contacted', label: 'Contacted Leads' },
  { id: 'replied', label: 'Replied Leads' },
  { id: 'self-generated', label: 'Self-Generated' },
];

// Dummy completed exports (fallback when store is empty)
const defaultExports = [
  { id: '1', name: 'leads_export_17709601762...', date: 'Feb 12, 2026 at 9:22 PM', leads: [] as ExportedLead[], hasContact: true },
  { id: '2', name: 'leads_export_17709600220...', date: 'Feb 12, 2026 at 9:20 PM', leads: [] as ExportedLead[], hasContact: false },
  { id: '3', name: 'search_565565', date: 'Feb 12, 2026 at 1:44 PM', leads: [] as ExportedLead[], hasContact: false },
  { id: '4', name: 'search_565565', date: 'Feb 12, 2026 at 1:43 PM', leads: [] as ExportedLead[], hasContact: false },
];

// Dummy review leads (from CSV)
const dummyReviewLeads = [
  { id: '1', name: 'Kelly Robinson', email: 'kellyrobinson@compass.com', jobTitle: 'Residential Real Estate Broker', company: 'Driven Properties', companyUrl: 'drivenproperties.com', phone: '+6468085794', location: 'NY, United States', linkedin: true },
  { id: '2', name: 'Fatma Hashim', email: 'fatmahashim@drivenproperties.ae', jobTitle: 'Partner', company: 'Driven Properties L.L.C.', companyUrl: 'drivenproperties.com', phone: '—', location: 'United Arab Emirates', linkedin: true },
  { id: '3', name: 'Luis Beltran', email: 'luis.beltran@drivenproperties.com', jobTitle: 'Senior Director of Marketing at Driven | Forbes Global Properties', company: 'Driven Properties', companyUrl: 'drivenproperties.com', phone: '+2122197607', location: 'United Arab Emirates', linkedin: true },
  { id: '4', name: 'Natalia Nasonova', email: 'nnasonova@pennington.ae', jobTitle: 'Sales Manager', company: 'Driven Properties L.L.C.', companyUrl: 'drivenproperties.com', phone: '+971 52 221 1029', location: 'United Arab Emirates', linkedin: true },
  { id: '5', name: 'Cristina Dumitrascu', email: 'cristina@pearlsdefrance.com', jobTitle: 'Executive Complex Director', company: 'Driven Properties', companyUrl: 'drivenproperties.com', phone: '—', location: 'Romania', linkedin: true },
  { id: '6', name: 'Ahmed Al Mansouri', email: 'ahmed.m@realtydxb.com', jobTitle: 'Senior Broker', company: 'Realty DXB', companyUrl: 'realtydxb.com', phone: '+971 55 123 4567', location: 'United Arab Emirates', linkedin: true },
  { id: '7', name: 'Sarah Chen', email: 'sarah.chen@knightfrank.com', jobTitle: 'Head of Residential Sales', company: 'Knight Frank', companyUrl: 'knightfrank.com', phone: '+971 4 456 7890', location: 'United Arab Emirates', linkedin: true },
];

// Dummy contacted leads
const dummyContactedLeads = [
  { id: 'c1', name: 'Omar Al Rashid', email: 'omar@dubaiprops.ae', phone: '+971 50 111 2222', location: 'Dubai, UAE', status: 'contacted' },
  { id: 'c2', name: 'Maria Santos', email: 'maria.s@globalre.com', phone: '+971 55 333 4444', location: 'Abu Dhabi, UAE', status: 'contacted' },
  { id: 'c3', name: 'James Wilson', email: 'jwilson@savills.ae', phone: '+44 7700 900123', location: 'London, UK', status: 'contacted' },
];

// Dummy replied leads
const dummyRepliedLeads = [
  { id: 'r1', name: 'Aisha Khalifa', email: 'aisha.k@emaar.ae', phone: '+971 50 555 6666', location: 'Dubai, UAE', status: 'replied' },
  { id: 'r2', name: 'David Park', email: 'dpark@cbre.com', phone: '+82 10 1234 5678', location: 'Seoul, South Korea', status: 'replied' },
];

// Dummy campaigns
const dummyCampaigns = [
  { id: 'camp1', name: 'Dubai Marina Outreach' },
  { id: 'camp2', name: 'JBR Sellers Campaign' },
  { id: 'camp3', name: 'Downtown Investors Q1' },
];

export default function AllLeadsPage() {
  const storeExports = useLeadExportsStore((s) => s.exports);
  const allExports = useMemo(() => [...storeExports, ...defaultExports], [storeExports]);
  const [activeTab, setActiveTab] = useState<TabId>('review');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [recentFilter, setRecentFilter] = useState<'all' | 'accepted' | 'rejected'>('all');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewExport, setReviewExport] = useState<LeadExport | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [uploadSource, setUploadSource] = useState<'google-sheet' | 'apollo'>('google-sheet');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const reviewLeads = reviewExport?.leads || dummyReviewLeads;

  const toggleAll = () => {
    if (selectedIds.length === reviewLeads.length) setSelectedIds([]);
    else setSelectedIds(reviewLeads.map((l) => l.id));
  };

  const openReviewModal = (exportId: string) => {
    const exp = allExports.find(e => e.id === exportId);
    setReviewExport(exp || null);
    setSelectedIds([]);
    setReviewModalOpen(true);
  };

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

              {/* Uploaded sheets history (dummy) */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground text-sm">Recent Imports</h4>
                <div className="text-sm text-muted-foreground italic">No imports yet. Paste a Google Sheet link above to get started.</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review / Contacted / Replied tabs */}
        {activeTab !== 'self-generated' && (
          <>
            {/* Completed Lead Exports */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-1">Completed Lead Exports</h2>
                <p className="text-sm text-muted-foreground mb-5">Recent completed exports from lead searches</p>

                <div className="space-y-0 divide-y divide-border">
                  {allExports.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{exp.name}</p>
                            <Badge className="bg-success/10 text-success border-success/20 text-xs font-medium">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              completed
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {exp.date}{exp.leads.length > 0 && ` · ${exp.leads.length} leads`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {exp.hasContact ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90 rounded-full px-5 gap-1.5"
                              onClick={() => openReviewModal(exp.id)}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Contact
                            </Button>
                            <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                              <Download className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-muted-foreground">—</span>
                            <Button variant="outline" size="sm" className="rounded-full px-4 gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              Generate CSV
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contacted tab list */}
            {activeTab === 'contacted' && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Contacted Leads</h3>
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
                        {dummyContactedLeads.map((lead) => (
                          <TableRow key={lead.id} className="hover:bg-muted/30">
                            <TableCell>
                              <p className="font-medium text-foreground">{lead.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{lead.email}</p>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.phone}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.location}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs">contacted</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Replied tab list */}
            {activeTab === 'replied' && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Replied Leads</h3>
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
                        {dummyRepliedLeads.map((lead) => (
                          <TableRow key={lead.id} className="hover:bg-muted/30">
                            <TableCell>
                              <p className="font-medium text-foreground">{lead.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{lead.email}</p>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.phone}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{lead.location}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs">replied</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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

      {/* Review Leads from CSV Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-w-[1100px] max-h-[85vh] overflow-y-auto p-0">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-1">
              <div>
                <DialogTitle className="text-xl font-bold">Review Leads from CSV</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{reviewLeads.length} leads · {selectedIds.length} selected</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-primary">
                  <Phone className="w-4 h-4" />
                  <span className="font-bold italic text-sm">5 Calling Credits</span>
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Job Titles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Job Titles ({reviewLeads.length})</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select campaign *" /></SelectTrigger>
                  <SelectContent>
                    {dummyCampaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
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
                      checked={selectedIds.length === reviewLeads.length && reviewLeads.length > 0}
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
                {reviewLeads.map((lead) => (
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
                      <a href={`https://${lead.companyUrl}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                        {lead.companyUrl} <ExternalLink className="w-3 h-3" />
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.phone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{lead.location}</TableCell>
                    <TableCell>
                      {lead.linkedin && (
                        <button className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
