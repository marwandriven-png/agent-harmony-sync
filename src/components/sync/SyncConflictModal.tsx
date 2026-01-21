import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSyncConflictResolver } from '@/hooks/useSheetsSync';
import { Loader2, ArrowLeftRight, Check, X } from 'lucide-react';

interface SyncConflict {
  row_id: string;
  crm_data: Record<string, unknown>;
  sheet_data: Record<string, unknown>;
  field_diffs: string[];
}

interface SyncConflictModalProps {
  conflicts: SyncConflict[];
  tableName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}

export function SyncConflictModal({
  conflicts,
  tableName,
  open,
  onOpenChange,
  onResolved,
}: SyncConflictModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mergedData, setMergedData] = useState<Record<string, unknown>>({});
  const resolver = useSyncConflictResolver();

  const currentConflict = conflicts[currentIndex];

  if (!currentConflict) return null;

  const handleResolve = async (resolution: 'keep_crm' | 'keep_sheet' | 'merge') => {
    const recordId = currentConflict.crm_data.id as string;
    const validTableName = tableName as 'leads' | 'cold_calls' | 'properties' | 'tasks';

    let dataToUse = {};
    if (resolution === 'keep_sheet') {
      dataToUse = currentConflict.sheet_data;
    } else if (resolution === 'merge') {
      dataToUse = { ...currentConflict.crm_data, ...mergedData };
    }

    await resolver.mutateAsync({
      tableName: validTableName,
      recordId,
      resolution,
      mergedData: dataToUse,
    });

    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setMergedData({});
    } else {
      onResolved();
      onOpenChange(false);
    }
  };

  const toggleFieldValue = (field: string, useSheet: boolean) => {
    setMergedData((prev) => ({
      ...prev,
      [field]: useSheet ? currentConflict.sheet_data[field] : currentConflict.crm_data[field],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Sync Conflict Resolution
          </DialogTitle>
          <DialogDescription>
            Conflict {currentIndex + 1} of {conflicts.length} • {tableName}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {/* Record ID */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Record:</span>
              <Badge variant="outline">{currentConflict.row_id}</Badge>
            </div>

            {/* Field Comparisons */}
            <div className="space-y-3">
              <h4 className="font-medium">Conflicting Fields:</h4>
              
              {currentConflict.field_diffs.map((field) => {
                const crmValue = currentConflict.crm_data[field];
                const sheetValue = currentConflict.sheet_data[field];
                const selectedValue = mergedData[field];
                const isUsingSheet = selectedValue === sheetValue;
                const isUsingCRM = selectedValue === crmValue || selectedValue === undefined;

                return (
                  <div key={field} className="border rounded-lg p-4">
                    <div className="font-medium text-sm mb-3 text-muted-foreground uppercase tracking-wide">
                      {field.replace(/_/g, ' ')}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* CRM Value */}
                      <button
                        onClick={() => toggleFieldValue(field, false)}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          isUsingCRM
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-xs">CRM</Badge>
                          {isUsingCRM && <Check className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="text-sm font-mono break-all">
                          {formatValue(crmValue)}
                        </div>
                      </button>

                      {/* Sheet Value */}
                      <button
                        onClick={() => toggleFieldValue(field, true)}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          isUsingSheet
                            ? 'border-status-closed bg-status-closed/5'
                            : 'border-transparent bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">Google Sheet</Badge>
                          {isUsingSheet && <Check className="w-4 h-4 text-status-closed" />}
                        </div>
                        <div className="text-sm font-mono break-all">
                          {formatValue(sheetValue)}
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-4 border-t">
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => handleResolve('keep_crm')}
              disabled={resolver.isPending}
              className="flex-1"
            >
              Keep CRM Values
            </Button>
            <Button
              variant="outline"
              onClick={() => handleResolve('keep_sheet')}
              disabled={resolver.isPending}
              className="flex-1"
            >
              Keep Sheet Values
            </Button>
          </div>
          
          <Button
            onClick={() => handleResolve('merge')}
            disabled={resolver.isPending || Object.keys(mergedData).length === 0}
            className="w-full"
          >
            {resolver.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Apply Selected Values ({Object.keys(mergedData).length} customized)
          </Button>

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Skip All Conflicts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (Array.isArray(value)) return value.join(', ') || '(empty array)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
