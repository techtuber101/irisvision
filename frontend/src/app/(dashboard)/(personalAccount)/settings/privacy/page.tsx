'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Lock, 
  Download, 
  Trash2,
  Eye,
  FileText,
  Database,
  Shield
} from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Privacy</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Control how your data is used and managed
        </p>
      </div>

      {/* Data Usage */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Data Usage</Label>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="improve-iris" className="font-medium cursor-pointer">
              Help Improve Iris
            </Label>
            <p className="text-sm text-muted-foreground">
              Allow us to use your interactions to improve Iris's responses
            </p>
          </div>
          <Switch id="improve-iris" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="personalization" className="font-medium cursor-pointer">
              Personalized Responses
            </Label>
            <p className="text-sm text-muted-foreground">
              Use your history to provide more personalized responses
            </p>
          </div>
          <Switch id="personalization" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="analytics" className="font-medium cursor-pointer">
              Usage Analytics
            </Label>
            <p className="text-sm text-muted-foreground">
              Share anonymous analytics to help us understand product usage
            </p>
          </div>
          <Switch id="analytics" defaultChecked />
        </div>
      </div>

      {/* Chat History */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Chat History</Label>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="save-history" className="font-medium cursor-pointer">
              Save Chat History
            </Label>
            <p className="text-sm text-muted-foreground">
              Store your conversations for future reference
            </p>
          </div>
          <Switch id="save-history" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="auto-delete" className="font-medium cursor-pointer">
              Auto-Delete Old Chats
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically delete chats older than 90 days
            </p>
          </div>
          <Switch id="auto-delete" />
        </div>

        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Who can see your chats?</p>
              <p className="text-xs text-muted-foreground">
                Your conversations are private and encrypted. Only you can access them unless you explicitly share them.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Retention */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Data Retention</Label>
        </div>

        <div className="p-4 bg-accent/30 border border-border/50 rounded-lg space-y-3">
          <div>
            <h3 className="font-medium text-sm mb-1">Current Retention Policy</h3>
            <p className="text-xs text-muted-foreground">
              Your data is retained as long as your account is active. You can export or delete your data at any time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <div className="px-3 py-2 bg-background rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground">Conversations</p>
              <p className="text-sm font-medium">Unlimited</p>
            </div>
            <div className="px-3 py-2 bg-background rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground">Generated Files</p>
              <p className="text-sm font-medium">90 days</p>
            </div>
            <div className="px-3 py-2 bg-background rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground">Usage Logs</p>
              <p className="text-sm font-medium">30 days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Export & Deletion */}
      <div className="space-y-4">
        <Label className="text-base">Data Management</Label>

        <div className="p-5 border border-border/50 rounded-lg space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium mb-1">Export Your Data</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Download a copy of all your data including chats, files, and account information
              </p>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Request Data Export
              </Button>
            </div>
          </div>
        </div>

        <div className="p-5 border border-destructive/20 bg-destructive/5 rounded-lg space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium mb-1">Clear All Data</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Permanently delete all your conversations, files, and generated content. This action cannot be undone.
              </p>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive border-destructive/20">
                <Trash2 className="h-4 w-4" />
                Clear All Data
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Data export requests are processed within 48 hours. You'll receive an email with a download link once ready.
          </p>
        </div>
      </div>
    </div>
  );
}

