import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Home, Key, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type PropertyRow = Database['public']['Tables']['properties']['Row'];

interface ConvertPropertyDialogProps {
  property: PropertyRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TargetSection = 'pocket_listing' | 'active_listing';
type ListingType = 'for_sale' | 'for_rent';

export function ConvertPropertyDialog({ property, open, onOpenChange }: ConvertPropertyDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [targetSection, setTargetSection] = useState<TargetSection>('pocket_listing');
  const [listingType, setListingType] = useState<ListingType>('for_sale');
  const [price, setPrice] = useState(property?.price?.toString() || '');

  // Reset form when dialog opens with new property
  React.useEffect(() => {
    if (property && open) {
      setPrice(property.price?.toString() || '');
      setTargetSection('pocket_listing');
      setListingType('for_sale');
    }
  }, [property, open]);

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!property) throw new Error('No property selected');

      const updates = {
        section: targetSection,
        listing_type: listingType,
        price: parseFloat(price) || 0,
        status: 'available' as const,
        listing_state: 'active',
      };

      const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', property.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Property not found or you do not have permission to update it');

      // Log activity
      await supabase.from('activity_logs').insert({
        table_name: 'properties',
        record_id: property.id,
        action: 'CONVERT_TO_LISTING',
        old_values: { section: 'database', database_status: property.database_status },
        new_values: updates,
        user_id: user?.id,
        source: 'conversion_dialog',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`Property converted to ${targetSection === 'pocket_listing' ? 'Pocket' : 'Active'} Listing`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to convert: ${error.message}`);
    },
  });

  if (!property) return null;

  const displayName = property.building_name || property.title || property.location || 'Unnamed Property';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-accent" />
            Convert to Listing
          </DialogTitle>
          <DialogDescription>
            Convert <span className="font-medium text-foreground">{displayName}</span> from Database to a live listing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Target Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Listing Type</Label>
            <RadioGroup
              value={targetSection}
              onValueChange={(v) => setTargetSection(v as TargetSection)}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="pocket_listing"
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all",
                  targetSection === 'pocket_listing'
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/50"
                )}
              >
                <RadioGroupItem value="pocket_listing" id="pocket_listing" className="sr-only" />
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Home className="w-5 h-5 text-accent" />
                </div>
                <span className="font-medium text-sm">Pocket Listing</span>
                <span className="text-xs text-muted-foreground text-center">Off-market, exclusive</span>
              </Label>

              <Label
                htmlFor="active_listing"
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all",
                  targetSection === 'active_listing'
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="active_listing" id="active_listing" className="sr-only" />
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Home className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-sm">Active Listing</span>
                <span className="text-xs text-muted-foreground text-center">Published, live</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Sale or Rent */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">For Sale or Rent?</Label>
            <RadioGroup
              value={listingType}
              onValueChange={(v) => setListingType(v as ListingType)}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="for_sale"
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                  listingType === 'for_sale'
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border hover:border-accent/50"
                )}
              >
                <RadioGroupItem value="for_sale" id="for_sale" className="sr-only" />
                <Home className="w-4 h-4" />
                <span className="font-medium">For Sale</span>
              </Label>

              <Label
                htmlFor="for_rent"
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                  listingType === 'for_rent'
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value="for_rent" id="for_rent" className="sr-only" />
                <Key className="w-4 h-4" />
                <span className="font-medium">For Rent</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price" className="text-sm font-medium">
              {listingType === 'for_sale' ? 'Sale Price' : 'Annual Rent'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                {property.currency || 'AED'}
              </span>
              <Input
                id="price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="pl-14"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending || !price}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {convertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
