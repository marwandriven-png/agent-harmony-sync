import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, MapPin, Calendar, DollarSign, TrendingUp,
  Loader2, MoreHorizontal, Pencil, Trash2, Layers, BarChart3
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useProjects, useDeleteProject, type Project } from '@/hooks/useProjects';
import { CreateProjectDialog } from './CreateProjectDialog';

const statusConfig: Record<string, { label: string; className: string }> = {
  planning: { label: 'Planning', className: 'bg-muted text-muted-foreground' },
  active: { label: 'Active', className: 'bg-foreground text-background' },
  on_hold: { label: 'On Hold', className: 'bg-muted text-muted-foreground border border-border' },
  completed: { label: 'Completed', className: 'bg-foreground/80 text-background' },
};

function formatCurrency(amount: number) {
  if (amount >= 1_000_000_000) return `AED ${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `AED ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `AED ${(amount / 1_000).toFixed(0)}K`;
  return `AED ${amount.toLocaleString()}`;
}

export function ProjectsTab() {
  const { data: projects = [], isLoading } = useProjects();
  const deleteProject = useDeleteProject();
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + (p.spent || 0), 0);
  const totalPlots = projects.reduce((s, p) => s + (p.total_plots || 0), 0);
  const totalSold = projects.reduce((s, p) => s + (p.sold_plots || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-foreground text-background">
          <CardContent className="p-4">
            <p className="text-sm text-background/70">Projects</p>
            <p className="text-2xl font-bold">{projects.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-foreground text-background">
          <CardContent className="p-4">
            <p className="text-sm text-background/70">Total Budget</p>
            <p className="text-xl font-bold">{formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card className="bg-foreground text-background">
          <CardContent className="p-4">
            <p className="text-sm text-background/70">Total Plots</p>
            <p className="text-2xl font-bold">{totalPlots}</p>
          </CardContent>
        </Card>
        <Card className="bg-foreground text-background">
          <CardContent className="p-4">
            <p className="text-sm text-background/70">Plots Sold</p>
            <p className="text-2xl font-bold">{totalSold}</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Cards */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">Create your first project to organize plots.</p>
            <CreateProjectDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project, i) => {
            const budgetUtilization = project.budget > 0
              ? Math.min(100, Math.round((project.spent / project.budget) * 100))
              : 0;
            const sc = statusConfig[project.status] || statusConfig.planning;

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                        {project.location && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">{project.location}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={sc.className}>{sc.label}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(project)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                    )}

                    {/* Completion */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-medium">{project.completion_percentage}%</span>
                      </div>
                      <Progress value={project.completion_percentage} className="h-2" />
                    </div>

                    {/* Budget */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          Budget
                        </span>
                        <span className="font-medium">{budgetUtilization}% used</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(project.spent)} spent</span>
                        <span>of {formatCurrency(project.budget)}</span>
                      </div>
                      <Progress value={budgetUtilization} className="h-1.5" />
                    </div>

                    {/* Footer Stats */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{project.total_plots || 0}</span>
                        <span className="text-muted-foreground">plots</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{project.sold_plots || 0}</span>
                        <span className="text-muted-foreground">sold</span>
                      </div>
                      {project.end_date && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(project.end_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? Plots assigned to this project won't be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteTarget) {
                  await deleteProject.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
