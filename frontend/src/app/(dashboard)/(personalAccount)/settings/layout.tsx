'use client';

import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isLocalMode } from '@/lib/config';
import { useSidebar } from '@/components/ui/sidebar';
import { 
  User, 
  Sparkles, 
  Coins, 
  CreditCard, 
  Plug, 
  Shield, 
  Lock, 
  Bell, 
  Settings, 
  Code, 
  FolderOpen,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

interface SettingsSection {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

export default function PersonalAccountSettingsPage({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLocal = isLocalMode();
  const { setOpen } = useSidebar();
  const [hasAutoCollapsed, setHasAutoCollapsed] = useState(false);

  // Auto-collapse sidebar only once when first entering settings
  useEffect(() => {
    if (!hasAutoCollapsed) {
      setOpen(false);
      setHasAutoCollapsed(true);
    }
  }, [setOpen, hasAutoCollapsed]);

  const sections: SettingsSection[] = [
    {
      title: 'Account',
      items: [
        { name: 'Profile', href: '/settings', icon: User },
        { name: 'Preferences', href: '/settings/preferences', icon: Settings },
      ],
    },
    {
      title: 'AI Settings',
      items: [
        { name: 'Personalization', href: '/settings/personalization', icon: Sparkles },
      ],
    },
    {
      title: 'Billing',
      items: [
        { name: 'Usage & Credits', href: '/settings/usage', icon: Coins },
        { name: 'Transactions', href: '/settings/transactions', icon: FolderOpen },
      ],
    },
    {
      title: 'Connections',
      items: [
        { name: 'Integrations', href: '/settings/integrations', icon: Plug },
        { name: 'API & Developer', href: '/settings/api-keys', icon: Code },
      ],
    },
    {
      title: 'Security & Privacy',
      items: [
        { name: 'Security', href: '/settings/security', icon: Shield },
        { name: 'Privacy', href: '/settings/privacy', icon: Lock },
        { name: 'Notifications', href: '/settings/notifications', icon: Bell },
      ],
    },
    ...(isLocal ? [{
      title: 'Advanced',
      items: [
        { name: 'Environment', href: '/settings/env-manager', icon: Code },
      ],
    }] : []),
  ];

  return (
    <>
      <div className="h-screen flex flex-col w-full overflow-hidden bg-[#f6f6f6] dark:bg-[#070b13]">

        {/* Header - Fixed */}
        <div className="border-b border-border/50 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account, AI preferences, and integrations
            </p>
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col lg:flex-row gap-8 w-full max-w-7xl mx-auto px-4">
            {/* Sidebar Navigation - Independently Scrollable */}
            <aside className="lg:w-64 flex-shrink-0 overflow-y-auto py-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <nav className="space-y-6 pr-2">
                {sections.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {section.title}
                    </h3>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`
                              group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium 
                              transition-all duration-200
                              ${isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                              }
                            `}
                          >
                            <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                            <span className="flex-1">{item.name}</span>
                            {item.badge && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
                                {item.badge}
                              </span>
                            )}
                            <ChevronRight className={`h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100' : ''}`} />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Danger Zone */}
                <div>
                  <h3 className="text-xs font-semibold text-destructive/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" />
                    Danger Zone
                  </h3>
                  <Link
                    href="/settings/danger"
                    className={`
                      group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium 
                      transition-all duration-200
                      ${pathname === '/settings/danger'
                        ? 'bg-destructive/10 text-destructive'
                        : 'text-destructive/70 hover:bg-destructive/5 hover:text-destructive'
                      }
                    `}
                  >
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">Delete Account</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              </nav>
            </aside>

          {/* Main Content Area - Independently Scrollable */}
          <div className="flex-1 min-w-0 overflow-y-auto py-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            <div className="bg-transparent border-0 rounded-xl">
              {children}
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
