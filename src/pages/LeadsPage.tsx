import { useState, useMemo, useCallback } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useLeads, useUpdateLeadStatus, LeadWithProfile } from '@/hooks/useLeads';
import { useActivities, ActivityWithProfile } from '@/hooks/useActivities';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateLeadDialog } from '@/components/forms/CreateLeadDialog';
import { ScheduleViewingDialog } from '@/components/forms/ScheduleViewingDialog';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Search,
  Phone,
  MapPin,
  Flame,
  Thermometer,
  Snowflake,
  Clock,
  Bed,
  Loader2,
  MessageSquare,
  Activity,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type LeadStatus = Database['public']['Enums']['lead_status'];
type LeadPriority = Database['public']['Enums']['lead_priority'];

const pipelineStages: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: 'bg-status-new' },
  { id: 'contacted', label: 'Contacted', color: 'bg-status-contacted' },
  { id: 'viewing', label: 'Viewing', color: 'bg-status-viewing' },
  { id: 'viewed', label: 'Viewed', color: 'bg-status-viewed' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-status-negotiation' },
  { id: 'closed', label: 'Closed', color: 'bg-status-closed' },
  { id: 'lost', label: 'Lost', color: 'bg-status-lost' },
];

const priorityConfig: Record<LeadPriority, { icon: React.ElementType; color: string; bg: string }> = {
  hot: { icon: Flame, color: 'text-priority-hot', bg: 'bg-pastel-red' },
  warm: { icon: Thermometer, color: 'text-priority-warm', bg: 'bg-pastel-orange' },
  cold: { icon: Snowflake, color: 'text-priority-cold', bg: 'bg-pastel-cyan' },
};

export default function LeadsPage() {
  const { data: leads = [], isLoading, error } = useLeads();
  const { data: activities = [] } = useActivities();
  const updateLeadStatus = useUpdateLeadStatus();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<LeadPriority | 'all'>('all');
  
  // State for viewing scheduling dialog
  const [viewingDialogOpen, setViewingDialogOpen] = useState(false);
  const [pendingViewingLead, setPendingViewingLead] = useState<{
    id: string;
    name: string;
    originalStatus: LeadStatus;
  } | null>(null);

  // Create a map of lead_id to latest activity and latest note
  const leadActivityMap = useMemo(() => {
    const map: Record<string, { lastActivity: ActivityWithProfile | null; lastNote: ActivityWithProfile | null }> = {};
    
    activities.forEach((activity) => {
      if (!activity.lead_id) return;
      
      if (!map[activity.lead_id]) {
        map[activity.lead_id] = { lastActivity: null, lastNote: null };
      }
      
      // Set latest activity (first one we encounter since activities are sorted desc)
      if (!map[activity.lead_id].lastActivity) {
        map[activity.lead_id].lastActivity = activity;
      }
      
      // Set latest note
      if (!map[activity.lead_id].lastNote && activity.type === 'note') {
        map[activity.lead_id].lastNote = activity;
      }
    });
    
    return map;
  }, [activities]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = 
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        lead.phone.includes(searchQuery);
      
      const matchesPriority = filterPriority === 'all' || lead.priority === filterPriority;
      
      return matchesSearch && matchesPriority;
    });
  }, [leads, searchQuery, filterPriority]);

  const leadsByStage = useMemo(() => {
    return pipelineStages.reduce((acc, stage) => {
      acc[stage.id] = filteredLeads.filter((lead) => lead.status === stage.id);
      return acc;
    }, {} as Record<LeadStatus, LeadWithProfile[]>);
  }, [filteredLeads]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;
    const newStatus = destination.droppableId as LeadStatus;
    const oldStatus = source.droppableId as LeadStatus;

    // If moving to "viewing" status, show the scheduling dialog
    if (newStatus === 'viewing' && oldStatus !== 'viewing') {
      const lead = leads.find(l => l.id === draggableId);
      if (lead) {
        setPendingViewingLead({
          id: draggableId,
          name: lead.name,
          originalStatus: oldStatus,
        });
        setViewingDialogOpen(true);
        return;
      }
    }

    // For other status changes, update directly
    updateLeadStatus.mutate({ id: draggableId, status: newStatus });
  }, [leads, updateLeadStatus]);

  const handleViewingConfirmed = useCallback(() => {
    if (pendingViewingLead) {
      updateLeadStatus.mutate({ id: pendingViewingLead.id, status: 'viewing' });
      setPendingViewingLead(null);
    }
  }, [pendingViewingLead, updateLeadStatus]);

  const handleViewingCancelled = useCallback(() => {
    setPendingViewingLead(null);
  }, []);

  const getAgentName = (lead: LeadWithProfile) => {
    return lead.profiles?.full_name?.split(' ')[0] || 'Unassigned';
  };

  if (error) {
    return (
      <MainLayout>
        <PageContent>
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h2 className="text-xl font-semibold text-foreground mb-2">Error loading leads</h2>
            <p className="text-muted-foreground">{error.message}</p>
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Leads Pipeline"
        subtitle="Manage and track your leads through the sales process"
        actions={
          <CreateLeadDialog
            trigger={
              <Button className="bg-gradient-primary hover:opacity-90">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            }
          />
        }
      />

      <PageContent noPadding className="flex flex-col h-[calc(100vh-88px)]">
        {/* Filters */}
        <div className="px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Priority:</span>
              {(['all', 'hot', 'warm', 'cold'] as const).map((priority) => (
                <button
                  key={priority}
                  onClick={() => setFilterPriority(priority)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    filterPriority === priority
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {priority === 'all' ? 'All' : priority.charAt(0).toUpperCase() + priority.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto px-6 py-4">
          {isLoading ? (
            <div className="flex gap-4 h-full min-w-max">
              {pipelineStages.map((stage) => (
                <div key={stage.id} className="w-80 flex flex-col">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <Skeleton className="w-20 h-5" />
                    </div>
                  </div>
                  <div className="flex-1 rounded-xl p-2 bg-kanban-bg">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-40 w-full mb-2 rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-4 h-full min-w-max">
                {pipelineStages.map((stage) => (
                  <div key={stage.id} className="w-80 flex flex-col">
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-4 px-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-3 h-3 rounded-full", stage.color)} />
                        <h3 className="font-semibold text-foreground">{stage.label}</h3>
                        <span className="px-2 py-0.5 bg-muted rounded-full text-xs font-medium text-muted-foreground">
                          {leadsByStage[stage.id]?.length || 0}
                        </span>
                      </div>
                    </div>

                    {/* Droppable Column */}
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "flex-1 rounded-xl p-2 transition-colors min-h-[200px]",
                            snapshot.isDraggingOver
                              ? "bg-primary/10 ring-2 ring-primary/20"
                              : "bg-kanban-bg"
                          )}
                        >
                          <AnimatePresence mode="popLayout">
                            {leadsByStage[stage.id]?.map((lead, index) => (
                              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => navigate(`/leads/${lead.id}`)}
                                    className={cn(
                                      "kanban-card mb-2 animate-scale-in",
                                      snapshot.isDragging && "dragging shadow-lg rotate-2"
                                    )}
                                  >
                                    <LeadCard 
                                      lead={lead} 
                                      getAgentName={getAgentName}
                                      lastActivity={leadActivityMap[lead.id]?.lastActivity || null}
                                      lastNote={leadActivityMap[lead.id]?.lastNote || null}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </AnimatePresence>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
            </DragDropContext>
          )}
        </div>
      </PageContent>

      {/* Viewing Scheduling Dialog */}
      {pendingViewingLead && (
        <ScheduleViewingDialog
          open={viewingDialogOpen}
          onOpenChange={setViewingDialogOpen}
          leadId={pendingViewingLead.id}
          leadName={pendingViewingLead.name}
          onConfirm={handleViewingConfirmed}
          onCancel={handleViewingCancelled}
        />
      )}
    </MainLayout>
  );
}

interface LeadCardProps {
  lead: LeadWithProfile;
  getAgentName: (lead: LeadWithProfile) => string;
  lastActivity: ActivityWithProfile | null;
  lastNote: ActivityWithProfile | null;
}

function LeadCard({ lead, getAgentName, lastActivity, lastNote }: LeadCardProps) {
  const PriorityIcon = priorityConfig[lead.priority].icon;
  const budgetMin = lead.budget_min || 0;
  const budgetMax = lead.budget_max || 0;
  const currency = lead.budget_currency || 'AED';
  const bedrooms = lead.bedrooms || 0;
  const propertyTypes = lead.property_types || [];
  const buildingName = (lead as any).building_name;
  const areaName = (lead as any).area_name;
  const leadType = (lead as any).lead_type;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
            priorityConfig[lead.priority].bg,
            priorityConfig[lead.priority].color
          )}>
            {lead.name.charAt(0)}
          </div>
          <div>
            <h4 className="font-medium text-foreground text-sm">{lead.name}</h4>
            <p className="text-xs text-muted-foreground">{getAgentName(lead)}</p>
          </div>
        </div>
        <div className={cn("p-1 rounded", priorityConfig[lead.priority].bg)}>
          <PriorityIcon className={cn("w-4 h-4", priorityConfig[lead.priority].color)} />
        </div>
      </div>

      {/* Contact Info */}
      <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
        <Phone className="w-3 h-3" />
        <span>{lead.phone}</span>
      </div>

      {/* Budget */}
      <div className="mb-2">
        <p className="text-sm font-semibold text-foreground">
          {formatCurrency(budgetMin, currency)} - {formatCurrency(budgetMax, currency)}
        </p>
      </div>

      {/* Requirements */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <Badge variant="secondary" className="text-xs">
          <Bed className="w-3 h-3 mr-1" />
          {bedrooms} BR
        </Badge>
        {propertyTypes.slice(0, 1).map((type) => (
          <Badge key={type} variant="secondary" className="text-xs capitalize">
            {type}
          </Badge>
        ))}
      </div>

      {/* Last Note */}
      {lastNote && lastNote.description && (
        <div className="mb-2 p-2 bg-muted/50 rounded-md">
          <div className="flex items-start gap-1.5">
            <MessageSquare className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground line-clamp-2">
              {lastNote.description}
            </p>
          </div>
        </div>
      )}

      {/* Footer - Building & Area */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {buildingName || areaName 
              ? [buildingName, areaName].filter(Boolean).join(', ')
              : 'No location'}
          </span>
        </div>
        {leadType && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0 ml-1">
            {leadType}
          </Badge>
        )}
        {lead.next_follow_up && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(lead.next_follow_up)}</span>
          </div>
        )}
      </div>
    </>
  );
}
