import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send } from "lucide-react";

export default function SMSTemplatesPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState({
    reminder_24h: "",
    reminder_1h: "",
    confirmation: "",
    review_request: "",
  });

  useEffect(() => {
    loadTemplates();
  }, [profile]);

  const loadTemplates = async () => {
    if (!profile?.business_id) return;

    try {
      const { data, error } = await supabase
        .from("sms_templates")
        .select("*")
        .eq("business_id", profile.business_id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setTemplates({
          reminder_24h: data.reminder_24h || "",
          reminder_1h: data.reminder_1h || "",
          confirmation: data.confirmation || "",
          review_request: data.review_request || "",
        });
      }
    } catch (error: any) {
      console.error("Error loading templates:", error);
    }
  };

  const handleSave = async () => {
    if (!profile?.business_id) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("sms_templates").upsert({
        business_id: profile.business_id,
        ...templates,
      });

      if (error) throw error;
      toast.success("SMS templates saved successfully");
    } catch (error: any) {
      toast.error("Error saving templates");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSMS = async () => {
    toast.info("Test SMS functionality coming soon");
  };

  const variables = [
    { name: "{client_name}", desc: "Client's full name" },
    { name: "{service_name}", desc: "Service name" },
    { name: "{staff_name}", desc: "Staff member name" },
    { name: "{date}", desc: "Appointment date" },
    { name: "{time}", desc: "Appointment time" },
    { name: "{business_name}", desc: "Your business name" },
  ];

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            ← Back
          </Button>
          <h2 className="text-lg font-semibold">SMS Templates</h2>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Info Card */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Available Variables</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Use these variables in your templates:
              </p>
              <div className="space-y-1">
                {variables.map((v) => (
                  <div key={v.name} className="flex gap-2 text-sm">
                    <Badge variant="secondary" className="font-mono">
                      {v.name}
                    </Badge>
                    <span className="text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* 24 Hour Reminder */}
        <Card className="p-4 space-y-3">
          <div>
            <Label className="text-base font-semibold">24 Hour Reminder</Label>
            <p className="text-sm text-muted-foreground">
              Sent 24 hours before appointment
            </p>
          </div>
          <Textarea
            value={templates.reminder_24h}
            onChange={(e) => setTemplates({ ...templates, reminder_24h: e.target.value })}
            placeholder="Hi {client_name}! Reminder: You have an appointment for {service_name} with {staff_name} tomorrow at {time}."
            rows={4}
          />
        </Card>

        {/* 1 Hour Reminder */}
        <Card className="p-4 space-y-3">
          <div>
            <Label className="text-base font-semibold">1 Hour Reminder</Label>
            <p className="text-sm text-muted-foreground">
              Sent 1 hour before appointment
            </p>
          </div>
          <Textarea
            value={templates.reminder_1h}
            onChange={(e) => setTemplates({ ...templates, reminder_1h: e.target.value })}
            placeholder="Hi {client_name}! Your appointment with {staff_name} is in 1 hour at {time}. See you soon!"
            rows={4}
          />
        </Card>

        {/* Confirmation */}
        <Card className="p-4 space-y-3">
          <div>
            <Label className="text-base font-semibold">Booking Confirmation</Label>
            <p className="text-sm text-muted-foreground">
              Sent when appointment is booked
            </p>
          </div>
          <Textarea
            value={templates.confirmation}
            onChange={(e) => setTemplates({ ...templates, confirmation: e.target.value })}
            placeholder="Hi {client_name}! Your {service_name} appointment with {staff_name} is confirmed for {date} at {time}."
            rows={4}
          />
        </Card>

        {/* Review Request */}
        <Card className="p-4 space-y-3">
          <div>
            <Label className="text-base font-semibold">Review Request</Label>
            <p className="text-sm text-muted-foreground">
              Sent after appointment completion
            </p>
          </div>
          <Textarea
            value={templates.review_request}
            onChange={(e) => setTemplates({ ...templates, review_request: e.target.value })}
            placeholder="Hi {client_name}! Thank you for visiting {business_name}. We'd love your feedback! Please leave us a review."
            rows={4}
          />
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleTestSMS}
            variant="outline"
            className="flex-1"
            disabled={loading}
          >
            <Send className="w-4 h-4 mr-2" />
            Test SMS
          </Button>
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? "Saving..." : "Save Templates"}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
