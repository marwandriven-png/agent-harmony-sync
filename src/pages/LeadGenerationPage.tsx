import { useState } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useCreateLead } from '@/hooks/useLeads';
import { useLeads } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Zap,
  Target,
  TrendingUp,
  Users,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Building2,
  DollarSign,
  Bed,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type LeadSource = Database['public']['Enums']['lead_source'];
type LeadPriority = Database['public']['Enums']['lead_priority'];
type PropertyType = Database['public']['Enums']['property_type'];
type LeadType = Database['public']['Enums']['lead_type'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const initialForm = {
  name: '',
  phone: '',
  email: '',
  source: 'other' as LeadSource,
  priority: 'warm' as LeadPriority,
  lead_type: 'buyer' as LeadType,
  budget_min: '',
  budget_max: '',
  budget_currency: 'AED',
  bedrooms: '',
  property_types: [] as PropertyType[],
  locations: '',
  area_name: '',
  building_name: '',
  requirements_notes: '',
};

export default function LeadGenerationPage() {
  const createLead = useCreateLead();
  const { data: leads = [] } = useLeads();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);

  const recentLeads = leads.slice(0, 5);

  // Stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const leadsToday = leads.filter((l) => new Date(l.created_at) >= todayStart).length;
  const leadsThisWeek = leads.filter((l) => {
    const d = new Date(l.created_at);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    return d >= weekAgo;
  }).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error('Name and phone are required');
      return;
    }
    try {
      await createLead.mutateAsync({
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        source: form.source,
        priority: form.priority,
        lead_type: form.lead_type,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        budget_currency: form.budget_currency,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        property_types: form.property_types.length > 0 ? form.property_types : null,
        locations: form.locations ? form.locations.split(',').map((s) => s.trim()) : null,
        area_name: form.area_name || null,
        building_name: form.building_name || null,
        requirements_notes: form.requirements_notes || null,
      });
      setForm(initialForm);
      toast.success('Lead created! It will appear in All Leads and the Pipeline.');
    } catch {}
  };

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const togglePropertyType = (type: PropertyType) => {
    setForm((prev) => ({
      ...prev,
      property_types: prev.property_types.includes(type)
        ? prev.property_types.filter((t) => t !== type)
        : [...prev.property_types, type],
    }));
  };

  return (
    <MainLayout>
      <PageHeader
        title="Lead Generation"
        subtitle="Capture new leads and feed them into outreach workflows"
        actions={
          <Button variant="outline" onClick={() => navigate('/all-leads')}>
            <Users className="w-4 h-4 mr-2" />
            View All Leads
          </Button>
        }
      />

      <PageContent>
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Leads', value: leads.length, icon: Users, color: 'primary' },
              { label: 'Added Today', value: leadsToday, icon: Zap, color: 'accent' },
              { label: 'This Week', value: leadsThisWeek, icon: TrendingUp, color: 'success' },
            ].map((m) => (
              <motion.div key={m.label} variants={itemVariants}>
                <div className={cn('metric-card', `metric-card-${m.color}`)}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">{m.label}</p>
                      <p className="text-3xl font-bold text-foreground mt-2">{m.value}</p>
                    </div>
                    <div className={cn(
                      'p-3 rounded-xl',
                      m.color === 'primary' && 'bg-pastel-blue',
                      m.color === 'accent' && 'bg-pastel-green',
                      m.color === 'success' && 'bg-pastel-green',
                    )}>
                      <m.icon className={cn(
                        'w-6 h-6',
                        m.color === 'primary' && 'text-primary',
                        m.color === 'accent' && 'text-accent',
                        m.color === 'success' && 'text-success',
                      )} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lead Form */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" />
                    New Lead Entry
                  </CardTitle>
                  <CardDescription>Enter lead details. They'll instantly appear in All Leads and trigger outreach.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name *</Label>
                        <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="John Smith" />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone *</Label>
                        <Input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+971501234567" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="john@email.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>Lead Type</Label>
                        <Select value={form.lead_type} onValueChange={(v) => updateField('lead_type', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="buyer">Buyer</SelectItem>
                            <SelectItem value="landlord">Landlord</SelectItem>
                            <SelectItem value="tenant">Tenant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Classification */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Source</Label>
                        <Select value={form.source} onValueChange={(v) => updateField('source', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['website', 'referral', 'cold_call', 'social_media', 'property_portal', 'walk_in', 'other'].map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select value={form.priority} onValueChange={(v) => updateField('priority', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hot">🔥 Hot</SelectItem>
                            <SelectItem value="warm">🌡️ Warm</SelectItem>
                            <SelectItem value="cold">❄️ Cold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Bedrooms</Label>
                        <Input type="number" value={form.bedrooms} onChange={(e) => updateField('bedrooms', e.target.value)} placeholder="2" />
                      </div>
                    </div>

                    {/* Budget */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Budget Min</Label>
                        <Input type="number" value={form.budget_min} onChange={(e) => updateField('budget_min', e.target.value)} placeholder="500000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Budget Max</Label>
                        <Input type="number" value={form.budget_max} onChange={(e) => updateField('budget_max', e.target.value)} placeholder="1500000" />
                      </div>
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={form.budget_currency} onValueChange={(v) => updateField('budget_currency', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AED">AED</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Property Types */}
                    <div className="space-y-2">
                      <Label>Property Types</Label>
                      <div className="flex flex-wrap gap-2">
                        {(['apartment', 'villa', 'townhouse', 'penthouse', 'studio', 'commercial', 'land'] as PropertyType[]).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => togglePropertyType(type)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                              form.property_types.includes(type)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Location */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Area Name</Label>
                        <Input value={form.area_name} onChange={(e) => updateField('area_name', e.target.value)} placeholder="Downtown Dubai" />
                      </div>
                      <div className="space-y-2">
                        <Label>Building Name</Label>
                        <Input value={form.building_name} onChange={(e) => updateField('building_name', e.target.value)} placeholder="Burj Vista" />
                      </div>
                      <div className="space-y-2">
                        <Label>Locations (comma-sep)</Label>
                        <Input value={form.locations} onChange={(e) => updateField('locations', e.target.value)} placeholder="Marina, JBR, Downtown" />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label>Requirements Notes</Label>
                      <Textarea value={form.requirements_notes} onChange={(e) => updateField('requirements_notes', e.target.value)} placeholder="Any specific requirements, preferences, or notes..." rows={3} />
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setForm(initialForm)}>Reset</Button>
                      <Button type="submit" disabled={createLead.isPending} className="bg-gradient-primary hover:opacity-90">
                        {createLead.isPending ? 'Creating...' : (
                          <>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Create Lead
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Leads Sidebar */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-accent" />
                      Recent Leads
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/all-leads')}>
                      View all <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No leads yet. Create your first lead!</p>
                  ) : (
                    recentLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                          {lead.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.phone}</p>
                        </div>
                        <span className={cn('status-badge text-[10px]', statusBadgeClass[lead.status] || 'status-badge-new')}>
                          {lead.status}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </PageContent>
    </MainLayout>
  );
}

const statusBadgeClass: Record<string, string> = {
  new: 'status-badge-new',
  contacted: 'status-badge-contacted',
  viewing: 'status-badge-viewing',
  viewed: 'status-badge-viewed',
  negotiation: 'status-badge-negotiation',
  closed: 'status-badge-closed',
  lost: 'status-badge-lost',
};
