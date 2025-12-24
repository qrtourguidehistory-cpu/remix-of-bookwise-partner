import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, Star, RefreshCw, X } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
  service_id: string;
  staff_id: string;
  services: { name: string; price: number; duration_minutes: number } | null;
  staff: { full_name: string } | null;
  reviews: { rating: number; comment: string }[];
}

export default function ClientPortal() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{ show: boolean; appointment: Appointment | null }>({
    show: false,
    appointment: null,
  });
  const [reviewData, setReviewData] = useState({ rating: 5, comment: "" });

  useEffect(() => {
    if (user) {
      loadAppointments();
      
      // Subscribe to realtime appointment changes
      const channel = supabase
        .channel('client-appointments')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
          },
          (payload) => {
            // Reload appointments when any change occurs
            loadAppointments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadAppointments = async () => {
    if (!user) return;

    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!clientData) {
        toast.error("Client profile not found");
        return;
      }

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          services!appointments_service_id_fkey(name, price, duration_minutes),
          staff!appointments_staff_id_fkey(full_name),
          reviews(rating, comment)
        `)
        .eq("client_id", clientData.id)
        .order("appointment_date", { ascending: false });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = (data || []).filter(apt => 
        new Date(apt.appointment_date) >= today && apt.status !== "cancelled"
      ) as any[];
      const past = (data || []).filter(apt => 
        new Date(apt.appointment_date) < today || apt.status === "completed"
      ) as any[];

      setUpcomingAppointments(upcoming);
      setPastAppointments(past);
    } catch (error: any) {
      toast.error("Error loading appointments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (error) throw error;
      toast.success("Appointment cancelled successfully");
      loadAppointments();
    } catch (error: any) {
      toast.error("Error cancelling appointment");
      console.error(error);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewDialog.appointment || !user) return;

    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("id, business_id")
        .eq("user_id", user.id)
        .single();

      if (!clientData) throw new Error("Client not found");

      const { error } = await supabase.from("reviews").insert({
        appointment_id: reviewDialog.appointment.id,
        client_id: clientData.id,
        business_id: clientData.business_id,
        service_id: reviewDialog.appointment.service_id,
        staff_id: reviewDialog.appointment.staff_id,
        rating: reviewData.rating,
        comment: reviewData.comment,
      } as any);

      if (error) throw error;
      toast.success("Review submitted successfully");
      setReviewDialog({ show: false, appointment: null });
      setReviewData({ rating: 5, comment: "" });
      loadAppointments();
    } catch (error: any) {
      toast.error("Error submitting review");
      console.error(error);
    }
  };

  const renderAppointmentCard = (appointment: Appointment, showActions: boolean = false) => {
    const hasReview = appointment.reviews && appointment.reviews.length > 0;
    const statusColors: Record<string, string> = {
      confirmed: "bg-green-500",
      pending: "bg-yellow-500",
      completed: "bg-blue-500",
      cancelled: "bg-red-500",
    };

    return (
      <Card key={appointment.id} className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{appointment.services?.name || "Servicio"}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <User className="w-4 h-4" />
              {appointment.staff?.full_name}
            </p>
          </div>
          <Badge className={`${statusColors[appointment.status]} text-white`}>
            {appointment.status}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(appointment.appointment_date), "PPP")}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{appointment.start_time} - {appointment.end_time}</span>
          </div>
        </div>

        {appointment.notes && (
          <p className="text-sm text-muted-foreground mt-3 p-2 bg-muted/50 rounded">
            {appointment.notes}
          </p>
        )}

        {showActions && (
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/booking/reschedule/${appointment.id}`)}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Reschedule
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCancelAppointment(appointment.id)}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        )}

        {!hasReview && appointment.status === "completed" && (
          <Button
            size="sm"
            onClick={() => setReviewDialog({ show: true, appointment })}
            className="w-full mt-3"
          >
            <Star className="w-4 h-4 mr-1" />
            Leave Review
          </Button>
        )}

        {hasReview && (
          <div className="mt-3 p-3 bg-primary/5 rounded-lg">
            <div className="flex items-center gap-1 mb-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < appointment.reviews[0].rating ? "fill-yellow-400 text-yellow-400" : "text-muted"
                  }`}
                />
              ))}
            </div>
            {appointment.reviews[0].comment && (
              <p className="text-sm text-muted-foreground">{appointment.reviews[0].comment}</p>
            )}
          </div>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="p-4 text-center">Loading your appointments...</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <h2 className="text-lg font-semibold">My Appointments</h2>
        <p className="text-sm text-muted-foreground">View and manage your bookings</p>
      </div>

      <div className="p-4">
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="upcoming">Upcoming ({upcomingAppointments.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastAppointments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-3">
            {upcomingAppointments.length === 0 ? (
              <Card className="p-8 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No upcoming appointments</p>
                <Button onClick={() => navigate("/booking")}>Book Now</Button>
              </Card>
            ) : (
              upcomingAppointments.map((apt) => renderAppointmentCard(apt, true))
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3">
            {pastAppointments.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No past appointments</p>
              </Card>
            ) : (
              pastAppointments.map((apt) => renderAppointmentCard(apt, false))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.show} onOpenChange={(open) => setReviewDialog({ show: open, appointment: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
            <DialogDescription>Share your experience with this service</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setReviewData({ ...reviewData, rating: i + 1 })}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        i < reviewData.rating ? "fill-yellow-400 text-yellow-400" : "text-muted"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Comment (optional)</Label>
              <Textarea
                value={reviewData.comment}
                onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                placeholder="Share your thoughts..."
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setReviewDialog({ show: false, appointment: null })} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSubmitReview} className="flex-1">
                Submit Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
