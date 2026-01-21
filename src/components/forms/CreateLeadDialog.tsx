import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateLead } from '@/hooks/useLeads';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Plus } from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';

const leadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  email: z.string().trim().email('Invalid email').max(255).optional().or(z.literal('')),
  phone: z.string().trim().min(1, 'Phone is required').max(20, 'Phone must be less than 20 characters'),
  source: z.enum(Constants.public.Enums.lead_source as unknown as [string, ...string[]]),
  priority: z.enum(Constants.public.Enums.lead_priority as unknown as [string, ...string[]]),
  budget_min: z.coerce.number().min(0).optional(),
  budget_max: z.coerce.number().min(0).optional(),
  budget_currency: z.string().default('AED'),
  bedrooms: z.coerce.number().min(0).max(20).optional(),
  requirements_notes: z.string().max(1000).optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface CreateLeadDialogProps {
  trigger: React.ReactNode;
}

export function CreateLeadDialog({ trigger }: CreateLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const createLead = useCreateLead();

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      source: 'website',
      priority: 'warm',
      budget_min: undefined,
      budget_max: undefined,
      budget_currency: 'AED',
      bedrooms: undefined,
      requirements_notes: '',
    },
  });

  const addLocation = () => {
    if (locationInput.trim() && !locations.includes(locationInput.trim())) {
      setLocations([...locations, locationInput.trim()]);
      setLocationInput('');
    }
  };

  const removeLocation = (loc: string) => {
    setLocations(locations.filter((l) => l !== loc));
  };

  const togglePropertyType = (type: string) => {
    if (propertyTypes.includes(type)) {
      setPropertyTypes(propertyTypes.filter((t) => t !== type));
    } else {
      setPropertyTypes([...propertyTypes, type]);
    }
  };

  const onSubmit = async (data: LeadFormData) => {
    await createLead.mutateAsync({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      source: data.source as any,
      priority: data.priority as any,
      budget_min: data.budget_min,
      budget_max: data.budget_max,
      budget_currency: data.budget_currency,
      bedrooms: data.bedrooms,
      requirements_notes: data.requirements_notes,
      locations,
      property_types: propertyTypes as any,
    });
    setOpen(false);
    form.reset();
    setLocations([]);
    setPropertyTypes([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Source & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Constants.public.Enums.lead_source.map((source) => (
                          <SelectItem key={source} value={source} className="capitalize">
                            {source.replace(/_/g, ' ')}
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Constants.public.Enums.lead_priority.map((priority) => (
                          <SelectItem key={priority} value={priority} className="capitalize">
                            {priority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Budget */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="budget_min"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Budget</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="500000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budget_max"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Budget</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1000000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budget_currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="AED">AED</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Property Requirements */}
            <FormField
              control={form.control}
              name="bedrooms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bedrooms</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={20} placeholder="2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Property Types */}
            <div>
              <FormLabel>Property Types</FormLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {Constants.public.Enums.property_type.map((type) => (
                  <Badge
                    key={type}
                    variant={propertyTypes.includes(type) ? 'default' : 'outline'}
                    className="cursor-pointer capitalize"
                    onClick={() => togglePropertyType(type)}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Locations */}
            <div>
              <FormLabel>Preferred Locations</FormLabel>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Add location..."
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLocation();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addLocation}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {locations.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {locations.map((loc) => (
                    <Badge key={loc} variant="secondary" className="gap-1">
                      {loc}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => removeLocation(loc)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="requirements_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional requirements or notes..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createLead.isPending} className="bg-gradient-primary">
                {createLead.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Lead
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
