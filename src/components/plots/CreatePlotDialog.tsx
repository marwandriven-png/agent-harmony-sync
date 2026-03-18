import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreatePlot } from '@/hooks/usePlots';

const plotSchema = z.object({
  plot_number: z.string().min(1, 'Plot number is required'),
  area_name: z.string().min(1, 'Area name is required'),
  master_plan: z.string().optional(),
  plot_size: z.number().positive('Plot size must be positive'),
  gfa: z.number().optional(),
  floors_allowed: z.number().optional(),
  zoning: z.string().optional(),
  status: z.string().default('available'),
  price: z.number().optional(),
  price_per_sqft: z.number().optional(),
  owner_name: z.string().optional(),
  owner_mobile: z.string().optional(),
  pdf_source_link: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

type PlotFormData = z.infer<typeof plotSchema>;

interface CreatePlotDialogProps {
  trigger?: React.ReactNode;
}

export function CreatePlotDialog({ trigger }: CreatePlotDialogProps) {
  const [open, setOpen] = useState(false);
  const createPlot = useCreatePlot();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PlotFormData>({
    resolver: zodResolver(plotSchema),
    defaultValues: {
      status: 'available',
      zoning: 'residential',
    },
  });

  const onSubmit = async (data: PlotFormData) => {
    await createPlot.mutateAsync({
      plot_number: data.plot_number,
      area_name: data.area_name,
      plot_size: data.plot_size,
      status: data.status || 'available',
      gfa: data.gfa || null,
      floors_allowed: data.floors_allowed || null,
      price: data.price || null,
      price_per_sqft: data.price_per_sqft || null,
      master_plan: data.master_plan || null,
      owner_name: data.owner_name || null,
      owner_mobile: data.owner_mobile || null,
      pdf_source_link: data.pdf_source_link || null,
      notes: data.notes || null,
      zoning: data.zoning || null,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Plot
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Plot</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plot_number">Plot Number *</Label>
              <Input
                id="plot_number"
                {...register('plot_number')}
                placeholder="e.g., PLT-001"
              />
              {errors.plot_number && (
                <p className="text-sm text-destructive">{errors.plot_number.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="area_name">Area Name *</Label>
              <Input
                id="area_name"
                {...register('area_name')}
                placeholder="e.g., Dubai Marina"
              />
              {errors.area_name && (
                <p className="text-sm text-destructive">{errors.area_name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="master_plan">Master Plan</Label>
              <Input
                id="master_plan"
                {...register('master_plan')}
                placeholder="e.g., Dubai 2040"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plot_size">Plot Size (sqft) *</Label>
              <Input
                id="plot_size"
                type="number"
                {...register('plot_size', { valueAsNumber: true })}
                placeholder="e.g., 10000"
              />
              {errors.plot_size && (
                <p className="text-sm text-destructive">{errors.plot_size.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gfa">GFA (sqft)</Label>
              <Input
                id="gfa"
                type="number"
                {...register('gfa', { valueAsNumber: true })}
                placeholder="e.g., 25000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="floors_allowed">Floors Allowed</Label>
              <Input
                id="floors_allowed"
                type="number"
                {...register('floors_allowed', { valueAsNumber: true })}
                placeholder="e.g., 10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zoning">Zoning</Label>
              <Select
                defaultValue="residential"
                onValueChange={(value) => setValue('zoning', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select zoning" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="mixed">Mixed Use</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (AED)</Label>
              <Input
                id="price"
                type="number"
                {...register('price', { valueAsNumber: true })}
                placeholder="e.g., 5000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_per_sqft">Price/sqft</Label>
              <Input
                id="price_per_sqft"
                type="number"
                {...register('price_per_sqft', { valueAsNumber: true })}
                placeholder="e.g., 500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                defaultValue="available"
                onValueChange={(value) => setValue('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="under_negotiation">Under Negotiation</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner_name">Owner Name</Label>
              <Input
                id="owner_name"
                {...register('owner_name')}
                placeholder="Owner's name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_mobile">Owner Mobile</Label>
              <Input
                id="owner_mobile"
                {...register('owner_mobile')}
                placeholder="+971..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdf_source_link">PDF Source Link</Label>
            <Input
              id="pdf_source_link"
              {...register('pdf_source_link')}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Additional notes about the plot..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createPlot.isPending}>
              {createPlot.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Plot
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
