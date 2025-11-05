"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  GalleryVerticalEnd,
} from "lucide-react"

import { TeamSwitcher } from "@/components/team-switcher"
import { NavUser } from "@/components/nav-user"
import { Badge } from "@/components/ui/badge"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { DocsThemeToggle } from "./docs/theme-toggle"
import { IrisLogo } from "./sidebar/iris-logo"
import Image from "next/image"
import { useEffect } from "react"
import { useTheme } from "next-themes"

const data = {
  user: {
    name: "Iris User",
    email: "docs@irisvision.ai",
    avatar: "/favicon.png",
  },
  teams: [
    {
      name: "Iris AI",
      logo: GalleryVerticalEnd,
      plan: "Platform",
    },
  ],
  navMain: [
    {
      title: "What is Iris?",
      url: "/docs/introduction",
      items: [
        {
          title: "Overview",
          url: "/docs/introduction#overview",
        },
        {
          title: "Iris - Our Flagship Agent",
          url: "/docs/introduction#meet-iris",
        },
        {
          title: "Build Your Own Agents",
          url: "/docs/introduction#build-your-own",
        },
        {
          title: "How It Works",
          url: "/docs/introduction#how-it-works",
        },
      ],
    },
    {
      title: "Quick Start Guide",
      url: "/docs/quick-start",
      items: [
        {
          title: "Welcome to Iris!",
          url: "/docs/quick-start#welcome",
        },
        {
          title: "Step 1: Your First Conversation",
          url: "/docs/quick-start#step-1",
        },
        {
          title: "Step 2: Create Your First Document",
          url: "/docs/quick-start#step-2",
        },
        {
          title: "Step 3: Search the Web",
          url: "/docs/quick-start#step-3",
        },
        {
          title: "Step 4: Try a Multi-Step Task",
          url: "/docs/quick-start#step-4",
        },
        {
          title: "Step 5: Explore Advanced Features",
          url: "/docs/quick-start#step-5",
        },
        {
          title: "Quick Tips for Success",
          url: "/docs/quick-start#best-practices",
        },
        {
          title: "What's Next?",
          url: "/docs/quick-start#next-steps",
        },
      ],
    },
    {
      title: "Complete User Guide",
      url: "/docs/user-guide",
      items: [
        {
          title: "Overview",
          url: "/docs/user-guide#overview",
        },
        {
          title: "Core Capabilities",
          url: "/docs/user-guide#core-capabilities",
        },
        {
          title: "Image Generation & Design",
          url: "/docs/user-guide#image-generation",
        },
        {
          title: "Presentation & Slide Generation",
          url: "/docs/user-guide#slide-generation",
        },
        {
          title: "Research & Information Gathering",
          url: "/docs/user-guide#research",
        },
        {
          title: "Document Creation",
          url: "/docs/user-guide#document-creation",
        },
        {
          title: "Building Custom Agents",
          url: "/docs/user-guide#agent-building",
        },
        {
          title: "External Integrations",
          url: "/docs/user-guide#integrations",
        },
        {
          title: "Automation & Triggers",
          url: "/docs/user-guide#automation",
        },
        {
          title: "Best Practices",
          url: "/docs/user-guide#best-practices",
        },
        {
          title: "Next Steps",
          url: "/docs/user-guide#next-steps",
        },
      ],
    },
    {
      title: "Formatting Showcase",
      url: "/docs/formatting-showcase",
      items: [
        {
          title: "Overview",
          url: "/docs/formatting-showcase#overview",
        },
        {
          title: "Headings",
          url: "/docs/formatting-showcase#headings",
        },
        {
          title: "Text Formatting",
          url: "/docs/formatting-showcase#text-formatting",
        },
        {
          title: "Lists",
          url: "/docs/formatting-showcase#lists",
        },
        {
          title: "Code Blocks",
          url: "/docs/formatting-showcase#code-blocks",
        },
        {
          title: "Tables",
          url: "/docs/formatting-showcase#tables",
        },
        {
          title: "Links",
          url: "/docs/formatting-showcase#links",
        },
        {
          title: "Blockquotes",
          url: "/docs/formatting-showcase#blockquotes",
        },
        {
          title: "Alerts & Callouts",
          url: "/docs/formatting-showcase#alerts",
        },
        {
          title: "Cards",
          url: "/docs/formatting-showcase#cards",
        },
        {
          title: "Combining Elements",
          url: "/docs/formatting-showcase#combining",
        },
        {
          title: "Summary",
          url: "/docs/formatting-showcase#summary",
        },
      ],
    },
    {
      title: "Self Hosting",
      url: "/docs/self-hosting",
      items: [
        {
          title: "What You Need First",
          url: "/docs/self-hosting#prerequisites",
        },
        {
          title: "Step 1: Clone and Enter",
          url: "/docs/self-hosting#step-1-clone",
        },
        {
          title: "Step 2: Run the Setup Wizard",
          url: "/docs/self-hosting#step-2-run-wizard",
        },
        {
          title: "Step 3: Provide Your Credentials",
          url: "/docs/self-hosting#step-3-provide-credentials",
        },
        {
          title: "Step 4: Database Setup",
          url: "/docs/self-hosting#step-4-database-setup",
        },
        {
          title: "Step 5: Start the app",
          url: "/docs/self-hosting#step-5-start",
        },
        {
          title: "You're Done! 🎉",
          url: "/docs/self-hosting#youre-done",
        },
      ],
    },
    {
      title: "Quick Links",
      items: [
        {
          title: "Homepage",
          url: "https://irisvision.ai/dashboard",
          external: true,
        },
        {
          title: "Dashboard",
          url: "https://irisvision.ai/dashboard",
          external: true,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false);
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = !mounted
    ? '/irislogoblack.png'
    : resolvedTheme === 'dark'
      ? '/irislogowhitebig.png'
      : '/irislogoblack.png';
  

  const isActive = (url: string) => {
    return pathname === url
  }

  return (
    <Sidebar className="w-72 border-none backdrop-blur-2xl" {...props}>
      <SidebarHeader className="bg-transparent p-6 px-2">
        <Image
          src={logoSrc}
          alt="Iris Logo"
          width={80}
          height={14}
          className="md:w-[100px] md:h-[18px]"
          priority
        /> 
      </SidebarHeader>
      <SidebarContent className="px-2 bg-transparent scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
        {data.navMain.map((section) => {
          const hasItems = section.items && section.items.length > 0;
          const isHeaderWithSubItems = section.url && hasItems;
          
          return (
            <SidebarGroup key={section.title}>
              {isHeaderWithSubItems ? (
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild
                      isActive={pathname === section.url}
                      className="font-semibold"
                    >
                      <Link href={section.url}>
                        {section.title}
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      {section.items?.map((item) => {
                        const itemUrl = item.url || '';
                        const basePath = itemUrl.split('#')[0];
                        const isItemActive = pathname === basePath;
                        
                        return (
                          <SidebarMenuSubItem key={item.title}>
                            {(item as any).external ? (
                              <SidebarMenuSubButton 
                                asChild
                                isActive={false}
                              >
                                <a href={item.url} target="_blank" rel="noopener noreferrer">
                                  {item.title}
                                </a>
                              </SidebarMenuSubButton>
                            ) : (
                              <SidebarMenuSubButton 
                                asChild
                                isActive={isItemActive}
                              >
                                <Link href={item.url || '#'}>
                                  {item.title}
                                </Link>
                              </SidebarMenuSubButton>
                            )}
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                </SidebarMenu>
              ) : (
                <>
                  <SidebarGroupLabel className="font-medium tracking-wide">{section.title}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items?.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            className={`font-semibold ${item.comingSoon ? 'opacity-70 cursor-not-allowed' : ''}`}
                            asChild={!item.comingSoon}
                            isActive={isActive(item.url || '')}
                            disabled={item.comingSoon}
                          >
                            {item.comingSoon ? (
                              <div className="flex items-center justify-between w-full">
                                <span>{item.title}</span>
                                <Badge className="ml-auto text-xs bg-amber-500/20 border-amber-500/60 text-white text-amber-500">
                                  Coming Soon
                                </Badge>
                              </div>
                            ) : item.external ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full">
                                <span>{item.title}</span>
                              </a>
                            ) : (
                              <Link href={item.url || '#'} className="flex items-center justify-between w-full">
                                <span>{item.title}</span>
                              </Link>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="bg-transparent p-4 flex flex-row justify-between items-center">
        <div className="text-muted-foreground text-xs">Version 0.1.0</div>
        <DocsThemeToggle/>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

