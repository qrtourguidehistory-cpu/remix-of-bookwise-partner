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
import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";

const clients = [
  {
    id: "1",
    name: "Emma Wilson",
    email: "emma.wilson@email.com",
    phone: "(555) 123-4567",
    totalBookings: 12,
    totalSpent: "$1,240",
    lastVisit: "2 days ago",
    avatar: "",
  },
  {
    id: "2",
    name: "James Brown",
    email: "james.brown@email.com",
    phone: "(555) 234-5678",
    totalBookings: 8,
    totalSpent: "$680",
    lastVisit: "1 week ago",
    avatar: "",
  },
  {
    id: "3",
    name: "Sofia Martinez",
    email: "sofia.m@email.com",
    phone: "(555) 345-6789",
    totalBookings: 15,
    totalSpent: "$1,890",
    lastVisit: "Today",
    avatar: "",
  },
];

export default function ClientsManagement() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Client Database</h1>
            <p className="text-muted-foreground mt-1">Manage your client relationships</p>
          </div>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">248</div>
              <p className="text-sm text-muted-foreground mt-1">Total Clients</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">12</div>
              <p className="text-sm text-muted-foreground mt-1">New This Month</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">$124.50</div>
              <p className="text-sm text-muted-foreground mt-1">Avg. Lifetime Value</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Clients</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search clients..." className="pl-9 w-64" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Total Bookings</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={client.avatar} />
                          <AvatarFallback>{client.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{client.totalBookings}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{client.totalSpent}</TableCell>
                    <TableCell>{client.lastVisit}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                        <Button variant="ghost" size="sm">
                          Edit
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
