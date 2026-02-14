import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCalls } from '@/hooks/useCalls';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { Phone, TrendingUp, Clock, Brain, Target, Award } from 'lucide-react';
import { format, subDays, startOfDay, isAfter } from 'date-fns';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--destructive))', 'hsl(var(--warning))'];

export function CallAnalyticsDashboard() {
  const { data: calls = [] } = useCalls();

  const stats = useMemo(() => {
    const total = calls.length;
    const answered = calls.filter((c) => ['completed', 'answered'].includes(c.status)).length;
    const missed = calls.filter((c) => c.status === 'missed').length;
    const avgDuration = total > 0
      ? Math.round(calls.reduce((s, c) => s + (c.duration_seconds || 0), 0) / total)
      : 0;
    const scored = calls.filter((c) => c.ai_overall_score != null);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, c) => s + (c.ai_overall_score || 0), 0) / scored.length)
      : 0;
    const answerRate = total > 0 ? Math.round((answered / total) * 100) : 0;

    return { total, answered, missed, avgDuration, avgScore, answerRate };
  }, [calls]);

  // Daily call volume (last 14 days)
  const dailyData = useMemo(() => {
    const days: { date: string; outbound: number; inbound: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const dayStr = format(day, 'MMM d');
      const nextDay = startOfDay(subDays(new Date(), i - 1));
      const dayCalls = calls.filter((c) => {
        const d = new Date(c.call_date);
        return d >= day && d < nextDay;
      });
      days.push({
        date: dayStr,
        outbound: dayCalls.filter((c) => c.direction === 'outbound').length,
        inbound: dayCalls.filter((c) => c.direction === 'inbound').length,
      });
    }
    return days;
  }, [calls]);

  // Status distribution
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    calls.forEach((c) => {
      map[c.status] = (map[c.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [calls]);

  // Score distribution
  const scoreData = useMemo(() => {
    const buckets = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '21-40', min: 21, max: 40, count: 0 },
      { range: '41-60', min: 41, max: 60, count: 0 },
      { range: '61-80', min: 61, max: 80, count: 0 },
      { range: '81-100', min: 81, max: 100, count: 0 },
    ];
    calls.forEach((c) => {
      if (c.ai_overall_score != null) {
        const bucket = buckets.find((b) => c.ai_overall_score! >= b.min && c.ai_overall_score! <= b.max);
        if (bucket) bucket.count++;
      }
    });
    return buckets.map(({ range, count }) => ({ range, count }));
  }, [calls]);

  // AI score trend (last 14 days)
  const scoreTrend = useMemo(() => {
    const days: { date: string; avgScore: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const nextDay = startOfDay(subDays(new Date(), i - 1));
      const dayCalls = calls.filter((c) => {
        const d = new Date(c.call_date);
        return d >= day && d < nextDay && c.ai_overall_score != null;
      });
      const avg = dayCalls.length > 0
        ? Math.round(dayCalls.reduce((s, c) => s + (c.ai_overall_score || 0), 0) / dayCalls.length)
        : 0;
      days.push({ date: format(day, 'MMM d'), avgScore: avg });
    }
    return days;
  }, [calls]);

  const kpiCards = [
    { icon: Phone, label: 'Total Calls', value: stats.total, color: 'text-primary' },
    { icon: Target, label: 'Answer Rate', value: `${stats.answerRate}%`, color: 'text-green-500' },
    { icon: Clock, label: 'Avg Duration', value: `${Math.floor(stats.avgDuration / 60)}m ${stats.avgDuration % 60}s`, color: 'text-blue-500' },
    { icon: Brain, label: 'Avg AI Score', value: stats.avgScore || '–', color: 'text-purple-500' },
    { icon: TrendingUp, label: 'Answered', value: stats.answered, color: 'text-green-500' },
    { icon: Award, label: 'Missed', value: stats.missed, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Call Volume */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Call Volume (14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="outbound" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inbound" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Call Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* AI Score Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AI Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AI Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
