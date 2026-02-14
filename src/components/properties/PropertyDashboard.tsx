import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProperties, usePropertyMetrics, useDeleteProperty } from '@/hooks/useProperties';
import { PropertySectionTabs, type PropertySection } from './PropertySectionTabs';
import { PropertySectionList } from './PropertySectionList';
import { PropertySectionFilters } from './PropertySectionFilters';
import { ConvertPropertyDialog } from './ConvertPropertyDialog';
import { CreatePropertyDialog } from '@/components/forms/CreatePropertyDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, RefreshCw, Building2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyStatus = Database['public']['Enums']['property_status'];

export function PropertyDashboard() {
  const { data: properties = [], isLoading, refetch } = useProperties();
  const deleteProperty = useDeleteProperty();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Section & filter state
  const [activeSection, setActiveSection] = useState<PropertySection>('pocket_listing');
  const [listingTypeFilter, setListingTypeFilter] = useState<'all' | 'for_sale' | 'for_rent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | 'all'>('all');

  // Dialog state
  const [convertProperty, setConvertProperty] = useState<PropertyRow | null>(null);
  const [deleteConfirmProperty, setDeleteConfirmProperty] = useState<PropertyRow | null>(null);

  // Auto-open convert dialog from URL param (e.g. from Cold Calls export)
  useEffect(() => {
    const convertId = searchParams.get('convert');
    if (convertId && properties.length > 0) {
      const prop = properties.find(p => p.id === convertId);
      if (prop) {
        setActiveSection('database');
        setConvertProperty(prop);
        // Clear the param so it doesn't re-trigger
        searchParams.delete('convert');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, properties, setSearchParams]);

  // Filter properties by section
  const sectionedProperties = useMemo(() => {
    const pocket_listing = properties.filter(p => p.section === 'pocket_listing');
    const active_listing = properties.filter(p => p.section === 'active_listing');
    const database = properties.filter(p => p.section === 'database' || !p.section);
    
    return { pocket_listing, active_listing, database };
  }, [properties]);

  // Apply search and status filters
  const filteredSectionProperties = useMemo(() => {
    const sectionProps = sectionedProperties[activeSection];
    
    return sectionProps.filter((property) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        property.title?.toLowerCase().includes(searchLower) ||
        property.building_name?.toLowerCase().includes(searchLower) ||
        property.owner_name?.toLowerCase().includes(searchLower) ||
        property.location?.toLowerCase().includes(searchLower) ||
        property.regis?.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus = statusFilter === 'all' || property.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sectionedProperties, activeSection, searchQuery, statusFilter]);

  // Section counts
  const sectionCounts = {
    pocket_listing: sectionedProperties.pocket_listing.length,
    active_listing: sectionedProperties.active_listing.length,
    database: sectionedProperties.database.length,
  };

  const handleConvert = (property: PropertyRow) => {
    setConvertProperty(property);
  };

  const handleDelete = (property: PropertyRow) => {
    setDeleteConfirmProperty(property);
  };

  const confirmDelete = () => {
    if (deleteConfirmProperty) {
      deleteProperty.mutate(deleteConfirmProperty.id);
      setDeleteConfirmProperty(null);
    }
  };

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
        <Skeleton className="h-14 w-full rounded-xl" />
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
                {properties.length} total properties
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
                <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  <Plus className="w-4 h-4" />
                  Add Property
                </Button>
              }
            />
          </div>
        </div>
      </header>

      {/* Section Tabs */}
      <div className="px-6 py-4 border-b border-border bg-card/50">
        <PropertySectionTabs
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          counts={sectionCounts}
        />
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Filters */}
          <PropertySectionFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            section={activeSection}
          />

          {/* Properties List */}
          <PropertySectionList
            section={activeSection}
            properties={filteredSectionProperties}
            isLoading={isLoading}
            listingTypeFilter={listingTypeFilter}
            onListingTypeChange={setListingTypeFilter}
            onConvert={handleConvert}
            onDelete={handleDelete}
          />
        </div>
      </ScrollArea>

      {/* Convert Dialog */}
      <ConvertPropertyDialog
        property={convertProperty}
        open={!!convertProperty}
        onOpenChange={(open) => !open && setConvertProperty(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmProperty} onOpenChange={(open) => !open && setDeleteConfirmProperty(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmProperty?.building_name || deleteConfirmProperty?.title || 'this property'}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
