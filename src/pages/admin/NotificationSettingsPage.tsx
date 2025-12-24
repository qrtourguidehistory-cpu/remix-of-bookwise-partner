import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Mail, MessageSquare, Star } from "lucide-react";

export default function NotificationSettingsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    reminder_enabled: true,
    reminder_hours_before: [24, 1],
    reminder_channels: ["email"],
    confirmation_enabled: true,
    confirmation_channels: ["email"],
    review_request_enabled: false,
    review_request_delay_days: 1,
  });

  useEffect(() => {
    loadNotificationSettings();
  }, [profile]);

  const loadNotificationSettings = async () => {
    if (!profile?.business_id) return;

    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("business_id", profile.business_id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setSettings({
          reminder_enabled: data.reminder_enabled,
          reminder_hours_before: data.reminder_hours_before,
          reminder_channels: data.reminder_channels,
          confirmation_enabled: data.confirmation_enabled,
          confirmation_channels: data.confirmation_channels,
          review_request_enabled: data.review_request_enabled,
          review_request_delay_days: data.review_request_delay_days,
        });
      }
    } catch (error: any) {
      console.error("Error loading notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.business_id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_settings")
        .upsert({
          business_id: profile.business_id,
          ...settings,
        });

      if (error) throw error;
      toast.success("Notification settings saved");
    } catch (error: any) {
      toast.error("Error saving settings");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleHourBefore = (hour: number) => {
    const hours = settings.reminder_hours_before.includes(hour)
      ? settings.reminder_hours_before.filter((h) => h !== hour)
      : [...settings.reminder_hours_before, hour];
    setSettings({ ...settings, reminder_hours_before: hours });
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="p-4 text-center">Loading...</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            ← Back
          </Button>
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Appointment Reminders */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <div>
                  <Label className="text-base font-semibold">Appointment Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Send reminders to clients before appointments
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.reminder_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, reminder_enabled: checked })
                }
              />
            </div>

            {settings.reminder_enabled && (
              <div className="pl-8 space-y-3 border-l-2 border-primary/20">
                <Label className="text-sm font-semibold">Send reminders:</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="24h"
                      checked={settings.reminder_hours_before.includes(24)}
                      onCheckedChange={() => toggleHourBefore(24)}
                    />
                    <Label htmlFor="24h" className="cursor-pointer">
                      24 hours before
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="1h"
                      checked={settings.reminder_hours_before.includes(1)}
                      onCheckedChange={() => toggleHourBefore(1)}
                    />
                    <Label htmlFor="1h" className="cursor-pointer">
                      1 hour before
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Channels:</Label>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm">Email (enabled)</Label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Booking Confirmations */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-primary" />
              <div>
                <Label className="text-base font-semibold">Booking Confirmations</Label>
                <p className="text-sm text-muted-foreground">
                  Auto-send confirmation when booking is made
                </p>
              </div>
            </div>
            <Switch
              checked={settings.confirmation_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, confirmation_enabled: checked })
              }
            />
          </div>
        </Card>

        {/* Review Requests */}
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-primary" />
                <div>
                  <Label className="text-base font-semibold">Review Requests</Label>
                  <p className="text-sm text-muted-foreground">
                    Ask clients for reviews after appointments
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.review_request_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, review_request_enabled: checked })
                }
              />
            </div>

            {settings.review_request_enabled && (
              <div className="pl-8 space-y-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Send request after:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      value={settings.review_request_delay_days}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          review_request_delay_days: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">day(s)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          {saving ? "Saving..." : "Save Notification Settings"}
        </Button>
      </div>
    </MobileLayout>
  );
}
