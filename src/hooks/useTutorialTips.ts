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
  activeTip: TutorialTipId | null;
  setActiveTip: (tipId: TutorialTipId | null) => void;
  canShowTip: (tipId: TutorialTipId) => boolean;
}

export function useTutorialTips(): UseTutorialTipsReturn {
  const { user } = useAuth();
  const [seenTips, setSeenTips] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTip, setActiveTip] = useState<TutorialTipId | null>(null);

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

  // Check if tip has been seen (used for one-time tips)
  const shouldShowTip = useCallback((tipId: TutorialTipId): boolean => {
    if (isLoading) return false;
    return !seenTips.includes(tipId);
  }, [seenTips, isLoading]);

  // Check if a tip can be shown (not seen AND no other tip is active)
  const canShowTip = useCallback((tipId: TutorialTipId): boolean => {
    if (isLoading) return false;
    if (seenTips.includes(tipId)) return false;
    if (activeTip !== null && activeTip !== tipId) return false;
    return true;
  }, [seenTips, isLoading, activeTip]);

  const markTipAsSeen = useCallback(async (tipId: TutorialTipId) => {
    if (!user?.id || seenTips.includes(tipId)) return;

    const newSeenTips = [...seenTips, tipId];
    setSeenTips(newSeenTips);
    setActiveTip(null);

    // Save to localStorage
    localStorage.setItem(`seen_tips_${user.id}`, JSON.stringify(newSeenTips));
  }, [user?.id, seenTips]);

  return {
    shouldShowTip,
    markTipAsSeen,
    seenTips,
    isLoading,
    activeTip,
    setActiveTip,
    canShowTip,
  };
}
