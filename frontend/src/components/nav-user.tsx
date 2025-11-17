"use client"

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 p-5 rounded-2xl border border-black/10 bg-white/95 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.1)] dark:border-white/10 dark:bg-[rgba(7,10,17,0.95)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] dark:shadow-[0_10px_20px_-10px_rgba(0,0,0,0.6)]"
            side={isMobile ? "bottom" : "right"}
            align="center"
            sideOffset={8}
          >
            {/* Iris Header */}
            <header className="mb-4 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-black/10 ring-1 ring-black/20 flex items-center justify-center dark:bg-white/10 dark:ring-white/20">
                <img src="/irislogoblack.png?v=2" alt="Iris Logo" className="h-4 w-4 dark:hidden" />
                <img src="/irissymbolwhite.png?v=2" alt="Iris Logo" className="h-4 w-4 hidden dark:block" />
              </div>
              <h3 className="text-sm font-medium text-black/80 dark:text-white/80">Iris</h3>
            </header>
            
            {/* User Info Section */}
            <div className="relative">
              <div className="relative rounded-2xl border border-black/10 bg-black/5 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-300 dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-xl ring-1 ring-black/10 dark:ring-white/10">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-xl bg-black/10 text-black/80 dark:bg-white/10 dark:text-white/80">CN</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-black/90 truncate dark:text-white/90">{user.name}</div>
                    <div className="text-xs text-black/60 truncate dark:text-white/60">{user.email}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="mt-4 space-y-2">
              {/* Upgrade Section */}
              <div className="rounded-2xl border border-black/10 bg-black/5 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-black/8 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] dark:hover:bg-white/8 dark:hover:border-white/15">
                <DropdownMenuItem className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center">
                  <Sparkles className="h-4 w-4 mr-3 flex-shrink-0" />
                  <span className="text-sm">Upgrade to Pro</span>
                </DropdownMenuItem>
              </div>

              {/* Settings Section */}
              <div className="rounded-2xl border border-black/10 bg-black/5 p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-300 hover:bg-black/8 hover:border-black/15 dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] dark:hover:bg-white/8 dark:hover:border-white/15">
                <div className="space-y-1">
                  <DropdownMenuItem className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center">
                    <BadgeCheck className="h-4 w-4 mr-3 flex-shrink-0" />
                    <span className="text-sm">Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center">
                    <CreditCard className="h-4 w-4 mr-3 flex-shrink-0" />
                    <span className="text-sm">Billing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="h-auto p-3 rounded-xl bg-black/5 border border-black/10 text-black/80 hover:bg-black/10 hover:border-black/20 transition-all duration-200 focus:bg-black/10 focus:border-black/20 dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20 dark:focus:bg-white/10 dark:focus:border-white/20 flex items-center">
                    <Bell className="h-4 w-4 mr-3 flex-shrink-0" />
                    <span className="text-sm">Notifications</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      // Theme toggle logic would go here
                      const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                      if (newTheme === 'dark') {
                        document.documentElement.classList.add('dark');
                      } else {
                        document.documentElement.classList.remove('dark');
                      }
                    }}
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
                <DropdownMenuItem className="h-auto p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 focus:bg-red-500/20 focus:border-red-500/30 dark:text-red-400 flex items-center">
                  <LogOut className="h-4 w-4 mr-3 flex-shrink-0" />
                  <span className="text-sm">Log out</span>
                </DropdownMenuItem>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
