import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { ReactNode, useState } from 'react';
import {
  Edit3,
  MessageSquare,
  Home,
  Paperclip,
  Calendar,
  Trash2,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PropertySwipeActionsProps {
  children: ReactNode;
  propertyId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onChangeStatus: () => void;
  onAddNote: () => void;
  onConvertToListing: () => void;
  onAttachDocument: () => void;
  onAddActivity: () => void;
  onDelete: () => void;
  className?: string;
}

export function PropertySwipeActions({
  children,
  propertyId,
  isExpanded,
  onToggleExpand,
  onChangeStatus,
  onAddNote,
  onConvertToListing,
  onAttachDocument,
  onAddActivity,
  onDelete,
  className,
}: PropertySwipeActionsProps) {
  const [showActions, setShowActions] = useState(false);
  const x = useMotionValue(0);

  const actionsOpacity = useTransform(x, [0, 80], [0, 1]);
  const swipeThreshold = 80;

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x >= swipeThreshold) {
      setShowActions(true);
    } else {
      setShowActions(false);
    }
  };

  const closeActions = () => setShowActions(false);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Action buttons background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-muted to-muted/80 flex items-center gap-1 px-2"
        style={{ opacity: showActions ? 1 : actionsOpacity }}
      >
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => {
            onChangeStatus();
            closeActions();
          }}
          title="Change Status"
        >
          <Edit3 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 bg-secondary text-secondary-foreground hover:bg-secondary/90"
          onClick={() => {
            onAddNote();
            closeActions();
          }}
          title="Add Note"
        >
          <MessageSquare className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 bg-success text-success-foreground hover:bg-success/90"
          onClick={() => {
            onConvertToListing();
            closeActions();
          }}
          title="Convert to Listing"
        >
          <Home className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => {
            onAttachDocument();
            closeActions();
          }}
          title="Attach Documents"
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 bg-warning text-warning-foreground hover:bg-warning/90"
          onClick={() => {
            onAddActivity();
            closeActions();
          }}
          title="Add Activity"
        >
          <Calendar className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={() => {
            onDelete();
            closeActions();
          }}
          title="Archive Property"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Swipeable row content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: showActions ? 200 : 0 }}
        dragElastic={{ left: 0, right: 0.3 }}
        onDragEnd={handleDragEnd}
        style={{ x: showActions ? 200 : x }}
        animate={{ x: showActions ? 200 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="relative bg-card"
      >
        <div className="flex items-center">
          <div className="flex-1">{children}</div>
          <div className="pr-2">
            {showActions ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={closeActions}
              >
                <X className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setShowActions(true)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
