import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, MapPin } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useNavigate } from "react-router-dom";

const Customer = () => {
  const navigate = useNavigate();

  const upcomingAppointments = [
    {
      id: 1,
      service: "Women's Haircut",
      staff: "Sarah Johnson",
      date: "Dec 20, 2025",
      time: "2:00 PM",
      status: "confirmed",
    },
  ];

  const pastAppointments = [
    {
      id: 2,
      service: "Facial Treatment",
      staff: "Emily Rodriguez",
      date: "Nov 15, 2025",
      time: "11:00 AM",
      status: "completed",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">My Account</h1>
            <p className="text-muted-foreground">Manage your appointments and profile</p>
          </div>

          {/* Profile Card */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Guest User</CardTitle>
                    <CardDescription>Member since 2025</CardDescription>
                  </div>
                </div>
                <Button onClick={() => navigate("/booking")}>
                  Book Appointment
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Upcoming Appointments */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
              <CardDescription>Your scheduled appointments</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingAppointments.length > 0 ? (
                <div className="space-y-4">
                  {upcomingAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="p-4 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">
                            {appointment.service}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>{appointment.staff}</span>
                          </div>
                        </div>
                        <Badge className="bg-secondary text-secondary-foreground">
                          {appointment.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{appointment.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{appointment.time}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline">
                          Reschedule
                        </Button>
                        <Button size="sm" variant="outline">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No upcoming appointments
                  </p>
                  <Button onClick={() => navigate("/booking")}>
                    Book Now
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past Appointments */}
          <Card>
            <CardHeader>
              <CardTitle>Past Appointments</CardTitle>
              <CardDescription>Your appointment history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pastAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">
                          {appointment.service}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>{appointment.staff}</span>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {appointment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{appointment.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{appointment.time}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="mt-4">
                      Leave Review
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Customer;
