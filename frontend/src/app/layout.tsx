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
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-1024x1024.png', sizes: '1024x1024', type: 'image/png' },
      { url: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon-256x256.png', sizes: '256x256', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
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
        {/* Favicon links - SVG first for better scaling and maximum visibility */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" type="image/svg+xml" href="/favicon.svg" />
        {/* Light mode favicons - ordered from largest to smallest for maximum browser visibility */}
        <link rel="icon" type="image/png" href="/favicon-2048x2048.png" sizes="2048x2048" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-1536x1536.png" sizes="1536x1536" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-1024x1024.png" sizes="1024x1024" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-768x768.png" sizes="768x768" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-512x512.png" sizes="512x512" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-384x384.png" sizes="384x384" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-256x256.png" sizes="256x256" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-192x192.png" sizes="192x192" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-128x128.png" sizes="128x128" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-64x64.png" sizes="64x64" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-48x48.png" sizes="48x48" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-32x32.png" sizes="32x32" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-24x24.png" sizes="24x24" media="(prefers-color-scheme: light)" />
        <link rel="icon" type="image/png" href="/favicon-16x16.png" sizes="16x16" media="(prefers-color-scheme: light)" />
        {/* Dark mode favicons - white versions - ordered from largest to smallest */}
        <link rel="icon" type="image/png" href="/favicon-2048x2048-white.png" sizes="2048x2048" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-1536x1536-white.png" sizes="1536x1536" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-1024x1024-white.png" sizes="1024x1024" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-768x768-white.png" sizes="768x768" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-512x512-white.png" sizes="512x512" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-384x384-white.png" sizes="384x384" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-256x256-white.png" sizes="256x256" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-192x192-white.png" sizes="192x192" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-128x128-white.png" sizes="128x128" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-96x96-white.png" sizes="96x96" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-64x64-white.png" sizes="64x64" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-48x48-white.png" sizes="48x48" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-32x32-white.png" sizes="32x32" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-24x24-white.png" sizes="24x24" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/png" href="/favicon-16x16-white.png" sizes="16x16" media="(prefers-color-scheme: dark)" />
        <link rel="alternate icon" href="/favicon.ico" media="(prefers-color-scheme: light)" />
        <link rel="alternate icon" href="/favicon-white.ico" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" media="(prefers-color-scheme: light)" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-white.png" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-title" content="Iris" />
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Dynamic favicon update for class-based dark mode */}
        <Script id="dark-mode-favicon" strategy="afterInteractive">
          {`(function() {
            function updateFavicons() {
              const isDark = document.documentElement.classList.contains('dark');
              const timestamp = '?v=' + Date.now();
              
              // Update all PNG favicon links
              document.querySelectorAll('link[rel="icon"][type="image/png"]').forEach(link => {
                const sizes = link.getAttribute('sizes');
                if (sizes) {
                  const size = sizes.split('x')[0];
                  const newHref = isDark 
                    ? '/favicon-' + size + 'x' + size + '-white.png' + timestamp
                    : '/favicon-' + size + 'x' + size + '.png' + timestamp;
                  if (link.href !== newHref) {
                    link.href = newHref;
                  }
                }
              });
              
              // Update alternate icon (ICO)
              const altIcons = document.querySelectorAll('link[rel="alternate icon"]');
              altIcons.forEach(link => {
                const newHref = (isDark ? '/favicon-white.ico' : '/favicon.ico') + timestamp;
                if (link.href !== newHref) {
                  link.href = newHref;
                }
              });
              
              // Update apple touch icon
              document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(link => {
                const newHref = (isDark ? '/apple-touch-icon-white.png' : '/apple-touch-icon.png') + timestamp;
                if (link.href !== newHref) {
                  link.href = newHref;
                }
              });
              
              // Update shortcut icon to force browser refresh
              const shortcutIcons = document.querySelectorAll('link[rel="shortcut icon"]');
              shortcutIcons.forEach(link => {
                const newHref = (isDark ? '/favicon-white.ico' : '/favicon.ico') + timestamp;
                link.href = newHref;
              });
            }
            
            // Wait a bit for theme to initialize, then set up observer
            function init() {
              // Initial update after a short delay to ensure theme is set
              setTimeout(updateFavicons, 100);
              
              // Watch for class changes on html element
              const observer = new MutationObserver(function(mutations) {
                let shouldUpdate = false;
                mutations.forEach(function(mutation) {
                  if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    shouldUpdate = true;
                  }
                });
                if (shouldUpdate) {
                  setTimeout(updateFavicons, 50);
                }
              });
              
              observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class']
              });
            }
            
            // Run when DOM is ready
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', init);
            } else {
              init();
            }
          })();`}
        </Script>
        
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
