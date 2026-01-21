import { useState, useMemo } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useLeads, useUpdateLeadStatus, LeadWithProfile } from '@/hooks/useLeads';
import { formatCurrency, formatRelativeTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateLeadDialog } from '@/components/forms/CreateLeadDialog';
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
  const updateLeadStatus = useUpdateLeadStatus();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<LeadPriority | 'all'>('all');

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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as LeadStatus;

    updateLeadStatus.mutate({ id: draggableId, status: newStatus });
  };

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
                                    <LeadCard lead={lead} getAgentName={getAgentName} />
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
    </MainLayout>
  );
}

interface LeadCardProps {
  lead: LeadWithProfile;
  getAgentName: (lead: LeadWithProfile) => string;
}

function LeadCard({ lead, getAgentName }: LeadCardProps) {
  const PriorityIcon = priorityConfig[lead.priority].icon;
  const budgetMin = lead.budget_min || 0;
  const budgetMax = lead.budget_max || 0;
  const currency = lead.budget_currency || 'AED';
  const bedrooms = lead.bedrooms || 0;
  const locations = lead.locations || [];
  const propertyTypes = lead.property_types || [];

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
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

      {/* Budget */}
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">
          {formatCurrency(budgetMin, currency)} - {formatCurrency(budgetMax, currency)}
        </p>
      </div>

      {/* Requirements */}
      <div className="flex flex-wrap gap-1.5 mb-3">
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

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span className="truncate max-w-[100px]">{locations[0] || 'No location'}</span>
        </div>
        {lead.next_follow_up && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(lead.next_follow_up)}</span>
          </div>
        )}
      </div>
    </>
  );
}
