import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useConvertColdCallToLead, useUpdateColdCall } from '@/hooks/useColdCalls';
import { useCreateProperty } from '@/hooks/useProperties';
import { usePushToSheets } from '@/hooks/useSheetsSync';
import { Loader2, UserPlus, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type ColdCallRow = Database['public']['Tables']['cold_calls']['Row'];

interface ConvertColdCallDialogProps {
  coldCall: ColdCallRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConvertColdCallDialog({ coldCall, open, onOpenChange }: ConvertColdCallDialogProps) {
  const [conversionType, setConversionType] = useState<'lead' | 'listing'>('lead');
  const convertToLead = useConvertColdCallToLead();
  const updateColdCall = useUpdateColdCall();
  const createProperty = useCreateProperty();
  const pushToSheets = usePushToSheets();

  const handleConvert = async () => {
    if (!coldCall) return;

    try {
      if (conversionType === 'lead') {
        // Use existing convert to lead mutation
        await convertToLead.mutateAsync(coldCall.id);
      } else {
        // Convert to listing (property)
        const property = await createProperty.mutateAsync({
          title: `Property from ${coldCall.name}`,
          type: 'apartment', // Default, should be collected
          price: coldCall.budget || 0,
          currency: 'AED',
          location: coldCall.location || 'TBD',
          bedrooms: coldCall.bedrooms || 1,
          bathrooms: 1,
          size: 0,
          size_unit: 'sqft',
          description: coldCall.notes || '',
          features: [],
          images: [],
          status: 'available',
        });

        // Update cold call status
        await updateColdCall.mutateAsync({
          id: coldCall.id,
          status: 'converted',
        });

        // Push to sheets
        pushToSheets.mutate({
          tableName: 'cold_calls',
          record: { id: coldCall.id, status: 'converted' },
          recordId: coldCall.id,
        });

        toast.success('Cold call converted to property listing');
      }

      onOpenChange(false);
    } catch (error) {
      // Error handled by mutations
    }
  };

  const isLoading = convertToLead.isPending || createProperty.isPending;

  if (!coldCall) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert Cold Call</DialogTitle>
          <DialogDescription>
            Choose how to convert <strong>{coldCall.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <RadioGroup
            value={conversionType}
            onValueChange={(value) => setConversionType(value as 'lead' | 'listing')}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="lead" id="lead" className="mt-1" />
              <Label htmlFor="lead" className="cursor-pointer flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <span className="font-medium">Convert to New Lead</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create a new lead in the pipeline with all call history and notes preserved.
                  Perfect for prospects interested in buying or renting.
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="listing" id="listing" className="mt-1" />
              <Label htmlFor="listing" className="cursor-pointer flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-5 h-5 text-status-closed" />
                  <span className="font-medium">Convert to New Listing</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create a new property listing. Use this for owners looking to sell or rent
                  their property through your agency.
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Data to be transferred:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Name: {coldCall.name}</li>
            <li>• Phone: {coldCall.phone}</li>
            {coldCall.email && <li>• Email: {coldCall.email}</li>}
            {coldCall.location && <li>• Location: {coldCall.location}</li>}
            {coldCall.budget && <li>• Budget: AED {coldCall.budget.toLocaleString()}</li>}
            {coldCall.notes && <li>• Notes: {coldCall.notes}</li>}
          </ul>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Convert to {conversionType === 'lead' ? 'Lead' : 'Listing'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
