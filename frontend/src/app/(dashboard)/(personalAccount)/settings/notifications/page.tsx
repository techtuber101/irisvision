'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Bell, 
  Mail, 
  Smartphone,
  MessageSquare,
  CreditCard,
  Shield,
  Sparkles,
  TrendingUp
} from 'lucide-react';

export default function NotificationsPage() {
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Notifications</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage how and when you receive notifications
        </p>
      </div>

      {/* Notification Channels */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <Label className="text-base">Notification Channels</Label>
        
        <div className="flex items-center justify-between p-4 bg-accent/30 border border-border/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-sm">Email Notifications</h3>
              <p className="text-xs text-muted-foreground">Receive updates via email</p>
            </div>
          </div>
          <Switch defaultChecked />
        </div>

        <div className="flex items-center justify-between p-4 bg-accent/30 border border-border/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-sm">Push Notifications</h3>
              <p className="text-xs text-muted-foreground">Get alerts on your device</p>
            </div>
          </div>
          <Switch defaultChecked />
        </div>

        <div className="flex items-center justify-between p-4 bg-accent/30 border border-border/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-sm">In-App Notifications</h3>
              <p className="text-xs text-muted-foreground">See notifications in the app</p>
            </div>
          </div>
          <Switch defaultChecked />
        </div>
      </div>

      {/* AI Activity */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">AI Activity</Label>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="task-complete" className="font-medium cursor-pointer">
              Task Completion
            </Label>
            <p className="text-sm text-muted-foreground">
              When Iris completes a task or generates content
            </p>
          </div>
          <Switch id="task-complete" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="long-tasks" className="font-medium cursor-pointer">
              Long-Running Tasks
            </Label>
            <p className="text-sm text-muted-foreground">
              Progress updates for tasks taking more than 2 minutes
            </p>
          </div>
          <Switch id="long-tasks" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="errors" className="font-medium cursor-pointer">
              Errors & Issues
            </Label>
            <p className="text-sm text-muted-foreground">
              When Iris encounters problems or needs clarification
            </p>
          </div>
          <Switch id="errors" defaultChecked />
        </div>
      </div>

      {/* Account Updates */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Account & Security</Label>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="security-alerts" className="font-medium cursor-pointer">
              Security Alerts
            </Label>
            <p className="text-sm text-muted-foreground">
              New login, password changes, and suspicious activity
            </p>
          </div>
          <Switch id="security-alerts" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="account-changes" className="font-medium cursor-pointer">
              Account Changes
            </Label>
            <p className="text-sm text-muted-foreground">
              Profile updates, email changes, and settings modifications
            </p>
          </div>
          <Switch id="account-changes" defaultChecked />
        </div>
      </div>

      {/* Billing */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Billing & Usage</Label>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="payment-receipts" className="font-medium cursor-pointer">
              Payment Receipts
            </Label>
            <p className="text-sm text-muted-foreground">
              Successful payments and invoice notifications
            </p>
          </div>
          <Switch id="payment-receipts" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="payment-failures" className="font-medium cursor-pointer">
              Payment Failures
            </Label>
            <p className="text-sm text-muted-foreground">
              Failed payments and billing issues
            </p>
          </div>
          <Switch id="payment-failures" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="credit-warnings" className="font-medium cursor-pointer">
              Credit Warnings
            </Label>
            <p className="text-sm text-muted-foreground">
              When you're running low on credits (below 20%)
            </p>
          </div>
          <Switch id="credit-warnings" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="subscription-updates" className="font-medium cursor-pointer">
              Subscription Updates
            </Label>
            <p className="text-sm text-muted-foreground">
              Plan changes, renewals, and cancellations
            </p>
          </div>
          <Switch id="subscription-updates" defaultChecked />
        </div>
      </div>

      {/* Product Updates */}
      <div className="space-y-4 pb-6 border-b border-border/50">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base">Product Updates</Label>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="new-features" className="font-medium cursor-pointer">
              New Features
            </Label>
            <p className="text-sm text-muted-foreground">
              Announcements about new capabilities and improvements
            </p>
          </div>
          <Switch id="new-features" defaultChecked />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="tips-tricks" className="font-medium cursor-pointer">
              Tips & Tricks
            </Label>
            <p className="text-sm text-muted-foreground">
              Helpful guides to get more out of Iris
            </p>
          </div>
          <Switch id="tips-tricks" />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <Label htmlFor="newsletters" className="font-medium cursor-pointer">
              Newsletters
            </Label>
            <p className="text-sm text-muted-foreground">
              Monthly updates and AI industry insights
            </p>
          </div>
          <Switch id="newsletters" />
        </div>
      </div>

      {/* Notification Frequency */}
      <div className="space-y-4">
        <Label className="text-base">Email Frequency</Label>
        <p className="text-sm text-muted-foreground">
          How often would you like to receive email notifications?
        </p>
        
        <RadioGroup defaultValue="realtime" className="space-y-3">
          <div className="flex items-start space-x-3 space-y-0">
            <RadioGroupItem value="realtime" id="realtime" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="realtime" className="font-medium cursor-pointer">
                Real-time
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive emails as events happen
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 space-y-0">
            <RadioGroupItem value="daily" id="daily" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="daily" className="font-medium cursor-pointer">
                Daily Digest
              </Label>
              <p className="text-sm text-muted-foreground">
                One email per day with all updates
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 space-y-0">
            <RadioGroupItem value="weekly" id="weekly" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="weekly" className="font-medium cursor-pointer">
                Weekly Summary
              </Label>
              <p className="text-sm text-muted-foreground">
                One email per week with a summary
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

