import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateProperty } from '@/hooks/useProperties';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';

// Schema matches Google Sheets columns exactly
const propertySchema = z.object({
  // Regis - auto-generated, not in form
  procedure_value: z.coerce.number().min(0, 'Value must be positive').optional(),
  master_project: z.string().max(200).optional(),
  building_name: z.string().trim().min(1, 'Building name is required').max(200),
  size: z.coerce.number().min(0),
  unit_number: z.string().max(50).optional(),
  type: z.enum(Constants.public.Enums.property_type as unknown as [string, ...string[]]),
  party_type: z.string().max(100).optional(),
  owner_name: z.string().max(200).optional(),
  owner_mobile: z.string().max(20).optional(),
  procedure_name: z.string().max(200).optional(),
  country: z.string().default('UAE'),
  status: z.enum(Constants.public.Enums.property_status as unknown as [string, ...string[]]),
  // Additional CRM fields
  location: z.string().trim().min(1, 'Location is required').max(200),
  bedrooms: z.coerce.number().min(0).max(20),
  bathrooms: z.coerce.number().min(0).max(20),
  currency: z.string().default('AED'),
  size_unit: z.string().default('sqft'),
  description: z.string().max(2000).optional(),
  features: z.string().optional(),
});

type PropertyFormData = z.infer<typeof propertySchema>;

interface CreatePropertyDialogProps {
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreatePropertyDialog({ trigger, open: controlledOpen, onOpenChange }: CreatePropertyDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  
  const createProperty = useCreateProperty();

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      procedure_value: 0,
      master_project: '',
      building_name: '',
      size: 0,
      unit_number: '',
      type: 'apartment',
      party_type: '',
      owner_name: '',
      owner_mobile: '',
      procedure_name: '',
      country: 'UAE',
      status: 'available',
      location: '',
      bedrooms: 1,
      bathrooms: 1,
      currency: 'AED',
      size_unit: 'sqft',
      description: '',
      features: '',
    },
  });

  const onSubmit = async (data: PropertyFormData) => {
    const featuresArray = data.features
      ? data.features.split(',').map(f => f.trim()).filter(Boolean)
      : [];

    await createProperty.mutateAsync({
      // Title derived from building name for display
      title: data.building_name,
      type: data.type as any,
      status: data.status as any,
      price: data.procedure_value || 0,
      currency: data.currency,
      location: data.location,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      size: data.size,
      size_unit: data.size_unit,
      description: data.description || null,
      features: featuresArray,
      images: [],
      // New Google Sheets aligned fields
      procedure_value: data.procedure_value || null,
      master_project: data.master_project || null,
      building_name: data.building_name,
      unit_number: data.unit_number || null,
      party_type: data.party_type || null,
      owner_name: data.owner_name || null,
      owner_mobile: data.owner_mobile || null,
      procedure_name: data.procedure_name || null,
      country: data.country,
    });
    
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Property Listing</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Google Sheets Aligned Fields */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Property Details (Synced with Sheets)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="building_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BuildingNameEn *</FormLabel>
                      <FormControl>
                        <Input placeholder="Park Heights Tower 1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="procedure_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ProcedureValue</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1500000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1200" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UnitNumber</FormLabel>
                      <FormControl>
                        <Input placeholder="1205" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PropertyTypeEn *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Constants.public.Enums.property_type.map((type) => (
                            <SelectItem key={type} value={type} className="capitalize">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Constants.public.Enums.property_status.map((status) => (
                            <SelectItem key={status} value={status} className="capitalize">
                              {status.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CountryNameEn</FormLabel>
                      <FormControl>
                        <Input placeholder="UAE" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Owner Information */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Owner Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="owner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NameEn</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="owner_mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile</FormLabel>
                      <FormControl>
                        <Input placeholder="+971501234567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="procedure_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ProcedureNameEn</FormLabel>
                    <FormControl>
                      <Input placeholder="Sale / Rent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location Details */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Location Details</h3>
              
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location *</FormLabel>
                    <FormControl>
                      <Input placeholder="Dubai Marina, Dubai" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Additional Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Additional Details</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="bedrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedrooms</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={20} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bathrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bathrooms</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={20} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="size_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size Unit</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sqft">sqft</SelectItem>
                          <SelectItem value="sqm">sqm</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the property..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="features"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Features (comma-separated)</FormLabel>
                    <FormControl>
                      <Input placeholder="Pool, Gym, Parking, Sea View" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProperty.isPending} className="bg-gradient-primary">
                {createProperty.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Property
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
