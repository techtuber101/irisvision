import { PostHog } from 'posthog-react-native';

// Initialize PostHog
const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY || '', {
  host: 'https://app.posthog.com',
});

// Analytics utilities
export const Analytics = {
  // Track screen views
  trackScreen: (screenName: string, properties?: any) => {
    posthog.screen(screenName, {
      ...properties,
      platform: 'mobile',
      app_version: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
    });
  },
  
  // Track user events
  trackEvent: (eventName: string, properties?: any) => {
    posthog.capture(eventName, {
      ...properties,
      platform: 'mobile',
      timestamp: new Date().toISOString(),
    });
  },
  
  // Track user properties
  identifyUser: (userId: string, properties?: any) => {
    posthog.identify(userId, {
      ...properties,
      platform: 'mobile',
      first_seen: new Date().toISOString(),
    });
  },
  
  // Track feature usage
  trackFeatureUsage: (featureName: string, properties?: any) => {
    posthog.capture('feature_used', {
      feature_name: featureName,
      ...properties,
      platform: 'mobile',
    });
  },
  
  // Track errors
  trackError: (error: Error, context?: any) => {
    posthog.capture('error_occurred', {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
      platform: 'mobile',
    });
  },
  
  // Track performance metrics
  trackPerformance: (metricName: string, value: number, unit: string = 'ms') => {
    posthog.capture('performance_metric', {
      metric_name: metricName,
      value,
      unit,
      platform: 'mobile',
    });
  },
  
  // Track user journey
  trackUserJourney: (step: string, properties?: any) => {
    posthog.capture('user_journey', {
      step,
      ...properties,
      platform: 'mobile',
    });
  },
};

export default posthog;

