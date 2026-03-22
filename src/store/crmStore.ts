import { create } from 'zustand';
import { Lead, Activity, Task, ColdCall, Property, Agent, LeadStatus, DashboardMetrics } from '@/types/crm';

const initialAgents: Agent[] = [];
const initialLeads: Lead[] = [];
const initialActivities: Activity[] = [];
const initialTasks: Task[] = [];
const initialColdCalls: ColdCall[] = [];
const initialProperties: Property[] = [];

const emptyAgent: Agent = {
  id: '',
  name: '',
  email: '',
  phone: '',
  role: 'agent',
  leadsCount: 0,
  closedDeals: 0,
  revenue: 0,
  avatar: undefined,
};

interface CRMStore {
  // Data
  leads: Lead[];
  activities: Activity[];
  tasks: Task[];
  coldCalls: ColdCall[];
  properties: Property[];
  agents: Agent[];
  currentAgent: Agent;
  
  // Computed
  getMetrics: () => DashboardMetrics;
  getLeadsByStatus: (status: LeadStatus) => Lead[];
  getLeadById: (id: string) => Lead | undefined;
  getAgentById: (id: string) => Agent | undefined;
  getActivitiesByLead: (leadId: string) => Activity[];
  getTasksByLead: (leadId: string) => Task[];
  
  // Actions
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  addActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  convertColdCallToLead: (coldCallId: string) => void;
  updateColdCallStatus: (coldCallId: string, status: ColdCall['status']) => void;
}

export const useCRMStore = create<CRMStore>((set, get) => ({
  leads: initialLeads,
  activities: initialActivities,
  tasks: initialTasks,
  coldCalls: initialColdCalls,
  properties: initialProperties,
  agents: initialAgents,
  currentAgent: emptyAgent,

  getMetrics: () => {
    const { leads, tasks } = get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStr = today.toISOString().split('T')[0];
    
    return {
      newLeadsToday: leads.filter(l => l.createdAt.startsWith(todayStr)).length,
      followUpsDue: tasks.filter(t => t.status === 'pending' && new Date(t.dueDate) <= new Date()).length,
      viewingsToday: tasks.filter(t => t.type === 'viewing' && t.dueDate.startsWith(todayStr)).length,
      closedDealsMonth: leads.filter(l => l.status === 'closed').length,
      totalRevenue: 0,
      conversionRate: leads.length > 0 ? (leads.filter(l => l.status === 'closed').length / leads.length) * 100 : 0,
    };
  },

  getLeadsByStatus: (status) => get().leads.filter(l => l.status === status),
  
  getLeadById: (id) => get().leads.find(l => l.id === id),
  
  getAgentById: (id) => get().agents.find(a => a.id === id),
  
  getActivitiesByLead: (leadId) => get().activities.filter(a => a.leadId === leadId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  
  getTasksByLead: (leadId) => get().tasks.filter(t => t.leadId === leadId),

  updateLeadStatus: (leadId, status) => {
    set((state) => ({
      leads: state.leads.map(l => 
        l.id === leadId 
          ? { ...l, status, updatedAt: new Date().toISOString() }
          : l
      ),
      activities: [
        ...state.activities,
        {
          id: Date.now().toString(),
          leadId,
          type: 'Status Change' as const,
          title: `Status changed to ${status}`,
          createdAt: new Date().toISOString(),
          createdBy: state.currentAgent.id,
        }
      ]
    }));
  },

  addActivity: (activity) => {
    set((state) => ({
      activities: [
        ...state.activities,
        {
          ...activity,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
        }
      ]
    }));
  },

  updateTask: (taskId, updates) => {
    set((state) => ({
      tasks: state.tasks.map(t =>
        t.id === taskId
          ? { ...t, ...updates }
          : t
      )
    }));
  },

  convertColdCallToLead: (coldCallId) => {
    const { coldCalls, currentAgent } = get();
    const coldCall = coldCalls.find(c => c.id === coldCallId);
    
    if (!coldCall) return;

    const newLead: Lead = {
      id: Date.now().toString(),
      name: coldCall.name,
      email: coldCall.email || '',
      phone: coldCall.phone,
      status: 'new',
      priority: 'warm',
      source: coldCall.source,
      assignedAgent: coldCall.assignedAgent,
      budget: {
        min: coldCall.budget || 0,
        max: (coldCall.budget || 0) * 1.5,
        currency: 'AED',
      },
      requirements: {
        propertyType: ['Apartment'],
        bedrooms: coldCall.bedrooms || 1,
        locations: coldCall.location ? [coldCall.location] : [],
        notes: coldCall.notes,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      leads: [...state.leads, newLead],
      coldCalls: state.coldCalls.map(c =>
        c.id === coldCallId
          ? { ...c, status: 'converted' as const, updatedAt: new Date().toISOString() }
          : c
      ),
      activities: [
        ...state.activities,
        {
          id: Date.now().toString(),
          leadId: newLead.id,
          type: 'Note' as const,
          title: 'Lead created from cold call',
          description: `Converted from cold call record`,
          createdAt: new Date().toISOString(),
          createdBy: currentAgent.id,
        }
      ]
    }));
  },

  updateColdCallStatus: (coldCallId, status) => {
    set((state) => ({
      coldCalls: state.coldCalls.map(c =>
        c.id === coldCallId
          ? { ...c, status, updatedAt: new Date().toISOString() }
          : c
      )
    }));
  },
}));
