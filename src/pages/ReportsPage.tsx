import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useCRMStore } from '@/store/crmStore';
import { formatCurrency, formatCompactNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
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
} from 'lucide-react';

export default function ReportsPage() {
  const { leads, agents, getMetrics } = useCRMStore();
  const metrics = getMetrics();

  const monthlyStats = {
    revenue: 4200000,
    leads: 45,
    conversions: 8,
    avgDealSize: 525000,
  };

  const leadsBySource = [
    { source: 'Website', count: 18, percentage: 40 },
    { source: 'Referral', count: 12, percentage: 27 },
    { source: 'Property Portal', count: 9, percentage: 20 },
    { source: 'Social Media', count: 4, percentage: 9 },
    { source: 'Other', count: 2, percentage: 4 },
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Reports"
        subtitle="Analytics and performance insights"
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>This Month</span>
          </div>
        }
      />

      <PageContent>
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Total Revenue',
                value: formatCurrency(monthlyStats.revenue),
                change: '+18%',
                isPositive: true,
                icon: DollarSign,
                color: 'primary',
              },
              {
                title: 'New Leads',
                value: monthlyStats.leads,
                change: '+12%',
                isPositive: true,
                icon: Users,
                color: 'accent',
              },
              {
                title: 'Conversion Rate',
                value: `${metrics.conversionRate}%`,
                change: '+3.2%',
                isPositive: true,
                icon: Target,
                color: 'success',
              },
              {
                title: 'Avg Deal Size',
                value: formatCurrency(monthlyStats.avgDealSize),
                change: '-2%',
                isPositive: false,
                icon: BarChart3,
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
                      stat.isPositive ? "text-success" : "text-destructive"
                    )}>
                      {stat.isPositive ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span>{stat.change} vs last month</span>
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

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lead Sources */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-card rounded-xl p-6 shadow-card"
            >
              <div className="flex items-center gap-2 mb-6">
                <PieChart className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Lead Sources</h3>
              </div>
              <div className="space-y-4">
                {leadsBySource.map((source, index) => (
                  <div key={source.source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{source.source}</span>
                      <span className="text-sm text-muted-foreground">{source.count} leads</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${source.percentage}%` }}
                        transition={{ duration: 0.8, delay: 0.5 + index * 0.1 }}
                        className="h-full bg-gradient-primary rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Top Agents */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-card rounded-xl p-6 shadow-card"
            >
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Agent Rankings</h3>
              </div>
              <div className="space-y-4">
                {agents.sort((a, b) => b.revenue - a.revenue).map((agent, index) => (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
                      index === 0 && "bg-warning text-warning-foreground",
                      index === 1 && "bg-muted-foreground/30 text-foreground",
                      index === 2 && "bg-accent/30 text-accent",
                      index > 2 && "bg-muted text-muted-foreground"
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{agent.name}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{agent.leadsCount} leads</span>
                        <span>{agent.closedDeals} deals</span>
                      </div>
                    </div>
                    <p className="font-bold text-foreground">
                      {formatCurrency(agent.revenue)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Summary Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-hero text-white rounded-xl p-6 shadow-card"
          >
            <h3 className="text-lg font-semibold mb-4">Monthly Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-white/70 text-sm">Total Closed</p>
                <p className="text-3xl font-bold">{monthlyStats.conversions}</p>
              </div>
              <div>
                <p className="text-white/70 text-sm">Pipeline Value</p>
                <p className="text-3xl font-bold">{formatCompactNumber(12500000)}</p>
              </div>
              <div>
                <p className="text-white/70 text-sm">Active Leads</p>
                <p className="text-3xl font-bold">{leads.filter(l => l.status !== 'closed' && l.status !== 'lost').length}</p>
              </div>
              <div>
                <p className="text-white/70 text-sm">Follow-ups Made</p>
                <p className="text-3xl font-bold">127</p>
              </div>
            </div>
          </motion.div>
        </div>
      </PageContent>
    </MainLayout>
  );
}
