import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Home, Key } from 'lucide-react';
import { PropertyTableRow } from './PropertyTableRow';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import type { PropertySection } from './PropertySectionTabs';

type PropertyRow = Database['public']['Tables']['properties']['Row'];

interface PropertySectionListProps {
  section: PropertySection;
  properties: PropertyRow[];
  isLoading: boolean;
  listingTypeFilter: 'all' | 'for_sale' | 'for_rent';
  onListingTypeChange: (type: 'all' | 'for_sale' | 'for_rent') => void;
  onConvert?: (property: PropertyRow) => void;
  onDelete?: (property: PropertyRow) => void;
}

export function PropertySectionList({
  section,
  properties,
  isLoading,
  listingTypeFilter,
  onListingTypeChange,
  onConvert,
  onDelete,
}: PropertySectionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter by listing type (for pocket & active)
  const filteredProperties = properties.filter(p => {
    if (section === 'database') return true; // No sub-filter for database
    if (listingTypeFilter === 'all') return true;
    const pType = (p.listing_type || 'for_sale').toLowerCase();
    return pType === listingTypeFilter;
  });

  const toggleExpand = (propertyId: string) => {
    setExpandedId(expandedId === propertyId ? null : propertyId);
  };

  const getSectionConfig = () => {
    switch (section) {
      case 'pocket_listing':
        return {
          title: 'Pocket Listings',
          description: 'Off-market, exclusive properties',
          icon: Building2,
          emptyText: 'No pocket listings yet',
          emptySubtext: 'Convert interested database properties to pocket listings',
        };
      case 'active_listing':
        return {
          title: 'Active Listings',
          description: 'Published and live on portals',
          icon: Building2,
          emptyText: 'No active listings yet',
          emptySubtext: 'Convert properties to active listings to publish them',
        };
      case 'database':
        return {
          title: 'Database',
          description: 'Sourcing and qualification pipeline',
          icon: Building2,
          emptyText: 'No properties in database',
          emptySubtext: 'Add properties to start sourcing',
        };
    }
  };

  const config = getSectionConfig();
  const showTypeFilter = section !== 'database';

  // Count by type
  const saleCount = properties.filter(p => (p.listing_type || 'for_sale').toLowerCase() === 'for_sale').length;
  const rentCount = properties.filter(p => (p.listing_type || 'for_sale').toLowerCase() === 'for_rent').length;

  return (
    <div className="space-y-4">
      {/* Sub-header with type filter */}
      {showTypeFilter && (
        <div className="flex items-center justify-between">
          <Tabs value={listingTypeFilter} onValueChange={(v) => onListingTypeChange(v as any)}>
            <TabsList className="h-9 bg-muted/50">
              <TabsTrigger value="all" className="text-xs px-3 data-[state=active]:bg-card">
                All ({properties.length})
              </TabsTrigger>
              <TabsTrigger value="for_sale" className="text-xs px-3 data-[state=active]:bg-card">
                <Home className="w-3.5 h-3.5 mr-1.5 text-accent" />
                For Sale ({saleCount})
              </TabsTrigger>
              <TabsTrigger value="for_rent" className="text-xs px-3 data-[state=active]:bg-card">
                <Key className="w-3.5 h-3.5 mr-1.5 text-primary" />
                For Rent ({rentCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Database status info */}
      {section === 'database' && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {properties.filter(p => p.database_status === 'interested').length} interested
          </span>
          <span className="text-muted-foreground">
            {properties.filter(p => p.database_status === 'not_answering').length} not answering
          </span>
          <span className="text-muted-foreground">
            {properties.filter(p => p.database_status === 'not_interested').length} not interested
          </span>
        </div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl shadow-card overflow-hidden"
      >
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <config.icon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">{config.emptyText}</p>
            <p className="text-sm text-muted-foreground mt-1">{config.emptySubtext}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Property</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm hidden md:table-cell">Location</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm hidden lg:table-cell">Specs</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Matches</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filteredProperties.map((property) => (
                    <PropertyTableRow
                      key={property.id}
                      property={property}
                      section={section}
                      isExpanded={expandedId === property.id}
                      onToggleExpand={() => toggleExpand(property.id)}
                      onConvert={onConvert}
                      onDelete={onDelete}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
