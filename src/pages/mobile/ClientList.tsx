import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, UserPlus, Edit, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
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

export default function ClientList() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.business_id) {
      fetchClients();
    }
  }, [profile?.business_id]);

  const fetchClients = async () => {
    if (!profile?.business_id) return;
    
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("business_id", profile.business_id)
      .order("full_name");
    if (!error && data) {
      setClients(data);
    }
  };

  const filteredClients = clients.filter((client) =>
    client.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteId || !profile?.business_id) return;
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", deleteId)
      .eq("business_id", profile.business_id);
    
    if (!error) {
      toast.success(t("clientDeleted") || "Cliente eliminado");
      fetchClients();
    } else {
      toast.error("Error deleting client");
    }
    setDeleteId(null);
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("clients")}</h1>
          <Button onClick={() => navigate("/admin/clients/new")}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t("newClient")}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <Button
            variant="default"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            {language === "es" ? "Clientes" : "Clients"}
          </Button>
          <Button
            variant="ghost"
            className="rounded-none border-b-2 border-transparent"
            onClick={() => navigate("/admin/clients/credits")}
          >
            <Receipt className="h-4 w-4 mr-2" />
            {language === "es" ? "Créditos" : "Credits"}
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search") || "Buscar..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-3">
          {filteredClients.map((client) => (
            <div key={client.id} className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarImage src="" />
                  <AvatarFallback>{client.full_name?.split(" ").map((n: string) => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{client.full_name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                  <p className="text-sm text-muted-foreground">{client.phone}</p>
                  <Badge variant="secondary" className="mt-2">
                    {client.total_bookings || 0} {t("appointments") || "citas"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/admin/clients/edit/${client.id}`)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(client.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteClient")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteClientConfirm") || "¿Está seguro de que desea eliminar este cliente?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                {t("delete") || "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}
