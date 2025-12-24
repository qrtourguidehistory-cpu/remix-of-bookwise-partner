import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";

const statusColors = {
  pending: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  completed: "bg-green-500/10 text-green-700 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-700 border-red-500/20",
  no_show: "bg-gray-500/10 text-gray-700 border-gray-500/20",
};

interface AppointmentWithRelations {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  notes: string | null;
  clients: { full_name: string } | null;
  services: { name: string; price: number } | null;
  staff: { full_name: string } | null;
}

const ITEMS_PER_PAGE = 10;

export default function AppointmentsManagement() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.business_id) {
      fetchAppointments();
    }
  }, [profile?.business_id, date, currentPage]);

  const fetchAppointments = async () => {
    if (!profile?.business_id) return;
    
    setLoading(true);
    setError(null);

    try {
      const dateStr = date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      
      // Get total count for pagination
      const { count, error: countError } = await (supabase
        .from("appointments") as any)
        .select("*", { count: "exact", head: true })
        .eq("business_id", profile.business_id)
        .eq("appointment_date", dateStr);

      if (countError) throw countError;
      setTotalCount(count || 0);

      // Fetch appointments with relations
      const { data, error: fetchError } = await (supabase
        .from("appointments") as any)
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          status,
          payment_amount,
          payment_method,
          notes,
          clients!appointments_client_id_fkey(full_name),
          services!appointments_service_id_fkey(name, price),
          staff!appointments_staff_id_fkey(full_name)
        `)
        .eq("business_id", profile.business_id)
        .eq("appointment_date", dateStr)
        .order("start_time", { ascending: true })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

      if (fetchError) throw fetchError;
      
      setAppointments((data as unknown as AppointmentWithRelations[]) || []);
    } catch (err: any) {
      console.error("Error fetching appointments:", err);
      setError(err.message || "Error al cargar las citas");
      toast({
        title: "Error",
        description: "No se pudieron cargar las citas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter appointments by search query
  const filteredAppointments = useMemo(() => {
    if (!searchQuery.trim()) return appointments;
    
    const query = searchQuery.toLowerCase();
    return appointments.filter((apt) => {
      const clientName = apt.clients?.full_name?.toLowerCase() || "";
      const serviceName = apt.services?.name?.toLowerCase() || "";
      const staffName = apt.staff?.full_name?.toLowerCase() || "";
      return clientName.includes(query) || serviceName.includes(query) || staffName.includes(query);
    });
  }, [appointments, searchQuery]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatPayment = (amount: number | null, serviceprice: number | null) => {
    const value = amount ?? serviceprice ?? 0;
    return `$${value.toFixed(2)}`;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Appointments</h1>
            <p className="text-muted-foreground mt-1">Manage and schedule appointments</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar 
                mode="single" 
                selected={date} 
                onSelect={(newDate) => {
                  setDate(newDate);
                  setCurrentPage(1);
                }} 
                className="rounded-md" 
              />
            </CardContent>
          </Card>

          {/* Appointments List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {date ? format(date, "MMMM d, yyyy") : "Today's Schedule"}
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search client, service, staff..." 
                      className="pl-9 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-destructive">{error}</p>
                  <Button variant="outline" onClick={fetchAppointments} className="mt-4">
                    Retry
                  </Button>
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {searchQuery ? "No appointments match your search" : "No appointments for this date"}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppointments.map((apt) => (
                        <TableRow key={apt.id}>
                          <TableCell className="font-medium">
                            {formatTime(apt.start_time)}
                          </TableCell>
                          <TableCell>{apt.clients?.full_name || "—"}</TableCell>
                          <TableCell>{apt.services?.name || "—"}</TableCell>
                          <TableCell>{apt.staff?.full_name || "—"}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={statusColors[apt.status as keyof typeof statusColors] || statusColors.pending}
                            >
                              {apt.status || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatPayment(apt.payment_amount, apt.services?.price || null)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
                                  isActive={currentPage === pageNum}
                                  className="cursor-pointer"
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          })}
                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
