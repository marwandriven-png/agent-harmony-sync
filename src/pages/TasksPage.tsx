import { useState, useMemo } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useCRMStore } from '@/store/crmStore';
import { Button } from '@/components/ui/button';
import { formatDate, formatRelativeTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  Phone,
  Eye,
  MessageSquare,
  Calendar,
  FileText,
  Flame,
  Thermometer,
  Snowflake,
  Plus,
  Filter,
} from 'lucide-react';
import { TaskType, TaskStatus, LeadPriority } from '@/types/crm';

const taskTypeIcons: Record<TaskType, React.ElementType> = {
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

const statusIcons: Record<TaskStatus, React.ElementType> = {
  pending: Circle,
  completed: CheckCircle,
  overdue: AlertCircle,
};

const statusColors: Record<TaskStatus, string> = {
  pending: 'text-muted-foreground',
  completed: 'text-success',
  overdue: 'text-destructive',
};

export default function TasksPage() {
  const { tasks, updateTask } = useCRMStore();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<TaskType | 'all'>('all');

  const sortedTasks = useMemo(() => {
    let filtered = tasks;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }
    
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    // Sort by due date, overdue first, then pending, then completed
    return [...filtered].sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (a.status !== 'overdue' && b.status === 'overdue') return 1;
      if (a.status === 'pending' && b.status === 'completed') return -1;
      if (a.status === 'completed' && b.status === 'pending') return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, filterStatus, filterType]);

  const handleComplete = (taskId: string) => {
    updateTask(taskId, { status: 'completed', completedAt: new Date().toISOString() });
  };

  const overdueTasks = tasks.filter(t => t.status === 'overdue').length;
  const dueTodayTasks = tasks.filter(t => {
    const today = new Date().toISOString().split('T')[0];
    return t.status === 'pending' && t.dueDate.startsWith(today);
  }).length;

  return (
    <MainLayout>
      <PageHeader
        title="Tasks"
        subtitle="Manage your follow-ups and scheduled activities"
        actions={
          <Button className="bg-gradient-primary hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        }
      />

      <PageContent>
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 shadow-card flex items-center gap-4"
          >
            <div className="p-3 bg-pastel-red rounded-lg">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{overdueTasks}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-4 shadow-card flex items-center gap-4"
          >
            <div className="p-3 bg-pastel-orange rounded-lg">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{dueTodayTasks}</p>
              <p className="text-sm text-muted-foreground">Due Today</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-4 shadow-card flex items-center gap-4"
          >
            <div className="p-3 bg-pastel-green rounded-lg">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {tasks.filter(t => t.status === 'completed').length}
              </p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Status:</span>
            {(['all', 'overdue', 'pending', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  filterStatus === status
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Type:</span>
            {(['all', 'call', 'viewing', 'meeting', 'follow-up'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  filterType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Task List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl shadow-card overflow-hidden"
        >
          <div className="divide-y divide-border">
            <AnimatePresence mode="popLayout">
              {sortedTasks.map((task, index) => {
                const TypeIcon = taskTypeIcons[task.type];
                const PriorityIcon = priorityIcons[task.leadPriority];
                const StatusIcon = statusIcons[task.status];
                const isOverdue = task.status === 'overdue' || (task.status === 'pending' && new Date(task.dueDate) < new Date());

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      "p-4 hover:bg-muted/30 transition-colors cursor-pointer group",
                      isOverdue && "bg-pastel-red/50"
                    )}
                    onClick={() => navigate(`/leads/${task.leadId}`)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (task.status !== 'completed') {
                            handleComplete(task.id);
                          }
                        }}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                          task.status === 'completed'
                            ? "bg-success border-success"
                            : "border-muted-foreground/30 hover:border-success hover:bg-success/10",
                          isOverdue && task.status !== 'completed' && "border-destructive"
                        )}
                      >
                        {task.status === 'completed' && (
                          <CheckCircle className="w-4 h-4 text-success-foreground" />
                        )}
                      </button>

                      {/* Task Type Icon */}
                      <div className={cn(
                        "p-2 rounded-lg flex-shrink-0",
                        task.status === 'completed' ? "bg-muted" : "bg-pastel-blue"
                      )}>
                        <TypeIcon className={cn(
                          "w-4 h-4",
                          task.status === 'completed' ? "text-muted-foreground" : "text-primary"
                        )} />
                      </div>

                      {/* Task Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn(
                            "font-medium truncate",
                            task.status === 'completed' 
                              ? "text-muted-foreground line-through" 
                              : "text-foreground"
                          )}>
                            {task.title}
                          </p>
                          <PriorityIcon className={cn(
                            "w-4 h-4 flex-shrink-0",
                            priorityColors[task.leadPriority]
                          )} />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{task.leadName}</span>
                          <span>•</span>
                          <span className="capitalize">{task.type}</span>
                        </div>
                      </div>

                      {/* Due Date */}
                      <div className="text-right flex-shrink-0">
                        <p className={cn(
                          "text-sm font-medium",
                          isOverdue && task.status !== 'completed' 
                            ? "text-destructive" 
                            : task.status === 'completed'
                            ? "text-muted-foreground"
                            : "text-foreground"
                        )}>
                          {isOverdue && task.status !== 'completed' ? 'Overdue' : formatDate(task.dueDate)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(task.dueDate)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {sortedTasks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No tasks found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          )}
        </motion.div>
      </PageContent>
    </MainLayout>
  );
}
