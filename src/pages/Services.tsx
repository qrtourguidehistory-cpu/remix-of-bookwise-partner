import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";

const services = [
  {
    id: 1,
    category: "Haircut",
    services: [
      { name: "Men's Haircut", duration: "30 min", price: 35 },
      { name: "Women's Haircut", duration: "45 min", price: 55 },
      { name: "Kids Haircut", duration: "20 min", price: 25 },
    ],
  },
  {
    id: 2,
    category: "Styling",
    services: [
      { name: "Blow Dry & Style", duration: "30 min", price: 40 },
      { name: "Updo", duration: "60 min", price: 80 },
      { name: "Hair Treatment", duration: "45 min", price: 60 },
    ],
  },
  {
    id: 3,
    category: "Coloring",
    services: [
      { name: "Full Color", duration: "120 min", price: 120 },
      { name: "Highlights", duration: "90 min", price: 140 },
      { name: "Balayage", duration: "150 min", price: 180 },
    ],
  },
  {
    id: 4,
    category: "Spa & Beauty",
    services: [
      { name: "Facial Treatment", duration: "60 min", price: 85 },
      { name: "Manicure", duration: "45 min", price: 35 },
      { name: "Pedicure", duration: "60 min", price: 50 },
    ],
  },
];

const Services = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-4xl font-bold mb-4">Our Services</h1>
          <p className="text-muted-foreground">
            Discover our range of premium beauty and grooming services
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
          {services.map((category) => (
            <Card key={category.id} className="overflow-hidden border-border hover:shadow-lg transition-shadow">
              <CardHeader className="bg-accent">
                <CardTitle className="text-2xl">{category.category}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {category.services.map((service, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between pb-4 border-b border-border last:border-0 last:pb-0"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold mb-2">{service.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{service.duration}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            <span>${service.price}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate("/booking")}
                        className="ml-4"
                      >
                        Book
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Services;
