import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useCampaigns, useCreateCampaign, useStartCampaign, Campaign } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, Star, Pause, Play, Copy, Pencil, Trash2, Mail, Phone, Send,
  MessageSquare, Sparkles, HelpCircle, Upload, X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface EmailStep {
  id: string;
  enabled: boolean;
  subjectLine: string;
  emailBody: string;
  whenToSend: 'exact' | 'delay';
  delayMinutes: number;
}

interface CampaignFormState {
  name: string;
  fromEmail: string;
  emailEnabled: boolean;
  aiCallerEnabled: boolean;
  whatsappEnabled: boolean;
  // AI Caller config
  callerVoice: string;
  openingScript: string;
  discloseAI: boolean;
  qualificationQuestions: string[];
  // Email config
  sendInitialImmediately: boolean;
  emailSteps: EmailStep[];
  // WhatsApp config
  whatsappTemplate: string;
}

const defaultForm: CampaignFormState = {
  name: '',
  fromEmail: '',
  emailEnabled: true,
  aiCallerEnabled: false,
  whatsappEnabled: false,
  callerVoice: 'uk_default',
  openingScript: '',
  discloseAI: false,
  qualificationQuestions: [],
  sendInitialImmediately: true,
  emailSteps: [],
  whatsappTemplate: '',
};

const voiceOptions = [
  { value: 'uk_default', label: 'UK Default' },
  { value: 'us_male', label: 'US Male' },
  { value: 'us_female', label: 'US Female' },
  { value: 'uk_female', label: 'UK Female' },
  { value: 'au_male', label: 'AU Male' },
];

export default function OutreachCenterPage() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignFormState>({ ...defaultForm });
  const [newQuestion, setNewQuestion] = useState('');

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  const updateForm = (updates: Partial<CampaignFormState>) => setForm((p) => ({ ...p, ...updates }));

  const addEmailStep = () => {
    if (form.emailSteps.length >= 5) return;
    updateForm({
      emailSteps: [...form.emailSteps, {
        id: crypto.randomUUID(),
        enabled: true,
        subjectLine: '',
        emailBody: '',
        whenToSend: 'delay',
        delayMinutes: 1440,
      }],
    });
  };

  const updateEmailStep = (id: string, updates: Partial<EmailStep>) => {
    updateForm({
      emailSteps: form.emailSteps.map((s) => s.id === id ? { ...s, ...updates } : s),
    });
  };

  const removeEmailStep = (id: string) => {
    updateForm({ emailSteps: form.emailSteps.filter((s) => s.id !== id) });
  };

  const addQuestion = () => {
    if (!newQuestion.trim()) return;
    updateForm({ qualificationQuestions: [...form.qualificationQuestions, newQuestion.trim()] });
    setNewQuestion('');
  };

  const removeQuestion = (idx: number) => {
    updateForm({ qualificationQuestions: form.qualificationQuestions.filter((_, i) => i !== idx) });
  };

  const handleCreate = async () => {
    if (!form.name) { toast.error('Campaign name is required'); return; }
    try {
      await createCampaign.mutateAsync({
        name: form.name,
        campaign_type: 'outreach',
        email_enabled: form.emailEnabled,
        whatsapp_enabled: form.whatsappEnabled,
        email_subject: form.emailSteps[0]?.subjectLine || '',
        email_body: form.emailSteps[0]?.emailBody || '',
        whatsapp_template: form.whatsappTemplate,
      } as any);
      setCreateOpen(false);
      setForm({ ...defaultForm });
      toast.success('Campaign created successfully');
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

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const { error } = await supabase.from('campaigns').delete().eq('id', deleteTargetId);
      if (error) throw error;
      toast.success('Campaign deleted');
      if (selectedCampaignId === deleteTargetId) setSelectedCampaignId(null);
      setDeleteOpen(false);
      setDeleteTargetId(null);
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  };

  const handlePause = async (campaignId: string) => {
    try {
      const { error } = await supabase.functions.invoke('campaign-engine', {
        body: { action: 'pause', campaign_id: campaignId },
      });
      if (error) throw error;
      toast.success('Campaign paused');
    } catch (e: any) {
      toast.error(`Pause failed: ${e.message}`);
    }
  };

  const openDuplicate = (campaign: Campaign) => {
    setDuplicateSourceId(campaign.id);
    setDuplicateName('');
    setDuplicateOpen(true);
  };

  const openDelete = (campaign: Campaign) => {
    setDeleteTargetId(campaign.id);
    setDeleteOpen(true);
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-primary/10 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold italic text-primary">Outreach Centre</h1>
            <p className="text-sm text-muted-foreground">Manage your outreach campaigns</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90 rounded-full px-6">
            <Plus className="w-4 h-4 mr-2" /> New Campaign
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
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No campaigns yet. Create your first one!</div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  onClick={() => setSelectedCampaignId(campaign.id)}
                  className={cn('cursor-pointer transition-all hover:shadow-md', selectedCampaignId === campaign.id ? 'ring-2 ring-primary border-primary' : 'border-border')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge className={cn('text-xs font-medium',
                        campaign.status === 'active' ? 'bg-success text-success-foreground border-success'
                        : campaign.status === 'paused' ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary border-primary/20'
                      )}>
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Star className="w-4 h-4" /></button>
                      {campaign.status === 'active' ? (
                        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); handlePause(campaign.id); }}><Pause className="w-4 h-4" /></button>
                      ) : (
                        <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); startCampaign.mutate(campaign.id); }}><Play className="w-4 h-4" /></button>
                      )}
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); openDuplicate(campaign); }}><Copy className="w-4 h-4" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-muted transition-colors text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); openDelete(campaign); }}><Trash2 className="w-4 h-4" /></button>
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
              <Card>
                <CardContent className="p-8 text-center">
                  <h2 className="text-2xl font-bold text-foreground mb-2">{selectedCampaign.name}</h2>
                  <p className="text-muted-foreground mb-4">Status: {selectedCampaign.status} · {selectedCampaign.total_leads} leads</p>
                  {/* Delivery funnel */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Sent', value: selectedCampaign.sent_count, color: 'text-primary' },
                      { label: 'Delivered', value: selectedCampaign.delivered_count, color: 'text-blue-500' },
                      { label: 'Read', value: selectedCampaign.read_count, color: 'text-amber-500' },
                      { label: 'Replied', value: selectedCampaign.replied_count, color: 'text-green-500' },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button className="bg-primary hover:bg-primary/90 rounded-full px-6"><Pencil className="w-4 h-4 mr-2" /> Edit Campaign</Button>
                    <Button variant="outline" className="rounded-full px-6"><Phone className="w-4 h-4 mr-2" /> Test AI Caller</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Configuration</h3>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /><span className="text-sm">Email: {selectedCampaign.email_enabled ? 'ON' : 'OFF'}</span></div>
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-green-500" /><span className="text-sm">AI Caller: {selectedCampaign.whatsapp_enabled ? 'ON' : 'OFF'}</span></div>
                    <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-green-600" /><span className="text-sm">WhatsApp: {selectedCampaign.whatsapp_enabled ? 'ON' : 'OFF'}</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ===== CREATE CAMPAIGN DIALOG ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Create New Campaign</DialogTitle>
            <p className="text-sm text-muted-foreground">Set up your outreach campaign with email and calling capabilities</p>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Name + From Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold">Campaign Name</Label>
                <Input value={form.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="Q1 Sales Outreach" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">From Email</Label>
                <Input value={form.fromEmail} onChange={(e) => updateForm({ fromEmail: e.target.value })} placeholder="your@email.com" />
                <p className="text-xs text-muted-foreground">This is your account email</p>
              </div>
            </div>

            {/* Channel Switcher Tabs */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Channels</Label>
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className={cn("flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
                  form.emailEnabled ? "border-primary bg-primary/5" : "border-border")}
                  onClick={() => updateForm({ emailEnabled: !form.emailEnabled })}>
                  <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Email</span></div>
                  <Switch checked={form.emailEnabled} onCheckedChange={(v) => updateForm({ emailEnabled: v })} />
                </div>
                <div className={cn("flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
                  form.aiCallerEnabled ? "border-primary bg-primary/5" : "border-border")}
                  onClick={() => updateForm({ aiCallerEnabled: !form.aiCallerEnabled })}>
                  <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /><span className="text-sm font-medium">AI Caller</span></div>
                  <Switch checked={form.aiCallerEnabled} onCheckedChange={(v) => updateForm({ aiCallerEnabled: v })} />
                </div>
                <div className={cn("flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
                  form.whatsappEnabled ? "border-success bg-success/5" : "border-border")}
                  onClick={() => updateForm({ whatsappEnabled: !form.whatsappEnabled })}>
                  <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-success" /><span className="text-sm font-medium">WhatsApp</span></div>
                  <Switch checked={form.whatsappEnabled} onCheckedChange={(v) => updateForm({ whatsappEnabled: v })} />
                </div>
              </div>
            </div>

            {/* Dynamic Channel Configuration Tabs */}
            {(form.emailEnabled || form.aiCallerEnabled || form.whatsappEnabled) && (
              <Tabs defaultValue={form.emailEnabled ? 'email' : form.aiCallerEnabled ? 'ai-caller' : 'whatsapp'} className="mt-2">
                <TabsList className="w-full">
                  {form.emailEnabled && (
                    <TabsTrigger value="email" className="flex-1 gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email Settings
                    </TabsTrigger>
                  )}
                  {form.aiCallerEnabled && (
                    <TabsTrigger value="ai-caller" className="flex-1 gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> AI Caller
                    </TabsTrigger>
                  )}
                  {form.whatsappEnabled && (
                    <TabsTrigger value="whatsapp" className="flex-1 gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Email Tab Content */}
                {form.emailEnabled && (
                  <TabsContent value="email">
                    <Card className="border-primary/20">
                      <CardContent className="p-5 space-y-5">
                        <div>
                          <h4 className="font-semibold text-foreground">Email Sequence</h4>
                          <p className="text-xs text-muted-foreground">Configure up to 5 email steps in your sequence</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium">Send Initial Email Immediately</Label>
                            <p className="text-xs text-muted-foreground">Send the first email as soon as the lead is due</p>
                          </div>
                          <Switch checked={form.sendInitialImmediately} onCheckedChange={(v) => updateForm({ sendInitialImmediately: v })} />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Email Steps</Label>
                          <Button variant="outline" size="sm" onClick={addEmailStep} disabled={form.emailSteps.length >= 5} className="gap-1.5">
                            <Plus className="w-3 h-3" /> Add Step ({form.emailSteps.length}/5)
                          </Button>
                        </div>

                        {form.emailSteps.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-6">No email steps configured. Click "Add Step" to create your first email sequence step.</p>
                        ) : (
                          <div className="space-y-4">
                            {form.emailSteps.map((step, idx) => (
                              <Card key={step.id} className="border-primary/10">
                                <CardContent className="p-4 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">Step {idx + 1}</span>
                                      {!step.subjectLine && <Badge variant="destructive" className="text-xs">Incomplete</Badge>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Switch checked={step.enabled} onCheckedChange={(v) => updateEmailStep(step.id, { enabled: v })} />
                                      <button onClick={() => removeEmailStep(step.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1.5"><Label className="text-sm">Subject Line</Label><HelpCircle className="w-3 h-3 text-muted-foreground" /></div>
                                    <Input value={step.subjectLine} onChange={(e) => updateEmailStep(step.id, { subjectLine: e.target.value })} placeholder="Quick question about {company_name}" />
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1.5"><Label className="text-sm">Email Body</Label><HelpCircle className="w-3 h-3 text-muted-foreground" /></div>
                                    <Textarea value={step.emailBody} onChange={(e) => updateEmailStep(step.id, { emailBody: e.target.value })} placeholder="Write your email content..." rows={5} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm">Attachments</Label>
                                    <div className="flex items-center justify-between p-3 border border-dashed border-border rounded-lg">
                                      <p className="text-xs text-muted-foreground">No attachments. Upload PDF, images, or Office documents (max 10MB each).</p>
                                      <Button variant="outline" size="sm" className="text-xs shrink-0 gap-1.5"><Upload className="w-3 h-3" /> Upload File</Button>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <Label className="text-sm font-medium">When to Send</Label>
                                    <RadioGroup value={step.whenToSend} onValueChange={(v) => updateEmailStep(step.id, { whenToSend: v as 'exact' | 'delay' })}>
                                      <div className="flex items-center gap-2"><RadioGroupItem value="exact" id={`exact-${step.id}`} /><Label htmlFor={`exact-${step.id}`} className="text-sm">At exact date/time</Label></div>
                                      <div className="flex items-center gap-2"><RadioGroupItem value="delay" id={`delay-${step.id}`} /><Label htmlFor={`delay-${step.id}`} className="text-sm">After delay</Label></div>
                                    </RadioGroup>
                                    {step.whenToSend === 'delay' && (
                                      <div className="space-y-2">
                                        <Label className="text-sm">Delay (minutes)</Label>
                                        <div className="flex items-center gap-2">
                                          <Input type="number" min={10} value={step.delayMinutes} onChange={(e) => updateEmailStep(step.id, { delayMinutes: parseInt(e.target.value) || 10 })} placeholder="Minimum 10 minutes" className="flex-1" />
                                          <Button variant="outline" size="sm" onClick={() => updateEmailStep(step.id, { delayMinutes: 1440 })}>1 Day</Button>
                                          <Button variant="outline" size="sm" onClick={() => updateEmailStep(step.id, { delayMinutes: 2880 })}>2 Days</Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Minimum 10 minutes. 1 day = 1440 minutes</p>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}

                {/* AI Caller Tab Content */}
                {form.aiCallerEnabled && (
                  <TabsContent value="ai-caller">
                    <Card className="border-primary/20">
                      <CardContent className="p-5 space-y-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-foreground">Call Script Configuration</h4>
                            <p className="text-xs text-muted-foreground">Configure your AI caller's behavior, goals, and responses</p>
                          </div>
                          <Button variant="outline" size="sm" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Generate Script</Button>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Caller Voice</Label>
                          <p className="text-xs text-muted-foreground">Select the voice and region for your AI caller</p>
                          <Select value={form.callerVoice} onValueChange={(v) => updateForm({ callerVoice: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {voiceOptions.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-sm font-medium">Opening Script</Label>
                            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex justify-end"><span className="text-xs text-muted-foreground">{form.openingScript.length}/300 characters</span></div>
                          <Textarea value={form.openingScript} onChange={(e) => { if (e.target.value.length <= 300) updateForm({ openingScript: e.target.value }); }} placeholder="Enter your opening script..." rows={4} />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium">Disclose AI?</Label>
                            <p className="text-xs text-muted-foreground">Should the caller mention it's AI?</p>
                          </div>
                          <Switch checked={form.discloseAI} onCheckedChange={(v) => updateForm({ discloseAI: v })} />
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">Qualification Questions</Label>
                            <div className="flex items-center gap-2">
                              <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Enter question..." className="w-60 h-8 text-xs" onKeyDown={(e) => e.key === 'Enter' && addQuestion()} />
                              <Button variant="outline" size="sm" onClick={addQuestion} className="h-8 text-xs"><Plus className="w-3 h-3 mr-1" /> Add Question</Button>
                            </div>
                          </div>
                          {form.qualificationQuestions.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">No questions added yet</p>
                          ) : (
                            <div className="space-y-2">
                              {form.qualificationQuestions.map((q, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                                  <span className="text-sm">{i + 1}. {q}</span>
                                  <button onClick={() => removeQuestion(i)} className="text-destructive hover:text-destructive/80"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}

                {/* WhatsApp Tab Content */}
                {form.whatsappEnabled && (
                  <TabsContent value="whatsapp">
                    <Card className="border-success/20">
                      <CardContent className="p-5 space-y-4">
                        <h4 className="font-semibold text-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4 text-success" /> WhatsApp Configuration</h4>
                        <div className="space-y-2">
                          <Label className="text-sm">Message Template</Label>
                          <Textarea value={form.whatsappTemplate} onChange={(e) => updateForm({ whatsappTemplate: e.target.value })} placeholder="Hi {{name}}, I'd like to discuss..." rows={4} />
                          <p className="text-xs text-muted-foreground">Use {'{{name}}'}, {'{{company}}'} as variables</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}
              </Tabs>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createCampaign.isPending} className="bg-primary hover:bg-primary/90 gap-2">
              <Send className="w-4 h-4" />
              {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Copy className="w-5 h-5" /> Duplicate Campaign</DialogTitle>
            <p className="text-sm text-muted-foreground">Create a copy of "{campaigns.find((c) => c.id === duplicateSourceId)?.name}"</p>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="font-semibold">Campaign Name</Label>
            <Input value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} placeholder="Enter new campaign name" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>Cancel</Button>
            <Button onClick={handleDuplicate} disabled={createCampaign.isPending} className="bg-primary hover:bg-primary/90">
              {createCampaign.isPending ? 'Duplicating...' : 'Duplicate Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="w-5 h-5" /> Delete Campaign</DialogTitle>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete "{campaigns.find((c) => c.id === deleteTargetId)?.name}"? This action cannot be undone.</p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
