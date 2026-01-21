import { useCRMStore } from '@/store/crmStore';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Phone, 
  Eye, 
  MessageSquare, 
  Calendar,
  FileText,
  Flame,
  Thermometer,
  Snowflake,
  CheckCircle,
} from 'lucide-react';
import { TaskType, LeadPriority } from '@/types/crm';

const taskIcons: Record<TaskType, React.ElementType> = {
  call: Phone,
  viewing: Eye,
  'follow-up': MessageSquare,
  meeting: Calendar,
  document: FileText,
  other: FileText,
};

const priorityIcons: Record<LeadPriority, React.ElementType> = {
  hot: Flame,
  warm: Thermometer,
  cold: Snowflake,
};

const priorityColors: Record<LeadPriority, string> = {
  hot: 'text-priority-hot',
  warm: 'text-priority-warm',
  cold: 'text-priority-cold',
};

export function UpcomingTasks() {
  const { tasks, updateTask } = useCRMStore();
  const navigate = useNavigate();

  const upcomingTasks = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const handleComplete = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask(taskId, { status: 'completed', completedAt: new Date().toISOString() });
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Upcoming Tasks</h3>
          <p className="text-sm text-muted-foreground">Your next priorities</p>
        </div>
        <button 
          onClick={() => navigate('/tasks')}
          className="text-sm text-primary hover:underline"
        >
          View all →
        </button>
      </div>

      <div className="space-y-3">
        {upcomingTasks.map((task, index) => {
          const TaskIcon = taskIcons[task.type];
          const PriorityIcon = priorityIcons[task.leadPriority];
          const isOverdue = task.status === 'overdue' || new Date(task.dueDate) < new Date();

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "p-3 rounded-lg border transition-all cursor-pointer group",
                isOverdue 
                  ? "border-destructive/30 bg-pastel-red" 
                  : "border-border hover:border-primary/30 hover:bg-muted/50"
              )}
              onClick={() => navigate(`/leads/${task.leadId}`)}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={(e) => handleComplete(task.id, e)}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors",
                    "hover:bg-success hover:border-success group-hover:border-primary",
                    isOverdue ? "border-destructive" : "border-muted-foreground/30"
                  )}
                >
                  <CheckCircle className="w-full h-full opacity-0 group-hover:opacity-100 text-success" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TaskIcon className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground truncate">
                      {task.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <PriorityIcon className={cn("w-3 h-3", priorityColors[task.leadPriority])} />
                    <span className="text-xs text-muted-foreground truncate">
                      {task.leadName}
                    </span>
                  </div>
                </div>
                <span className={cn(
                  "text-xs whitespace-nowrap",
                  isOverdue ? "text-destructive font-medium" : "text-muted-foreground"
                )}>
                  {isOverdue ? 'Overdue' : formatDate(task.dueDate)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {upcomingTasks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No upcoming tasks</p>
        </div>
      )}
    </div>
  );
}
