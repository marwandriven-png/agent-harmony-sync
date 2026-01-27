import React from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, Bed, Maximize, Phone, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type PropertyStatus = Database['public']['Enums']['property_status'];

const statusConfig: Record<PropertyStatus, { label: string; className: string }> = {
  available: { 
    label: 'Available', 
    className: 'bg-success/20 text-success border-success/30' 
  },
  under_offer: { 
    label: 'Under Offer', 
    className: 'bg-warning/20 text-warning border-warning/30' 
  },
  sold: { 
    label: 'Sold', 
    className: 'bg-muted text-muted-foreground border-border' 
  },
  rented: { 
    label: 'Rented', 
    className: 'bg-primary/20 text-primary border-primary/30' 
  },
};

interface PropertyListPanelProps {
  properties: PropertyRow[];
  selectedProperty: PropertyRow | null;
  onSelectProperty: (property: PropertyRow) => void;
}

export function PropertyListPanel({ 
  properties, 
  selectedProperty, 
  onSelectProperty 
}: PropertyListPanelProps) {
  
  const getDisplayName = (property: PropertyRow) => {
    return property.building_name || 
      (property.title && !property.title.startsWith('Property 1K') ? property.title : null) ||
      property.location || 
      'Unnamed Property';
  };

  if (properties.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
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
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {properties.map((property, index) => {
          const isSelected = selectedProperty?.id === property.id;
          const status = statusConfig[property.status];

          return (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02, duration: 0.2 }}
              onClick={() => onSelectProperty(property)}
              className={cn(
                "p-4 cursor-pointer transition-all duration-200",
                "hover:bg-muted/50",
                isSelected && "bg-accent/5 border-l-2 border-l-accent"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Property Image/Icon */}
                <div className="w-12 h-12 rounded-xl bg-muted/70 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {property.images?.[0] ? (
                    <img 
                      src={property.images[0]} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                {/* Property Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {getDisplayName(property)}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {property.location}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
                      isSelected && "text-accent rotate-90"
                    )} />
                  </div>

                  {/* Details Row */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Bed className="w-3 h-3" />
                      {property.bedrooms}BR
                    </span>
                    <span className="flex items-center gap-1">
                      <Maximize className="w-3 h-3" />
                      {property.size} sqft
                    </span>
                    <span className="capitalize">{property.type}</span>
                  </div>

                  {/* Price & Status Row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground number-display">
                      {formatCurrency(property.price, property.currency || 'AED')}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] border", status.className)}
                    >
                      {status.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
