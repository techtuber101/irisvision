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
      title: "Getting Started",
      items: [
        {
          title: "What is Iris?",
          url: "/docs/introduction",
        },
        {
          title: "Overview",
          url: "/docs/introduction/overview",
        },
        {
          title: "Meet Iris",
          url: "/docs/introduction/meet-iris",
        },
        {
          title: "Build Your Own Agents",
          url: "/docs/introduction/build-your-own",
        },
        {
          title: "How It Works",
          url: "/docs/introduction/how-it-works",
        },
        {
          title: "Why Iris?",
          url: "/docs/introduction/why-iris",
        },
        {
          title: "Quick Start Guide",
          url: "/docs/quick-start",
        },
        {
          title: "Welcome to Iris!",
          url: "/docs/quick-start/welcome",
        },
        {
          title: "Step 1: Your First Conversation",
          url: "/docs/quick-start/step-1",
        },
        {
          title: "Step 2: Create Your First Document",
          url: "/docs/quick-start/step-2",
        },
        {
          title: "Step 3: Search the Web",
          url: "/docs/quick-start/step-3",
        },
        {
          title: "Step 4: Try a Multi-Step Task",
          url: "/docs/quick-start/step-4",
        },
        {
          title: "Step 5: Explore Advanced Features",
          url: "/docs/quick-start/step-5",
        },
        {
          title: "Quick Tips for Success",
          url: "/docs/quick-start/best-practices",
        },
        {
          title: "What's Next?",
          url: "/docs/quick-start/next-steps",
        },
      ],
    },
    {
      title: "Iris Capabilities",
      items: [
        {
          title: "Research",
          url: "/docs/capabilities/research",
        },
        {
          title: "Slides Generation",
          url: "/docs/capabilities/slides-generation",
        },
        {
          title: "Website Creations",
          url: "/docs/capabilities/website-creations",
        },
        {
          title: "Data",
          url: "/docs/capabilities/data",
        },
        {
          title: "Docs",
          url: "/docs/capabilities/docs",
        },
        {
          title: "Career & People Research",
          url: "/docs/capabilities/career-people-research",
        },
        {
          title: "Image Generation",
          url: "/docs/capabilities/image-generation",
        },
        {
          title: "Video Generation",
          url: "/docs/capabilities/video-generation",
          comingSoon: true,
        },
      ],
    },
    {
      title: "Resources",
      items: [
        {
          title: "Formatting Showcase",
          url: "/docs/formatting-showcase",
        },
        {
          title: "Overview",
          url: "/docs/formatting-showcase/overview",
        },
        {
          title: "Headings",
          url: "/docs/formatting-showcase/headings",
        },
        {
          title: "Text Formatting",
          url: "/docs/formatting-showcase/text-formatting",
        },
        {
          title: "Lists",
          url: "/docs/formatting-showcase/lists",
        },
        {
          title: "Code Blocks",
          url: "/docs/formatting-showcase/code-blocks",
        },
        {
          title: "Tables",
          url: "/docs/formatting-showcase/tables",
        },
        {
          title: "Links",
          url: "/docs/formatting-showcase/links",
        },
        {
          title: "Blockquotes",
          url: "/docs/formatting-showcase/blockquotes",
        },
        {
          title: "Alerts & Callouts",
          url: "/docs/formatting-showcase/alerts",
        },
        {
          title: "Cards",
          url: "/docs/formatting-showcase/cards",
        },
        {
          title: "Combining Elements",
          url: "/docs/formatting-showcase/combining-elements",
        },
        {
          title: "Summary",
          url: "/docs/formatting-showcase/summary",
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
    <Sidebar className="w-72 border-none backdrop-blur-2xl" data-sidebar {...props}>
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
        {data.navMain.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel className="font-medium tracking-wide mb-2">{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items?.map((item) => (
                  <SidebarMenuItem key={item.title} className="mb-1">
                    <SidebarMenuButton 
                      className={`font-semibold py-2.5 px-3 min-h-[44px] ${item.comingSoon ? 'opacity-70 cursor-not-allowed' : ''}`}
                      asChild={!item.comingSoon}
                      isActive={isActive(item.url || '')}
                      disabled={item.comingSoon}
                    >
                      {item.comingSoon ? (
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="flex-1 text-left break-words leading-relaxed">{item.title}</span>
                          <Badge className="ml-2 flex-shrink-0 text-xs bg-amber-500/20 border-amber-500/60 text-white text-amber-500 whitespace-nowrap">
                            Coming Soon
                          </Badge>
                        </div>
                      ) : (item as any).external ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between w-full gap-2">
                          <span className="flex-1 text-left break-words leading-relaxed">{item.title}</span>
                        </a>
                      ) : (
                        <Link href={item.url || '#'} className="flex items-center justify-between w-full gap-2">
                          <span className="flex-1 text-left break-words leading-relaxed">{item.title}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="bg-transparent p-4 flex flex-row justify-between items-center">
        <div className="text-muted-foreground text-xs">Version 0.1.0</div>
        <DocsThemeToggle/>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

