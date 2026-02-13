import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useCampaigns, useCreateCampaign, useStartCampaign, Campaign } from '@/hooks/useCampaigns';
import { useLeads } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Megaphone,
  Plus,
  Send,
  Mail,
  MessageSquare,
  Users,
  CheckCircle,
  Clock,
  Play,
  Pause,
  Eye,
  TrendingUp,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', className: 'premium-badge-muted', icon: Clock },
  active: { label: 'Active', className: 'premium-badge-success', icon: Play },
  paused: { label: 'Paused', className: 'premium-badge-warning', icon: Pause },
  completed: { label: 'Completed', className: 'premium-badge-accent', icon: CheckCircle },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function OutreachCenterPage() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const { data: leads = [] } = useLeads();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const [newCampaign, setNewCampaign] = useState({
    name: '', description: '', campaign_type: 'outreach',
    whatsapp_enabled: false, email_enabled: false,
    whatsapp_template: '', email_subject: '', email_body: '',
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalSent = campaigns.reduce((s, c) => s + c.sent_count, 0);
  const totalDelivered = campaigns.reduce((s, c) => s + c.delivered_count, 0);
  const totalRead = campaigns.reduce((s, c) => s + c.read_count, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.replied_count, 0);
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;

  const handleCreate = async () => {
    if (!newCampaign.name) { toast.error('Campaign name is required'); return; }
    try {
      await createCampaign.mutateAsync(newCampaign as any);
      setCreateOpen(false);
      setNewCampaign({ name: '', description: '', campaign_type: 'outreach', whatsapp_enabled: false, email_enabled: false, whatsapp_template: '', email_subject: '', email_body: '' });
      setSelectedLeadIds([]);
    } catch {}
  };

  const handleStart = async (id: string) => {
    try { await startCampaign.mutateAsync(id); } catch {}
  };

  const metrics = [
    { label: 'Total Leads', value: leads.length, icon: Users, subtitle: 'From all completed exports' },
    { label: 'Contacted Leads', value: totalSent, icon: Send, subtitle: totalSent ? `${Math.round((totalDelivered / totalSent) * 100)}% contact rate` : '0% contact rate' },
    { label: 'Active Campaigns', value: activeCampaigns, icon: Megaphone, subtitle: 'Currently running' },
    { label: 'Replies', value: totalReplied, icon: MessageSquare, subtitle: totalSent ? `${Math.round((totalReplied / totalSent) * 100)}% reply rate` : '0% reply rate' },
  ];

  return (
    <MainLayout>
      {/* Header */}
      <div className="px-6 py-4 bg-primary/5 border-b border-primary/10 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Outreach Center</h1>
              <p className="text-sm text-muted-foreground">Manage campaigns, WhatsApp & email outreach</p>
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input value={newCampaign.name} onChange={(e) => setNewCampaign((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Q1 Follow-up Blast" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={newCampaign.description} onChange={(e) => setNewCampaign((p) => ({ ...p, description: e.target.value }))} placeholder="Describe the campaign goal..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newCampaign.campaign_type} onValueChange={(v) => setNewCampaign((p) => ({ ...p, campaign_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outreach">Outreach</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="re_engagement">Re-engagement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Channels</Label>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-success" />
                      <span className="text-sm">WhatsApp</span>
                    </div>
                    <Switch checked={newCampaign.whatsapp_enabled} onCheckedChange={(v) => setNewCampaign((p) => ({ ...p, whatsapp_enabled: v }))} />
                  </div>
                  {newCampaign.whatsapp_enabled && (
                    <Textarea value={newCampaign.whatsapp_template} onChange={(e) => setNewCampaign((p) => ({ ...p, whatsapp_template: e.target.value }))} placeholder="WhatsApp message template..." rows={3} />
                  )}
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      <span className="text-sm">Email</span>
                    </div>
                    <Switch checked={newCampaign.email_enabled} onCheckedChange={(v) => setNewCampaign((p) => ({ ...p, email_enabled: v }))} />
                  </div>
                  {newCampaign.email_enabled && (
                    <div className="space-y-2">
                      <Input value={newCampaign.email_subject} onChange={(e) => setNewCampaign((p) => ({ ...p, email_subject: e.target.value }))} placeholder="Email subject line" />
                      <Textarea value={newCampaign.email_body} onChange={(e) => setNewCampaign((p) => ({ ...p, email_body: e.target.value }))} placeholder="Email body content..." rows={4} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Select Leads ({selectedLeadIds.length})</Label>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                    {leads.map((lead) => (
                      <label key={lead.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedLeadIds.includes(lead.id)}
                          onCheckedChange={(checked) => {
                            setSelectedLeadIds((prev) => checked ? [...prev, lead.id] : prev.filter((id) => id !== lead.id));
                          }}
                        />
                        <span className="text-sm">{lead.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{lead.phone}</span>
                      </label>
                    ))}
                    {leads.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No leads available</p>}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createCampaign.isPending}>
                  {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-6">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {/* Metric Cards - LeadM8 style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m) => (
              <motion.div key={m.label} variants={itemVariants}>
                <Card className="border border-border">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">{m.label}</p>
                        <p className="text-3xl font-bold text-foreground mt-2">{m.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{m.subtitle}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-primary/10">
                        <m.icon className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Two-column layout: Recent Activity + Notifications */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity / Delivery Funnel */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Delivery Funnel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Sent', value: totalSent, pct: 100 },
                      { label: 'Delivered', value: totalDelivered, pct: totalSent ? Math.round((totalDelivered / totalSent) * 100) : 0 },
                      { label: 'Read', value: totalRead, pct: totalSent ? Math.round((totalRead / totalSent) * 100) : 0 },
                      { label: 'Replied', value: totalReplied, pct: totalSent ? Math.round((totalReplied / totalSent) * 100) : 0 },
                    ].map((step) => (
                      <div key={step.label} className="text-center">
                        <p className="text-2xl font-bold text-foreground">{step.value}</p>
                        <p className="text-sm text-muted-foreground">{step.label}</p>
                        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${step.pct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{step.pct}%</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Notifications Panel */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Latest Notifications</CardTitle>
                  <p className="text-sm text-muted-foreground">Recent updates and alerts from your campaigns</p>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Megaphone className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No notifications yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Notifications will appear here when leads interact</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {campaigns.slice(0, 5).map((c) => (
                        <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            c.status === 'active' ? 'bg-success' : c.status === 'completed' ? 'bg-primary' : 'bg-muted-foreground'
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.sent_count} sent · {c.replied_count} replies</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), 'MMM d')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Filters */}
          <motion.div variants={itemVariants} className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search campaigns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <div className="flex items-center gap-2">
              {['all', 'draft', 'active', 'paused', 'completed'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Campaign List */}
          <motion.div variants={itemVariants} className="space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : filteredCampaigns.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Megaphone className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No campaigns yet</p>
                  <p className="text-sm text-muted-foreground">Create your first campaign to start outreach</p>
                </CardContent>
              </Card>
            ) : (
              filteredCampaigns.map((campaign) => (
                <CampaignRow key={campaign.id} campaign={campaign} onStart={handleStart} />
              ))
            )}
          </motion.div>
        </motion.div>
      </div>
    </MainLayout>
  );
}

function CampaignRow({ campaign, onStart }: { campaign: Campaign; onStart: (id: string) => void }) {
  const config = statusConfig[campaign.status] || statusConfig.draft;
  const StatusIcon = config.icon;

  return (
    <Card className="hover:shadow-card-hover transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold text-foreground truncate">{campaign.name}</h3>
              <span className={cn('premium-badge', config.className)}>
                <StatusIcon className="w-3 h-3" />
                {config.label}
              </span>
            </div>
            {campaign.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{campaign.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{campaign.total_leads} leads</span>
              <span className="flex items-center gap-1"><Send className="w-3 h-3" />{campaign.sent_count} sent</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />{campaign.delivered_count} delivered</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{campaign.read_count} read</span>
              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{campaign.replied_count} replies</span>
              {campaign.whatsapp_enabled && <Badge variant="outline" className="text-[10px]">WhatsApp</Badge>}
              {campaign.email_enabled && <Badge variant="outline" className="text-[10px]">Email</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {campaign.status === 'draft' && (
              <Button size="sm" onClick={() => onStart(campaign.id)}>
                <Play className="w-3 h-3 mr-1" />
                Start
              </Button>
            )}
            <span className="text-xs text-muted-foreground">{format(new Date(campaign.created_at), 'MMM d, yyyy')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
