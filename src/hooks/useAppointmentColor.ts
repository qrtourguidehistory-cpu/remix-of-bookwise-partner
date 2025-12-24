import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to get the appointment border color from business theme settings
 * Returns the configured color or default black (#000000)
 */
export function useAppointmentColor(): string {
  const { profile } = useAuth();
  const [appointmentColor, setAppointmentColor] = useState<string>("#000000");

  useEffect(() => {
    if (!profile?.business_id) {
      setAppointmentColor("#000000");
      return;
    }

    const loadAppointmentColor = async () => {
      try {
        const { data, error } = await supabase
          .from("businesses")
          .select("theme_settings")
          .eq("id", profile.business_id)
          .single();

        if (error) throw error;

        if (
          data?.theme_settings &&
          typeof data.theme_settings === "object" &&
          "appointmentColor" in data.theme_settings
        ) {
          const color = data.theme_settings.appointmentColor as string;
          setAppointmentColor(color || "#000000");
        } else {
          setAppointmentColor("#000000");
        }
      } catch (error) {
        console.error("Error loading appointment color:", error);
        setAppointmentColor("#000000");
      }
    };

    loadAppointmentColor();

    // Subscribe to changes in theme_settings
    const channel = supabase
      .channel(`business-theme-${profile.business_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "businesses",
          filter: `id=eq.${profile.business_id}`,
        },
        (payload) => {
          const newSettings = payload.new.theme_settings;
          if (
            newSettings &&
            typeof newSettings === "object" &&
            "appointmentColor" in newSettings
          ) {
            setAppointmentColor((newSettings.appointmentColor as string) || "#000000");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id]);

  return appointmentColor;
}

