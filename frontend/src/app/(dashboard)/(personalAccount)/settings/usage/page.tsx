'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { BillingModal } from '@/components/billing/billing-modal';
import { useAccounts } from '@/hooks/use-accounts';
import { useSharedSubscription } from '@/contexts/SubscriptionContext';
import { useTransactions } from '@/hooks/react-query/billing/use-transactions';
import Link from 'next/link';
import { 
  Coins, 
  TrendingUp, 
  Calendar, 
  Activity,
  ArrowRight,
  Sparkles,
  Clock,
  Infinity,
  CreditCard
} from 'lucide-react';

const returnUrl = process.env.NEXT_PUBLIC_URL as string;

export default function UsagePage() {
  const [showBillingModal, setShowBillingModal] = useState(false);
  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useAccounts();
  
  const {
    data: subscriptionData,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  } = useSharedSubscription();
  
  const { data: transactionData } = useTransactions(1, 0);

  const personalAccount = useMemo(
    () => accounts?.find((account) => account.personal_account),
    [accounts],
  );

  // Calculate credits data
  const creditsBalance = subscriptionData?.credits?.balance || 0;
  const tierCredits = subscriptionData?.credits?.tier_credits || subscriptionData?.tier?.credits || 10000;
  const creditsUsed = tierCredits - creditsBalance;
  const creditsPercentage = tierCredits > 0 ? (creditsUsed / tierCredits) * 100 : 0;

  const usageStats = [
    { label: 'Chats', value: '127', icon: Activity },
    { label: 'Code Generated', value: '45K lines', icon: TrendingUp },
    { label: 'Files Created', value: '234', icon: Calendar },
    { label: 'API Calls', value: '1,203', icon: Sparkles },
  ];

  const recentUsage = [
    { date: 'Today', credits: 450, tasks: 12 },
    { date: 'Yesterday', credits: 380, tasks: 8 },
    { date: 'Nov 9', credits: 520, tasks: 15 },
    { date: 'Nov 8', credits: 290, tasks: 7 },
    { date: 'Nov 7', credits: 610, tasks: 18 },
  ];

  if (accountsError || subscriptionError) {
    return (
      <div className="p-6">
        <Alert variant="destructive" className="border-red-300 dark:border-red-800 rounded-xl">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {accountsError instanceof Error ? accountsError.message : subscriptionError?.message || 'Failed to load data'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (accountsLoading || subscriptionLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <BillingModal 
        open={showBillingModal} 
        onOpenChange={setShowBillingModal}
        returnUrl={`${returnUrl}/settings/usage`}
      />

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Usage & Credits</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Monitor your usage and manage your credits
        </p>
      </div>

      {/* Credits Overview */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Available Credits</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">
                {creditsBalance.toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">
                / {tierCredits.toLocaleString()}
              </span>
            </div>
          </div>
          <Button size="sm" className="gap-2">
            <Coins className="h-4 w-4" />
            Buy More
          </Button>
        </div>
        
        <Progress value={creditsPercentage} className="h-2 mb-2" />
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {creditsUsed.toLocaleString()} used this month
          </span>
          <span className="font-medium text-primary">
            {Math.round(100 - creditsPercentage)}% remaining
          </span>
        </div>
      </div>

      {/* Credit Breakdown */}
      {transactionData?.current_balance && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="p-5 border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">Expiring Credits</p>
                  <p className="text-xs text-orange-700 dark:text-orange-300">Resets monthly with subscription</p>
                </div>
              </div>
            </div>
            <p className="text-3xl font-bold text-orange-600">
              ${transactionData.current_balance.expiring.toFixed(2)}
            </p>
          </div>

          <div className="p-5 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Infinity className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Non-Expiring Credits</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Never expires</p>
                </div>
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              ${transactionData.current_balance.non_expiring.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Usage Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {usageStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-4 border border-border/50 rounded-lg bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Current Plan */}
      <div className="p-5 border border-border/50 rounded-lg space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">
                {subscriptionData?.plan_name || 'Free Plan'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {tierCredits.toLocaleString()} credits per month • 
                {subscriptionData?.subscription?.status === 'active' ? ' Active subscription' : ' No active subscription'}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowBillingModal(true)}
          >
            Manage Subscription
          </Button>
        </div>
        
        {subscriptionData?.subscription?.current_period_end && (
          <div className="flex items-center gap-2 text-sm pt-2 border-t border-border/50">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {subscriptionData?.subscription?.cancel_at ? 'Cancels' : 'Renews'} on{' '}
              <span className="font-medium text-foreground">
                {new Date(subscriptionData.subscription.current_period_end).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            asChild
          >
            <Link href="/model-pricing">
              View Model Pricing
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent Usage */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recent Usage</h3>
          <Button variant="ghost" size="sm" className="gap-1">
            View All
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <div className="divide-y divide-border/50">
            {recentUsage.map((day, index) => (
              <div 
                key={day.date} 
                className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-1.5 h-8 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted'}`} />
                  <div>
                    <p className="font-medium">{day.date}</p>
                    <p className="text-sm text-muted-foreground">{day.tasks} tasks</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{day.credits}</p>
                  <p className="text-sm text-muted-foreground">credits</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Usage Insights */}
      <div className="p-5 bg-accent/30 border border-border/50 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Usage Insights</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          You're using <span className="font-medium text-foreground">15% more</span> credits this month compared to last month. 
          Your most active day is <span className="font-medium text-foreground">Monday</span>.
        </p>
      </div>
    </div>
  );
}

