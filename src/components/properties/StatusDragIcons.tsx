import { cn } from '@/lib/utils';

export type DragStatusKey = 
  | 'not-answering' 
  | 'not-working' 
  | 'red-flag' 
  | 'new-listing' 
  | 'busy';

interface StatusInfo {
  icon: string;
  label: string;
  colorClass: string;
}

export const STATUS_DRAG_ICONS: Record<DragStatusKey, StatusInfo> = {
  'not-answering': { icon: '📵', label: 'Not Answering', colorClass: 'bg-warning text-warning-foreground' },
  'not-working': { icon: '❌', label: 'Not Working', colorClass: 'bg-destructive text-destructive-foreground' },
  'red-flag': { icon: '🚩', label: 'Red Flag', colorClass: 'bg-destructive text-destructive-foreground' },
  'new-listing': { icon: '🆕', label: 'New Listing', colorClass: 'bg-success text-success-foreground' },
  'busy': { icon: '⏰', label: 'Busy', colorClass: 'bg-accent text-accent-foreground' },
};

interface StatusDragIconsProps {
  onDragStart: (key: DragStatusKey) => void;
}

export function StatusDragIcons({ onDragStart }: StatusDragIconsProps) {
  const handleDragStart = (e: React.DragEvent, key: DragStatusKey) => {
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(key);
  };

  return (
    <div className="bg-card rounded-xl p-4 shadow-card mb-4">
      <p className="text-xs text-muted-foreground mb-3 font-medium">
        🎯 Drag status icon to property row:
      </p>
      <div className="flex gap-2 flex-wrap">
        {Object.entries(STATUS_DRAG_ICONS).map(([key, info]) => (
          <div
            key={key}
            draggable
            onDragStart={(e) => handleDragStart(e, key as DragStatusKey)}
            className={cn(
              info.colorClass,
              'px-3 py-1.5 rounded-lg text-xs font-semibold cursor-move flex items-center gap-2',
              'hover:scale-105 hover:shadow-md transition-all active:cursor-grabbing'
            )}
          >
            <span>{info.icon}</span>
            <span>{info.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
