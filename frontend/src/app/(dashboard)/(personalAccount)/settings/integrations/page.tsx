'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plug, 
  CheckCircle2,
  ExternalLink,
  Settings as SettingsIcon,
  Trash2
} from 'lucide-react';

export default function IntegrationsPage() {
  const connectedIntegrations = [
    {
      name: 'GitHub',
      description: 'Access repositories and manage code',
      icon: '🐙',
      connected: true,
      lastSync: '2 hours ago',
    },
    {
      name: 'Google Drive',
      description: 'Read and write files to your Drive',
      icon: '📁',
      connected: true,
      lastSync: '5 minutes ago',
    },
    {
      name: 'Slack',
      description: 'Send messages and notifications',
      icon: '💬',
      connected: true,
      lastSync: 'Just now',
    },
  ];

  const availableIntegrations = [
    {
      name: 'Notion',
      description: 'Create and update pages and databases',
      icon: '📝',
      connected: false,
    },
    {
      name: 'Linear',
      description: 'Manage issues and projects',
      icon: '📊',
      connected: false,
    },
    {
      name: 'Figma',
      description: 'Access designs and prototypes',
      icon: '🎨',
      connected: false,
    },
    {
      name: 'Gmail',
      description: 'Read and send emails',
      icon: '✉️',
      connected: false,
    },
    {
      name: 'Jira',
      description: 'Track and manage work items',
      icon: '🔷',
      connected: false,
    },
    {
      name: 'Dropbox',
      description: 'Access and sync files',
      icon: '📦',
      connected: false,
    },
  ];

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Plug className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Integrations</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect Iris with your favorite tools and services
        </p>
      </div>

      {/* Connected Integrations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Connected</h3>
            <p className="text-sm text-muted-foreground">
              {connectedIntegrations.length} integration{connectedIntegrations.length !== 1 ? 's' : ''} active
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {connectedIntegrations.map((integration) => (
            <div 
              key={integration.name}
              className="p-5 border border-border/50 rounded-lg hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{integration.icon}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{integration.name}</h3>
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Connected
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      Last synced: {integration.lastSync}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-2">
                        <SettingsIcon className="h-3 w-3" />
                        Configure
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive hover:text-destructive gap-2"
                      >
                        <Trash2 className="h-3 w-3" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Integrations */}
      <div className="space-y-4 pt-6 border-t border-border/50">
        <div>
          <h3 className="font-semibold">Available Integrations</h3>
          <p className="text-sm text-muted-foreground">
            Connect more tools to enhance Iris's capabilities
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {availableIntegrations.map((integration) => (
            <div 
              key={integration.name}
              className="p-4 border border-border/50 rounded-lg hover:bg-accent/30 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{integration.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{integration.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {integration.description}
                  </p>
                  <Button size="sm" variant="outline" className="gap-2 w-full">
                    <Plug className="h-3 w-3" />
                    Connect
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OAuth Info */}
      <div className="p-5 bg-muted/50 rounded-lg space-y-3">
        <div className="flex items-start gap-3">
          <SettingsIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm mb-1">Secure OAuth Authentication</p>
            <p className="text-xs text-muted-foreground">
              All integrations use OAuth 2.0 for secure authentication. Iris never stores your passwords. 
              You can revoke access at any time from your connected accounts.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-xs">
          Learn More About Security
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

