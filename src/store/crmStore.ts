import { create } from 'zustand';
import { Lead, Activity, Task, ColdCall, Property, Agent, LeadStatus, DashboardMetrics } from '@/types/crm';

// Mock Data
const mockAgents: Agent[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah@realestate.com', phone: '+1234567890', role: 'admin', leadsCount: 45, closedDeals: 12, revenue: 2400000, avatar: undefined },
  { id: '2', name: 'Michael Chen', email: 'michael@realestate.com', phone: '+1234567891', role: 'agent', leadsCount: 32, closedDeals: 8, revenue: 1800000, avatar: undefined },
  { id: '3', name: 'Emily Davis', email: 'emily@realestate.com', phone: '+1234567892', role: 'agent', leadsCount: 28, closedDeals: 6, revenue: 1200000, avatar: undefined },
];

const mockLeads: Lead[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+971501234567',
    status: 'new',
    priority: 'hot',
    source: 'Website',
    assignedAgent: '1',
    budget: { min: 1000000, max: 1500000, currency: 'AED' },
    requirements: { propertyType: ['Apartment'], bedrooms: 2, locations: ['Downtown Dubai', 'Business Bay'] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nextFollowUp: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: '2',
    name: 'Maria Garcia',
    email: 'maria.g@email.com',
    phone: '+971502345678',
    status: 'contacted',
    priority: 'warm',
    source: 'Referral',
    assignedAgent: '2',
    budget: { min: 2000000, max: 3000000, currency: 'AED' },
    requirements: { propertyType: ['Villa'], bedrooms: 4, locations: ['Palm Jumeirah', 'Emirates Hills'] },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
    lastContactedAt: new Date(Date.now() - 86400000).toISOString(),
    nextFollowUp: new Date(Date.now() + 86400000 * 2).toISOString(),
  },
  {
    id: '3',
    name: 'Ahmed Hassan',
    email: 'ahmed.h@email.com',
    phone: '+971503456789',
    status: 'viewing',
    priority: 'hot',
    source: 'Property Portal',
    assignedAgent: '1',
    budget: { min: 800000, max: 1200000, currency: 'AED' },
    requirements: { propertyType: ['Apartment', 'Studio'], bedrooms: 1, locations: ['Dubai Marina', 'JLT'] },
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
    lastContactedAt: new Date().toISOString(),
    nextFollowUp: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    id: '4',
    name: 'Lisa Wong',
    email: 'lisa.w@email.com',
    phone: '+971504567890',
    status: 'viewed',
    priority: 'warm',
    source: 'Social Media',
    assignedAgent: '3',
    budget: { min: 1500000, max: 2000000, currency: 'AED' },
    requirements: { propertyType: ['Townhouse'], bedrooms: 3, locations: ['Arabian Ranches', 'Dubai Hills'] },
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date().toISOString(),
    lastContactedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: '5',
    name: 'Robert Taylor',
    email: 'robert.t@email.com',
    phone: '+971505678901',
    status: 'negotiation',
    priority: 'hot',
    source: 'Referral',
    assignedAgent: '2',
    budget: { min: 5000000, max: 8000000, currency: 'AED' },
    requirements: { propertyType: ['Penthouse'], bedrooms: 4, locations: ['Downtown Dubai', 'DIFC'] },
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: new Date().toISOString(),
    lastContactedAt: new Date().toISOString(),
  },
  {
    id: '6',
    name: 'Emma Wilson',
    email: 'emma.w@email.com',
    phone: '+971506789012',
    status: 'closed',
    priority: 'hot',
    source: 'Website',
    assignedAgent: '1',
    budget: { min: 1200000, max: 1500000, currency: 'AED' },
    requirements: { propertyType: ['Apartment'], bedrooms: 2, locations: ['Dubai Marina'] },
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date().toISOString(),
    lastContactedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: '7',
    name: 'David Brown',
    email: 'david.b@email.com',
    phone: '+971507890123',
    status: 'new',
    priority: 'cold',
    source: 'Cold Call',
    assignedAgent: '3',
    budget: { min: 600000, max: 900000, currency: 'AED' },
    requirements: { propertyType: ['Studio', 'Apartment'], bedrooms: 1, locations: ['JVC', 'Sports City'] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '8',
    name: 'Sophie Martin',
    email: 'sophie.m@email.com',
    phone: '+971508901234',
    status: 'lost',
    priority: 'warm',
    source: 'Property Portal',
    assignedAgent: '2',
    budget: { min: 2500000, max: 3500000, currency: 'AED' },
    requirements: { propertyType: ['Villa'], bedrooms: 5, locations: ['Jumeirah', 'Al Barsha'] },
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    lastContactedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
];

const mockActivities: Activity[] = [
  { id: '1', leadId: '1', type: 'Call', title: 'Initial contact call', description: 'Discussed requirements and budget', createdAt: new Date().toISOString(), createdBy: '1' },
  { id: '2', leadId: '2', type: 'Email', title: 'Sent property listings', description: 'Sent 5 villa options in Palm Jumeirah', createdAt: new Date(Date.now() - 3600000).toISOString(), createdBy: '2' },
  { id: '3', leadId: '3', type: 'Meeting', title: 'Property viewing scheduled', description: 'Viewing at Dubai Marina tower', createdAt: new Date(Date.now() - 7200000).toISOString(), createdBy: '1' },
  { id: '4', leadId: '5', type: 'WhatsApp', title: 'Negotiation update', description: 'Client counter-offered at 7.2M', createdAt: new Date(Date.now() - 10800000).toISOString(), createdBy: '2' },
  { id: '5', leadId: '1', type: 'Note', title: 'Client preferences updated', description: 'Now prefers higher floor apartments', createdAt: new Date(Date.now() - 14400000).toISOString(), createdBy: '1' },
];

const mockTasks: Task[] = [
  { id: '1', leadId: '1', leadName: 'John Smith', leadPriority: 'hot', type: 'call', title: 'Follow-up call', description: 'Discuss viewing schedule', dueDate: new Date().toISOString(), status: 'pending', assignedTo: '1', createdAt: new Date().toISOString() },
  { id: '2', leadId: '3', leadName: 'Ahmed Hassan', leadPriority: 'hot', type: 'viewing', title: 'Property viewing', description: 'Dubai Marina apartment viewing', dueDate: new Date(Date.now() + 86400000).toISOString(), status: 'pending', assignedTo: '1', createdAt: new Date().toISOString() },
  { id: '3', leadId: '2', leadName: 'Maria Garcia', leadPriority: 'warm', type: 'follow-up', title: 'Send additional listings', description: 'Client requested more villa options', dueDate: new Date(Date.now() + 86400000 * 2).toISOString(), status: 'pending', assignedTo: '2', createdAt: new Date().toISOString() },
  { id: '4', leadId: '5', leadName: 'Robert Taylor', leadPriority: 'hot', type: 'meeting', title: 'Contract discussion', description: 'Final negotiation meeting', dueDate: new Date(Date.now() + 86400000 * 3).toISOString(), status: 'pending', assignedTo: '2', createdAt: new Date().toISOString() },
  { id: '5', leadId: '4', leadName: 'Lisa Wong', leadPriority: 'warm', type: 'call', title: 'Feedback call', description: 'Get feedback on viewed properties', dueDate: new Date(Date.now() - 86400000).toISOString(), status: 'overdue', assignedTo: '3', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
];

const mockColdCalls: ColdCall[] = [
  { id: '1', name: 'James Anderson', phone: '+971509876543', email: 'james.a@email.com', source: 'Cold Call', location: 'Downtown Dubai', budget: 1500000, bedrooms: 2, notes: 'Interested in investment properties', assignedAgent: '1', status: 'new', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '2', name: 'Nina Patel', phone: '+971508765432', source: 'Property Portal', location: 'Marina', budget: 2000000, bedrooms: 3, assignedAgent: '2', status: 'called', lastCallDate: new Date(Date.now() - 86400000).toISOString(), nextFollowUp: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), updatedAt: new Date().toISOString() },
  { id: '3', name: 'Carlos Rodriguez', phone: '+971507654321', email: 'carlos.r@email.com', source: 'Social Media', location: 'JBR', assignedAgent: '3', status: 'interested', lastCallDate: new Date().toISOString(), notes: 'Looking for beachfront property', createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), updatedAt: new Date().toISOString() },
  { id: '4', name: 'Fatima Al-Rashid', phone: '+971506543210', source: 'Referral', budget: 3500000, bedrooms: 4, assignedAgent: '1', status: 'not_interested', lastCallDate: new Date(Date.now() - 86400000 * 2).toISOString(), notes: 'Not ready to buy at the moment', createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), updatedAt: new Date().toISOString() },
];

const mockProperties: Property[] = [
  { id: '1', title: 'Luxury 2BR in Downtown', type: 'Apartment', price: 1400000, currency: 'AED', location: 'Downtown Dubai', bedrooms: 2, bathrooms: 2, size: 1200, sizeUnit: 'sqft', features: ['Sea View', 'Balcony', 'Gym', 'Pool'], images: [], status: 'available', createdAt: new Date().toISOString() },
  { id: '2', title: 'Stunning Villa in Palm', type: 'Villa', price: 8500000, currency: 'AED', location: 'Palm Jumeirah', bedrooms: 5, bathrooms: 6, size: 6500, sizeUnit: 'sqft', features: ['Private Beach', 'Pool', 'Garden', 'Maid Room'], images: [], status: 'available', createdAt: new Date().toISOString() },
  { id: '3', title: 'Modern Studio Marina', type: 'Studio', price: 750000, currency: 'AED', location: 'Dubai Marina', bedrooms: 0, bathrooms: 1, size: 500, sizeUnit: 'sqft', features: ['Marina View', 'Furnished', 'Gym'], images: [], status: 'available', createdAt: new Date().toISOString() },
];

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
  leads: mockLeads,
  activities: mockActivities,
  tasks: mockTasks,
  coldCalls: mockColdCalls,
  properties: mockProperties,
  agents: mockAgents,
  currentAgent: mockAgents[0],

  getMetrics: () => {
    const { leads, tasks } = get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStr = today.toISOString().split('T')[0];
    
    return {
      newLeadsToday: leads.filter(l => l.createdAt.startsWith(todayStr)).length || 3,
      followUpsDue: tasks.filter(t => t.status === 'pending' && new Date(t.dueDate) <= new Date()).length || 5,
      viewingsToday: tasks.filter(t => t.type === 'viewing' && t.dueDate.startsWith(todayStr)).length || 2,
      closedDealsMonth: leads.filter(l => l.status === 'closed').length,
      totalRevenue: 4200000,
      conversionRate: 23.5,
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
