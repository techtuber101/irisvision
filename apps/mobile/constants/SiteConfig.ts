export const siteConfig = {
  name: "Iris",
  url: "https://irisvision.ai",
  description: "Iris is a fully open source AI assistant that helps you accomplish real-world tasks with ease. Through natural conversation, Iris becomes your digital companion for research, data analysis, and everyday challenges.",
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
  creator: 'Iris Team - Adam Cohen Hillel, Marko Kraemer, Domenico Gagliardi, and Quoc Dat Le',
  publisher: 'Iris Team - Adam Cohen Hillel, Marko Kraemer, Domenico Gagliardi, and Quoc Dat Le',
  category: 'Technology',
  applicationName: 'Iris',
  twitterHandle: '@irisvisionai',
  githubUrl: 'https://github.com/irisvision-ai/iris',
  
  // Mobile-specific configurations
  bundleId: {
    ios: 'com.irisvision.iris',
    android: 'com.irisvision.iris'
  },
  
  // Theme colors
  colors: {
    primary: '#000000',
    background: '#ffffff',
    theme: '#000000'
  }
};

// React Native metadata structure (for web builds)
export const mobileMetadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: siteConfig.authors,
  creator: siteConfig.creator,
  publisher: siteConfig.publisher,
  category: siteConfig.category,
  applicationName: siteConfig.applicationName,
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    title: 'Iris - Open Source Generalist AI Agent',
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 630,
        alt: 'Iris - Open Source Generalist AI Agent',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Iris - Open Source Generalist AI Agent',
    description: siteConfig.description,
    creator: siteConfig.twitterHandle,
    site: siteConfig.twitterHandle,
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 630,
        alt: 'Iris - Open Source Generalist AI Agent',
      },
    ],
  },
  icons: {
    icon: [{ url: '/favicon.png', sizes: 'any' }],
    shortcut: '/favicon.png',
  },
  alternates: {
    canonical: siteConfig.url,
  },
}; 