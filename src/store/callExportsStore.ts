import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CallExportedLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  company: string;
  location: string;
  exportedAt: string;
}

interface CallExportsStore {
  exportedLeads: CallExportedLead[];
  addLeads: (leads: CallExportedLead[]) => void;
  removeLeads: (ids: string[]) => void;
  clearAll: () => void;
}

export const useCallExportsStore = create<CallExportsStore>()(
  persist(
    (set) => ({
      exportedLeads: [],
      addLeads: (leads) =>
        set((state) => {
          const existingIds = new Set(state.exportedLeads.map((l) => l.id));
          const newLeads = leads.filter((l) => !existingIds.has(l.id));
          return { exportedLeads: [...newLeads, ...state.exportedLeads] };
        }),
      removeLeads: (ids) =>
        set((state) => ({
          exportedLeads: state.exportedLeads.filter((l) => !ids.includes(l.id)),
        })),
      clearAll: () => set({ exportedLeads: [] }),
    }),
    { name: 'call-exports-storage' }
  )
);
