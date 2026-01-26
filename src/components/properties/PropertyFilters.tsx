import React from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Constants } from '@/integrations/supabase/types';
import type { Database } from '@/integrations/supabase/types';

type PropertyStatus = Database['public']['Enums']['property_status'];
type PropertyType = Database['public']['Enums']['property_type'];

interface PropertyFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterStatus: PropertyStatus | 'all';
  onStatusChange: (status: PropertyStatus | 'all') => void;
  filterType: PropertyType | 'all';
  onTypeChange: (type: PropertyType | 'all') => void;
  activeTab: 'all' | 'available' | 'under_offer' | 'sold';
  onTabChange: (tab: 'all' | 'available' | 'under_offer' | 'sold') => void;
  tabCounts: Record<string, number>;
}

export function PropertyFilters({
  searchQuery,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterType,
  onTypeChange,
  activeTab,
  onTabChange,
  tabCounts,
}: PropertyFiltersProps) {
  const tabs = [
    { key: 'all', label: 'All Properties', count: tabCounts.all },
    { key: 'available', label: 'Available', count: tabCounts.available },
    { key: 'under_offer', label: 'Under Offer', count: tabCounts.under_offer },
    { key: 'sold', label: 'Sold/Rented', count: tabCounts.sold },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search properties, owners, locations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-muted/50 border-border/50 focus:bg-background transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={(v) => onTypeChange(v as any)}>
            <SelectTrigger className="w-[140px] bg-muted/50 border-border/50">
              <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Type" />
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

          <Button variant="outline" size="icon" className="bg-muted/50 border-border/50">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
              activeTab === tab.key
                ? "text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {activeTab === tab.key && (
              <motion.div
                layoutId="activePropertyTab"
                className="absolute inset-0 bg-accent rounded-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.label}
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-md",
                activeTab === tab.key 
                  ? "bg-accent-foreground/20" 
                  : "bg-muted"
              )}>
                {tab.count}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
