import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useCRMStore } from '@/store/crmStore';
import { formatCurrency, formatCompactNumber } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  UserPlus, 
  Phone, 
  Eye, 
  CheckCircle, 
  TrendingUp, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Calendar,
  Target,
  DollarSign,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { AgentPerformance } from '@/components/dashboard/AgentPerformance';
import { UpcomingTasks } from '@/components/dashboard/UpcomingTasks';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { getMetrics, leads } = useCRMStore();
  const metrics = getMetrics();
  const navigate = useNavigate();

  const metricCards = [
    {
      title: 'New Leads Today',
      value: metrics.newLeadsToday,
      icon: UserPlus,
      trend: '+12%',
      trendUp: true,
      color: 'primary',
      onClick: () => navigate('/leads'),
    },
    {
      title: 'Follow-ups Due',
      value: metrics.followUpsDue,
      icon: Clock,
      trend: '5 overdue',
      trendUp: false,
      color: 'accent',
      onClick: () => navigate('/tasks'),
    },
    {
      title: 'Viewings Today',
      value: metrics.viewingsToday,
      icon: Eye,
      trend: '+2 scheduled',
      trendUp: true,
      color: 'success',
      onClick: () => navigate('/calendar'),
    },
    {
      title: 'Closed This Month',
      value: metrics.closedDealsMonth,
      icon: CheckCircle,
      trend: formatCurrency(metrics.totalRevenue),
      trendUp: true,
      color: 'success',
      onClick: () => navigate('/leads'),
    },
  ];

  return (
    <MainLayout>
      <PageHeader 
        title="Dashboard" 
        subtitle={`Welcome back, ${useCRMStore.getState().currentAgent.name.split(' ')[0]}!`}
        actions={
          <Button onClick={() => navigate('/leads')} className="bg-gradient-primary hover:opacity-90">
            <UserPlus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        }
      />
      
      <PageContent>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metricCards.map((card, index) => (
              <motion.div
                key={card.title}
                variants={itemVariants}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={card.onClick}
                className={cn(
                  "metric-card cursor-pointer transition-shadow hover:shadow-card-hover",
                  `metric-card-${card.color}`
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{card.value}</p>
                    <div className={cn(
                      "flex items-center gap-1 mt-2 text-sm",
                      card.trendUp ? "text-success" : "text-accent"
                    )}>
                      {card.trendUp ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span>{card.trend}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-foreground">
                    <card.icon className="w-6 h-6 text-background" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pipeline Funnel */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <PipelineFunnel />
            </motion.div>

            {/* Upcoming Tasks */}
            <motion.div variants={itemVariants}>
              <UpcomingTasks />
            </motion.div>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activities */}
            <motion.div variants={itemVariants}>
              <RecentActivities />
            </motion.div>

            {/* Agent Performance */}
            <motion.div variants={itemVariants}>
              <AgentPerformance />
            </motion.div>
          </div>
        </motion.div>
      </PageContent>
    </MainLayout>
  );
}
