import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ServicesManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    if (!profile?.business_id) return;

    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", profile.business_id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setServices(data);
    }
  }, [profile?.business_id]);

  // Use ref to keep stable reference for realtime subscription
  const fetchServicesRef = useRef(fetchServices);
  useEffect(() => {
    fetchServicesRef.current = fetchServices;
  }, [fetchServices]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!profile?.business_id) return;

    const channel = supabase
      .channel('services-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'services',
          filter: `business_id=eq.${profile.business_id}`
        },
        () => {
          fetchServicesRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id]);

  const handleDelete = async () => {
    if (!deleteId || !profile?.business_id) return;

    const { error } = await supabase
      .from("services")
      .update({ is_active: false })
      .eq("id", deleteId)
      .eq("business_id", profile.business_id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Service deleted successfully",
      });
      fetchServices();
    }
    setDeleteId(null);
  };

  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Services & Pricing</CardTitle>
                <CardDescription className="mt-2">
                  Manage your service catalog
                </CardDescription>
              </div>
              <Button onClick={() => navigate("/admin/services/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      {service.image_url && (
                        <img
                          src={service.image_url}
                          alt={service.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>{service.category}</TableCell>
                    <TableCell>{service.duration_minutes} min</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>RD$ {service.price || 0}</span>
                        {service.price_usd && (
                          <span className="text-xs text-muted-foreground">
                            ${service.price_usd} USD
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={service.is_active ? "default" : "secondary"}>
                        {service.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/services/${service.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteId(service.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
