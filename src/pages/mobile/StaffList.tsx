import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, UserPlus, Edit, Trash2 } from "lucide-react";
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

export default function StaffList() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [staff, setStaff] = useState<any[]>([]);

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
    member.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteId || !profile?.business_id) return;
    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", deleteId)
      .eq("business_id", profile.business_id);
    
    if (!error) {
      toast.success(t("staffDeleted") || "Personal eliminado");
      fetchStaff();
    } else {
      toast.error("Error deleting staff");
    }
    setDeleteId(null);
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{t("team")}</h1>
          <Button onClick={() => navigate("/admin/staff/new")}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t("addStaff") || "Agregar"}
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
          {filteredStaff.map((staff) => (
            <div key={staff.id} className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarImage src={staff.avatar_url} />
                  <AvatarFallback>{staff.full_name?.split(" ").map((n: string) => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{staff.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{staff.email}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {staff.specialties?.slice(0, 2).map((spec: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("commission") || "Comisión"}: {staff.commission_rate}%
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/admin/staff/edit/${staff.id}`)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(staff.id)}
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
              <AlertDialogTitle>{t("deleteStaff") || "Eliminar Personal"}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteStaffConfirm") || "¿Está seguro de que desea eliminar este miembro del personal?"}
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
