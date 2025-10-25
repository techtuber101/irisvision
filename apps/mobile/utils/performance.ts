import { Platform } from 'react-native';

// Performance monitoring utilities
export const PerformanceMonitor = {
  // Track component render times
  trackRender: (componentName: string, startTime: number) => {
    if (__DEV__) {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (renderTime > 16) { // More than one frame (60fps)
        console.warn(`🐌 Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
      }
    }
  },

  // Track memory usage
  trackMemory: () => {
    if (__DEV__ && Platform.OS === 'web') {
      const memory = (performance as any).memory;
      if (memory) {
        const usedMB = memory.usedJSHeapSize / 1024 / 1024;
        const totalMB = memory.totalJSHeapSize / 1024 / 1024;
        
        if (usedMB > 100) { // More than 100MB
          console.warn(`🧠 High memory usage: ${usedMB.toFixed(2)}MB / ${totalMB.toFixed(2)}MB`);
        }
      }
    }
  },

  // Track network requests
  trackNetworkRequest: (url: string, duration: number) => {
    if (__DEV__) {
      if (duration > 5000) { // More than 5 seconds
        console.warn(`🌐 Slow network request: ${url} took ${duration}ms`);
      }
    }
  },
};

// Image optimization settings
export const ImageOptimization = {
  // Lazy loading threshold
  lazyThreshold: 200,
  
  // Image quality settings
  quality: Platform.OS === 'ios' ? 0.8 : 0.7,
  
  // Cache settings
  cachePolicy: 'memory-disk' as const,
};

// Bundle optimization
export const BundleOptimization = {
  // Enable tree shaking
  enableTreeShaking: true,
  
  // Code splitting
  enableCodeSplitting: true,
  
  // Lazy loading
  enableLazyLoading: true,
};

// Memory management
export const MemoryManagement = {
  // Clear unused images
  clearUnusedImages: () => {
    if (Platform.OS === 'web') {
      // Force garbage collection on web
      if ((window as any).gc) {
        (window as any).gc();
      }
    }
  },
  
  // Monitor memory pressure
  monitorMemoryPressure: () => {
    if (Platform.OS === 'ios') {
      // iOS memory pressure monitoring
      const memoryWarning = () => {
        console.warn('⚠️ Memory pressure detected');
        PerformanceMonitor.trackMemory();
      };
      
      // This would need to be implemented with native modules
      // For now, just log the concept
      console.log('Memory pressure monitoring available for iOS');
    }
  },
};

