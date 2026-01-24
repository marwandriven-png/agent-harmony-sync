import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeadById } from '@/hooks/useLeads';
import { 
  usePropertyMatchesByLead, 
  useGenerateMatches,
  useUpdateMatchStatus,
  useToggleMatchFlag,
  useAddMatchNote
} from '@/hooks/usePropertyMatches';
import { PropertyMatchCard } from '@/components/matching/PropertyMatchCard';
import { LeadRequirementsCard } from '@/components/matching/LeadRequirementsCard';
import { MatchingStats } from '@/components/matching/MatchingStats';
import { 
  ArrowLeft, 
  RefreshCw, 
  Loader2, 
  Sparkles,
  Home,
  ExternalLink,
  Star,
  Filter
} from 'lucide-react';

type TabValue = 'all' | 'internal' | 'external' | 'starred';

export default function BuyerMatchingPage() {
  const { id: leadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>('all');

  // Data hooks
  const { data: lead, isLoading: leadLoading } = useLeadById(leadId || '');
  const { data: matches = [], isLoading: matchesLoading } = usePropertyMatchesByLead(leadId || '');
  
  // Mutation hooks
  const generateMatches = useGenerateMatches();
  const updateStatus = useUpdateMatchStatus();
  const toggleFlag = useToggleMatchFlag();
  const addNote = useAddMatchNote();

  // Filter matches based on tab
  const filteredMatches = useMemo(() => {
    switch (activeTab) {
      case 'internal':
        return matches.filter(m => m.match_type === 'internal');
      case 'external':
        return matches.filter(m => m.match_type === 'external');
      case 'starred':
        return matches.filter(m => m.is_flagged);
      default:
        return matches;
    }
  }, [matches, activeTab]);

  const internalCount = matches.filter(m => m.match_type === 'internal').length;
  const externalCount = matches.filter(m => m.match_type === 'external').length;
  const starredCount = matches.filter(m => m.is_flagged).length;

  const handleGenerateMatches = () => {
    if (leadId) {
      generateMatches.mutate(leadId);
    }
  };

  if (leadLoading) {
    return (
      <MainLayout>
        <PageContent>
          <div className="space-y-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-80 w-full" />
              ))}
            </div>
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  if (!lead) {
    return (
      <MainLayout>
        <PageContent>
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <h2 className="text-2xl font-semibold text-foreground mb-2">Lead not found</h2>
            <p className="text-muted-foreground mb-4">The lead you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/leads')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leads
            </Button>
          </div>
        </PageContent>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title=""
        actions={
          <Button
            onClick={handleGenerateMatches}
            disabled={generateMatches.isPending}
            className="bg-gradient-to-r from-primary to-primary/80"
          >
            {generateMatches.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Find Matches
          </Button>
        }
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/leads/${leadId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Property Matching</h1>
            <p className="text-muted-foreground">
              AI-powered property recommendations for {lead.name}
            </p>
          </div>
        </div>
      </PageHeader>

      <PageContent>
        <div className="space-y-6">
          {/* Lead Requirements Card */}
          <LeadRequirementsCard lead={lead} />

          {/* Processing State */}
          <AnimatePresence>
            {generateMatches.isPending && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Finding Property Matches</h3>
                    <p className="text-sm text-muted-foreground">
                      Analyzing properties against lead requirements...
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Cards */}
          {matches.length > 0 && <MatchingStats matches={matches} />}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
            <TabsList className="grid w-full max-w-lg grid-cols-4">
              <TabsTrigger value="all" className="gap-2">
                <Filter className="w-4 h-4" />
                All ({matches.length})
              </TabsTrigger>
              <TabsTrigger value="internal" className="gap-2">
                <Home className="w-4 h-4" />
                Internal ({internalCount})
              </TabsTrigger>
              <TabsTrigger value="external" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                External ({externalCount})
              </TabsTrigger>
              <TabsTrigger value="starred" className="gap-2">
                <Star className="w-4 h-4" />
                Starred ({starredCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Property Matches Grid */}
          {matchesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-96 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Home className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {matches.length === 0 ? 'No matches yet' : 'No matches in this category'}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {matches.length === 0 
                  ? 'Click "Find Matches" to analyze properties against this lead\'s requirements.'
                  : 'Try selecting a different filter or generate more matches.'
                }
              </p>
              {matches.length === 0 && (
                <Button onClick={handleGenerateMatches} disabled={generateMatches.isPending}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Find Matches
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMatches.map((match) => (
                <PropertyMatchCard
                  key={match.id}
                  match={match}
                  onMarkSent={async () => {
                    await updateStatus.mutateAsync({
                      matchId: match.id,
                      status: 'sent',
                      leadId: leadId!,
                    });
                  }}
                  onToggleFlag={async () => {
                    await toggleFlag.mutateAsync({
                      matchId: match.id,
                      isFlagged: !match.is_flagged,
                      leadId: leadId!,
                    });
                  }}
                  onAddNote={async (note) => {
                    await addNote.mutateAsync({
                      matchId: match.id,
                      note,
                      leadId: leadId!,
                    });
                  }}
                  onDismiss={async () => {
                    await updateStatus.mutateAsync({
                      matchId: match.id,
                      status: 'dismissed',
                      leadId: leadId!,
                    });
                  }}
                  onConvert={match.match_type === 'external' ? async () => {
                    await updateStatus.mutateAsync({
                      matchId: match.id,
                      status: 'converted',
                      leadId: leadId!,
                    });
                  } : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </PageContent>
    </MainLayout>
  );
}
