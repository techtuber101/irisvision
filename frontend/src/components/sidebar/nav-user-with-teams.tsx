'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BadgeCheck,
  Bell,
  ChevronDown,
  ChevronsUpDown,
  ChevronRight,
  Command,
  CreditCard,
  Key,
  LogOut,
  Plus,
  Settings,
  User,
  AudioWaveform,
  Sun,
  Moon,
  KeyRound,
  Plug,
  Zap,
  Shield,
  DollarSign,
  Users,
  BarChart3,
  FileText,
} from 'lucide-react';
import { useAccounts } from '@/hooks/use-accounts';
import NewTeamForm from '@/components/basejump/new-team-form';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from 'next-themes';
import { isLocalMode } from '@/lib/config';
import { clearUserLocalStorage } from '@/lib/utils/clear-local-storage';
import { BillingModal } from '@/components/billing/billing-modal';
import { cn } from '@/lib/utils';

export function NavUserWithTeams({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
    isAdmin?: boolean;
  };
}) {
  const router = useRouter();
  const { isMobile, state } = useSidebar();
  const { data: accounts } = useAccounts();
  const [showNewTeamDialog, setShowNewTeamDialog] = React.useState(false);
  const [showBillingModal, setShowBillingModal] = React.useState(false);
  const { theme, setTheme } = useTheme();

  // Prepare personal account and team accounts
  const personalAccount = React.useMemo(
    () => accounts?.find((account) => account.personal_account),
    [accounts],
  );
  const teamAccounts = React.useMemo(
    () => accounts?.filter((account) => !account.personal_account),
    [accounts],
  );

  // Create a default list of teams with logos for the UI (will show until real data loads)
  const defaultTeams = [
    {
      name: personalAccount?.name || 'Personal Account',
      logo: Command,
      plan: 'Personal',
      account_id: personalAccount?.account_id,
      slug: personalAccount?.slug,
      personal_account: true,
    },
    ...(teamAccounts?.map((team) => ({
      name: team.name,
      logo: AudioWaveform,
      plan: 'Team',
      account_id: team.account_id,
      slug: team.slug,
      personal_account: false,
    })) || []),
  ];

  // Use the first team or first entry in defaultTeams as activeTeam
  const [activeTeam, setActiveTeam] = React.useState(defaultTeams[0]);

  // Update active team when accounts load
  React.useEffect(() => {
    if (accounts?.length) {
      const currentTeam = accounts.find(
        (account) => account.account_id === activeTeam.account_id,
      );
      if (currentTeam) {
        setActiveTeam({
          name: currentTeam.name,
          logo: currentTeam.personal_account ? Command : AudioWaveform,
          plan: currentTeam.personal_account ? 'Personal' : 'Team',
          account_id: currentTeam.account_id,
          slug: currentTeam.slug,
          personal_account: currentTeam.personal_account,
        });
      } else {
        // If current team not found, set first available account as active
        const firstAccount = accounts[0];
        setActiveTeam({
          name: firstAccount.name,
          logo: firstAccount.personal_account ? Command : AudioWaveform,
          plan: firstAccount.personal_account ? 'Personal' : 'Team',
          account_id: firstAccount.account_id,
          slug: firstAccount.slug,
          personal_account: firstAccount.personal_account,
        });
      }
    }
  }, [accounts, activeTeam.account_id]);

  // Handle team selection
  const handleTeamSelect = (team) => {
    setActiveTeam(team);

    // Navigate to the appropriate dashboard
    if (team.personal_account) {
      router.push('/');
    } else {
      router.push(`/${team.slug}`);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear local storage after sign out
    clearUserLocalStorage();
    router.push('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (!activeTeam) {
    return null;
  }

  const isCollapsed = state === 'collapsed';

  return (
    <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className={cn(
                      "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                      isCollapsed && "justify-center p-0 rounded-full h-7 w-7 aspect-square"
                    )}
                  >
                    <Avatar className={cn(
                      "rounded-full relative shadow-[0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] ring-2 ring-black/10 dark:ring-white/10 hover:ring-black/20 dark:hover:ring-white/20 transition-all duration-300 hover:shadow-[0_6px_16px_rgba(0,0,0,0.2),0_3px_6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.15)] dark:hover:shadow-[0_6px_16px_rgba(0,0,0,0.5),0_3px_6px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] hover:scale-105",
                      isCollapsed ? "h-7 w-7" : "h-9 w-9"
                    )}>
                      <AvatarImage 
                        src={user.avatar} 
                        alt={user.name}
                        className="object-cover rounded-full"
                      />
                      <AvatarFallback className="rounded-full backdrop-blur-md bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.2)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.15)] text-foreground font-semibold text-xs">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    {!isCollapsed && (
                      <>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-medium">{user.name}</span>
                          <span className="truncate text-xs">{user.email}</span>
                        </div>
                        <ChevronsUpDown className="ml-auto size-4" />
                      </>
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" sideOffset={8}>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </TooltipContent>
              )}
            </Tooltip>
            <DropdownMenuContent
              className="w-56 p-5 rounded-2xl border border-black/10 bg-white/95 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.1)] dark:border-white/10 dark:bg-[rgba(7,10,17,0.95)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] dark:shadow-[0_10px_20px_-10px_rgba(0,0,0,0.6)]"
              side={isMobile ? 'bottom' : 'top'}
              align="center"
              sideOffset={8}
            >
              {/* Iris Header */}
              <header className="mb-4 flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-black/10 ring-1 ring-black/20 flex items-center justify-center dark:bg-white/10 dark:ring-white/20">
                  <img src="/irissymbolblack.png?v=2" alt="Iris Logo" className="h-4 w-4 dark:hidden" />
                  <img src="/irissymbolwhite.png?v=2" alt="Iris Logo" className="h-4 w-4 hidden dark:block" />
                </div>
                <h3 className="text-sm font-medium text-black/80 dark:text-white/80">Iris</h3>
              </header>
              
              {/* User Info Section */}
              <div className="relative">
                <div className="relative rounded-2xl border border-black/10 bg-black/5 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-300 dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-full relative shadow-[0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] ring-2 ring-black/10 dark:ring-white/10">
                      <AvatarImage 
                        src={user.avatar} 
                        alt={user.name}
                        className="object-cover rounded-full"
                      />
                      <AvatarFallback className="rounded-full backdrop-blur-md bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.2)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.15)] text-foreground font-semibold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-black/90 truncate dark:text-white/90">{user.name}</div>
                      <div className="text-xs text-black/60 truncate dark:text-white/60">{user.email}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Teams Section */}
              {teamAccounts && teamAccounts.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="rounded-2xl border border-black/10 bg-black/5 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-black/8 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] dark:hover:bg-white/8 dark:hover:border-white/15">
                    <div className="text-xs text-black/50 mb-2 px-1 dark:text-white/50">Teams</div>
                    <div className="space-y-1">
                      {teamAccounts.map((team, index) => (
                        <DropdownMenuItem
                          key={team.account_id}
                          onClick={() =>
                            handleTeamSelect({
                              name: team.name,
                              logo: AudioWaveform,
                              plan: 'Team',
                              account_id: team.account_id,
                              slug: team.slug,
                              personal_account: false,
                            })
                          }
                          className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center"
                        >
                          <div className="flex size-6 items-center justify-center rounded-xs border border-black/20 bg-black/10 dark:border-white/20 dark:bg-white/10 flex-shrink-0 mr-3">
                            <AudioWaveform className="size-4 shrink-0 text-black/80 dark:text-white/80" />
                          </div>
                          <span className="text-sm flex-1">{team.name}</span>
                          <DropdownMenuShortcut className="text-black/50 dark:text-white/50">⌘{index + 1}</DropdownMenuShortcut>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* User Settings Section */}
              <div className="mt-4 space-y-2">
                {/* Admin Section */}
                {user.isAdmin && (
                  <div className="rounded-2xl border border-black/10 bg-black/5 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-black/8 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] dark:hover:bg-white/8 dark:hover:border-white/15">
                    <div className="text-xs text-black/50 mb-2 px-1 dark:text-white/50">Admin</div>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center">
                        <Shield className="h-4 w-4 mr-3 flex-shrink-0" />
                        <span className="text-sm">Admin Panel</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="rounded-2xl border border-black/10 bg-white/95 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(7,10,17,0.95)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                          <DropdownMenuItem asChild className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 flex items-center">
                            <Link href="/admin/billing" className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-3 flex-shrink-0" />
                              <span className="text-sm">Billing Management</span>
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  </div>
                )}
                
                {/* Settings Section */}
                <div className="rounded-2xl border border-black/10 bg-black/5 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-black/8 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] dark:hover:bg-white/8 dark:hover:border-white/15">
                  <div className="text-xs text-black/50 mb-2 px-1 dark:text-white/50">Settings</div>
                  <div className="space-y-1">
                    <DropdownMenuItem asChild className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center">
                      <Link href="/settings" className="flex items-center">
                        <Settings className="h-4 w-4 mr-3 flex-shrink-0" />
                        <span className="text-sm">Preferences</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center">
                      <Link href="/settings/usage" className="flex items-center">
                        <Zap className="h-4 w-4 mr-3 flex-shrink-0" />
                        <span className="text-sm">Usage & Coins</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center">
                      <Link href="/settings/credentials" className="flex items-center">
                        <Plug className="h-4 w-4 mr-3 flex-shrink-0" />
                        <span className="text-sm">Integrations</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                      className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center"
                    >
                      <div className="flex items-center gap-3">
                        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="text-sm ml-2">Theme</span>
                      </div>
                    </DropdownMenuItem>
                  </div>
                </div>

                {/* Logout Section */}
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-red-500/15 hover:border-red-500/30 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                  <DropdownMenuItem className="h-auto p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 focus:bg-red-500/20 focus:border-red-500/30 dark:text-red-400 flex items-center" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-3 flex-shrink-0" />
                    <span className="text-sm">Log out</span>
                  </DropdownMenuItem>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <DialogContent className="sm:max-w-[425px] border-subtle dark:border-white/10 bg-card-bg dark:bg-background-secondary rounded-2xl shadow-custom">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Create a new team
          </DialogTitle>
          <DialogDescription className="text-foreground/70">
            Create a team to collaborate with others.
          </DialogDescription>
        </DialogHeader>
        <NewTeamForm />
      </DialogContent>

      {/* Billing Modal */}
      <BillingModal
        open={showBillingModal}
        onOpenChange={setShowBillingModal}
        returnUrl={typeof window !== 'undefined' ? window?.location?.href || '/' : '/'}
      />
    </Dialog>
  );
}
