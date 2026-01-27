import React, { useState, useMemo } from 'react';
import { useProperties, usePropertyMetrics } from '@/hooks/useProperties';
import { PropertyTable } from './PropertyTable';
import { PropertyTableFilters } from './PropertyTableFilters';
import { CreatePropertyDialog } from '@/components/forms/CreatePropertyDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, RefreshCw, Building2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyStatus = Database['public']['Enums']['property_status'];
type PropertyType = Database['public']['Enums']['property_type'];

export function PropertyDashboard() {
  const { data: properties = [], isLoading, refetch } = useProperties();
  const metrics = usePropertyMetrics();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<PropertyStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<PropertyType | 'all'>('all');

  // Filtered properties
  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        property.title?.toLowerCase().includes(searchLower) ||
        property.building_name?.toLowerCase().includes(searchLower) ||
        property.owner_name?.toLowerCase().includes(searchLower) ||
        property.location?.toLowerCase().includes(searchLower) ||
        property.regis?.toLowerCase().includes(searchLower);

      const matchesStatus = filterStatus === 'all' || property.status === filterStatus;
      const matchesType = filterType === 'all' || property.type === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [properties, searchQuery, filterStatus, filterType]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-background p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="flex-1 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="px-6 py-5 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-accent/10 rounded-xl">
              <Building2 className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Properties</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Manage {metrics.totalProperties} property listings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Sync
            </Button>
            <CreatePropertyDialog
              trigger={
                <Button size="sm" className="gap-2 bg-accent text-white hover:bg-accent/90">
                  <Plus className="w-4 h-4" />
                  Add Property
                </Button>
              }
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Filters */}
          <PropertyTableFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterStatus={filterStatus}
            onStatusChange={setFilterStatus}
            filterType={filterType}
            onTypeChange={setFilterType}
          />

          {/* Table */}
          <PropertyTable properties={filteredProperties} />
        </div>
      </ScrollArea>
    </div>
  );
}
