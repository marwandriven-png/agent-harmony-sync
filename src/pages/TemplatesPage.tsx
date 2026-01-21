import { useState } from 'react';
import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Plus,
  Clock,
  MessageSquare,
  Edit,
  Copy,
  Trash2,
  CheckCircle,
} from 'lucide-react';

interface FollowUpTemplate {
  id: string;
  day: number;
  title: string;
  content: string;
  isActive: boolean;
}

const defaultTemplates: FollowUpTemplate[] = [
  {
    id: '1',
    day: 2,
    title: 'Initial Follow-up',
    content: 'Hi {{name}}, following up on your interest in {{bedrooms}}BR properties in {{locations}}. I\'ve found some excellent options within your {{budget}} budget. When\'s a good time to discuss?',
    isActive: true,
  },
  {
    id: '2',
    day: 4,
    title: 'Property Showcase',
    content: 'Hi {{name}}, I wanted to share some handpicked properties that match your requirements. Would you like me to arrange viewings for any of these?',
    isActive: true,
  },
  {
    id: '3',
    day: 6,
    title: 'Pro Tip Follow-up',
    content: 'Hi {{name}}, quick tip: Properties in {{locations}} are moving fast this season. Let me know if you\'d like priority access to new listings.',
    isActive: true,
  },
];

const scheduleDays = [0, 2, 4, 6, 9, 12, 16, 20];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<FollowUpTemplate[]>(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<FollowUpTemplate | null>(templates[0] || null);

  const getTemplateForDay = (day: number) => {
    return templates.find((t) => t.day === day);
  };

  const handleCopy = (template: FollowUpTemplate) => {
    navigator.clipboard.writeText(template.content);
  };

  const handleDelete = (templateId: string) => {
    setTemplates(templates.filter((t) => t.id !== templateId));
    if (selectedTemplate?.id === templateId) {
      setSelectedTemplate(templates[0] || null);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Follow-up Templates"
        subtitle="Manage automated follow-up messages"
        actions={
          <Button className="bg-gradient-primary hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        }
      />

      <PageContent>
        <div className="space-y-6">
          {/* 21-Day Schedule Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-6 shadow-card"
          >
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">21-Day Follow-up Schedule</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {scheduleDays.map((day, index) => {
                const template = getTemplateForDay(day);
                const hasTemplate = !!template;

                return (
                  <motion.div
                    key={day}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => template && setSelectedTemplate(template)}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all cursor-pointer min-h-[120px]",
                      hasTemplate
                        ? "border-primary bg-primary/5 hover:bg-primary/10"
                        : "border-dashed border-muted-foreground/30 hover:border-muted-foreground/50",
                      selectedTemplate?.day === day && "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    <Badge
                      className={cn(
                        "absolute -top-2 left-1/2 -translate-x-1/2",
                        hasTemplate ? "bg-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      Day {day}
                    </Badge>

                    <div className="pt-3 text-center">
                      <p className="text-xs text-muted-foreground mb-2">
                        {day === 0 ? 'Lead created' : `${day} days later`}
                      </p>
                      {hasTemplate ? (
                        <>
                          <p className="text-sm font-medium text-foreground truncate">
                            {template.title}
                          </p>
                          <CheckCircle className="w-4 h-4 text-success mx-auto mt-2" />
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No template</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Selected Template Preview */}
          {selectedTemplate && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-xl p-6 shadow-card"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Day {selectedTemplate.day}</Badge>
                  <h3 className="text-lg font-semibold text-foreground">
                    {selectedTemplate.title}
                  </h3>
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  {selectedTemplate.isActive && (
                    <Badge className="bg-pastel-green text-success">Active</Badge>
                  )}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <p className="text-foreground whitespace-pre-wrap">
                  {selectedTemplate.content}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCopy(selectedTemplate)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedTemplate.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </motion.div>
          )}

          {/* All Templates List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl p-6 shadow-card"
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">All Templates</h3>
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={cn(
                    "p-4 rounded-lg border transition-all cursor-pointer",
                    selectedTemplate?.id === template.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">Day {template.day}</Badge>
                      <span className="font-medium text-foreground">{template.title}</span>
                      {template.isActive && (
                        <Badge className="bg-pastel-green text-success text-xs">Active</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(template);
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {template.content}
                  </p>
                </div>
              ))}

              {templates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No templates yet</p>
                  <p className="text-sm">Create your first follow-up template</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </PageContent>
    </MainLayout>
  );
}
