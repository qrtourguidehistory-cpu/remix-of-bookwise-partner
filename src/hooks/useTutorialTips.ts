import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type TutorialTipId = 
  | "add_appointment"
  | "calendar_filters"
  | "bottom_navigation"
  | "client_management"
  | "staff_schedule"
  | "sales_tracking"
  | "complete_public_profile"
  | "add_button_tip"
  | "filter_button_tip"
  | "clients_button_tip";

interface UseTutorialTipsReturn {
  shouldShowTip: (tipId: TutorialTipId) => boolean;
  markTipAsSeen: (tipId: TutorialTipId) => Promise<void>;
  seenTips: string[];
  isLoading: boolean;
}

export function useTutorialTips(): UseTutorialTipsReturn {
  const { user } = useAuth();
  const [seenTips, setSeenTips] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchSeenTips();
    } else {
      setIsLoading(false);
    }
  }, [user?.id]);

  const fetchSeenTips = async () => {
    if (!user?.id) return;

    try {
      // Use localStorage for storing seen tips
      const localTips = localStorage.getItem(`seen_tips_${user.id}`);
      if (localTips) {
        setSeenTips(JSON.parse(localTips));
      }
    } catch (error) {
      console.error("Error fetching seen tips:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const shouldShowTip = useCallback((tipId: TutorialTipId): boolean => {
    if (isLoading) return false;
    return !seenTips.includes(tipId);
  }, [seenTips, isLoading]);

  const markTipAsSeen = useCallback(async (tipId: TutorialTipId) => {
    if (!user?.id || seenTips.includes(tipId)) return;

    const newSeenTips = [...seenTips, tipId];
    setSeenTips(newSeenTips);

    // Save to localStorage
    localStorage.setItem(`seen_tips_${user.id}`, JSON.stringify(newSeenTips));
  }, [user?.id, seenTips]);

  return {
    shouldShowTip,
    markTipAsSeen,
    seenTips,
    isLoading,
  };
}
