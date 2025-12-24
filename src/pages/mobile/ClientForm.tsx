import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function ClientForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    notes: "",
  });

  useEffect(() => {
    if (id) {
      fetchClient();
    }
  }, [id]);

  const fetchClient = async () => {
    if (!id || !profile?.business_id) return;
    
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("business_id", profile.business_id)
      .single();
    
    if (!error && data) {
      setFormData({
        fullName: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        notes: data.notes || "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const clientData = {
      full_name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      notes: formData.notes,
    };

    if (isEdit && id) {
      if (!profile?.business_id) {
        toast.error("No business found");
        return;
      }
      
      const { error } = await supabase
        .from("clients")
        .update(clientData)
        .eq("id", id)
        .eq("business_id", profile.business_id);
      
      if (!error) {
        toast.success(t("clientUpdated") || "Cliente actualizado");
        navigate("/admin/clients");
      } else {
        toast.error("Error updating client");
      }
    } else {
      if (!profile?.business_id) {
        toast.error("No business found");
        return;
      }
      
      const { error } = await supabase
        .from("clients")
        .insert({ ...clientData, business_id: profile.business_id, id: crypto.randomUUID() });
      
      if (!error) {
        toast.success(t("clientAdded") || "Cliente agregado");
        navigate("/admin/clients");
      } else {
        toast.error("Error adding client");
      }
    }
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {isEdit ? t("editClient") : t("newClient")}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">{t("fullName")}</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="notes">{t("notes") || "Notas"}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
              {t("cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {t("save")}
            </Button>
          </div>
        </form>
      </div>
    </MobileLayout>
  );
}
