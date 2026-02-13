import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useCampaigns, useCreateCampaign, useStartCampaign, Campaign } from '@/hooks/useCampaigns';
import { useLeads } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus,
  Star,
  Pause,
  Play,
  Copy,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Send,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function OutreachCenterPage() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const { data: leads = [] } = useLeads();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);

  // Create campaign form state
  const [newCampaign, setNewCampaign] = useState({
    name: '', email_enabled: true, whatsapp_enabled: false,
    email_subject: '', email_body: '',
  });

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  const handleCreate = async () => {
    if (!newCampaign.name) { toast.error('Campaign name is required'); return; }
    try {
      await createCampaign.mutateAsync({
        name: newCampaign.name,
        campaign_type: 'outreach',
        email_enabled: newCampaign.email_enabled,
        whatsapp_enabled: newCampaign.whatsapp_enabled,
        email_subject: newCampaign.email_subject,
        email_body: newCampaign.email_body,
      } as any);
      setCreateOpen(false);
      setNewCampaign({ name: '', email_enabled: true, whatsapp_enabled: false, email_subject: '', email_body: '' });
    } catch {}
  };

  const handleDuplicate = async () => {
    if (!duplicateName) { toast.error('Campaign name is required'); return; }
    const source = campaigns.find((c) => c.id === duplicateSourceId);
    if (!source) return;
    try {
      await createCampaign.mutateAsync({
        name: duplicateName,
        campaign_type: source.campaign_type,
        email_enabled: source.email_enabled,
        whatsapp_enabled: source.whatsapp_enabled,
        email_subject: source.email_subject,
        email_body: source.email_body,
        whatsapp_template: source.whatsapp_template,
      } as any);
      setDuplicateOpen(false);
      setDuplicateName('');
      setDuplicateSourceId(null);
    } catch {}
  };

  const openDuplicate = (campaign: Campaign) => {
    setDuplicateSourceId(campaign.id);
    setDuplicateName('');
    setDuplicateOpen(true);
  };

  return (
    <MainLayout>
      {/* Purple gradient header */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-primary/10 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold italic text-primary">Outreach Centre</h1>
            <p className="text-sm text-muted-foreground">Manage your outreach campaigns</p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-primary hover:bg-primary/90 rounded-full px-6"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 73px)' }}>
        {/* Left: Campaign List */}
        <div className="w-[420px] border-r border-border p-5 overflow-y-auto shrink-0">
          <p className="text-sm font-bold text-foreground uppercase tracking-wide mb-4">
            Manual Campaigns ({campaigns.length})
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No campaigns yet. Create your first one!
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  onClick={() => setSelectedCampaignId(campaign.id)}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    selectedCampaignId === campaign.id
                      ? 'ring-2 ring-primary border-primary'
                      : 'border-border'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          'text-xs font-medium',
                        campaign.status === 'active'
                            ? 'bg-success text-success-foreground border-success'
                            : campaign.status === 'paused'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary/10 text-primary border-primary/20'
                        )}
                      >
                        {campaign.status === 'active' ? 'Active' : campaign.status === 'paused' ? 'Paused' : campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </Badge>
                    </div>
                    {/* Action icons row */}
                    <div className="flex items-center gap-1 justify-end">
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Star className="w-4 h-4" />
                      </button>
                      {campaign.status === 'active' ? (
                        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          onClick={(e) => { e.stopPropagation(); startCampaign.mutate(campaign.id); }}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); openDuplicate(campaign); }}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right: Campaign Detail */}
        <div className="flex-1 overflow-y-auto p-8">
          {!selectedCampaign ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-lg font-semibold text-foreground">Select a campaign</p>
              <p className="text-sm text-muted-foreground mt-1">Choose from the list to view details and edit</p>
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Campaign info card */}
              <Card>
                <CardContent className="p-8 text-center">
                  <h2 className="text-2xl font-bold text-foreground mb-2">{selectedCampaign.name}</h2>
                  <p className="text-muted-foreground mb-6">
                    Click "Edit Campaign" below to modify settings, messaging, and delivery rules.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button className="bg-primary hover:bg-primary/90 rounded-full px-6">
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Campaign
                    </Button>
                    <Button variant="outline" className="rounded-full px-6">
                      <Phone className="w-4 h-4 mr-2" />
                      Test AI Caller
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Campaign Configuration */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Campaign Configuration</h3>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground">Emails: {selectedCampaign.email_enabled ? 'ON' : 'OFF'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-success" />
                      <span className="text-sm text-foreground">Calls: {selectedCampaign.whatsapp_enabled ? 'ON' : 'OFF'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Create New Campaign Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Create New Campaign</DialogTitle>
            <p className="text-sm text-muted-foreground">Set up your outreach campaign with email and calling capabilities</p>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold">Campaign Name</Label>
                <Input
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Q1 Sales Outreach"
                  className="border-primary/30 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">From Email</Label>
                <Input placeholder="your@email.com" disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">This is your account email</p>
              </div>
            </div>

            {/* Channel toggles */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Email Settings</span>
                </div>
                <Switch
                  checked={newCampaign.email_enabled}
                  onCheckedChange={(v) => setNewCampaign((p) => ({ ...p, email_enabled: v }))}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">AI Caller Settings</span>
                </div>
                <Switch
                  checked={newCampaign.whatsapp_enabled}
                  onCheckedChange={(v) => setNewCampaign((p) => ({ ...p, whatsapp_enabled: v }))}
                />
              </div>
            </div>

            {/* Email Configuration */}
            {newCampaign.email_enabled && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-foreground">Email Configuration</h4>
                  <Button variant="outline" size="sm" className="text-xs">
                    ✨ Generate with AI
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Subject Line</Label>
                  <Input
                    value={newCampaign.email_subject}
                    onChange={(e) => setNewCampaign((p) => ({ ...p, email_subject: e.target.value }))}
                    placeholder="Quick question about {company_name}"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Email Body</Label>
                  <Textarea
                    value={newCampaign.email_body}
                    onChange={(e) => setNewCampaign((p) => ({ ...p, email_body: e.target.value }))}
                    placeholder="Write your email content..."
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Attachments</Label>
                  <div className="flex items-center justify-between p-3 border border-dashed border-border rounded-lg">
                    <p className="text-xs text-muted-foreground">No attachments. Upload PDF, images, or Office documents (max 10MB each).</p>
                    <Button variant="outline" size="sm" className="text-xs shrink-0">
                      Upload File
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createCampaign.isPending} className="bg-primary hover:bg-primary/90">
              {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Campaign Dialog */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              Duplicate Campaign
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Create a copy of "{campaigns.find((c) => c.id === duplicateSourceId)?.name}". Enter a new name for the duplicated campaign.
            </p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="font-semibold">Campaign Name</Label>
            <Input
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="Enter new campaign name"
              className="border-primary/30 focus:border-primary"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>Cancel</Button>
            <Button onClick={handleDuplicate} disabled={createCampaign.isPending} className="bg-primary hover:bg-primary/90">
              {createCampaign.isPending ? 'Duplicating...' : 'Duplicate Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
