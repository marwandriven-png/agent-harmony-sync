import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export interface ActivityLogEntry {
  id: string | number;
  propertyId: string;
  buildingName: string;
  action: string;
  oldValue: string;
  newValue: string;
  user: string;
  timestamp: string;
  source: string;
}

interface PropertyActivityLogProps {
  logs: ActivityLogEntry[];
}

export function PropertyActivityLog({ logs }: PropertyActivityLogProps) {
  if (logs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 bg-card rounded-xl shadow-card p-5"
    >
      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-foreground">
        <Clock className="w-5 h-5 text-primary" />
        Recent Activity
      </h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {logs.slice(0, 10).map((log) => (
          <div
            key={log.id}
            className="bg-muted/50 p-4 rounded-lg text-sm border border-border"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{log.buildingName}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
            <p className="text-muted-foreground mt-1">
              <span className="font-medium text-primary">{log.action}</span>
              {log.oldValue && ` from "${log.oldValue}"`}
              {log.newValue && ` to "${log.newValue}"`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              by {log.user} via {log.source}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
