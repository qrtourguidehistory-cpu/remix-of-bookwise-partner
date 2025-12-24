import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Clock, DollarSign, CheckCircle2 } from "lucide-react";

const Booking = () => {
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const services = [
    { id: "1", name: "Men's Haircut", duration: "30 min", price: 35 },
    { id: "2", name: "Women's Haircut", duration: "45 min", price: 55 },
    { id: "3", name: "Hair Coloring", duration: "120 min", price: 120 },
    { id: "4", name: "Facial Treatment", duration: "60 min", price: 85 },
  ];

  const staff = [
    { id: "1", name: "Sarah Johnson", role: "Master Stylist" },
    { id: "2", name: "Michael Chen", role: "Senior Barber" },
    { id: "3", name: "Emily Rodriguez", role: "Beauty Expert" },
  ];

  const timeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM",
    "05:00 PM", "06:00 PM",
  ];

  const handleBooking = () => {
    if (!selectedService || !selectedStaff || !selectedDate || !selectedTime) {
      toast({
        title: "Missing Information",
        description: "Please complete all booking steps",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Booking Confirmed! 🎉",
      description: "Your appointment has been successfully scheduled",
    });
    
    setTimeout(() => {
      navigate("/customer");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-4xl font-bold mb-4">Book Your Appointment</h1>
          <p className="text-muted-foreground">
            Follow the steps below to schedule your visit
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-4">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step >= num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > num ? <CheckCircle2 className="h-5 w-5" /> : num}
                </div>
                {num < 4 && (
                  <div
                    className={`w-12 h-1 ${
                      step > num ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Step 1: Select Service */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Select a Service</CardTitle>
                <CardDescription>Choose the service you'd like to book</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedService} onValueChange={setSelectedService}>
                  <div className="space-y-3">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:bg-accent cursor-pointer"
                      >
                        <RadioGroupItem value={service.id} id={service.id} />
                        <Label htmlFor={service.id} className="flex-1 cursor-pointer">
                          <div className="font-semibold">{service.name}</div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {service.duration}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              ${service.price}
                            </span>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
                <Button
                  className="w-full mt-6"
                  onClick={() => setStep(2)}
                  disabled={!selectedService}
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Staff */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Choose Your Stylist</CardTitle>
                <CardDescription>Select a team member for your service</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedStaff} onValueChange={setSelectedStaff}>
                  <div className="space-y-3">
                    {staff.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center space-x-3 p-4 rounded-lg border border-border hover:bg-accent cursor-pointer"
                      >
                        <RadioGroupItem value={member.id} id={`staff-${member.id}`} />
                        <Label htmlFor={`staff-${member.id}`} className="flex-1 cursor-pointer">
                          <div className="font-semibold">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.role}</div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setStep(3)}
                    disabled={!selectedStaff}
                  >
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Select Date */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Pick a Date</CardTitle>
                <CardDescription>Choose your preferred appointment date</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    className="rounded-md border"
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setStep(4)}
                    disabled={!selectedDate}
                  >
                    Continue
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Select Time */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Choose Time</CardTitle>
                <CardDescription>Select your preferred time slot</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {timeSlots.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => setSelectedTime(time)}
                      className="h-12"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleBooking}
                    disabled={!selectedTime}
                  >
                    Confirm Booking
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
