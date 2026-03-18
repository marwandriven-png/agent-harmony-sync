import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Constants } from '@/integrations/supabase/types';
import type { Database } from '@/integrations/supabase/types';
import type { PropertySection } from './PropertySectionTabs';

type PropertyStatus = Database['public']['Enums']['property_status'];

interface PropertySectionFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: PropertyStatus | 'all';
  onStatusChange: (status: PropertyStatus | 'all') => void;
  section: PropertySection;
}

// Database has different statuses
const databaseStatuses = [
  { value: 'not_answering', label: 'Not Answering' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'interested', label: 'Interested' },
];

export function PropertySectionFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  section,
}: PropertySectionFiltersProps) {
  const isDatabase = section === 'database';

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by building, owner, location..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-card border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
        />
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as any)}>
        <SelectTrigger className="w-[160px] bg-card border-border">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {isDatabase ? (
            databaseStatuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))
          ) : (
            Constants.public.Enums.property_status.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {status.replace('_', ' ')}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
