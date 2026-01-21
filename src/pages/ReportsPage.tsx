import { useState, useMemo } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useLeads } from '@/hooks/useLeads';
import { useTasks } from '@/hooks/useTasks';
import { useActivities } from '@/hooks/useActivities';
import { useColdCalls } from '@/hooks/useColdCalls';
import { useProperties } from '@/hooks/useProperties';
import { formatCurrency, formatCompactNumber, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  endOfDay,
  endOfWeek,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import {
  TrendingUp,
  Users,
  DollarSign,
  Target,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Phone,
  Building2,
  CheckCircle,
  Clock,
  Download,
  FileText,
} from 'lucide-react';

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export default function ReportsPage() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: activities = [], isLoading: activitiesLoading } = useActivities();
  const { data: coldCalls = [], isLoading: coldCallsLoading } = useColdCalls();
  const { data: properties = [], isLoading: propertiesLoading } = useProperties();
  
  const [period, setPeriod] = useState<ReportPeriod>('daily');

  const isLoading = leadsLoading || tasksLoading || activitiesLoading || coldCallsLoading || propertiesLoading;

  // Calculate date ranges
  const dateRanges = useMemo(() => {
    const now = new Date();
    
    return {
      daily: {
        current: { start: startOfDay(now), end: endOfDay(now) },
        previous: { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) },
        label: 'Today',
        compareLabel: 'yesterday',
      },
      weekly: {
        current: { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) },
        previous: { start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }), end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }) },
        label: 'This Week',
        compareLabel: 'last week',
      },
      monthly: {
        current: { start: startOfMonth(now), end: endOfMonth(now) },
        previous: { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) },
        label: 'This Month',
        compareLabel: 'last month',
      },
    };
  }, []);

  // Helper to check if date is in range
  const isInRange = (dateStr: string, range: { start: Date; end: Date }) => {
    try {
      const date = parseISO(dateStr);
      return isWithinInterval(date, range);
    } catch {
      return false;
    }
  };

  // Calculate metrics for the selected period
  const metrics = useMemo(() => {
    const range = dateRanges[period];
    
    // Current period data
    const currentLeads = leads.filter(l => isInRange(l.created_at, range.current));
    const previousLeads = leads.filter(l => isInRange(l.created_at, range.previous));
    
    const currentTasks = tasks.filter(t => isInRange(t.created_at, range.current));
    const previousTasks = tasks.filter(t => isInRange(t.created_at, range.previous));
    
    const currentActivities = activities.filter(a => isInRange(a.created_at, range.current));
    const previousActivities = activities.filter(a => isInRange(a.created_at, range.previous));
    
    const currentColdCalls = coldCalls.filter(c => isInRange(c.created_at, range.current));
    const previousColdCalls = coldCalls.filter(c => isInRange(c.created_at, range.previous));
    
    const completedTasks = currentTasks.filter(t => t.status === 'completed');
    const previousCompletedTasks = previousTasks.filter(t => t.status === 'completed');
    
    const closedLeads = currentLeads.filter(l => l.status === 'closed');
    const previousClosedLeads = previousLeads.filter(l => l.status === 'closed');
    
    const convertedColdCalls = currentColdCalls.filter(c => c.status === 'converted');
    const previousConvertedColdCalls = previousColdCalls.filter(c => c.status === 'converted');

    // Calculate changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      newLeads: currentLeads.length,
      newLeadsChange: calculateChange(currentLeads.length, previousLeads.length),
      closedDeals: closedLeads.length,
      closedDealsChange: calculateChange(closedLeads.length, previousClosedLeads.length),
      tasksCompleted: completedTasks.length,
      tasksCompletedChange: calculateChange(completedTasks.length, previousCompletedTasks.length),
      totalTasks: currentTasks.length,
      activities: currentActivities.length,
      activitiesChange: calculateChange(currentActivities.length, previousActivities.length),
      coldCalls: currentColdCalls.length,
      coldCallsChange: calculateChange(currentColdCalls.length, previousColdCalls.length),
      conversions: convertedColdCalls.length,
      conversionsChange: calculateChange(convertedColdCalls.length, previousConvertedColdCalls.length),
      label: range.label,
      compareLabel: range.compareLabel,
    };
  }, [leads, tasks, activities, coldCalls, dateRanges, period]);

  // Lead source breakdown
  const leadsBySource = useMemo(() => {
    const range = dateRanges[period];
    const periodLeads = leads.filter(l => isInRange(l.created_at, range.current));
    
    const sourceCount: Record<string, number> = {};
    periodLeads.forEach(lead => {
      const source = lead.source || 'other';
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });

    const total = periodLeads.length || 1;
    return Object.entries(sourceCount)
      .map(([source, count]) => ({
        source: source.replace(/_/g, ' '),
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [leads, dateRanges, period]);

  // Activity breakdown by type
  const activityByType = useMemo(() => {
    const range = dateRanges[period];
    const periodActivities = activities.filter(a => isInRange(a.created_at, range.current));
    
    const typeCount: Record<string, number> = {};
    periodActivities.forEach(activity => {
      const type = activity.type || 'other';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    const total = periodActivities.length || 1;
    return Object.entries(typeCount)
      .map(([type, count]) => ({
        type: type.replace(/_/g, ' '),
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [activities, dateRanges, period]);

  // Pipeline status breakdown
  const pipelineStatus = useMemo(() => {
    const statusCount: Record<string, number> = {};
    leads.forEach(lead => {
      statusCount[lead.status] = (statusCount[lead.status] || 0) + 1;
    });

    const statusLabels: Record<string, string> = {
      new: 'New',
      contacted: 'Contacted',
      viewing: 'Viewing',
      viewed: 'Viewed',
      negotiation: 'Negotiation',
      closed: 'Closed',
      lost: 'Lost',
    };

    return Object.entries(statusCount).map(([status, count]) => ({
      status: statusLabels[status] || status,
      count,
    }));
  }, [leads]);

  if (isLoading) {
    return (
      <MainLayout>
        <PageHeader title="Reports" subtitle="Analytics and performance insights" />
        <PageContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Reports"
        subtitle="Analytics and performance insights"
        actions={
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        }
      />

      <PageContent>
        <div className="space-y-6">
          {/* Period Tabs */}
          <Tabs value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="daily" className="gap-2">
                <Calendar className="w-4 h-4" />
                Daily
              </TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2">
                <FileText className="w-4 h-4" />
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Monthly
              </TabsTrigger>
            </TabsList>

            <TabsContent value={period} className="mt-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    title: 'New Leads',
                    value: metrics.newLeads,
                    change: metrics.newLeadsChange,
                    icon: Users,
                    color: 'primary',
                  },
                  {
                    title: 'Closed Deals',
                    value: metrics.closedDeals,
                    change: metrics.closedDealsChange,
                    icon: Target,
                    color: 'success',
                  },
                  {
                    title: 'Tasks Completed',
                    value: `${metrics.tasksCompleted}/${metrics.totalTasks}`,
                    change: metrics.tasksCompletedChange,
                    icon: CheckCircle,
                    color: 'accent',
                  },
                  {
                    title: 'Activities Logged',
                    value: metrics.activities,
                    change: metrics.activitiesChange,
                    icon: Clock,
                    color: 'warning',
                  },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "bg-card rounded-xl p-6 shadow-card metric-card",
                      `metric-card-${stat.color}`
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                        <p className="text-2xl font-bold text-foreground mt-2">{stat.value}</p>
                        <div className={cn(
                          "flex items-center gap-1 mt-2 text-sm",
                          stat.change >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {stat.change >= 0 ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          <span>{stat.change >= 0 ? '+' : ''}{stat.change}% vs {metrics.compareLabel}</span>
                        </div>
                      </div>
                      <div className={cn(
                        "p-3 rounded-xl",
                        stat.color === 'primary' && "bg-pastel-blue",
                        stat.color === 'accent' && "bg-pastel-orange",
                        stat.color === 'success' && "bg-pastel-green",
                        stat.color === 'warning' && "bg-pastel-orange",
                      )}>
                        <stat.icon className={cn(
                          "w-6 h-6",
                          stat.color === 'primary' && "text-primary",
                          stat.color === 'accent' && "text-accent",
                          stat.color === 'success' && "text-success",
                          stat.color === 'warning' && "text-warning",
                        )} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Cold Calls & Conversions Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-card rounded-xl p-6 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-pastel-blue">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cold Calls Made</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-foreground">{metrics.coldCalls}</p>
                        <span className={cn(
                          "text-sm",
                          metrics.coldCallsChange >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {metrics.coldCallsChange >= 0 ? '+' : ''}{metrics.coldCallsChange}%
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-card rounded-xl p-6 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-pastel-green">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cold Call Conversions</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-foreground">{metrics.conversions}</p>
                        <span className={cn(
                          "text-sm",
                          metrics.conversionsChange >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {metrics.conversionsChange >= 0 ? '+' : ''}{metrics.conversionsChange}%
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Lead Sources */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-card rounded-xl p-6 shadow-card"
                >
                  <div className="flex items-center gap-2 mb-6">
                    <PieChart className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Lead Sources ({metrics.label})</h3>
                  </div>
                  {leadsBySource.length > 0 ? (
                    <div className="space-y-4">
                      {leadsBySource.map((source, index) => (
                        <div key={source.source}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground capitalize">{source.source}</span>
                            <span className="text-sm text-muted-foreground">{source.count} leads</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${source.percentage}%` }}
                              transition={{ duration: 0.8, delay: 0.7 + index * 0.1 }}
                              className="h-full bg-gradient-primary rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No leads in this period</p>
                  )}
                </motion.div>

                {/* Activity Breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-card rounded-xl p-6 shadow-card"
                >
                  <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Activity Breakdown ({metrics.label})</h3>
                  </div>
                  {activityByType.length > 0 ? (
                    <div className="space-y-4">
                      {activityByType.map((activity, index) => (
                        <div key={activity.type}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground capitalize">{activity.type}</span>
                            <span className="text-sm text-muted-foreground">{activity.count} activities</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${activity.percentage}%` }}
                              transition={{ duration: 0.8, delay: 0.8 + index * 0.1 }}
                              className="h-full bg-gradient-success rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No activities in this period</p>
                  )}
                </motion.div>
              </div>

              {/* Pipeline Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-gradient-hero text-white rounded-xl p-6 shadow-card"
              >
                <h3 className="text-lg font-semibold mb-4">Pipeline Overview</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                  {pipelineStatus.map((item) => (
                    <div key={item.status} className="text-center">
                      <p className="text-3xl font-bold">{item.count}</p>
                      <p className="text-white/70 text-sm">{item.status}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Properties Summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-card rounded-xl p-6 shadow-card mt-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Properties Summary</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">{properties.length}</p>
                    <p className="text-sm text-muted-foreground">Total Properties</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-success">{properties.filter(p => p.status === 'available').length}</p>
                    <p className="text-sm text-muted-foreground">Available</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-warning">{properties.filter(p => p.status === 'under_offer').length}</p>
                    <p className="text-sm text-muted-foreground">Under Offer</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{properties.filter(p => p.status === 'sold' || p.status === 'rented').length}</p>
                    <p className="text-sm text-muted-foreground">Sold/Rented</p>
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </PageContent>
    </MainLayout>
  );
}
