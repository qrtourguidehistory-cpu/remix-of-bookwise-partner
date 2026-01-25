import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Moon, Sun, Globe, LogOut } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ProfilePage() {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user, profile, signOut, refreshProfile } = useAuth();
  
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      // Prioritize business logo_url if available, otherwise use avatar_url
      // This ensures sync between profile and business logo
      const avatarToUse = profile.businesses?.logo_url || profile.avatar_url || "";
      setAvatarUrl(avatarToUse);
      
      // If business has logo_url but profile doesn't have it in avatar_url, sync it
      if (profile.businesses?.logo_url && profile.avatar_url !== profile.businesses.logo_url && user?.id) {
        supabase
          .from('profiles')
          .update({ avatar_url: profile.businesses.logo_url })
          .eq('id', user.id)
          .then(() => refreshProfile());
      }
    }
  }, [profile, user?.id, refreshProfile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      if (!user?.id || !profile?.business_id) {
        toast.error("No se pudo identificar el usuario o negocio");
        return;
      }

      const file = event.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Solo se permiten imágenes");
        return;
      }

      // Max 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast.error("La imagen debe ser menor a 5MB");
        return;
      }

      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      // Use business_id for folder structure to match business-images bucket
      const fileName = `logo-${timestamp}.${fileExt}`;
      const filePath = `${profile.business_id}/${fileName}`;

      // Upload to business-images bucket (same as logo)
      const { error: uploadError } = await supabase.storage
        .from('business-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('business-images')
        .getPublicUrl(filePath);

      // Update profile avatar_url
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateProfileError) throw updateProfileError;

      // Also update business logo_url to sync them
      const { error: updateBusinessError } = await supabase
        .from('businesses')
        .update({ logo_url: data.publicUrl })
        .eq('id', profile.business_id);

      if (updateBusinessError) {
        console.warn("Could not update business logo:", updateBusinessError);
        // Don't fail the whole operation if business update fails
      }

      setAvatarUrl(data.publicUrl);
      await refreshProfile();
      toast.success("Foto de perfil actualizada");
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast.error(error.message || "Error al subir foto de perfil");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName,
          phone: phone 
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success("Perfil actualizado");
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t("profile")}</h1>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <Avatar className="w-24 h-24">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {fullName ? getInitials(fullName) : "U"}
              </AvatarFallback>
            </Avatar>
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 rounded-full w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors"
            >
              <Camera className="w-4 h-4" />
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </label>
          </div>
          {profile?.businesses && (
            <p className="mt-2 text-sm text-muted-foreground">
              {profile.businesses.business_name}
            </p>
          )}
        </div>

        {/* Profile Form */}
        <div className="space-y-4 mb-8">
          <div>
            <Label htmlFor="name">{t("fullName")}</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} className="w-full" disabled={loading}>
            {loading ? "Guardando..." : t("save")}
          </Button>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("settings")}</h2>
          
          {/* Theme Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {theme === "light" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span>{theme === "light" ? t("lightMode") : t("darkMode")}</span>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {theme === "light" ? t("darkMode") : t("lightMode")}
            </Button>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5" />
              <span>{t("language")}</span>
            </div>
            <Select value={language} onValueChange={(val) => setLanguage(val as "en" | "es")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Logout */}
          <Button
            variant="destructive"
            className="w-full"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
