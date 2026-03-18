import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet } from 'lucide-react';

interface DataPreviewProps {
  headers: string[];
  rows: Record<string, string>[];
}

export function DataPreview({ headers, rows }: DataPreviewProps) {
  if (headers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-50" />
        <p>No data to preview</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Data Preview</h4>
        <Badge variant="secondary">
          Showing {rows.length} of many rows
        </Badge>
      </div>

      <ScrollArea className="w-full rounded-lg border">
        <div className="min-w-max">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header, index) => (
                  <TableHead key={index} className="whitespace-nowrap">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {headers.map((header, colIndex) => (
                    <TableCell key={colIndex} className="whitespace-nowrap max-w-[200px] truncate">
                      {row[header] || '-'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
