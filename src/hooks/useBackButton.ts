import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Root pages where back should exit app or show confirmation
const ROOT_PAGES = ['/admin', '/welcome', '/', '/auth/login'];

// Pages that should use replace navigation (not kept in history)
const REPLACE_NAVIGATION_PAGES = ['/onboarding', '/admin/booking'];

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackPress = useRef<number>(0);

  const handleBackButton = useCallback(() => {
    const currentPath = location.pathname;
    
    // Check if we're on a root page
    const isRootPage = ROOT_PAGES.some(root => 
      currentPath === root || (root === '/admin' && currentPath === '/admin')
    );

    if (isRootPage) {
      const now = Date.now();
      
      // Double tap to exit
      if (now - lastBackPress.current < 2000) {
        // Exit app on second tap
        App.exitApp();
      } else {
        lastBackPress.current = now;
        // Could show a toast here: "Press back again to exit"
      }
    } else {
      // Navigate back normally
      navigate(-1);
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    // Only register on native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const backButtonHandler = App.addListener('backButton', ({ canGoBack }) => {
      handleBackButton();
    });

    return () => {
      backButtonHandler.then(handler => handler.remove());
    };
  }, [handleBackButton]);

  return { handleBackButton };
}

// Helper function to determine if navigation should use replace
export function shouldReplaceNavigation(targetPath: string): boolean {
  return REPLACE_NAVIGATION_PAGES.some(page => targetPath.startsWith(page));
}
