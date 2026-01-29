import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, User, Phone, MapPin, Bed, Bath, Maximize, 
  MoreHorizontal, Edit3, MessageSquare, ArrowRight, Trash2,
  Home, Key, Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { EditPropertyDialog } from '@/components/forms/EditPropertyDialog';
import { PropertyNotesPanel } from './PropertyNotesPanel';
import type { Database } from '@/integrations/supabase/types';
import type { PropertySection } from './PropertySectionTabs';

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyStatus = Database['public']['Enums']['property_status'];

interface PropertyListingCardProps {
  property: PropertyRow;
  section: PropertySection;
  onConvert?: (property: PropertyRow) => void;
  onDelete?: (property: PropertyRow) => void;
}

// Status config for different sections
const statusConfig: Record<PropertyStatus, { label: string; className: string }> = {
  available: { label: 'Available', className: 'bg-success/20 text-success border-success/30' },
  under_offer: { label: 'Under Offer', className: 'bg-warning/20 text-warning border-warning/30' },
  sold: { label: 'Sold', className: 'bg-muted text-muted-foreground border-border' },
  rented: { label: 'Rented', className: 'bg-primary/20 text-primary border-primary/30' },
};

// Database-specific status mapping
const databaseStatusConfig: Record<string, { label: string; className: string }> = {
  not_answering: { label: 'Not Answering', className: 'bg-muted text-muted-foreground border-border' },
  not_interested: { label: 'Not Interested', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  interested: { label: 'Interested', className: 'bg-success/20 text-success border-success/30' },
};

export function PropertyListingCard({ property, section, onConvert, onDelete }: PropertyListingCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const getDisplayName = () => {
    return property.building_name || 
      (property.title && !property.title.startsWith('Property 1K') ? property.title : null) ||
      property.location || 
      'Unnamed Property';
  };

  const getListingType = () => {
    return property.listing_type || 'sale';
  };

  const isSale = getListingType().toLowerCase() === 'sale';

  const getStatus = () => {
    if (section === 'database') {
      const dbStatus = property.database_status || 'interested';
      return databaseStatusConfig[dbStatus] || databaseStatusConfig.interested;
    }
    return statusConfig[property.status];
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M`;
    }
    if (price >= 1000) {
      return `${(price / 1000).toFixed(0)}K`;
    }
    return price.toString();
  };

  const status = getStatus();
  const displayName = getDisplayName();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="glass-card p-4 hover:shadow-card-hover transition-all duration-200 group"
      >
        <div className="flex items-start gap-4">
          {/* Property Icon */}
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
            isSale ? "bg-accent/10" : "bg-primary/10"
          )}>
            {isSale ? (
              <Home className={cn("w-6 h-6", "text-accent")} />
            ) : (
              <Key className={cn("w-6 h-6", "text-primary")} />
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground truncate">{displayName}</h3>
                  <Badge variant="outline" className={cn(
                    "text-[10px] uppercase font-bold shrink-0",
                    isSale ? "border-accent text-accent" : "border-primary text-primary"
                  )}>
                    {isSale ? 'Sale' : 'Rent'}
                  </Badge>
                </div>
                {property.regis && (
                  <p className="text-xs text-muted-foreground font-mono">{property.regis}</p>
                )}
              </div>
              
              {/* Price */}
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-foreground">
                  {property.currency || 'AED'} {formatPrice(property.price)}
                </p>
                {!isSale && <p className="text-xs text-muted-foreground">/year</p>}
              </div>
            </div>

            {/* Property Details */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
              {property.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {property.location}
                </span>
              )}
              {property.bedrooms > 0 && (
                <span className="flex items-center gap-1">
                  <Bed className="w-3.5 h-3.5" />
                  {property.bedrooms} BR
                </span>
              )}
              {property.bathrooms > 0 && (
                <span className="flex items-center gap-1">
                  <Bath className="w-3.5 h-3.5" />
                  {property.bathrooms} BA
                </span>
              )}
              {property.size > 0 && (
                <span className="flex items-center gap-1">
                  <Maximize className="w-3.5 h-3.5" />
                  {property.size} {property.size_unit || 'sqft'}
                </span>
              )}
            </div>

            {/* Bottom Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Status Badge */}
                <Badge variant="outline" className={cn("text-xs font-medium", status.className)}>
                  {status.label}
                </Badge>

                {/* Listing State (for Active section) */}
                {section === 'active' && (
                  <Badge variant="outline" className={cn(
                    "text-xs font-medium",
                    property.listing_state === 'paused' 
                      ? "bg-muted text-muted-foreground border-border" 
                      : "bg-primary/10 text-primary border-primary/30"
                  )}>
                    {property.listing_state === 'paused' ? 'Paused' : 'Live'}
                  </Badge>
                )}

                {/* Assigned Agent */}
                {property.assigned_agent_id && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    Agent
                  </span>
                )}

                {/* Owner Info */}
                {property.owner_name && !property.assigned_agent_id && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    {property.owner_name}
                  </span>
                )}

                {/* Last Activity Indicator */}
                {property.last_activity_at && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(property.last_activity_at)}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setNotesOpen(!notesOpen)}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {section === 'database' && property.database_status === 'interested' && (
                      <>
                        <DropdownMenuItem onClick={() => onConvert?.(property)}>
                          <ArrowRight className="w-4 h-4 mr-2" />
                          Convert to Listing
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Property
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setNotesOpen(true)}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      View Notes
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDelete?.(property)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Panel (Expandable) */}
        {notesOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-border"
          >
            <PropertyNotesPanel propertyId={property.id} />
          </motion.div>
        )}
      </motion.div>

      <EditPropertyDialog
        property={property}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}
