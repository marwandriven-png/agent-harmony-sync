import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useLeadById } from '@/hooks/useLeads';
import { useActivitiesByLead, useCreateActivity } from '@/hooks/useActivities';
import { useProperties } from '@/hooks/useProperties';
import { formatCurrency, formatDateTime, formatRelativeTime, getDaysSinceCreation } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SendTemplateDialog } from '@/components/leads/SendTemplateDialog';
import { EditLeadDialog } from '@/components/forms/EditLeadDialog';
import { DeleteLeadDialog } from '@/components/forms/DeleteLeadDialog';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  Bed,
  Building2,
  Target,
  Calendar,
  Clock,
  Flame,
  Thermometer,
  Snowflake,
  Edit,
  Trash2,
  Send,
  Plus,
  FileText,
  ArrowRightLeft,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ActivityType = Database['public']['Enums']['activity_type'];
type LeadPriority = Database['public']['Enums']['lead_priority'];

const activityIcons: Record<ActivityType, React.ElementType> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  meeting: Calendar,
  note: FileText,
  task: FileText,
  status_change: ArrowRightLeft,
  property_sent: Send,
};

const activityColors: Record<ActivityType, string> = {
  call: 'bg-pastel-blue text-status-new',
  email: 'bg-pastel-purple text-status-contacted',
  whatsapp: 'bg-pastel-green text-status-closed',
  meeting: 'bg-pastel-orange text-status-viewing',
  note: 'bg-muted text-muted-foreground',
  task: 'bg-pastel-cyan text-status-viewed',
  status_change: 'bg-pastel-orange text-status-negotiation',
  property_sent: 'bg-pastel-blue text-primary',
};

const activityLabels: Record<ActivityType, string> = {
  call: 'Call',
  email: 'Email',
  whatsapp: 'WhatsApp',
  meeting: 'Meeting',
  note: 'Note',
  task: 'Task',
  status_change: 'Status Change',
  property_sent: 'Property Sent',
};

const priorityConfig: Record<LeadPriority, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  hot: { icon: Flame, color: 'text-priority-hot', bg: 'bg-pastel-red', label: 'Hot' },
  warm: { icon: Thermometer, color: 'text-priority-warm', bg: 'bg-pastel-orange', label: 'Warm' },
  cold: { icon: Snowflake, color: 'text-priority-cold', bg: 'bg-pastel-cyan', label: 'Cold' },
};

const statusLabels: Record<string, string> = {
  new: 'New Lead',
  contacted: 'Contacted',
  viewing: 'Viewing Scheduled',
  viewed: 'Viewed',
  negotiation: 'In Negotiation',
  closed: 'Closed Won',
  lost: 'Closed Lost',
};

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading: leadLoading, error } = useLeadById(id || '');
  const { data: activities = [], isLoading: activitiesLoading } = useActivitiesByLead(id || '');
  const { data: properties = [] } = useProperties();
  const createActivity = useCreateActivity();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (error) {
    return (
      <MainLayout>
        <PageContent>
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h2 className="text-2xl font-semibold text-foreground mb-2">Lead not found</h2>
            <p className="text-muted-foreground mb-4">The lead you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/leads')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leads
            </Button>
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  if (leadLoading || !lead) {
    return (
      <MainLayout>
        <PageContent>
          <div className="space-y-6">
            <Skeleton className="h-16 w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
              <div className="space-y-6">
                <Skeleton className="h-48 w-full" />
              </div>
            </div>
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  const PriorityIcon = priorityConfig[lead.priority].icon;
  const agentName = lead.profiles?.full_name || 'Unassigned';
  const budgetMin = lead.budget_min || 0;
  const budgetMax = lead.budget_max || 0;
  const currency = lead.budget_currency || 'AED';
  const bedrooms = lead.bedrooms || 0;
  const locations = lead.locations || [];
  const propertyTypes = lead.property_types || [];

  const handleLogActivity = async (type: ActivityType) => {
    await createActivity.mutateAsync({
      lead_id: lead.id,
      type,
      title: `${activityLabels[type]} logged`,
    });
  };

  return (
    <MainLayout>
      <PageHeader
        title=""
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
              <div className={cn("px-2 py-1 rounded-full flex items-center gap-1", priorityConfig[lead.priority].bg)}>
                <PriorityIcon className={cn("w-4 h-4", priorityConfig[lead.priority].color)} />
                <span className={cn("text-xs font-medium", priorityConfig[lead.priority].color)}>
                  {priorityConfig[lead.priority].label}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground">
              {statusLabels[lead.status]} • Added {getDaysSinceCreation(lead.created_at)} days ago
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl p-6 shadow-card"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pastel-blue rounded-lg">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{lead.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pastel-purple rounded-lg">
                    <Mail className="w-5 h-5 text-status-contacted" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{lead.email || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pastel-green rounded-lg">
                    <Target className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Source</p>
                    <p className="font-medium text-foreground capitalize">{lead.source.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pastel-orange rounded-lg">
                    <Calendar className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned To</p>
                    <p className="font-medium text-foreground">{agentName}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Requirements */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-xl p-6 shadow-card"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">Requirements</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Budget Range</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(budgetMin, currency)} - {formatCurrency(budgetMax, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Bedrooms</p>
                  <div className="flex items-center gap-2">
                    <Bed className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xl font-bold text-foreground">{bedrooms}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Property Types</p>
                  <div className="flex flex-wrap gap-2">
                    {propertyTypes.map((type) => (
                      <Badge key={type} variant="secondary" className="capitalize">
                        <Building2 className="w-3 h-3 mr-1" />
                        {type}
                      </Badge>
                    ))}
                    {propertyTypes.length === 0 && (
                      <span className="text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Preferred Locations</p>
                  <div className="flex flex-wrap gap-2">
                    {locations.map((loc) => (
                      <Badge key={loc} variant="secondary">
                        <MapPin className="w-3 h-3 mr-1" />
                        {loc}
                      </Badge>
                    ))}
                    {locations.length === 0 && (
                      <span className="text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>
              </div>
              {lead.requirements_notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-2">Notes</p>
                  <p className="text-foreground">{lead.requirements_notes}</p>
                </div>
              )}
            </motion.div>

            {/* Tabs */}
            <Tabs defaultValue="activities" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="activities">Activities</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
              </TabsList>
              
              <TabsContent value="activities" className="mt-4">
                <div className="bg-card rounded-xl p-6 shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Activity Timeline</h3>
                    <Button size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Activity
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {activitiesLoading ? (
                      [1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-4">
                          <Skeleton className="w-10 h-10 rounded-lg" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-1/3 mb-2" />
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                        </div>
                      ))
                    ) : activities.length > 0 ? (
                      activities.map((activity, index) => {
                        const Icon = activityIcons[activity.type];
                        return (
                          <motion.div
                            key={activity.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex gap-4"
                          >
                            <div className="relative">
                              <div className={cn("p-2 rounded-lg", activityColors[activity.type])}>
                                <Icon className="w-4 h-4" />
                              </div>
                              {index < activities.length - 1 && (
                                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-border" />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-foreground">{activity.title}</p>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(activity.created_at)}
                                </span>
                              </div>
                              {activity.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {activity.description}
                                </p>
                              )}
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No activities recorded yet.
                      </p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-4">
                <div className="bg-card rounded-xl p-6 shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Attachments</h3>
                    <Button size="sm" variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                  <p className="text-center text-muted-foreground py-8">
                    No attachments yet.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Quick Actions & Next Steps */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-xl p-6 shadow-card"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleLogActivity('call')}
                  disabled={createActivity.isPending}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Log Call
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleLogActivity('email')}
                  disabled={createActivity.isPending}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleLogActivity('whatsapp')}
                  disabled={createActivity.isPending}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send WhatsApp
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleLogActivity('meeting')}
                  disabled={createActivity.isPending}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Viewing
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleLogActivity('property_sent')}
                  disabled={createActivity.isPending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Properties
                </Button>
                <SendTemplateDialog lead={lead} />
              </div>
            </motion.div>

            {/* Next Follow-up */}
            {lead.next_follow_up && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-primary text-primary-foreground rounded-xl p-6 shadow-card"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5" />
                  <h3 className="font-semibold">Next Follow-up</h3>
                </div>
                <p className="text-2xl font-bold">{formatRelativeTime(lead.next_follow_up)}</p>
                <p className="text-sm opacity-80 mt-1">{formatDateTime(lead.next_follow_up)}</p>
              </motion.div>
            )}

            {/* Lead Score */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-card rounded-xl p-6 shadow-card"
            >
              <h3 className="text-lg font-semibold text-foreground mb-4">Lead Score</h3>
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      strokeWidth="8"
                      className="fill-none stroke-muted"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      strokeWidth="8"
                      className="fill-none stroke-primary"
                      strokeDasharray={`${lead.priority === 'hot' ? 75 : lead.priority === 'warm' ? 50 : 25} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-foreground">
                    {lead.priority === 'hot' ? '85' : lead.priority === 'warm' ? '65' : '35'}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {lead.priority === 'hot' ? 'High Intent' : lead.priority === 'warm' ? 'Medium Intent' : 'Low Intent'}
                  </p>
                  <p className="text-sm text-muted-foreground">Based on engagement</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </PageContent>
    </MainLayout>
  );
}
