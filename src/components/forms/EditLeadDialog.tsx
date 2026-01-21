import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateLead } from '@/hooks/useLeads';
import { usePushToSheets } from '@/hooks/useSheetsSync';
import { useCreateActivity } from '@/hooks/useActivities';
import { Loader2, X, Plus } from 'lucide-react';
import { Constants } from '@/integrations/supabase/types';
import type { Database } from '@/integrations/supabase/types';

type LeadRow = Database['public']['Tables']['leads']['Row'];

type LeadSource = Database['public']['Enums']['lead_source'];
type LeadPriority = Database['public']['Enums']['lead_priority'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type PropertyType = Database['public']['Enums']['property_type'];

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string(),
  priority: z.string(),
  status: z.string(),
  budget_min: z.number().optional(),
  budget_max: z.number().optional(),
  bedrooms: z.number().optional(),
  requirements_notes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface EditLeadDialogProps {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLeadDialog({ lead, open, onOpenChange }: EditLeadDialogProps) {
  const updateLead = useUpdateLead();
  const pushToSheets = usePushToSheets();
  const createActivity = useCreateActivity();
  
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
  });

  // Initialize form when lead changes
  useEffect(() => {
    if (lead) {
      reset({
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        source: lead.source,
        priority: lead.priority,
        status: lead.status,
        budget_min: lead.budget_min || undefined,
        budget_max: lead.budget_max || undefined,
        bedrooms: lead.bedrooms || undefined,
        requirements_notes: lead.requirements_notes || '',
      });
      setLocations(lead.locations || []);
      setPropertyTypes(lead.property_types || []);
    }
  }, [lead, reset]);

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
    if (!lead) return;

    const oldData = { ...lead };
    const updates = {
      id: lead.id,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      source: data.source as LeadSource,
      priority: data.priority as LeadPriority,
      status: data.status as LeadStatus,
      budget_min: data.budget_min,
      budget_max: data.budget_max,
      bedrooms: data.bedrooms,
      requirements_notes: data.requirements_notes,
      locations,
      property_types: propertyTypes as PropertyType[],
    };

    try {
      await updateLead.mutateAsync(updates);

      // Log the edit activity with old vs new values
      await createActivity.mutateAsync({
        lead_id: lead.id,
        type: 'note',
        title: 'Lead information updated',
        description: `Updated fields: ${Object.keys(data).filter(k => data[k as keyof LeadFormData] !== oldData[k as keyof typeof oldData]).join(', ')}`,
        metadata: { old_values: oldData, new_values: updates },
      });

      // Push to Google Sheets
      pushToSheets.mutate({
        tableName: 'leads',
        record: updates,
        recordId: lead.id,
      });

      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" {...register('phone')} />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={watch('source')}
                onValueChange={(value) => setValue('source', value as LeadFormData['source'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.lead_source.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch('status')}
                onValueChange={(value) => setValue('status', value as LeadFormData['status'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.lead_status.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={watch('priority')}
                onValueChange={(value) => setValue('priority', value as LeadFormData['priority'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.lead_priority.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget_min">Budget Min (AED)</Label>
              <Input
                id="budget_min"
                type="number"
                {...register('budget_min', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget_max">Budget Max (AED)</Label>
              <Input
                id="budget_max"
                type="number"
                {...register('budget_max', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Bedrooms */}
          <div className="space-y-2">
            <Label htmlFor="bedrooms">Bedrooms</Label>
            <Input
              id="bedrooms"
              type="number"
              {...register('bedrooms', { valueAsNumber: true })}
            />
          </div>

          {/* Property Types */}
          <div className="space-y-2">
            <Label>Property Types</Label>
            <div className="flex flex-wrap gap-2">
              {Constants.public.Enums.property_type.map((type) => (
                <Badge
                  key={type}
                  variant={propertyTypes.includes(type) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => togglePropertyType(type)}
                >
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          {/* Locations */}
          <div className="space-y-2">
            <Label>Preferred Locations</Label>
            <div className="flex gap-2">
              <Input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Add location"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
              />
              <Button type="button" variant="outline" size="icon" onClick={addLocation}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {locations.map((loc) => (
                <Badge key={loc} variant="secondary" className="gap-1">
                  {loc}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => removeLocation(loc)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="requirements_notes">Notes</Label>
            <Textarea
              id="requirements_notes"
              {...register('requirements_notes')}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateLead.isPending}>
              {updateLead.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
