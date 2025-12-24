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
import { ArrowLeft, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabaseClient";

export default function StaffForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    bio: "",
    specialties: "",
    commissionRate: "",
    avatar: "",
  });

  useEffect(() => {
    if (id) {
      fetchStaff();
    }
  }, [id]);

  const fetchStaff = async () => {
    if (!id || !profile?.business_id) return;
    
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("id", id)
      .eq("business_id", profile.business_id)
      .single();
    
    if (!error && data) {
      setFormData({
        fullName: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        bio: data.bio || "",
        specialties: data.specialties?.join(", ") || "",
        commissionRate: data.commission_rate?.toString() || "",
        avatar: data.avatar_url || "",
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.business_id && !isEdit) {
      toast.error("No business found. Please complete onboarding first.");
      return;
    }
    
    const specialtiesArray = formData.specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const staffData = {
      full_name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      bio: formData.bio,
      specialties: specialtiesArray,
      commission_rate: parseFloat(formData.commissionRate) || 0,
      avatar_url: formData.avatar,
      is_active: true,
      ...(isEdit ? {} : { business_id: profile?.business_id }),
    };

    if (isEdit && id) {
      if (!profile?.business_id) {
        toast.error("No business found");
        return;
      }
      
      const { error } = await supabase
        .from("staff")
        .update(staffData)
        .eq("id", id)
        .eq("business_id", profile.business_id);
      
      if (!error) {
        toast.success(t("staffUpdated") || "Personal actualizado");
        navigate("/admin/staff");
      } else {
        toast.error(error.message || "Error updating staff");
      }
    } else {
      const { error } = await supabase
        .from("staff")
        .insert(staffData);
      
      if (!error) {
        toast.success(t("staffAdded") || "Personal agregado");
        navigate("/admin/staff");
      } else {
        toast.error(error.message || "Error adding staff");
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
            {isEdit ? t("editStaff") || "Editar Personal" : t("addStaff") || "Agregar Personal"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center mb-4">
            <Avatar className="w-24 h-24 mb-3">
              <AvatarImage src={formData.avatar} />
              <AvatarFallback>{formData.fullName.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
            </Avatar>
            <Label htmlFor="avatar" className="cursor-pointer">
              <div className="flex items-center gap-2 text-primary">
                <Upload className="h-4 w-4" />
                {t("uploadPhoto") || "Subir foto"}
              </div>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </Label>
          </div>

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
            <Label htmlFor="specialties">{t("specialties") || "Especialidades"}</Label>
            <Input
              id="specialties"
              value={formData.specialties}
              onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
              placeholder="Corte, Color, Estilo..."
            />
          </div>

          <div>
            <Label htmlFor="commissionRate">{t("commission") || "Comisión"} (%)</Label>
            <Input
              id="commissionRate"
              type="number"
              value={formData.commissionRate}
              onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
              placeholder="40"
            />
          </div>

          <div>
            <Label htmlFor="bio">{t("bio") || "Biografía"}</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
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
