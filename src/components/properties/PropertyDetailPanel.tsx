import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, MapPin, Bed, Bath, Maximize, Phone, Mail, User, 
  Eye, Send, FileText, Edit3, Trash2, X, Calendar, 
  TrendingUp, Clock, ChevronRight, MoreHorizontal, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { useUpdateProperty, useDeleteProperty } from '@/hooks/useProperties';
import { EditPropertyDialog } from '@/components/forms/EditPropertyDialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyStatus = Database['public']['Enums']['property_status'];

const statusConfig: Record<PropertyStatus, { label: string; className: string; bgClass: string }> = {
  available: { 
    label: 'Available', 
    className: 'bg-success/20 text-success border-success/30',
    bgClass: 'bg-success'
  },
  under_offer: { 
    label: 'Under Offer', 
    className: 'bg-warning/20 text-warning border-warning/30',
    bgClass: 'bg-warning'
  },
  sold: { 
    label: 'Sold', 
    className: 'bg-muted text-muted-foreground border-border',
    bgClass: 'bg-muted-foreground'
  },
  rented: { 
    label: 'Rented', 
    className: 'bg-primary/20 text-primary border-primary/30',
    bgClass: 'bg-primary'
  },
};

interface PropertyDetailPanelProps {
  property: PropertyRow;
  onClose: () => void;
}

export function PropertyDetailPanel({ property, onClose }: PropertyDetailPanelProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteProperty = useDeleteProperty();
  const updateProperty = useUpdateProperty();

  const status = statusConfig[property.status];
  
  const getDisplayName = () => {
    return property.building_name || 
      (property.title && !property.title.startsWith('Property 1K') ? property.title : null) ||
      property.location || 
      'Unnamed Property';
  };

  const handleStatusChange = async (newStatus: PropertyStatus) => {
    await updateProperty.mutateAsync({ id: property.id, status: newStatus });
  };

  const handleDelete = async () => {
    await deleteProperty.mutateAsync(property.id);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Property Image */}
            <div className="w-20 h-20 rounded-xl bg-muted/70 flex items-center justify-center overflow-hidden flex-shrink-0">
              {property.images?.[0] ? (
                <img 
                  src={property.images[0]} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-8 h-8 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-2">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {getDisplayName()}
                </h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {property.location}
                  {property.master_project && ` • ${property.master_project}`}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("border", status.className)}>
                  {status.label}
                </Badge>
                {property.regis && (
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {property.regis}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Property
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Star className="w-4 h-4 mr-2" />
                  Mark as Featured
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Property
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          {/* Price Card */}
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Price</p>
                <p className="text-2xl font-bold text-accent number-display mt-1">
                  {formatCurrency(property.price, property.currency || 'AED')}
                </p>
                {property.procedure_value && property.procedure_value !== property.price && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Procedure: {formatCurrency(property.procedure_value, property.currency || 'AED')}
                  </p>
                )}
              </div>
              <div className="p-3 bg-accent/20 rounded-xl">
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
            </div>
          </div>

          {/* Property Details Grid */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Property Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <DetailItem icon={Bed} label="Bedrooms" value={`${property.bedrooms}`} />
              <DetailItem icon={Bath} label="Bathrooms" value={`${property.bathrooms}`} />
              <DetailItem icon={Maximize} label="Size" value={`${property.size} ${property.size_unit || 'sqft'}`} />
              <DetailItem icon={Building2} label="Type" value={property.type} />
              {property.unit_number && (
                <DetailItem icon={Building2} label="Unit" value={property.unit_number} />
              )}
            </div>
          </div>

          <Separator />

          {/* Owner Details */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Owner Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {property.owner_name || 'No owner assigned'}
                  </p>
                  <p className="text-sm text-muted-foreground">Property Owner</p>
                </div>
              </div>
              
              {property.owner_mobile && (
                <a 
                  href={`tel:${property.owner_mobile}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {property.owner_mobile}
                </a>
              )}
            </div>
          </div>

          <Separator />

          {/* Status Change */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Update Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(statusConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleStatusChange(key as PropertyStatus)}
                  disabled={property.status === key || updateProperty.isPending}
                  className={cn(
                    "p-3 rounded-lg text-sm font-medium transition-all",
                    "border border-border hover:border-accent/50",
                    property.status === key 
                      ? "bg-accent/10 border-accent text-accent"
                      : "hover:bg-muted/50"
                  )}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2">
              <Eye className="w-4 h-4" />
              View Details
            </Button>
            <Button variant="outline" className="gap-2">
              <Send className="w-4 h-4" />
              Send Report
            </Button>
            <Button variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </Button>
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              Schedule
            </Button>
          </div>

          {/* Description */}
          {property.description && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {property.description}
                </p>
              </div>
            </>
          )}

          {/* Features */}
          {property.features && property.features.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {property.features.map((feature, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <EditPropertyDialog
        property={property}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{getDisplayName()}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// Helper component
function DetailItem({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-semibold text-foreground capitalize">{value}</p>
    </div>
  );
}
