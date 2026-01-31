import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, MapPin, Building, Phone, User,
  Bed, Bath, Maximize, Home, Key, Edit3, Trash2, ArrowRight,
  MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { EditPropertyDialog } from '@/components/forms/EditPropertyDialog';
import { PropertyNotesPanel } from './PropertyNotesPanel';
import { PropertyMatchedLeadsDialog } from './PropertyMatchedLeadsDialog';
import { useUpdateProperty } from '@/hooks/useProperties';
import type { Database } from '@/integrations/supabase/types';
import type { PropertySection } from './PropertySectionTabs';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyStatus = Database['public']['Enums']['property_status'];

interface PropertyTableRowProps {
  property: PropertyRow;
  section: PropertySection;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onConvert?: (property: PropertyRow) => void;
  onDelete?: (property: PropertyRow) => void;
}

// Status configurations for listings
const listingStatusConfig: Record<PropertyStatus, { label: string; className: string; icon: React.ElementType }> = {
  available: { label: 'Available', className: 'bg-success/20 text-success border-success/30', icon: CheckCircle },
  under_offer: { label: 'Under Offer', className: 'bg-warning/20 text-warning border-warning/30', icon: Clock },
  sold: { label: 'Sold', className: 'bg-muted text-muted-foreground border-border', icon: CheckCircle },
  rented: { label: 'Rented', className: 'bg-primary/20 text-primary border-primary/30', icon: Key },
};

// Status configurations for database
const databaseStatusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  not_answering: { label: 'Not Answering', className: 'bg-muted text-muted-foreground border-border', icon: AlertCircle },
  not_interested: { label: 'Not Interested', className: 'bg-destructive/20 text-destructive border-destructive/30', icon: XCircle },
  interested: { label: 'Interested', className: 'bg-success/20 text-success border-success/30', icon: CheckCircle },
};

export function PropertyTableRow({
  property,
  section,
  isExpanded,
  onToggleExpand,
  onConvert,
  onDelete,
}: PropertyTableRowProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [matchedLeadsOpen, setMatchedLeadsOpen] = useState(false);
  const updateProperty = useUpdateProperty();

  const getDisplayName = () => {
    return property.building_name || 
      (property.title && !property.title.startsWith('Property 1K') ? property.title : null) ||
      property.location || 
      'Unnamed Property';
  };

  const isSale = (property.listing_type || 'for_sale').toLowerCase() === 'for_sale';

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `${(price / 1000).toFixed(0)}K`;
    return price.toString();
  };

  // Get current status config
  const getStatusConfig = () => {
    if (section === 'database') {
      const dbStatus = property.database_status || 'interested';
      return databaseStatusConfig[dbStatus] || databaseStatusConfig.interested;
    }
    return listingStatusConfig[property.status];
  };

  // Handle status change
  const handleStatusChange = async (newStatus: PropertyStatus | string) => {
    if (section === 'database') {
      await updateProperty.mutateAsync({
        id: property.id,
        database_status: newStatus,
      });
    } else {
      await updateProperty.mutateAsync({
        id: property.id,
        status: newStatus as PropertyStatus,
      });
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Available statuses for dropdown
  const availableStatuses = section === 'database'
    ? ['not_answering', 'not_interested', 'interested']
    : ['available', 'under_offer', 'sold', 'rented'] as PropertyStatus[];

  return (
    <>
      {/* Main Row */}
      <tr
        className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Expand Icon & Property Name */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              isSale ? "bg-accent/10" : "bg-primary/10"
            )}>
              {isSale ? (
                <Home className="w-4 h-4 text-accent" />
              ) : (
                <Key className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <span className="font-medium text-foreground truncate block">{getDisplayName()}</span>
              {property.regis && (
                <span className="text-xs text-muted-foreground font-mono">{property.regis}</span>
              )}
            </div>
          </div>
        </td>

        {/* Location */}
        <td className="py-3 px-4 hidden md:table-cell">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground truncate max-w-[150px]">
              {property.location || '-'}
            </span>
          </div>
        </td>

        {/* Specs */}
        <td className="py-3 px-4 hidden lg:table-cell">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {property.bedrooms > 0 && (
              <span className="flex items-center gap-1">
                <Bed className="w-3 h-3" />
                {property.bedrooms}
              </span>
            )}
            {property.bathrooms > 0 && (
              <span className="flex items-center gap-1">
                <Bath className="w-3 h-3" />
                {property.bathrooms}
              </span>
            )}
            {property.size > 0 && (
              <span className="flex items-center gap-1">
                <Maximize className="w-3 h-3" />
                {property.size}
              </span>
            )}
          </div>
        </td>

        {/* Matches */}
        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMatchedLeadsOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[hsl(82,84%,50%)]/10 transition-colors group"
            title="View matched leads"
          >
            <Users className="w-4 h-4 text-[hsl(82,84%,50%)] group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-foreground">{property.matches || 0}</span>
          </button>
        </td>

        {/* Price */}
        <td className="py-3 px-4">
          <div className="text-right">
            <span className="font-bold text-foreground">
              {property.currency || 'AED'} {formatPrice(property.price)}
            </span>
            {!isSale && <span className="text-xs text-muted-foreground block">/year</span>}
          </div>
        </td>

        {/* Status - Clickable Dropdown */}
        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "gap-1 cursor-pointer hover:opacity-80 transition-opacity",
                    statusConfig.className
                  )}
                >
                  <StatusIcon className="w-3 h-3" />
                  {statusConfig.label}
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availableStatuses.map((status) => {
                const config = section === 'database' 
                  ? databaseStatusConfig[status]
                  : listingStatusConfig[status as PropertyStatus];
                const Icon = config.icon;
                const currentStatus = section === 'database' 
                  ? property.database_status 
                  : property.status;
                
                return (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={currentStatus === status || updateProperty.isPending}
                    className={cn(currentStatus === status && "bg-muted")}
                  >
                    <Icon className={cn("w-4 h-4 mr-2")} />
                    {config.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>

        {/* Actions */}
        <td className="py-3 px-4">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditDialogOpen(true)}
              title="Edit"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            {section === 'database' && property.database_status === 'interested' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-success hover:text-success"
                onClick={() => onConvert?.(property)}
                title="Convert to Listing"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete?.(property)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Expanded Details Row */}
      <AnimatePresence>
        {isExpanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <td colSpan={7} className="bg-muted/20 px-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Property Details */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    Property Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="text-foreground capitalize">{property.type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Size:</span>
                      <span className="text-foreground">{property.size} {property.size_unit || 'sqft'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Bedrooms:</span>
                      <span className="text-foreground">{property.bedrooms}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Bathrooms:</span>
                      <span className="text-foreground">{property.bathrooms}</span>
                    </div>
                    {property.unit_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Unit #:</span>
                        <span className="text-foreground">{property.unit_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Owner Info */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Owner Info
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="text-foreground">{property.owner_name || 'N/A'}</span>
                    </div>
                    {property.owner_mobile && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <a href={`tel:${property.owner_mobile}`} className="text-primary hover:underline">
                          {property.owner_mobile}
                        </a>
                      </div>
                    )}
                    {property.country && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Country:</span>
                        <span className="text-foreground">{property.country}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-3">
                  <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    Notes
                  </h4>
                  <PropertyNotesPanel propertyId={property.id} compact />
                </div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>

      {/* Edit Dialog */}
      <EditPropertyDialog
        property={property}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Matched Leads Dialog */}
      <PropertyMatchedLeadsDialog
        property={property}
        open={matchedLeadsOpen}
        onOpenChange={setMatchedLeadsOpen}
      />
    </>
  );
}
