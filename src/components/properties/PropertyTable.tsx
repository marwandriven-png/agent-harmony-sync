import React from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PropertyTableRow } from './PropertyTableRow';
import { Building2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];

interface PropertyTableProps {
  properties: PropertyRow[];
}

export function PropertyTable({ properties }: PropertyTableProps) {
  if (properties.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Building2 className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="font-medium text-foreground">No properties found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try adjusting your filters
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-sidebar hover:bg-sidebar border-b border-border">
            <TableHead className="text-white font-semibold uppercase text-xs tracking-wide">
              Building
            </TableHead>
            <TableHead className="text-white font-semibold uppercase text-xs tracking-wide">
              Owner
            </TableHead>
            <TableHead className="text-white font-semibold uppercase text-xs tracking-wide">
              Mobile
            </TableHead>
            <TableHead className="text-white font-semibold uppercase text-xs tracking-wide text-center">
              Size
            </TableHead>
            <TableHead className="text-white font-semibold uppercase text-xs tracking-wide">
              Type
            </TableHead>
            <TableHead className="text-white font-semibold uppercase text-xs tracking-wide">
              Status
            </TableHead>
            <TableHead className="text-white font-semibold uppercase text-xs tracking-wide text-center">
              Matches
            </TableHead>
            <TableHead className="text-white font-semibold uppercase text-xs tracking-wide">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((property) => (
            <PropertyTableRow key={property.id} property={property} />
          ))}
        </TableBody>
      </Table>
      
      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground">
          Showing {properties.length} of {properties.length} properties • Swipe right or click arrow for quick actions
        </p>
      </div>
    </div>
  );
}
