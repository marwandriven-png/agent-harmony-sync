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

type PropertyStatus = Database['public']['Enums']['property_status'];
type PropertyType = Database['public']['Enums']['property_type'];

interface PropertyTableFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: PropertyStatus | 'all';
  onStatusChange: (status: PropertyStatus | 'all') => void;
  filterType: PropertyType | 'all';
  onTypeChange: (type: PropertyType | 'all') => void;
}

export function PropertyTableFilters({
  searchQuery,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterType,
  onTypeChange,
}: PropertyTableFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by building, owner..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-card border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
        />
      </div>

      {/* Type Filter */}
      <Select value={filterType} onValueChange={(v) => onTypeChange(v as any)}>
        <SelectTrigger className="w-[140px] bg-card border-border">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {Constants.public.Enums.property_type.map((type) => (
            <SelectItem key={type} value={type} className="capitalize">
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={filterStatus} onValueChange={(v) => onStatusChange(v as any)}>
        <SelectTrigger className="w-[140px] bg-card border-border">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {Constants.public.Enums.property_status.map((status) => (
            <SelectItem key={status} value={status} className="capitalize">
              {status.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
