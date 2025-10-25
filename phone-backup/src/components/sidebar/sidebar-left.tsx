'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Menu, Plus, ChevronRight } from 'lucide-react';

import { NavAgents } from '@/components/sidebar/nav-agents';
import { NavUserWithTeams } from '@/components/sidebar/nav-user-with-teams';
import { IrisLogo } from '@/components/sidebar/iris-logo';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { NewAgentDialog } from '@/components/agents/new-agent-dialog';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { useDocumentModalStore } from '@/lib/stores/use-document-modal-store';

function FloatingMobileMenuButton() {
  const { setOpenMobile, openMobile } = useSidebar();
  const isMobile = useIsMobile();

  if (!isMobile || openMobile) return null;

  return (
    <div className="fixed top-6 left-4 z-50">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setOpenMobile(true)}
            size="icon"
            className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Open menu
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const { state, setOpen, setOpenMobile } = useSidebar();
  const isMobile = useIsMobile();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [user, setUser] = useState<{
    name: string;
    email: string;
    avatar: string;
    isAdmin?: boolean;
  }>({
    name: 'Loading...',
    email: 'loading@example.com',
    avatar: '',
    isAdmin: false,
  });

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showNewAgentDialog, setShowNewAgentDialog] = useState(false);
  const { isOpen: isDocumentModalOpen } = useDocumentModalStore();

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, searchParams, isMobile, setOpenMobile]);


  useEffect(() => {
    const fetchUserData = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .in('role', ['admin', 'super_admin']);
        const isAdmin = !!(roleData && roleData.length > 0);

        setUser({
          name:
            data.user.user_metadata?.name ||
            data.user.email?.split('@')[0] ||
            'User',
          email: data.user.email || '',
          avatar: data.user.user_metadata?.avatar_url || '', // User avatar (different from agent avatar)
          isAdmin: isAdmin,
        });
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDocumentModalOpen) return;

      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        setOpen(!state.startsWith('expanded'));
        window.dispatchEvent(
          new CustomEvent('sidebar-left-toggled', {
            detail: { expanded: !state.startsWith('expanded') },
          }),
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, setOpen, isDocumentModalOpen]);




  return (
    <Sidebar
      collapsible="icon"
      className="border-r-0 backdrop-blur-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] relative"
      {...props}
    >
      {/* Light mode glassmorphism background */}
      <div className="absolute inset-0 opacity-0 dark:opacity-0 light:opacity-100 pointer-events-none" style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}></div>
      
      {/* Light mode checkered pattern background */}
      <div className="absolute inset-0 opacity-0 dark:opacity-0 light:opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(to right, rgba(0, 0, 0, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 0, 0, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }}></div>
      <SidebarHeader className="px-2 py-1 relative z-10">
        <div className="flex h-[48px] items-center px-1 relative">
          <Link href="/dashboard" className="flex-shrink-0" onClick={() => isMobile && setOpenMobile(false)}>
            {state === 'collapsed' ? (
              <>
                <Image
                  src="/irissymbolblack.png"
                  alt="Iris Symbol"
                  width={48}
                  height={48}
                  className="w-12 h-12 dark:hidden"
                  priority
                />
                <Image
                  src="/irissymbolwhite.png"
                  alt="Iris Symbol"
                  width={48}
                  height={48}
                  className="w-12 h-12 hidden dark:block"
                  priority
                />
              </>
            ) : (
              <>
                <Image
                  src="/irislogoblack.png"
                  alt="Iris Logo"
                  width={260}
                  height={46}
                  className="h-12 w-auto dark:hidden"
                  priority
                />
                <Image
                  src="/irislogowhitebig.png"
                  alt="Iris Logo"
                  width={180}
                  height={32}
                  className="h-8 w-auto hidden dark:block"
                  priority
                />
              </>
            )}
          </Link>
          {state !== 'collapsed' && (
            <div className="ml-2 transition-all duration-200 ease-in-out whitespace-nowrap">
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {state !== 'collapsed' && !isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarTrigger className="h-8 w-8" />
                </TooltipTrigger>
                <TooltipContent>Toggle sidebar (CMD+B)</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="[&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] relative z-10">
        <SidebarGroup>
          <Link href="/dashboard">
            <SidebarMenuButton
              className={cn('touch-manipulation', {
                'bg-accent text-accent-foreground font-medium': pathname === '/dashboard',
              })}
              onClick={() => {
                posthog.capture('new_task_clicked');
                if (isMobile) setOpenMobile(false);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              <span className="flex items-center justify-between w-full">
                New Mission
              </span>
            </SidebarMenuButton>
          </Link>
          {(
            <SidebarMenu>
              <Collapsible
                defaultOpen={false}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip="Personalities"
                      onClick={() => {
                        if (state === 'collapsed') {
                          setOpen(true);
                        }
                      }}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      <span>Personalities</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* <SidebarMenuSubItem>
                        <SidebarMenuSubButton className={cn('pl-3 touch-manipulation', {
                          'bg-accent text-accent-foreground font-medium': pathname === '/agents' && searchParams.get('tab') === 'marketplace',
                        })} asChild>
                          <Link href="/agents?tab=marketplace" onClick={() => isMobile && setOpenMobile(false)}>
                            <span>Explore</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem> */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton className={cn('pl-3 touch-manipulation', {
                          'bg-accent text-accent-foreground font-medium': pathname === '/agents' && ((searchParams?.get('tab') === 'my-agents') || (searchParams?.get('tab') === null)),
                        })} asChild>
                          <Link href="/agents?tab=my-agents" onClick={() => isMobile && setOpenMobile(false)}>
                            <span>Added Personalities</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          onClick={() => {
                            setShowNewAgentDialog(true);
                            if (isMobile) setOpenMobile(false);
                          }}
                          className="cursor-pointer pl-3 touch-manipulation"
                        >
                          <span>New Personality</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          )}
        </SidebarGroup>
        <NavAgents />
      </SidebarContent>
      <SidebarFooter className="relative z-10">
        {state === 'collapsed' && (
          <div className="mt-2 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="h-8 w-8" />
              </TooltipTrigger>
              <TooltipContent>Expand sidebar (CMD+B)</TooltipContent>
            </Tooltip>
          </div>
        )}
        <NavUserWithTeams user={user} />
      </SidebarFooter>
      <SidebarRail />
      <NewAgentDialog
        open={showNewAgentDialog}
        onOpenChange={setShowNewAgentDialog}
      />
    </Sidebar>
  );
}

// Export the floating button so it can be used in the layout
export { FloatingMobileMenuButton };
