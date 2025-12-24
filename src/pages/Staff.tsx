import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";

const staffMembers = [
  {
    id: 1,
    name: "Sarah Johnson",
    role: "Master Stylist",
    specialties: ["Haircut", "Coloring", "Styling"],
    rating: 4.9,
    reviews: 127,
    bio: "10+ years of experience in hair styling and coloring",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop",
  },
  {
    id: 2,
    name: "Michael Chen",
    role: "Senior Barber",
    specialties: ["Men's Haircut", "Beard Trim", "Hot Towel Shave"],
    rating: 4.8,
    reviews: 98,
    bio: "Specialist in classic and modern men's grooming",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    role: "Beauty Expert",
    specialties: ["Spa Treatment", "Facial", "Makeup"],
    rating: 5.0,
    reviews: 156,
    bio: "Certified esthetician specializing in skincare",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
  },
  {
    id: 4,
    name: "David Kim",
    role: "Color Specialist",
    specialties: ["Balayage", "Highlights", "Full Color"],
    rating: 4.9,
    reviews: 89,
    bio: "Expert in advanced coloring techniques",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
  },
];

const Staff = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-4xl font-bold mb-4">Meet Our Team</h1>
          <p className="text-muted-foreground">
            Our talented professionals are here to make you look and feel amazing
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
          {staffMembers.map((staff) => (
            <Card key={staff.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square overflow-hidden">
                <img
                  src={staff.image}
                  alt={staff.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-1">{staff.name}</h3>
                <p className="text-sm text-primary font-medium mb-3">{staff.role}</p>
                
                <div className="flex items-center gap-1 mb-3">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <span className="font-semibold">{staff.rating}</span>
                  <span className="text-sm text-muted-foreground">
                    ({staff.reviews} reviews)
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-4">{staff.bio}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {staff.specialties.map((specialty, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                </div>

                <Button
                  className="w-full"
                  onClick={() => navigate("/booking")}
                >
                  Book with {staff.name.split(" ")[0]}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Staff;
