import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Menu, X, Calendar, Scissors, Users, User } from "lucide-react";
import { useState } from "react";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <NavLink to="/" className="flex items-center gap-2">
            <Scissors className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">StyleBook</span>
          </NavLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <NavLink
              to="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-primary font-medium"
            >
              Home
            </NavLink>
            <NavLink
              to="/services"
              className="text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-primary font-medium"
            >
              Services
            </NavLink>
            <NavLink
              to="/staff"
              className="text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-primary font-medium"
            >
              Our Team
            </NavLink>
            <NavLink
              to="/booking"
              className="text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-primary font-medium"
            >
              Book Now
            </NavLink>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <NavLink to="/customer">
                <User className="h-4 w-4 mr-2" />
                My Account
              </NavLink>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 space-y-3 border-t border-border">
            <NavLink
              to="/"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/services"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Services
            </NavLink>
            <NavLink
              to="/staff"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Our Team
            </NavLink>
            <NavLink
              to="/booking"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              Book Now
            </NavLink>
            <NavLink
              to="/customer"
              className="block py-2 text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              My Account
            </NavLink>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
