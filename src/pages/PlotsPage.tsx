import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Plus, Search, Filter, RefreshCw, Brain,
  Building, TrendingUp, DollarSign, Users, Loader2,
  Map, BarChart3, Target, Layers, X
} from 'lucide-react';
import { LandMatchingWizard } from '@/components/plots/LandMatchingWizard';
import { PlotData } from '@/services/DDAGISService';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PlotTable } from '@/components/plots/PlotTable';
import { PlotFeasibilityCard } from '@/components/plots/PlotFeasibilityCard';
import { CreatePlotDialog } from '@/components/plots/CreatePlotDialog';
import { PlotOffersDialog, PlotInterestedDialog } from '@/components/plots/PlotDialogs';
import {
  usePlots,
  useDeletePlot,
  useRunFeasibility,
  usePlotFeasibility,
  type Plot
} from '@/hooks/usePlots';
import { DecisionConfidence } from '@/components/plots/DecisionConfidence';
import { cn } from '@/lib/utils';

export default function PlotsPage() {
  // Data fetching
  const { data: plots = [], isLoading, refetch } = usePlots();
  const deletePlot = useDeletePlot();
  const runFeasibility = useRunFeasibility();

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoningFilter, setZoningFilter] = useState<string>('all');

  // Dialog State
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [offersDialogOpen, setOffersDialogOpen] = useState(false);
  const [interestedDialogOpen, setInterestedDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [feasibilityPlot, setFeasibilityPlot] = useState<Plot | null>(null);
  const [runningPlotId, setRunningPlotId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reportPlot, setReportPlot] = useState<Plot | null>(null);
  const [activeAnalysisPlot, setActiveAnalysisPlot] = useState<Plot | null>(null);

  // Feasibility data for selected plot
  const { data: feasibilityReports = [] } = usePlotFeasibility(feasibilityPlot?.id);

  // Filters
  const filteredPlots = plots.filter((plot) => {
    const matchesSearch =
      plot.plot_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plot.area_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (plot.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === 'all' || plot.status === statusFilter;
    const matchesZoning = zoningFilter === 'all' || plot.zoning === zoningFilter;

    return matchesSearch && matchesStatus && matchesZoning;
  });

  // Stats
  const stats = {
    total: plots.length,
    available: plots.filter(p => p.status === 'available').length,
    underNegotiation: plots.filter(p => p.status === 'under_negotiation').length,
    sold: plots.filter(p => p.status === 'sold').length,
    totalValue: plots.reduce((sum, p) => sum + (p.price || 0), 0),
  };

  // Handlers
  const handleEdit = (plot: Plot) => {
    // TODO: Open edit dialog
    console.log('Edit plot:', plot);
  };

  const handleDelete = (plot: Plot) => {
    setSelectedPlot(plot);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedPlot) {
      await deletePlot.mutateAsync(selectedPlot.id);
      setDeleteDialogOpen(false);
      setSelectedPlot(null);
    }
  };

  const handleViewOffers = (plot: Plot) => {
    setSelectedPlot(plot);
    setOffersDialogOpen(true);
  };

  const handleViewInterested = (plot: Plot) => {
    setSelectedPlot(plot);
    setInterestedDialogOpen(true);
  };

  const handleRunFeasibility = async (plot: Plot) => {
    setRunningPlotId(plot.id);
    setFeasibilityPlot(plot);
    try {
      await runFeasibility.mutateAsync(plot);
    } finally {
      setRunningPlotId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000000) return `AED ${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `AED ${(amount / 1000000).toFixed(1)}M`;
    return `AED ${amount.toLocaleString()}`;
  };

  const handleViewDecisionConfidence = (plot: Plot) => {
    setActiveAnalysisPlot(plot);
    // Scroll to analysis section if needed
    const analysisSection = document.getElementById('ai-analysis-section');
    if (analysisSection) {
      analysisSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Map className="h-6 w-6 text-primary" />
              Plot Intelligence
            </h1>
            <p className="text-muted-foreground">
              Manage land plots with AI-powered feasibility analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="secondary"
              className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
              onClick={() => setWizardOpen(true)}
            >
              <Target className="h-4 w-4 mr-2" />
              Matching Wizard
            </Button>
            <CreatePlotDialog />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-foreground text-background">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-background/70">Total Plots</p>
                    <p className="text-2xl font-bold text-background">{stats.total}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-background/20 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-background" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="bg-foreground text-background">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-background/70">Available</p>
                    <p className="text-2xl font-bold text-background">{stats.available}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-background/20 flex items-center justify-center">
                    <Building className="h-5 w-5 text-background" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-foreground text-background">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-background/70">Negotiation</p>
                    <p className="text-2xl font-bold text-background">{stats.underNegotiation}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-background/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-background" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="bg-foreground text-background">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-background/70">Sold</p>
                    <p className="text-2xl font-bold text-background">{stats.sold}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-background/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-background" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-foreground text-background">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-background/70">Total Value</p>
                    <p className="text-xl font-bold text-background">{formatCurrency(stats.totalValue)}</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-background/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-background" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plots by number, area, or owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="under_negotiation">Under Negotiation</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
              <Select value={zoningFilter} onValueChange={setZoningFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Zoning" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zoning</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="mixed">Mixed Use</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="flex flex-col gap-6">
          {/* Plot Table */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  <span>Plots ({filteredPlots.length})</span>
                </div>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredPlots.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground">No plots found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || statusFilter !== 'all' || zoningFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Add your first plot to get started'}
                  </p>
                  <CreatePlotDialog
                    trigger={
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Plot
                      </Button>
                    }
                  />
                </div>
              ) : (
                <PlotTable
                  plots={filteredPlots}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onViewOffers={handleViewOffers}
                  onViewInterested={handleViewInterested}
                  onRunFeasibility={handleRunFeasibility}
                  onViewDecisionConfidence={handleViewDecisionConfidence}
                  isRunningFeasibility={runFeasibility.isPending}
                  runningPlotId={runningPlotId}
                />
              )}
            </CardContent>
          </Card>

          {/* AI Analysis Section (Full Width) */}
          <div id="ai-analysis-section" className="scroll-mt-6">
            <Card className={cn(
              "transition-all duration-300 border-none shadow-lg overflow-hidden",
              activeAnalysisPlot ? "ring-2 ring-primary/20" : "opacity-90"
            )}>
              <CardHeader className="pb-0 border-b bg-muted/20">
                <div className="flex items-center justify-between py-2">
                  <CardTitle className="flex items-center gap-2 text-xl font-bold">
                    <Brain className="h-6 w-6 text-primary" />
                    Plot Intelligence & AI Feasibility
                  </CardTitle>
                  {activeAnalysisPlot && (
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                        Analyzing: {activeAnalysisPlot.plot_number}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveAnalysisPlot(null)}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Clear Analysis
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 min-h-[400px]">
                {activeAnalysisPlot ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <DecisionConfidence
                      plot={{
                        id: activeAnalysisPlot.plot_number,
                        area: activeAnalysisPlot.plot_size || 0,
                        gfa: activeAnalysisPlot.gfa || 0,
                        zoning: activeAnalysisPlot.zoning,
                        status: activeAnalysisPlot.status,
                        location: activeAnalysisPlot.area_name,
                        project: activeAnalysisPlot.master_plan,
                        floors: activeAnalysisPlot.floors_allowed
                      } as any}
                      isFullscreen={false}
                      onToggleFullscreen={() => { }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center px-4 bg-muted/5">
                    <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
                      <Brain className="h-10 w-10 text-primary/40" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">Ready for Analysis</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mb-8">
                      Select any plot from the table and click the AI button to generate a detailed
                      Decision Confidence report with financial feasibility, ROI, and risk analysis.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl text-left">
                      <div className="p-4 rounded-xl border bg-background/50">
                        <DollarSign className="h-5 w-5 text-green-500 mb-2" />
                        <h4 className="font-medium text-sm mb-1">Financial KPIs</h4>
                        <p className="text-xs text-muted-foreground">Detailed ROI, profit margins, and peak investment requirements.</p>
                      </div>
                      <div className="p-4 rounded-xl border bg-background/50">
                        <TrendingUp className="h-5 w-5 text-blue-500 mb-2" />
                        <h4 className="font-medium text-sm mb-1">Market Strategy</h4>
                        <p className="text-xs text-muted-foreground">Compare Balanced, Premium, and Investor unit mix strategies.</p>
                      </div>
                      <div className="p-4 rounded-xl border bg-background/50">
                        <Target className="h-5 w-5 text-purple-500 mb-2" />
                        <h4 className="font-medium text-sm mb-1">Risk Assessment</h4>
                        <p className="text-xs text-muted-foreground">AI-driven SWOT analysis and mitigation strategies for every plot.</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <PlotOffersDialog
        plot={selectedPlot}
        open={offersDialogOpen}
        onOpenChange={setOffersDialogOpen}
      />

      <PlotInterestedDialog
        plot={selectedPlot}
        open={interestedDialogOpen}
        onOpenChange={setInterestedDialogOpen}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plot?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete plot "{selectedPlot?.plot_number}"?
              This will also remove all offers and interested buyers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlot.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Land Matching Wizard */}
      <LandMatchingWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        plots={plots.map(p => ({
          id: p.plot_number,
          area: p.area_sqft ? p.area_sqft / 10.7639 : 0,
          gfa: p.gfa_sqft ? p.gfa_sqft / 10.7639 : 0,
          zoning: p.zoning,
          status: p.status,
          location: p.area_name
        }))}
        onHighlightPlots={(ids) => {
          console.log('Highlighting plots:', ids);
          setSearchQuery(ids.join(', '));
        }}
        onSelectPlot={(plot) => {
          console.log('Selected plot from wizard:', plot);
          setWizardOpen(false);
          // Auto-fill search with the plot number
          setSearchQuery(plot.id);
        }}
      />
      {/* Decision Confidence Report Dialog */}
      <AlertDialog open={!!reportPlot} onOpenChange={() => setReportPlot(null)}>
        <AlertDialogContent className="max-w-7xl h-[90vh] p-0 overflow-hidden border-none bg-background">
          {reportPlot && (
            <div className="h-full flex flex-col relative">
              <button
                onClick={() => setReportPlot(null)}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-background/80 hover:bg-background border shadow-sm transition-colors"
              >
                <Plus className="h-5 w-5 rotate-45" />
              </button>
              <DecisionConfidence
                plot={{
                  id: reportPlot.plot_number,
                  area: reportPlot.area_sqft ? reportPlot.area_sqft / 10.7639 : 0,
                  gfa: reportPlot.gfa_sqft ? reportPlot.gfa_sqft / 10.7639 : 0,
                  zoning: reportPlot.zoning,
                  status: reportPlot.status,
                  location: reportPlot.area_name,
                  project: reportPlot.master_plan,
                  floors: reportPlot.floors_allowed
                } as any}
                isFullscreen={true}
                onToggleFullscreen={() => { }}
              />
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
// Force sync update: Wed Mar  4 02:02:27 PST 2026
