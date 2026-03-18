import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, DollarSign, User, Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useAddPlotOffer, 
  useAddInterestedBuyer,
  usePlotOffers,
  usePlotInterestedBuyers,
  type Plot,
  type PlotOffer,
  type PlotInterestedBuyer 
} from '@/hooks/usePlots';
import { useLeads } from '@/hooks/useLeads';
import { cn } from '@/lib/utils';

// Offer schema
const offerSchema = z.object({
  buyer_name: z.string().min(1, 'Buyer name is required'),
  mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  offer_amount: z.number().positive('Offer amount must be positive'),
  notes: z.string().optional(),
});

type OfferFormData = z.infer<typeof offerSchema>;

// Interested buyer schema
const interestedBuyerSchema = z.object({
  buyer_name: z.string().min(1, 'Buyer name is required'),
  mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  notes: z.string().optional(),
  lead_id: z.string().optional(),
});

type InterestedBuyerFormData = z.infer<typeof interestedBuyerSchema>;

const offerStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  countered: 'bg-blue-100 text-blue-800',
};

// =============================================
// OFFERS DIALOG
// =============================================
interface PlotOffersDialogProps {
  plot: Plot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlotOffersDialog({ plot, open, onOpenChange }: PlotOffersDialogProps) {
  const [showForm, setShowForm] = useState(false);
  const { data: offers = [] } = usePlotOffers(plot?.id);
  const addOffer = useAddPlotOffer();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OfferFormData>({
    resolver: zodResolver(offerSchema),
  });

  const onSubmit = async (data: OfferFormData) => {
    if (!plot) return;
    await addOffer.mutateAsync({
      plot_id: plot.id,
      buyer_name: data.buyer_name,
      mobile: data.mobile || null,
      email: data.email || null,
      offer_amount: data.offer_amount,
      offer_status: 'pending',
      notes: data.notes || null,
      lead_id: null,
    });
    reset();
    setShowForm(false);
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `AED ${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `AED ${(amount / 1000).toFixed(0)}K`;
    return `AED ${amount.toLocaleString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Offers for {plot?.plot_number}
          </DialogTitle>
        </DialogHeader>

        {/* Offer List */}
        <div className="space-y-3">
          {offers.length === 0 && !showForm ? (
            <p className="text-muted-foreground text-center py-4">
              No offers yet
            </p>
          ) : (
            offers.map((offer) => (
              <div 
                key={offer.id}
                className="border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{offer.buyer_name}</span>
                  <Badge className={cn('text-xs', offerStatusColors[offer.offer_status])}>
                    {offer.offer_status}
                  </Badge>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(offer.offer_amount)}
                </p>
                {offer.mobile && (
                  <p className="text-sm text-muted-foreground">{offer.mobile}</p>
                )}
                {offer.notes && (
                  <p className="text-sm text-muted-foreground">{offer.notes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(offer.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Add Offer Form */}
        {showForm ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buyer Name *</Label>
                <Input {...register('buyer_name')} placeholder="Name" />
                {errors.buyer_name && (
                  <p className="text-sm text-destructive">{errors.buyer_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Offer Amount (AED) *</Label>
                <Input 
                  type="number" 
                  {...register('offer_amount', { valueAsNumber: true })} 
                  placeholder="5000000"
                />
                {errors.offer_amount && (
                  <p className="text-sm text-destructive">{errors.offer_amount.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input {...register('mobile')} placeholder="+971..." />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input {...register('email')} placeholder="email@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea {...register('notes')} placeholder="Additional notes..." rows={2} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={addOffer.isPending} className="flex-1">
                {addOffer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Offer
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setShowForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Offer
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// INTERESTED BUYERS DIALOG
// =============================================
interface PlotInterestedDialogProps {
  plot: Plot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlotInterestedDialog({ plot, open, onOpenChange }: PlotInterestedDialogProps) {
  const [showForm, setShowForm] = useState(false);
  const { data: buyers = [] } = usePlotInterestedBuyers(plot?.id);
  const { data: leads = [] } = useLeads();
  const addBuyer = useAddInterestedBuyer();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InterestedBuyerFormData>({
    resolver: zodResolver(interestedBuyerSchema),
    defaultValues: {
      source: 'direct',
    },
  });

  const onSubmit = async (data: InterestedBuyerFormData) => {
    if (!plot) return;
    await addBuyer.mutateAsync({
      plot_id: plot.id,
      buyer_name: data.buyer_name,
      mobile: data.mobile || null,
      email: data.email || null,
      source: data.source || 'direct',
      notes: data.notes || null,
      lead_id: data.lead_id || null,
      viewed_at: new Date().toISOString(),
    });
    reset();
    setShowForm(false);
  };

  // Handle linking to existing lead
  const handleLinkLead = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setValue('buyer_name', lead.name);
      setValue('mobile', lead.phone || '');
      setValue('email', lead.email || '');
      setValue('lead_id', leadId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Interested Buyers for {plot?.plot_number}
          </DialogTitle>
        </DialogHeader>

        {/* Buyers List */}
        <div className="space-y-3">
          {buyers.length === 0 && !showForm ? (
            <p className="text-muted-foreground text-center py-4">
              No interested buyers yet
            </p>
          ) : (
            buyers.map((buyer) => (
              <div 
                key={buyer.id}
                className="border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{buyer.buyer_name}</span>
                  {buyer.lead_id && (
                    <Badge className="text-xs bg-primary/10 text-primary">
                      Linked to Lead
                    </Badge>
                  )}
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  {buyer.mobile && <span>{buyer.mobile}</span>}
                  {buyer.email && <span>{buyer.email}</span>}
                </div>
                {buyer.source && (
                  <Badge variant="outline" className="text-xs">
                    Source: {buyer.source}
                  </Badge>
                )}
                {buyer.notes && (
                  <p className="text-sm text-muted-foreground">{buyer.notes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Viewed: {buyer.viewed_at ? new Date(buyer.viewed_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Add Buyer Form */}
        {showForm ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border-t border-border pt-4">
            {/* Link to existing lead */}
            <div className="space-y-2">
              <Label>Link to Existing Lead (Optional)</Label>
              <Select onValueChange={handleLinkLead}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a lead..." />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name} - {lead.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buyer Name *</Label>
                <Input {...register('buyer_name')} placeholder="Name" />
                {errors.buyer_name && (
                  <p className="text-sm text-destructive">{errors.buyer_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select 
                  defaultValue="direct"
                  onValueChange={(v) => setValue('source', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input {...register('mobile')} placeholder="+971..." />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input {...register('email')} placeholder="email@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea {...register('notes')} placeholder="Additional notes..." rows={2} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={addBuyer.isPending} className="flex-1">
                {addBuyer.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Interested Buyer
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setShowForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Interested Buyer
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
