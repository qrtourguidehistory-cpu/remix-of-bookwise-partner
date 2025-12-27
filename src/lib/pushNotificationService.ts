import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Push Notification Service for Capacitor (Android/iOS)
 * Handles registration, permissions, and token management
 */
class PushNotificationService {
  private initialized = false;

  /**
   * Check if push notifications are available (native platform only)
   */
  isAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Initialize push notifications
   * Call this once when the app starts (after user is authenticated)
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      console.log('[PushNotifications] Already initialized');
      return true;
    }

    if (!this.isAvailable()) {
      console.log('[PushNotifications] Not available on web platform');
      return false;
    }

    try {
      // Request permission
      const permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        const result = await PushNotifications.requestPermissions();
        if (result.receive !== 'granted') {
          console.log('[PushNotifications] Permission denied');
          return false;
        }
      } else if (permStatus.receive !== 'granted') {
        console.log('[PushNotifications] Permission not granted:', permStatus.receive);
        return false;
      }

      // Register for push notifications
      await PushNotifications.register();

      // Set up listeners
      this.setupListeners();

      this.initialized = true;
      console.log('[PushNotifications] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[PushNotifications] Initialization error:', error);
      return false;
    }
  }

  /**
   * Set up push notification listeners
   */
  private setupListeners(): void {
    // On registration success - save token to database
    PushNotifications.addListener('registration', async (token) => {
      console.log('[PushNotifications] Registration token:', token.value);
      await this.saveTokenToDatabase(token.value);
    });

    // On registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotifications] Registration error:', error);
    });

    // On push notification received (foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNotifications] Received in foreground:', notification);
      // You can show a local notification or toast here
      this.handleForegroundNotification(notification);
    });

    // On push notification action (user tapped notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[PushNotifications] Action performed:', notification);
      this.handleNotificationAction(notification);
    });
  }

  /**
   * Save push token to user's profile in database
   */
  private async saveTokenToDatabase(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('[PushNotifications] No authenticated user, cannot save token');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);

      if (error) {
        console.error('[PushNotifications] Error saving token:', error);
      } else {
        console.log('[PushNotifications] Token saved to database');
      }
    } catch (error) {
      console.error('[PushNotifications] Error saving token:', error);
    }
  }

  /**
   * Handle foreground notification
   */
  private handleForegroundNotification(notification: any): void {
    // Import toast dynamically to avoid circular dependencies
    import('sonner').then(({ toast }) => {
      toast(notification.title, {
        description: notification.body,
      });
    });
  }

  /**
   * Handle notification action (user tapped)
   */
  private handleNotificationAction(action: any): void {
    const data = action.notification?.data;
    
    if (data?.appointmentId) {
      // Navigate to appointment details
      window.location.href = `/?appointment=${data.appointmentId}`;
    } else if (data?.route) {
      // Navigate to specific route
      window.location.href = data.route;
    }
  }

  /**
   * Clear push token from database (call on logout)
   */
  async clearToken(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await supabase
          .from('profiles')
          .update({ push_token: null })
          .eq('id', user.id);
        
        console.log('[PushNotifications] Token cleared from database');
      }
    } catch (error) {
      console.error('[PushNotifications] Error clearing token:', error);
    }
  }

  /**
   * Get current permission status
   */
  async getPermissionStatus(): Promise<string> {
    if (!this.isAvailable()) {
      return 'denied';
    }

    const status = await PushNotifications.checkPermissions();
    return status.receive;
  }

  /**
   * Remove all notification listeners (cleanup)
   */
  async removeAllListeners(): Promise<void> {
    await PushNotifications.removeAllListeners();
    this.initialized = false;
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();

// Export convenience functions
export const initializePushNotifications = () => pushNotificationService.initialize();
export const clearPushToken = () => pushNotificationService.clearToken();
export const getPushPermissionStatus = () => pushNotificationService.getPermissionStatus();
