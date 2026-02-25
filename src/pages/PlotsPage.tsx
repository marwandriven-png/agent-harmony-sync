import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, Plus, Search, Filter, RefreshCw, Brain,
  Building, TrendingUp, DollarSign, Users, Loader2,
  Map, BarChart3
} from 'lucide-react';
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plot Table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span>Plots ({filteredPlots.length})</span>
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
                    isRunningFeasibility={runFeasibility.isPending}
                    runningPlotId={runningPlotId}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Feasibility Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI Feasibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feasibilityPlot ? (
                  feasibilityReports.length > 0 ? (
                    <PlotFeasibilityCard feasibility={feasibilityReports[0]} />
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">
                        Click the brain icon on any plot to run AI feasibility analysis
                      </p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      Select a plot and click the AI button to analyze development potential
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Click on a row to expand details</p>
                <p>• Use 🧠 to run AI feasibility analysis</p>
                <p>• 💰 to view/add offers</p>
                <p>• 👥 to track interested buyers (linked to leads)</p>
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
    </MainLayout>
  );
}
