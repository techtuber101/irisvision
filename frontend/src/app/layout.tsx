import { ThemeProvider } from '@/components/theme-provider';
import { siteConfig } from '@/lib/site';
import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@vercel/analytics/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';
import { PostHogIdentify } from '@/components/posthog-identify';
import '@/lib/polyfills'; // Load polyfills early

export const viewport: Viewport = {
  themeColor: 'black',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description:
    'Iris is a fully open source AI assistant that helps you accomplish real-world tasks with ease. Through natural conversation, Iris becomes your digital companion for research, data analysis, and everyday challenges.',
  keywords: [
    'AI',
    'artificial intelligence',
    'browser automation',
    'web scraping',
    'file management',
    'AI assistant',
    'open source',
    'research',
    'data analysis',
  ],
  authors: [{ name: 'Iris Team', url: 'https://irisvision.ai' }],
  creator:
    'Iris Team',
  publisher:
    'Iris Team',
  category: 'Technology',
  applicationName: 'Iris',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: 'Iris Intelligence',
    description:
      'Iris is a fully open source AI assistant that helps you accomplish real-world tasks with ease through natural conversation.',
    url: siteConfig.url,
    siteName: 'Iris',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 568,
        alt: 'Iris Intelligence',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Iris Intelligence',
    description:
      'Iris is a fully open source AI assistant that helps you accomplish real-world tasks with ease through natural conversation.',
    creator: '@irisvisionai',
    site: '@irisvisionai',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 568,
        alt: 'Iris Intelligence',
      },
    ],
  },
  icons: {
    icon: [
      { url: '/favicon-1024x1024.png', sizes: '1024x1024', type: 'image/png' },
      { url: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon-256x256.png', sizes: '256x256', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  manifest: '/site.webmanifest',
  // manifest: "/manifest.json",
  alternates: {
    canonical: siteConfig.url,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Favicon links - SVG first for better scaling */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" href="/favicon-1024x1024.png" sizes="1024x1024" />
        <link rel="icon" type="image/png" href="/favicon-512x512.png" sizes="512x512" />
        <link rel="icon" type="image/png" href="/favicon-256x256.png" sizes="256x256" />
        <link rel="icon" type="image/png" href="/favicon-192x192.png" sizes="192x192" />
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="Iris" />
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-PCHSN4M2');`}
        </Script>
        <Script async src="https://cdn.tolt.io/tolt.js" data-tolt={process.env.NEXT_PUBLIC_TOLT_REFERRAL_ID}></Script>
      </head>

      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased font-sans bg-background`}
        suppressHydrationWarning
      >
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PCHSN4M2"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            {children}
            <Toaster />
          </Providers>
          <Analytics />
          <GoogleAnalytics gaId="G-6ETJFB3PT3" />
          <SpeedInsights />
          <PostHogIdentify />
        </ThemeProvider>
      </body>
    </html>
  );
}
