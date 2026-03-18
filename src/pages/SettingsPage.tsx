import { MainLayout, PageHeader, PageContent } from '@/components/layout/MainLayout';
import { useCRMStore } from '@/store/crmStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Mail,
  Globe,
  Save,
} from 'lucide-react';

export default function SettingsPage() {
  const { currentAgent } = useCRMStore();

  const settingSections = [
    {
      id: 'profile',
      icon: User,
      title: 'Profile',
      description: 'Manage your personal information',
    },
    {
      id: 'notifications',
      icon: Bell,
      title: 'Notifications',
      description: 'Configure notification preferences',
    },
    {
      id: 'security',
      icon: Shield,
      title: 'Security',
      description: 'Password and authentication settings',
    },
    {
      id: 'appearance',
      icon: Palette,
      title: 'Appearance',
      description: 'Customize the look and feel',
    },
    {
      id: 'integrations',
      icon: Database,
      title: 'Integrations',
      description: 'Connect external services',
    },
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences"
      />

      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card rounded-xl p-4 shadow-card h-fit"
          >
            <nav className="space-y-1">
              {settingSections.map((section, index) => (
                <button
                  key={section.id}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                    index === 0
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <section.icon className="w-5 h-5" />
                  <span className="font-medium">{section.title}</span>
                </button>
              ))}
            </nav>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 space-y-6"
          >
            {/* Profile Section */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Profile Settings</h2>
              </div>

              <div className="flex items-center gap-6 mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-hero flex items-center justify-center text-white text-2xl font-bold">
                  {currentAgent.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <Button variant="outline" size="sm">Change Photo</Button>
                  <p className="text-xs text-muted-foreground mt-2">JPG, PNG or GIF. Max 2MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue={currentAgent.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={currentAgent.email} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" defaultValue={currentAgent.phone} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" defaultValue={currentAgent.role} disabled className="capitalize" />
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button className="bg-gradient-primary">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <div className="flex items-center gap-2 mb-6">
                <Bell className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Notification Preferences</h2>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'New lead assignments', description: 'Get notified when a lead is assigned to you', enabled: true },
                  { label: 'Follow-up reminders', description: 'Receive reminders for upcoming follow-ups', enabled: true },
                  { label: 'Task due alerts', description: 'Get alerts when tasks are due or overdue', enabled: true },
                  { label: 'Weekly reports', description: 'Receive weekly performance summary emails', enabled: false },
                  { label: 'Pipeline updates', description: 'Get notified of lead status changes', enabled: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch defaultChecked={item.enabled} />
                  </div>
                ))}
              </div>
            </div>

            {/* Integrations Section */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <div className="flex items-center gap-2 mb-6">
                <Database className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
              </div>

              <div className="space-y-4">
                {[
                  { name: 'Google Sheets', description: 'Sync leads and data with Google Sheets', icon: Globe, connected: false },
                  { name: 'Email Service', description: 'Connect email for automated follow-ups', icon: Mail, connected: false },
                  { name: 'WhatsApp Business', description: 'Send WhatsApp messages directly', icon: Globe, connected: false },
                ].map((integration) => (
                  <div key={integration.name} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <integration.icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{integration.name}</p>
                        <p className="text-sm text-muted-foreground">{integration.description}</p>
                      </div>
                    </div>
                    <Button variant={integration.connected ? "outline" : "default"} size="sm">
                      {integration.connected ? 'Connected' : 'Connect'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </PageContent>
    </MainLayout>
  );
}
