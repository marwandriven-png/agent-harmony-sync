import { useState, useMemo } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useCRMStore } from '@/store/crmStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Flame, Thermometer, Snowflake } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LeadPriority } from '@/types/crm';

const priorityIcons: Record<LeadPriority, React.ElementType> = {
  hot: Flame,
  warm: Thermometer,
  cold: Snowflake,
};

const priorityColors: Record<LeadPriority, string> = {
  hot: 'border-l-priority-hot bg-pastel-red',
  warm: 'border-l-priority-warm bg-pastel-orange',
  cold: 'border-l-priority-cold bg-pastel-cyan',
};

export default function CalendarPage() {
  const { tasks } = useCRMStore();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get tasks grouped by date
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, typeof tasks> = {};
    tasks.forEach((task) => {
      const dateKey = format(parseISO(task.dueDate), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(task);
    });
    return grouped;
  }, [tasks]);

  const selectedDateTasks = selectedDate
    ? tasksByDate[format(selectedDate, 'yyyy-MM-dd')] || []
    : [];

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Get start padding for the first week
  const startPadding = monthStart.getDay();
  const paddingDays = Array(startPadding).fill(null);

  return (
    <MainLayout>
      <PageHeader
        title="Calendar"
        subtitle="View and manage your scheduled tasks and follow-ups"
        actions={
          <Button onClick={goToToday} variant="outline">
            Today
          </Button>
        }
      />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-card rounded-xl p-6 shadow-card"
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {paddingDays.map((_, index) => (
                <div key={`padding-${index}`} className="aspect-square" />
              ))}
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate[dateKey] || [];
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentDay = isToday(day);

                return (
                  <motion.button
                    key={dateKey}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square p-1 rounded-lg transition-all flex flex-col items-center justify-start",
                      isSelected && "bg-primary text-primary-foreground",
                      !isSelected && isCurrentDay && "bg-accent/50 ring-2 ring-primary",
                      !isSelected && !isCurrentDay && "hover:bg-muted"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium",
                      !isSelected && "text-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayTasks.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {dayTasks.slice(0, 3).map((task, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              task.leadPriority === 'hot' && "bg-priority-hot",
                              task.leadPriority === 'warm' && "bg-priority-warm",
                              task.leadPriority === 'cold' && "bg-priority-cold",
                              isSelected && "bg-primary-foreground"
                            )}
                          />
                        ))}
                        {dayTasks.length > 3 && (
                          <span className={cn(
                            "text-[10px]",
                            isSelected ? "text-primary-foreground" : "text-muted-foreground"
                          )}>
                            +{dayTasks.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Selected Day Tasks */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card rounded-xl p-6 shadow-card h-fit"
          >
            <div className="flex items-center gap-2 mb-4">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a day'}
              </h3>
            </div>

            {selectedDate && (
              <div className="space-y-3">
                {selectedDateTasks.length > 0 ? (
                  selectedDateTasks.map((task, index) => {
                    const PriorityIcon = priorityIcons[task.leadPriority];
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => navigate(`/leads/${task.leadId}`)}
                        className={cn(
                          "p-4 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md",
                          priorityColors[task.leadPriority]
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-foreground">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <User className="w-3 h-3" />
                              <span>{task.leadName}</span>
                            </div>
                          </div>
                          <PriorityIcon className={cn(
                            "w-4 h-4",
                            task.leadPriority === 'hot' && "text-priority-hot",
                            task.leadPriority === 'warm' && "text-priority-warm",
                            task.leadPriority === 'cold' && "text-priority-cold"
                          )} />
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{format(parseISO(task.dueDate), 'h:mm a')}</span>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No tasks scheduled for this day</p>
                  </div>
                )}
              </div>
            )}

            {!selectedDate && (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Click on a day to view tasks</p>
              </div>
            )}
          </motion.div>
        </div>
      </PageContent>
    </MainLayout>
  );
}
