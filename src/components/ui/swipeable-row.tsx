import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { ReactNode, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
  deleteThreshold?: number;
}

export function SwipeableRow({
  children,
  onDelete,
  className,
  deleteThreshold = 150,
}: SwipeableRowProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const x = useMotionValue(0);
  
  // Transform x position to background opacity and icon scale
  const deleteOpacity = useTransform(x, [0, deleteThreshold], [0, 1]);
  const deleteScale = useTransform(x, [0, deleteThreshold], [0.5, 1]);
  const deleteIconX = useTransform(x, [0, deleteThreshold], [-20, 20]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x >= deleteThreshold) {
      setIsDeleting(true);
      // Animate out then delete
      setTimeout(() => {
        onDelete();
      }, 200);
    }
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Delete background */}
      <motion.div
        className="absolute inset-0 bg-destructive flex items-center pl-4"
        style={{ opacity: deleteOpacity }}
      >
        <motion.div
          style={{ scale: deleteScale, x: deleteIconX }}
          className="flex items-center gap-2 text-destructive-foreground font-medium"
        >
          <Trash2 className="w-5 h-5" />
          <span>Delete</span>
        </motion.div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.5 }}
        onDragEnd={handleDragEnd}
        style={{ x }}
        animate={isDeleting ? { x: 500, opacity: 0 } : {}}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="relative bg-card cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
