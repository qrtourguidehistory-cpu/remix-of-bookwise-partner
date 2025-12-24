import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Star, Award, Users, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import heroImage from "@/assets/hero-salon.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent via-background to-secondary/20 opacity-50" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Premium Beauty Experience</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Book Your Perfect
                <span className="text-primary"> Style </span>
                Appointment
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Experience luxury salon services with our expert stylists. 
                Easy online booking, flexible scheduling, and top-rated professionals.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" onClick={() => navigate("/booking")} className="shadow-lg">
                  Book Appointment
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/services")}>
                  View Services
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-3xl" />
              <img
                src={heroImage}
                alt="Modern salon interior"
                className="relative rounded-3xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Choose StyleBook?</h2>
            <p className="text-muted-foreground">
              The easiest way to book and manage your beauty appointments
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-border">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Easy Booking</h3>
                <p className="text-muted-foreground">
                  Book appointments in seconds with our intuitive system
                </p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-secondary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Expert Stylists</h3>
                <p className="text-muted-foreground">
                  Choose from our team of certified professionals
                </p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Top Rated</h3>
                <p className="text-muted-foreground">
                  4.9 star average rating from thousands of customers
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">5000+</div>
              <div className="text-muted-foreground">Happy Clients</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">15+</div>
              <div className="text-muted-foreground">Expert Stylists</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">50+</div>
              <div className="text-muted-foreground">Services</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">4.9</div>
              <div className="text-muted-foreground">Average Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 via-accent to-secondary/10">
        <div className="container mx-auto px-4 text-center">
          <Award className="h-16 w-16 text-primary mx-auto mb-6" />
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Look?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied customers and book your appointment today
          </p>
          <Button size="lg" onClick={() => navigate("/booking")} className="shadow-lg">
            Book Your Appointment Now
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
