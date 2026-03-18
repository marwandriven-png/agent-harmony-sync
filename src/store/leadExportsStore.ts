import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ExportedLead {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  company: string;
  companyUrl?: string;
  phone: string;
  location: string;
  linkedin: boolean;
  linkedinUrl?: string;
}

export interface LeadExport {
  id: string;
  name: string;
  date: string;
  leads: ExportedLead[];
  hasContact: boolean;
}

interface LeadExportsStore {
  exports: LeadExport[];
  addExport: (exp: LeadExport) => void;
}

export const useLeadExportsStore = create<LeadExportsStore>()(
  persist(
    (set) => ({
      exports: [],
      addExport: (exp) => set((state) => ({ exports: [exp, ...state.exports] })),
    }),
    { name: 'lead-exports-storage' }
  )
);
