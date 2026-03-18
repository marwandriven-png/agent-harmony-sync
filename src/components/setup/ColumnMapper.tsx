import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

interface ColumnMapperProps {
  sourceColumns: string[];
  targetFields: { key: string; label: string; required: boolean }[];
  mappings: Record<string, string>;
  onMappingChange: (mappings: Record<string, string>) => void;
}

export function ColumnMapper({
  sourceColumns,
  targetFields,
  mappings,
  onMappingChange,
}: ColumnMapperProps) {
  const handleMappingChange = (targetKey: string, sourceColumn: string) => {
    const newMappings = { ...mappings };
    if (sourceColumn === '__none__') {
      delete newMappings[targetKey];
    } else {
      newMappings[targetKey] = sourceColumn;
    }
    onMappingChange(newMappings);
  };

  // Auto-map based on similar names
  const autoMap = () => {
    const newMappings: Record<string, string> = {};
    
    targetFields.forEach((field) => {
      const matchingColumn = sourceColumns.find((col) => {
        const colLower = col.toLowerCase().replace(/[_\s-]/g, '');
        const fieldLower = field.key.toLowerCase().replace(/[_\s-]/g, '');
        const labelLower = field.label.toLowerCase().replace(/[_\s-]/g, '');
        
        return (
          colLower === fieldLower ||
          colLower === labelLower ||
          colLower.includes(fieldLower) ||
          fieldLower.includes(colLower)
        );
      });
      
      if (matchingColumn) {
        newMappings[field.key] = matchingColumn;
      }
    });
    
    onMappingChange(newMappings);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Map Columns to CRM Fields</Label>
        <button
          type="button"
          onClick={autoMap}
          className="text-sm text-primary hover:underline"
        >
          Auto-detect mappings
        </button>
      </div>

      <div className="space-y-3">
        {targetFields.map((field) => (
          <div
            key={field.key}
            className="flex items-center gap-4 p-3 rounded-lg border bg-card"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{field.label}</span>
                {field.required && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{field.key}</span>
            </div>

            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

            <div className="flex-1">
              <Select
                value={mappings[field.key] || '__none__'}
                onValueChange={(value) => handleMappingChange(field.key, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Not mapped --</SelectItem>
                  {sourceColumns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
