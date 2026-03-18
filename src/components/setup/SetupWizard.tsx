import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useWizardProgress } from '@/hooks/useSetupWizard';
import { DataSourceStep } from './steps/DataSourceStep';
import { ApiKeysStep } from './steps/ApiKeysStep';
import { PropertySourcesStep } from './steps/PropertySourcesStep';
import { ReviewStep } from './steps/ReviewStep';
import {
  Database,
  Key,
  Building2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Data Sources', description: 'Connect your data', icon: Database },
  { id: 2, title: 'API Keys', description: 'Configure integrations', icon: Key },
  { id: 3, title: 'Properties', description: 'Property listings', icon: Building2 },
  { id: 4, title: 'Review', description: 'Finish setup', icon: CheckCircle },
];

interface SetupWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function SetupWizard({ onComplete, onSkip }: SetupWizardProps) {
  const navigate = useNavigate();
  const { progress, isLoading, createProgress, updateProgress } = useWizardProgress();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    if (!isLoading && !progress) {
      createProgress.mutate();
    } else if (progress) {
      setCurrentStep(progress.current_step);
      setCompletedSteps(progress.completed_steps);
    }
  }, [progress, isLoading]);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      const newCompleted = [...new Set([...completedSteps, currentStep])];
      setCompletedSteps(newCompleted);
      setCurrentStep(currentStep + 1);
      
      updateProgress.mutate({
        current_step: currentStep + 1,
        completed_steps: newCompleted,
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      updateProgress.mutate({ current_step: currentStep - 1 });
    }
  };

  const handleComplete = () => {
    updateProgress.mutate({
      is_complete: true,
      completed_steps: [...completedSteps, 4],
    });
    toast.success('Setup complete! Your CRM is ready to use.');
    onComplete?.();
    navigate('/');
  };

  const handleSkip = () => {
    onSkip?.();
    navigate('/');
  };

  const progressPercent = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">CRM Setup Wizard</h1>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            <X className="w-4 h-4 mr-2" />
            Skip Setup
          </Button>
        </div>
        <Progress value={progressPercent} className="h-1" />
      </header>

      {/* Steps Indicator */}
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center gap-4 mb-8">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = completedSteps.includes(step.id);

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => {
                    if (isCompleted || step.id <= currentStep) {
                      setCurrentStep(step.id);
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-full transition-all',
                    isActive && 'bg-primary text-primary-foreground',
                    isCompleted && !isActive && 'bg-primary/20 text-primary',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                    (isCompleted || step.id <= currentStep) && 'cursor-pointer hover:opacity-80'
                  )}
                >
                  <StepIcon className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={cn(
                    'w-8 h-0.5 mx-2',
                    completedSteps.includes(step.id) ? 'bg-primary' : 'bg-muted'
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-4xl mx-auto"
          >
            {currentStep === 1 && <DataSourceStep />}
            {currentStep === 2 && <ApiKeysStep />}
            {currentStep === 3 && <PropertySourcesStep />}
            {currentStep === 4 && <ReviewStep />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <footer className="mt-auto border-t bg-card/50 backdrop-blur-sm sticky bottom-0">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete} className="bg-gradient-primary">
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Setup
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
