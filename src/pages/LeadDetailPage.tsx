import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useCRMStore } from '@/store/crmStore';
import { formatCurrency, formatDateTime, formatRelativeTime, getDaysSinceCreation } from '@/lib/formatters';
import { matchProperties } from '@/lib/propertyMatching';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ActivityType, LeadPriority } from '@/types/crm';

const activityIcons: Record<ActivityType, React.ElementType> = {
  Call: Phone,
  Email: Mail,
  WhatsApp: MessageSquare,
  Meeting: Calendar,
  Note: FileText,
  Task: FileText,
  'Status Change': ArrowRightLeft,
  'Property Sent': Send,
};

const activityColors: Record<ActivityType, string> = {
  Call: 'bg-pastel-blue text-status-new',
  Email: 'bg-pastel-purple text-status-contacted',
  WhatsApp: 'bg-pastel-green text-status-closed',
  Meeting: 'bg-pastel-orange text-status-viewing',
  Note: 'bg-muted text-muted-foreground',
  Task: 'bg-pastel-cyan text-status-viewed',
  'Status Change': 'bg-pastel-orange text-status-negotiation',
  'Property Sent': 'bg-pastel-blue text-primary',
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
  const { leads, activities, properties, getAgentById } = useCRMStore();

  const lead = leads.find((l) => l.id === id);
  const leadActivities = activities.filter((a) => a.leadId === id);
  const matchedProperties = lead ? matchProperties(lead, properties) : [];
  const agent = lead ? getAgentById(lead.assignedAgent) : null;

  if (!lead) {
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

  const PriorityIcon = priorityConfig[lead.priority].icon;

  return (
    <MainLayout>
      <PageHeader
        title=""
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" size="sm">
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
              {statusLabels[lead.status]} • Added {getDaysSinceCreation(lead.createdAt)} days ago
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
                    <p className="font-medium text-foreground">{lead.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pastel-green rounded-lg">
                    <Target className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Source</p>
                    <p className="font-medium text-foreground">{lead.source}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pastel-orange rounded-lg">
                    <Calendar className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned To</p>
                    <p className="font-medium text-foreground">{agent?.name || 'Unassigned'}</p>
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
                    {formatCurrency(lead.budget.min, lead.budget.currency)} - {formatCurrency(lead.budget.max, lead.budget.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Bedrooms</p>
                  <div className="flex items-center gap-2">
                    <Bed className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xl font-bold text-foreground">{lead.requirements.bedrooms}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Property Types</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.requirements.propertyType.map((type) => (
                      <Badge key={type} variant="secondary">
                        <Building2 className="w-3 h-3 mr-1" />
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Preferred Locations</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.requirements.locations.map((loc) => (
                      <Badge key={loc} variant="secondary">
                        <MapPin className="w-3 h-3 mr-1" />
                        {loc}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Tabs */}
            <Tabs defaultValue="activities" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="activities">Activities</TabsTrigger>
                <TabsTrigger value="properties">Matched Properties</TabsTrigger>
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
                    {leadActivities.length > 0 ? (
                      leadActivities.map((activity, index) => {
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
                              {index < leadActivities.length - 1 && (
                                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-border" />
                              )}
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-foreground">{activity.title}</p>
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(activity.createdAt)}
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

              <TabsContent value="properties" className="mt-4">
                <div className="bg-card rounded-xl p-6 shadow-card">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Matched Properties</h3>
                  {matchedProperties.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {matchedProperties.map((match) => (
                        <div key={match.property.id} className="p-4 border border-border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-foreground">{match.property.title}</h4>
                            <Badge variant="secondary">{match.score}% match</Badge>
                          </div>
                          <p className="text-lg font-bold text-foreground mb-2">
                            {formatCurrency(match.property.price, match.property.currency)}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {match.matchReasons.map((reason) => (
                              <Badge key={reason} variant="outline" className="text-xs">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No matching properties found.
                    </p>
                  )}
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
                <Button className="w-full justify-start" variant="outline">
                  <Phone className="w-4 h-4 mr-2" />
                  Log Call
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send WhatsApp
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Viewing
                </Button>
                <Button className="w-full justify-start" variant="outline">
                  <Send className="w-4 h-4 mr-2" />
                  Send Properties
                </Button>
              </div>
            </motion.div>

            {/* Next Follow-up */}
            {lead.nextFollowUp && (
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
                <p className="text-2xl font-bold">{formatRelativeTime(lead.nextFollowUp)}</p>
                <p className="text-sm opacity-80 mt-1">{formatDateTime(lead.nextFollowUp)}</p>
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
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="8"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="8"
                      strokeDasharray={`${75 * 2.26} ${100 * 2.26}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-foreground">
                    75
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">High Quality Lead</p>
                  <p className="text-sm text-muted-foreground">Based on engagement and budget fit</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </PageContent>
    </MainLayout>
  );
}
