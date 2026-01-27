import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProperties, usePropertyMetrics } from '@/hooks/useProperties';
import { PropertyListPanel } from './PropertyListPanel';
import { PropertyDetailPanel } from './PropertyDetailPanel';
import { PropertyMetricsRow } from './PropertyMetricsRow';
import { PropertyFilters } from './PropertyFilters';
import { CreatePropertyDialog } from '@/components/forms/CreatePropertyDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, RefreshCw, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyStatus = Database['public']['Enums']['property_status'];
type PropertyType = Database['public']['Enums']['property_type'];

export function PropertyDashboard() {
  const { data: properties = [], isLoading, refetch } = useProperties();
  const metrics = usePropertyMetrics();
  
  // Selection & filters
  const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<PropertyStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<PropertyType | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'under_offer' | 'sold'>('all');

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
      const matchesTab = activeTab === 'all' || property.status === activeTab;

      return matchesSearch && matchesStatus && matchesType && matchesTab;
    });
  }, [properties, searchQuery, filterStatus, filterType, activeTab]);

  // Tab counts
  const tabCounts = useMemo(() => ({
    all: properties.length,
    available: properties.filter(p => p.status === 'available').length,
    under_offer: properties.filter(p => p.status === 'under_offer').length,
    sold: properties.filter(p => p.status === 'sold' || p.status === 'rented').length,
  }), [properties]);

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
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="flex-1 grid grid-cols-3 gap-6">
          <Skeleton className="col-span-1 rounded-2xl" />
          <Skeleton className="col-span-2 rounded-2xl" />
        </div>
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
      <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-5">
        {/* Metrics Row */}
        <PropertyMetricsRow metrics={metrics} />

        {/* Filters & Tabs */}
        <PropertyFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterStatus={filterStatus}
          onStatusChange={setFilterStatus}
          filterType={filterType}
          onTypeChange={setFilterType}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabCounts={tabCounts}
        />

        {/* Main Content - List + Detail */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-5 min-h-0 overflow-hidden">
          {/* Property List Panel */}
          <div className={cn(
            "lg:col-span-2 overflow-hidden rounded-2xl border border-border bg-card",
            selectedProperty && "hidden lg:block"
          )}>
            <PropertyListPanel
              properties={filteredProperties}
              selectedProperty={selectedProperty}
              onSelectProperty={setSelectedProperty}
            />
          </div>

          {/* Property Detail Panel */}
          <div className={cn(
            "lg:col-span-3 overflow-hidden rounded-2xl border border-border bg-card",
            !selectedProperty && "hidden lg:flex lg:items-center lg:justify-center"
          )}>
            <AnimatePresence mode="wait">
              {selectedProperty ? (
                <PropertyDetailPanel
                  key={selectedProperty.id}
                  property={selectedProperty}
                  onClose={() => setSelectedProperty(null)}
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center p-12"
                >
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">Select a property to view details</p>
                  <p className="text-muted-foreground/60 text-sm mt-1">
                    Click on any property from the list
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
