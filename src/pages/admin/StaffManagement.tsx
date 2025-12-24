import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export default function StaffManagement() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (profile?.business_id) {
      fetchStaff();
    }
  }, [profile?.business_id]);

  const fetchStaff = async () => {
    if (!profile?.business_id) return;
    
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("business_id", profile.business_id)
      .order("full_name");
    if (!error && data) {
      setStaff(data);
    }
  };

  const filteredStaff = staff.filter((member) =>
    member.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  return (
    <AdminLayout>
      <div className="space-y-6 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Staff Management</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage your team and their schedules</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="flex-1 sm:flex-none">
              <Calendar className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Manage Schedules</span>
              <span className="sm:hidden">Schedules</span>
            </Button>
            <Button className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Add Staff</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Team Members</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search staff..." 
                  className="pl-9 w-full sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Specialties</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback>{member.full_name?.split(" ").map((n: string) => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{member.email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.specialties?.slice(0, 2).map((spec: string, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {spec}
                          </Badge>
                        ))}
                        {member.specialties && member.specialties.length > 2 && (
                          <Badge variant="secondary">+{member.specialties.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{member.commission_rate}%</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                        {member.is_active ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm">
                          Schedule
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
    </AdminLayout>
  );
}
