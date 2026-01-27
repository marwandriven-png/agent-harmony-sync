import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Edit3, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableRow, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { PropertyExpandedDetails } from './PropertyExpandedDetails';
import { EditPropertyDialog } from '@/components/forms/EditPropertyDialog';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyStatus = Database['public']['Enums']['property_status'];

const statusConfig: Record<PropertyStatus, { label: string; className: string }> = {
  available: { 
    label: 'available', 
    className: 'bg-success text-white border-success' 
  },
  under_offer: { 
    label: 'under offer', 
    className: 'bg-warning text-white border-warning' 
  },
  sold: { 
    label: 'sold', 
    className: 'bg-muted-foreground text-white border-muted-foreground' 
  },
  rented: { 
    label: 'rented', 
    className: 'bg-primary text-white border-primary' 
  },
};

interface PropertyTableRowProps {
  property: PropertyRow;
}

export function PropertyTableRow({ property }: PropertyTableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const status = statusConfig[property.status];
  
  const getDisplayName = () => {
    return property.building_name || 
      (property.title && !property.title.startsWith('Property 1K') ? property.title : null) ||
      property.location || 
      'Unnamed Property';
  };

  const displayName = getDisplayName();
  const truncatedName = displayName.length > 20 ? `${displayName.slice(0, 20)}...` : displayName;

  return (
    <>
      <TableRow 
        className={cn(
          "hover:bg-muted/30 cursor-pointer transition-colors group",
          isExpanded && "bg-muted/20"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Building */}
        <TableCell className="font-medium">
          <div>
            <p className="font-semibold text-foreground">{truncatedName}</p>
            {property.unit_number && (
              <p className="text-xs text-muted-foreground">Unit {property.unit_number}</p>
            )}
          </div>
        </TableCell>

        {/* Owner */}
        <TableCell>
          <span className={cn(
            property.owner_name ? "text-foreground" : "text-muted-foreground italic"
          )}>
            {property.owner_name || 'No owner'}
          </span>
          {property.party_type && (
            <p className="text-xs text-muted-foreground capitalize">{property.party_type}</p>
          )}
        </TableCell>

        {/* Mobile */}
        <TableCell>
          {property.owner_mobile ? (
            <a 
              href={`tel:${property.owner_mobile}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline flex items-center gap-1"
            >
              {property.owner_mobile}
            </a>
          ) : (
            <span className="text-muted-foreground italic">No phone</span>
          )}
        </TableCell>

        {/* Size */}
        <TableCell className="text-center">
          {property.size ? (
            <span className="text-foreground">{property.size}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>

        {/* Type */}
        <TableCell className="capitalize">
          {property.type}
        </TableCell>

        {/* Status */}
        <TableCell>
          <Badge className={cn("text-xs font-medium border-0", status.className)}>
            {status.label}
          </Badge>
        </TableCell>

        {/* Matches */}
        <TableCell className="text-center">
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            {property.matches || 0}
          </Badge>
        </TableCell>

        {/* Actions */}
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                setEditDialogOpen(true);
              }}
            >
              <Edit3 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              <ChevronRight className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )} />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={8} className="p-0 border-0">
              <PropertyExpandedDetails property={property} />
            </td>
          </tr>
        )}
      </AnimatePresence>

      {/* Edit Dialog */}
      <EditPropertyDialog
        property={property}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}
