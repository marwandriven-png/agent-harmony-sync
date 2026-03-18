import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  isProcessing?: boolean;
}

export function FileUploadZone({ onFileSelect, isProcessing }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const validateFile = (file: File): boolean => {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const validExtensions = ['.csv', '.xls', '.xlsx'];

    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      toast.error('Please upload a CSV or Excel file');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return false;
    }

    return true;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file && validateFile(file)) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
        isProcessing && 'pointer-events-none opacity-60'
      )}
    >
      <input
        type="file"
        accept=".csv,.xls,.xlsx"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
      />

      <div className="flex flex-col items-center gap-3">
        {isProcessing ? (
          <>
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Processing file...</p>
          </>
        ) : selectedFile ? (
          <>
            <FileSpreadsheet className="w-10 h-10 text-primary" />
            <div>
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </>
        ) : (
          <>
            <Upload className="w-10 h-10 text-muted-foreground" />
            <div>
              <p className="font-medium">
                Drop your file here, or{' '}
                <span className="text-primary">browse</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Supports CSV and Excel files up to 10MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
