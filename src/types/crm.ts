// Lead Types
export type LeadStatus = 
  | 'new' 
  | 'contacted' 
  | 'viewing' 
  | 'viewed' 
  | 'negotiation' 
  | 'closed' 
  | 'lost';

export type LeadPriority = 'hot' | 'warm' | 'cold';

export type LeadSource = 
  | 'Website' 
  | 'Referral' 
  | 'Cold Call' 
  | 'Social Media' 
  | 'Property Portal' 
  | 'Walk-in' 
  | 'Other';

export type PropertyType = 
  | 'Apartment' 
  | 'Villa' 
  | 'Townhouse' 
  | 'Penthouse' 
  | 'Studio' 
  | 'Commercial' 
  | 'Land';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  priority: LeadPriority;
  source: LeadSource;
  assignedAgent: string;
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  requirements: {
    propertyType: PropertyType[];
    bedrooms: number;
    locations: string[];
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
  lastContactedAt?: string;
  nextFollowUp?: string;
  tags?: string[];
}

// Activity Types
export type ActivityType = 
  | 'Call' 
  | 'Email' 
  | 'WhatsApp' 
  | 'Meeting' 
  | 'Note' 
  | 'Task' 
  | 'Status Change'
  | 'Property Sent';

export interface Activity {
  id: string;
  leadId: string;
  type: ActivityType;
  title: string;
  description?: string;
  createdAt: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

// Task Types
export type TaskStatus = 'pending' | 'completed' | 'overdue';
export type TaskType = 'call' | 'viewing' | 'follow-up' | 'meeting' | 'document' | 'other';

export interface Task {
  id: string;
  leadId: string;
  leadName: string;
  leadPriority: LeadPriority;
  type: TaskType;
  title: string;
  description?: string;
  dueDate: string;
  status: TaskStatus;
  assignedTo: string;
  createdAt: string;
  completedAt?: string;
}

// Cold Call Types
export type ColdCallStatus = 'new' | 'called' | 'interested' | 'not_interested' | 'converted';

export interface ColdCall {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  location?: string;
  budget?: number;
  bedrooms?: number;
  notes?: string;
  assignedAgent: string;
  status: ColdCallStatus;
  lastCallDate?: string;
  nextFollowUp?: string;
  createdAt: string;
  updatedAt: string;
}

// Property Types
export interface Property {
  id: string;
  title: string;
  type: PropertyType;
  price: number;
  currency: string;
  location: string;
  bedrooms: number;
  bathrooms: number;
  size: number;
  sizeUnit: 'sqft' | 'sqm';
  description?: string;
  features: string[];
  images: string[];
  status: 'available' | 'under_offer' | 'sold' | 'rented';
  createdAt: string;
}

// Agent Types
export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: 'admin' | 'agent';
  leadsCount: number;
  closedDeals: number;
  revenue: number;
}

// Pipeline Stage
export interface PipelineStage {
  id: LeadStatus;
  label: string;
  color: string;
  order: number;
}

// Dashboard Metrics
export interface DashboardMetrics {
  newLeadsToday: number;
  followUpsDue: number;
  viewingsToday: number;
  closedDealsMonth: number;
  totalRevenue: number;
  conversionRate: number;
}
