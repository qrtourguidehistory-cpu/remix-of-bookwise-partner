import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { User, Phone, Mail, Star, UserPlus, Loader2, Camera, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  clientId?: string;
  appointmentId?: string;
  onClientAdded?: () => void;
}

export function UserProfileModal({
  open,
  onOpenChange,
  userId,
  clientId,
  appointmentId,
  onClientAdded,
}: UserProfileModalProps) {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [addingClient, setAddingClient] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [averageRating, setAverageRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);

  const [clientMode, setClientMode] = useState(false);
  const [editable, setEditable] = useState<{
    full_name: string;
    email: string;
    phone: string;
    avatar_url?: string | null;
  }>({ full_name: "", email: "", phone: "", avatar_url: null });

  const fetchUserProfile = useCallback(async () => {
    console.log("🔍 fetchUserProfile llamado con:", { userId, clientId });
    
    if (!userId && !clientId) {
      console.log("⚠️ fetchUserProfile: No userId ni clientId, retornando");
      return;
    }
    
    setLoading(true);
    setUserProfile(null);
    setUserEmail("");
    setClientMode(false);
    
    try {
      // PRIORITY 1: If we have a clientId, try to find the business client first
      if (clientId && profile?.business_id) {
        console.log("🔍 Buscando cliente con clientId:", clientId, "business_id:", profile.business_id);
        const { data: clientRow, error: clientErr } = await supabase
          .from("clients")
          .select("full_name, email, phone, business_id, user_id")
          .eq("id", clientId)
          .eq("business_id", profile.business_id)
          .maybeSingle();

        console.log("📊 Resultado de búsqueda cliente:", { clientRow, clientErr });

        if (clientRow && !clientErr) {
          console.log("✅ Cliente encontrado en clients table:", clientRow);
          setClientMode(true);
          setEditable({
            full_name: clientRow.full_name || "",
            email: clientRow.email || "",
            phone: clientRow.phone || "",
            avatar_url: null,
          });
          setUserEmail(clientRow.email || "");
          setUserProfile({
            full_name: clientRow.full_name || null,
            phone: clientRow.phone || null,
            avatar_url: null,
          });
          
          // Calculate rating for this client
          const { data: reviewsData } = await supabase
            .from("reviews")
            .select("rating")
            .eq("client_id", clientId);
          
          if (reviewsData && reviewsData.length > 0) {
            const totalRating = reviewsData.reduce((sum, review) => sum + (review.rating || 0), 0);
            const avgRating = totalRating / reviewsData.length;
            setAverageRating(avgRating);
            setReviewCount(reviewsData.length);
          }
          
          setLoading(false);
          return; // Found client, stop here
        }
      }

      // PRIORITY 2: Search by userId - IMPORTANT: Try client_profiles FIRST, then profiles
      if (userId) {
        // 2a. Try client_profiles table FIRST (clients from client app)
        console.log("🔍 Buscando en client_profiles table con userId:", userId);
        const { data: clientProfileData, error: clientProfileError } = await (supabase
          .from("client_profiles" as any)
          .select("full_name, phone, avatar_url, email")
          .eq("id", userId)
          .maybeSingle() as any);

        console.log("📊 Resultado de búsqueda client_profiles:", { clientProfileData, clientProfileError });

        if (clientProfileData && !clientProfileError) {
          console.log("✅ Perfil encontrado en client_profiles table:", clientProfileData);
          setUserProfile({
            full_name: (clientProfileData as any).full_name || null,
            phone: (clientProfileData as any).phone || null,
            avatar_url: (clientProfileData as any).avatar_url || null,
          });
          if ((clientProfileData as any).email) {
            setUserEmail((clientProfileData as any).email);
          }
          setEditable({
            full_name: (clientProfileData as any).full_name || "",
            email: (clientProfileData as any).email || "",
            phone: (clientProfileData as any).phone || "",
            avatar_url: (clientProfileData as any).avatar_url || null,
          });
          // Try to find if this user is also a client in this business
          if (profile?.business_id) {
            const { data: existingClient } = await supabase
              .from("clients")
              .select("id")
              .eq("user_id", userId)
              .eq("business_id", profile.business_id)
              .maybeSingle();
            
            if (existingClient) {
              console.log("✅ Usuario también es cliente en este negocio:", existingClient.id);
              setClientMode(true);
            }
          }
          setLoading(false);
          return; // Found in client_profiles, done
        }
        
        // 2b. Try clients table by user_id
        console.log("🔍 Buscando cliente por user_id:", userId, "business_id:", profile?.business_id);
        if (profile?.business_id) {
          const { data: clientData, error: clientError } = await supabase
            .from("clients")
            .select("full_name, email, phone, id")
            .eq("user_id", userId)
            .eq("business_id", profile.business_id)
            .maybeSingle();
          
          console.log("📊 Resultado de búsqueda cliente por user_id:", { clientData, clientError });

          if (clientData && !clientError) {
            console.log("✅ Perfil encontrado en clients table por user_id:", clientData);
            setClientMode(true);
            setUserProfile({
              full_name: clientData.full_name || null,
              phone: clientData.phone || null,
              avatar_url: null,
            });
            if (clientData.email) {
              setUserEmail(clientData.email);
            }
            setEditable({
              full_name: clientData.full_name || "",
              email: clientData.email || "",
              phone: clientData.phone || "",
              avatar_url: null,
            });
            
            // Calculate rating
            const { data: reviewsData } = await supabase
              .from("reviews")
              .select("rating")
              .eq("client_id", clientData.id);
            
            if (reviewsData && reviewsData.length > 0) {
              const totalRating = reviewsData.reduce((sum, review) => sum + (review.rating || 0), 0);
              const avgRating = totalRating / reviewsData.length;
              setAverageRating(avgRating);
              setReviewCount(reviewsData.length);
            }
            
            setLoading(false);
            return; // Found in clients table, done
          }
        }
        
        // 2c. LAST: Try profiles table (partners/staff) - only if not found in client tables
        console.log("🔍 Buscando en profiles table con userId:", userId);
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, phone, avatar_url")
          .eq("id", userId)
          .maybeSingle();

        console.log("📊 Resultado de búsqueda profiles:", { profileData, profileError });

        if (profileData && !profileError && profileData.full_name) {
          console.log("✅ Perfil encontrado en profiles table:", profileData);
          setUserProfile({
            full_name: profileData.full_name || null,
            phone: profileData.phone || null,
            avatar_url: profileData.avatar_url || null,
          });
          setEditable({
            full_name: profileData.full_name || "",
            email: "",
            phone: profileData.phone || "",
            avatar_url: profileData.avatar_url || null,
          });
          setLoading(false);
          return;
        }
      }
      
      // Nothing found
      console.log("❌ No se encontró perfil en ninguna tabla");
      setUserProfile({
        full_name: null,
        phone: null,
        avatar_url: null,
      });
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error(language === "es" ? "Error al cargar el perfil del usuario" : "Error loading user profile");
    } finally {
      setLoading(false);
    }
  }, [userId, clientId, language, profile?.business_id]);

  useEffect(() => {
    console.log("🔍 UserProfileModal useEffect:", { open, userId, clientId, profile_business_id: profile?.business_id });
    
    if (!open) {
      console.log("⚠️ UserProfileModal: Modal cerrado, reseteando estado");
      setUserProfile(null);
      setUserEmail("");
      setAverageRating(0);
      setReviewCount(0);
      setClientMode(false);
      return;
    }
    
    if (!userId && !clientId) {
      console.log("⚠️ UserProfileModal: No userId ni clientId, pero modal está abierto - intentando buscar información");
      // Don't return early, try to fetch anyway if we have appointmentId
      if (!appointmentId) {
        return;
      }
    }

    console.log("✅ UserProfileModal: Llamando fetchUserProfile");
    fetchUserProfile();
  }, [open, userId, clientId, fetchUserProfile, appointmentId]);

  const handleSaveClient = async () => {
    if (!profile?.business_id || !clientId) return;
    setAddingClient(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          full_name: editable.full_name || null,
          email: editable.email || null,
          phone: editable.phone || null,
        })
        .eq("id", clientId)
        .eq("business_id", profile.business_id);

      if (error) throw error;
      toast.success(language === "es" ? "Perfil guardado" : "Profile saved");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || (language === "es" ? "No se pudo guardar" : "Could not save"));
    } finally {
      setAddingClient(false);
    }
  };

  const handleAddAsClient = async () => {
    if (!profile?.business_id || !displayProfile) return;

    setAddingClient(true);
    try {
      const normalizedEmail = (userEmail || "").trim().toLowerCase();
      const emailOrNull = normalizedEmail ? normalizedEmail : null;

      const fullName = (displayProfile?.full_name || "").trim();

      // Check if client already exists
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", userId)
        .eq("business_id", profile.business_id)
        .maybeSingle();

      if (existingClient) {
        toast.info(language === "es" ? "Este usuario ya está registrado como cliente" : "This user is already registered as a client");
        setAddingClient(false);
        return;
      }

      // If email already exists for this business, link/update that record instead of inserting
      if (emailOrNull) {
        const { data: existingByEmail } = await supabase
          .from("clients")
          .select("id, user_id")
          .eq("business_id", profile.business_id)
          .ilike("email", emailOrNull)
          .maybeSingle();

        if (existingByEmail?.id) {
          // Link user_id if missing + refresh contact info
          await supabase
            .from("clients")
            .update({
              user_id: existingByEmail.user_id || userId,
              full_name: fullName || null,
              phone: displayProfile?.phone || null,
            })
            .eq("id", existingByEmail.id)
            .eq("business_id", profile.business_id);

          // Link appointment to the existing client
          if (appointmentId) {
            await supabase
              .from("appointments")
              .update({ client_id: existingByEmail.id })
              .eq("id", appointmentId)
              .eq("business_id", profile.business_id);
          }

          toast.success(language === "es" ? "Cliente vinculado exitosamente" : "Client linked successfully");
          onClientAdded?.();
          onOpenChange(false);
          return;
        }
      }

      // Create client record with a known ID
      const newClientId = crypto.randomUUID();
      const { error: insertError } = await supabase.from("clients").insert({
        id: newClientId,
        user_id: userId,
        business_id: profile.business_id,
        full_name: fullName || null,
        email: emailOrNull,
        phone: displayProfile?.phone || null,
      });

      if (insertError) throw insertError;

      // If there's an appointment, update it to link to the new client
      if (appointmentId) {
        await supabase
          .from("appointments")
          .update({ client_id: newClientId })
          .eq("id", appointmentId)
          .eq("business_id", profile.business_id);
      }

      toast.success(language === "es" ? "Cliente agregado exitosamente" : "Client added successfully");

      // Call onClientAdded and close modal
      onClientAdded?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || (language === "es" ? "Error al agregar como cliente" : "Error adding as client"));
    } finally {
      setAddingClient(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayProfile = userProfile ? {
    ...userProfile,
    full_name: userProfile.full_name
  } : (userEmail ? { 
    full_name: userEmail.split('@')[0], 
    phone: null, 
    avatar_url: null 
  } : null);

  // Show loading state
  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "es" ? "Cargando perfil..." : "Loading profile..."}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Show "Profile not found" only if we truly have no data
  if (!displayProfile && !userEmail && !loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">
              {language === "es" ? "Información Personal" : "Personal Information"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {language === "es" 
                ? "Información del perfil del usuario que realizó la reserva" 
                : "Profile information of the user who made the reservation"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Header with Back Button */}
            <div className="flex items-center gap-3 -mt-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-xl font-semibold">
                {language === "es" ? "Información Personal" : "Personal Information"}
              </h2>
            </div>

            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">
                {language === "es" ? "Perfil no encontrado" : "Profile not found"}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === "es" 
                  ? "No se pudo cargar la información del perfil del usuario." 
                  : "Could not load user profile information."}
              </p>
              {userId && (
                <p className="text-xs text-muted-foreground font-mono mt-4 opacity-60">
                  ID: {userId.substring(0, 8)}...
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Split full_name into first/last for display (read-only mode)
  // ✅ FIX: Use editable if available (when data was loaded), otherwise use displayProfile
  const displayName = (clientMode ? editable.full_name : displayProfile?.full_name) || editable.full_name || displayProfile?.full_name || "";
  const nameParts = displayName.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // ✅ DEBUG: Log what we're displaying
  console.log("🔍 Display values:", {
    clientMode,
    displayName,
    firstName,
    lastName,
    editable_full_name: editable.full_name,
    displayProfile_full_name: displayProfile?.full_name,
    userEmail,
    editable_email: editable.email
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {language === "es" ? "Información Personal" : "Personal Information"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === "es" 
              ? "Información del perfil del usuario que realizó la reserva" 
              : "Profile information of the user who made the reservation"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Header with Back Button */}
          <div className="flex items-center gap-3 -mt-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold">
              {language === "es" ? "Información Personal" : "Personal Information"}
            </h2>
          </div>

          {/* Profile Picture */}
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={displayProfile?.avatar_url || undefined} alt={displayProfile?.full_name || "User"} />
                <AvatarFallback className="text-2xl">
                  {getInitials(displayProfile?.full_name || userEmail || "")}
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer">
                <Camera className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {language === "es" ? "Toca para cambiar tu foto" : "Tap to change your photo"}
            </p>
          </div>

          <Separator />

          {/* Personal Information Form */}
          <div className="space-y-4">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="firstName" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {language === "es" ? "Nombre" : "First Name"}
              </Label>
              <Input
                id="firstName"
                value={clientMode ? editable.full_name.split(' ')[0] || '' : (editable.full_name?.split(' ')[0] || firstName || '')}
                readOnly={!clientMode}
                onChange={(e) => {
                  if (clientMode) {
                    const parts = editable.full_name.split(' ');
                    parts[0] = e.target.value;
                    setEditable((p) => ({ ...p, full_name: parts.join(' ').trim() }));
                  }
                }}
                className={!clientMode ? "bg-muted" : ""}
              />
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastName" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {language === "es" ? "Apellido" : "Last Name"}
              </Label>
              <Input
                id="lastName"
                value={clientMode ? editable.full_name.split(' ').slice(1).join(' ') || '' : (editable.full_name?.split(' ').slice(1).join(' ') || lastName || '')}
                readOnly={!clientMode}
                onChange={(e) => {
                  if (clientMode) {
                    const parts = editable.full_name.split(' ');
                    const first = parts[0] || '';
                    setEditable((p) => ({ ...p, full_name: `${first} ${e.target.value}`.trim() }));
                  }
                }}
                className={!clientMode ? "bg-muted" : ""}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {language === "es" ? "Correo Electrónico" : "Email"}
              </Label>
              <Input
                id="email"
                type="email"
                value={clientMode ? editable.email : (editable.email || userEmail || "")}
                readOnly={!clientMode}
                onChange={(e) => setEditable((p) => ({ ...p, email: e.target.value }))}
                className={!clientMode ? "bg-muted" : ""}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {language === "es" ? "Teléfono" : "Phone"}
              </Label>
              <Input
                id="phone"
                value={clientMode ? editable.phone : (editable.phone || displayProfile?.phone || "")}
                readOnly={!clientMode}
                onChange={(e) => setEditable((p) => ({ ...p, phone: e.target.value }))}
                className={!clientMode ? "bg-muted" : ""}
              />
            </div>

            {/* Rating (read-only) */}
            {reviewCount > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span>{averageRating.toFixed(1)} ({reviewCount} {language === "es" ? "reseñas" : "reviews"})</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {clientMode ? (
              <>
                <Button onClick={handleSaveClient} disabled={addingClient}>
                  {addingClient ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {language === "es" ? "Guardar Cambios" : "Save Changes"}
                </Button>
                {clientId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      // Trigger activity view - parent should handle this
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('openClientActivity', { 
                          detail: { clientId, userId } 
                        }));
                      }, 100);
                    }}
                  >
                    {language === "es" ? "Ver Actividades" : "View Activities"}
                  </Button>
                )}
              </>
            ) : (
              <Button
                onClick={handleAddAsClient}
                disabled={addingClient || !displayProfile}
                className="gap-2"
              >
                {addingClient ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {language === "es" ? "Agregar como Cliente" : "Add as Client"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
