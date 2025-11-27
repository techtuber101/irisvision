'use client';

import { Navbar } from "@/components/home/sections/navbar";
import SiteBackdrop from "@/components/ui/backgrounds/SiteBackdrop";
import { useAuth } from "@/components/AuthProvider";
import { ReactNode } from "react";
import { IrisLoadingScreen } from "@/components/ui/iris-loading-screen";

export default function HomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, isLoading } = useAuth();
  
  // Show loading screen without any layout/navbar during auth check
  if (isLoading) {
    return <IrisLoadingScreen />;
  }
  
  // If user is logged in, don't apply homepage layout (dashboard will handle its own layout)
  // This prevents mixing homepage styling with dashboard
  if (user) {
    return <>{children}</>;
  }
  
  // Apply homepage layout only for non-logged-in users
  return (
    // Force dark theme styling for homepage so it looks great in both app themes
    <div className="dark">
      <div className="homepage-layout relative min-h-dvh isolate overflow-hidden bg-background text-foreground">
        {/* Global hero-style backdrop for the entire page */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <SiteBackdrop />
        </div>

        {/* Optional vertical rails (subtle, hide on small screens) */}
        <div className="hidden md:block w-px h-full border-l border-white/10 fixed top-0 left-6 z-10" />
        <div className="hidden md:block w-px h-full border-r border-white/10 fixed top-0 right-6 z-10" />

        {/* Foreground content */}
        <div className="relative z-10">
          <Navbar />
          {children}
        </div>
      </div>
    </div>
  );
}
