import * as Sentry from '@sentry/react-native';

// Initialize Sentry
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_APP_ENV || 'development',
  
  // Performance monitoring
  tracesSampleRate: process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 0.1 : 1.0,
  
  // Session tracking
  enableAutoSessionTracking: true,
  
  // Native crash reporting
  enableNativeCrashHandling: true,
  
  // Debug mode for development
  debug: process.env.EXPO_PUBLIC_APP_ENV === 'development',
  
  // Custom tags
  beforeSend(event) {
    // Add custom context
    event.tags = {
      ...event.tags,
      platform: 'mobile',
      app_version: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
    };
    
    return event;
  },
});

// Performance monitoring utilities
export const PerformanceTracker = {
  // Track screen transitions
  trackScreen: (screenName: string) => {
    Sentry.addBreadcrumb({
      message: `Screen: ${screenName}`,
      category: 'navigation',
      level: 'info',
    });
  },
  
  // Track user actions
  trackAction: (action: string, data?: any) => {
    Sentry.addBreadcrumb({
      message: `Action: ${action}`,
      category: 'user',
      level: 'info',
      data,
    });
  },
  
  // Track API calls
  trackApiCall: (url: string, method: string, status: number, duration: number) => {
    Sentry.addBreadcrumb({
      message: `API: ${method} ${url}`,
      category: 'http',
      level: status >= 400 ? 'error' : 'info',
      data: {
        url,
        method,
        status,
        duration,
      },
    });
  },
  
  // Track errors with context
  trackError: (error: Error, context?: any) => {
    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext('error_context', context);
      }
      Sentry.captureException(error);
    });
  },
  
  // Track performance metrics
  trackPerformance: (name: string, value: number, unit: string = 'ms') => {
    Sentry.addBreadcrumb({
      message: `Performance: ${name}`,
      category: 'performance',
      level: 'info',
      data: {
        value,
        unit,
      },
    });
  },
};

export default Sentry;

