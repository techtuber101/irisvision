export const clearUserLocalStorage = () => {
  if (typeof window === 'undefined') return;

  try {
    // Note: Preserve model preference on logout - user choice should persist
    // localStorage.removeItem('iris-preferred-model-v3');
    localStorage.removeItem('customModels');
    localStorage.removeItem('iris-model-selection-v2');
    localStorage.removeItem('agent-selection-storage');
    localStorage.removeItem('auth-tracking-storage');
    localStorage.removeItem('pendingAgentPrompt');
    localStorage.removeItem('iris_upgrade_dialog_displayed');
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('maintenance-dismissed-')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('✅ Local storage cleared on logout');
  } catch (error) {
    console.error('❌ Error clearing local storage:', error);
  }
}; 