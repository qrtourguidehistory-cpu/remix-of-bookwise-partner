import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Eye, Globe, Building2, Image as ImageIcon, Phone, MapPin, Link2, Loader2, Star, Clock, CheckCircle2, Upload, X, AlertTriangle, CheckCircle, Scissors, Sparkles, Heart, Droplet, Users, HandMetal, Waves, Flame, Activity, Stethoscope, PawPrint, MoreHorizontal, AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { validatePublicVisibilityRequirements, PublicVisibilityRequirements } from "@/lib/validatePublicVisibility";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canChangeBusinessName, canChangeBusinessCategories, recordBusinessNameChange, recordBusinessCategoryChange } from "@/lib/businessChangeLimits";

interface BusinessProfile {
  id: string;
  business_name: string;
  is_public: boolean;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  primary_category: string | null;
  secondary_categories: string[] | null;
  average_rating: number | null;
  total_reviews: number | null;
  onboarding_completed: boolean | null;
  location_details: any | null;
  google_maps_url: string | null;
}

export default function BusinessProfileSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [visibilityRequirements, setVisibilityRequirements] = useState<PublicVisibilityRequirements | null>(null);
  const [checkingRequirements, setCheckingRequirements] = useState(false);
  const [nameChangeLimit, setNameChangeLimit] = useState<{ canChange: boolean; message?: string } | null>(null);
  const [categoryChangeLimit, setCategoryChangeLimit] = useState<{ canChange: boolean; message?: string } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false);
  const [tempBusinessName, setTempBusinessName] = useState("");
  const [tempPrimaryCategory, setTempPrimaryCategory] = useState<string>("");
  const [tempSecondaryCategories, setTempSecondaryCategories] = useState<string[]>([]);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  
  // Categories list (same as onboarding)
  const categories = [
    { id: "hair_salon", label: language === "es" ? "Salón de belleza" : "Hair salon", icon: Scissors },
    { id: "nails", label: language === "es" ? "Uñas" : "Nails", icon: Sparkles },
    { id: "eyebrows_lashes", label: language === "es" ? "Cejas y pestañas" : "Eyebrows & lashes", icon: Eye },
    { id: "beauty_salon", label: language === "es" ? "Salón de belleza" : "Beauty salon", icon: Heart },
    { id: "medspa", label: language === "es" ? "Medspa" : "Medspa", icon: Droplet },
    { id: "barber", label: language === "es" ? "Barbería" : "Barber", icon: Scissors },
    { id: "massage", label: language === "es" ? "Masajes" : "Massage", icon: HandMetal },
    { id: "spa_sauna", label: language === "es" ? "Spa y sauna" : "Spa & sauna", icon: Waves },
    { id: "waxing", label: language === "es" ? "Depilación" : "Waxing salon", icon: Flame },
    { id: "tattoo_piercing", label: language === "es" ? "Tatuajes y piercings" : "Tattooing & piercing", icon: HandMetal },
    { id: "tanning", label: language === "es" ? "Bronceado" : "Tanning studio", icon: Waves },
    { id: "fitness", label: language === "es" ? "Fitness y recuperación" : "Fitness & recovery", icon: Activity },
    { id: "physical_therapy", label: language === "es" ? "Fisioterapia" : "Physical therapy", icon: Stethoscope },
    { id: "health_practice", label: language === "es" ? "Práctica de salud" : "Health practice", icon: Heart },
    { id: "pet_grooming", label: language === "es" ? "Peluquería de mascotas" : "Pet grooming", icon: PawPrint },
    { id: "other", label: language === "es" ? "Otro" : "Other", icon: MoreHorizontal },
  ];

  useEffect(() => {
    fetchBusiness();
  }, [profile?.business_id]);

  useEffect(() => {
    if (business?.id && business.is_public === false) {
      // Only check requirements when visibility is disabled, not on every field change
      checkRequirements();
    }
  }, [business?.id, business?.is_public]);

  const fetchBusiness = async () => {
    if (!profile?.business_id) return;
    
    try {
      const { data, error } = await (supabase
        .from("businesses")
        .select("id, business_name, is_public, slug, description, logo_url, cover_image_url, phone, address, website, primary_category, secondary_categories, average_rating, total_reviews, onboarding_completed, location_details")
        .eq("id", profile.business_id)
        .maybeSingle() as any);

      if (error) throw error;
      if (data) {
        // Extract google_maps_url from location_details if not set directly
        const locationDetails = data.location_details as any;
        const googleMapsUrl = locationDetails?.googleMapsUrl || null;
        
        setBusiness({
          ...data,
          google_maps_url: googleMapsUrl,
        } as unknown as BusinessProfile);
        setTempBusinessName((data as any).business_name || "");
        setTempPrimaryCategory((data as any).primary_category || "");
        setTempSecondaryCategories((data as any).secondary_categories || []);
        
        // Check change limits
        const nameLimit = await canChangeBusinessName(profile.business_id);
        setNameChangeLimit(nameLimit);
        
        const categoryLimit = await canChangeBusinessCategories(profile.business_id);
        setCategoryChangeLimit(categoryLimit);
      }
    } catch (error) {
      console.error("Error fetching business:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "No se pudo cargar el perfil" : "Could not load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateSlug = (slug: string) => {
    if (!slug) return true;
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(slug);
  };

  const handleSlugChange = (value: string) => {
    const cleanSlug = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    setBusiness(prev => prev ? { ...prev, slug: cleanSlug } : null);
    
    if (cleanSlug && !validateSlug(cleanSlug)) {
      setSlugError(language === "es" ? "Solo letras, números y guiones" : "Only letters, numbers and hyphens");
    } else {
      setSlugError(null);
    }
  };

  const checkRequirements = async () => {
    if (!profile?.business_id) return;
    
    setCheckingRequirements(true);
    try {
      const requirements = await validatePublicVisibilityRequirements(profile.business_id);
      setVisibilityRequirements(requirements);
    } catch (error) {
      console.error("Error checking requirements:", error);
    } finally {
      setCheckingRequirements(false);
    }
  };

  const handleVisibilityToggle = async (checked: boolean) => {
    if (!business || !profile?.business_id) return;

    // If trying to enable, validate requirements first
    if (checked) {
      setCheckingRequirements(true);
      try {
        const requirements = await validatePublicVisibilityRequirements(profile.business_id);
        setVisibilityRequirements(requirements);

        if (!requirements.isValid) {
          toast({
            title: language === "es" ? "Requisitos no cumplidos" : "Requirements not met",
            description: language === "es" 
              ? `Debes completar los siguientes requisitos: ${requirements.missingRequirements.join(", ")}`
              : `You must complete the following requirements: ${requirements.missingRequirements.join(", ")}`,
            variant: "destructive",
          });
          return; // Don't enable if requirements not met
        }
      } catch (error) {
        console.error("Error validating requirements:", error);
        toast({
          title: language === "es" ? "Error" : "Error",
          description: language === "es" ? "No se pudieron validar los requisitos" : "Could not validate requirements",
          variant: "destructive",
        });
        return;
      } finally {
        setCheckingRequirements(false);
      }
    }

    // If all requirements are met or disabling, update the state
    setBusiness(prev => prev ? { ...prev, is_public: checked } : null);
  };

  const uploadImage = async (file: File, type: 'logo' | 'cover') => {
    if (!profile?.business_id) return null;
    
    const isLogo = type === 'logo';
    if (isLogo) {
      setUploadingLogo(true);
    } else {
      setUploadingCover(true);
    }
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.business_id}/${type}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('business-images')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('business-images')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "No se pudo subir la imagen" : "Could not upload image",
        variant: "destructive",
      });
      return null;
    } finally {
      if (isLogo) {
        setUploadingLogo(false);
      } else {
        setUploadingCover(false);
      }
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "Solo se permiten imágenes" : "Only images are allowed",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "La imagen no debe superar 5MB" : "Image must be less than 5MB",
        variant: "destructive",
      });
      return;
    }
    
    const url = await uploadImage(file, type);
    if (url) {
      setBusiness(prev => prev ? { 
        ...prev, 
        [type === 'logo' ? 'logo_url' : 'cover_image_url']: url 
      } : null);
      toast({
        title: language === "es" ? "Imagen subida" : "Image uploaded",
        description: language === "es" ? "Recuerda guardar los cambios" : "Remember to save changes",
      });
    }
  };

  const removeImage = (type: 'logo' | 'cover') => {
    setBusiness(prev => prev ? { 
      ...prev, 
      [type === 'logo' ? 'logo_url' : 'cover_image_url']: null 
    } : null);
  };

  const handleCategoryClick = (categoryId: string) => {
    if (tempPrimaryCategory === categoryId) {
      // Unselect primary
      setTempPrimaryCategory("");
    } else if (tempSecondaryCategories.includes(categoryId)) {
      // Remove from secondary
      setTempSecondaryCategories(tempSecondaryCategories.filter(id => id !== categoryId));
    } else if (!tempPrimaryCategory) {
      // Set as primary
      setTempPrimaryCategory(categoryId);
    } else if (tempSecondaryCategories.length < 3) {
      // Add to secondary (max 3)
      setTempSecondaryCategories([...tempSecondaryCategories, categoryId]);
    } else {
      toast({
        title: language === "es" ? "Límite alcanzado" : "Limit reached",
        description: language === "es" ? "Puedes seleccionar hasta 3 categorías secundarias" : "You can select up to 3 secondary categories",
        variant: "destructive",
      });
    }
  };

  const handleSaveName = async () => {
    if (!business || !profile?.business_id || !tempBusinessName.trim()) return;
    
    if (tempBusinessName === business.business_name) {
      setEditingName(false);
      return;
    }

    // Check if can change
    const limit = await canChangeBusinessName(profile.business_id);
    if (!limit.canChange) {
      toast({
        title: language === "es" ? "Límite alcanzado" : "Limit reached",
        description: limit.message || (language === "es" ? "Ya has cambiado el nombre este año" : "You've already changed the name this year"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Update business name
      const { error } = await supabase
        .from("businesses")
        .update({ business_name: tempBusinessName.trim() })
        .eq("id", profile.business_id);

      if (error) throw error;

      // Record the change
      await recordBusinessNameChange(
        profile.business_id,
        business.business_name,
        tempBusinessName.trim()
      );

      // Update local state
      setBusiness(prev => prev ? { ...prev, business_name: tempBusinessName.trim() } : null);
      setEditingName(false);
      
      // Refresh limit
      const newLimit = await canChangeBusinessName(profile.business_id);
      setNameChangeLimit(newLimit);

      toast({
        title: language === "es" ? "Nombre actualizado" : "Name updated",
        description: language === "es" ? "El nombre del negocio ha sido actualizado" : "Business name has been updated",
      });
    } catch (error: any) {
      console.error("Error saving name:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "No se pudo actualizar el nombre" : "Could not update name",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategories = async () => {
    if (!business || !profile?.business_id || !tempPrimaryCategory) return;
    
    const hasChanged = 
      tempPrimaryCategory !== business.primary_category ||
      JSON.stringify(tempSecondaryCategories.sort()) !== JSON.stringify((business.secondary_categories || []).sort());
    
    if (!hasChanged) {
      setEditingCategories(false);
      return;
    }

    // Check if can change
    const limit = await canChangeBusinessCategories(profile.business_id);
    if (!limit.canChange) {
      toast({
        title: language === "es" ? "Límite alcanzado" : "Limit reached",
        description: limit.message || (language === "es" ? "Ya has cambiado las categorías 2 veces este año" : "You've already changed categories 2 times this year"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Update categories
      const { error } = await supabase
        .from("businesses")
        .update({ 
          primary_category: tempPrimaryCategory,
          secondary_categories: tempSecondaryCategories,
        })
        .eq("id", profile.business_id);

      if (error) throw error;

      // Record the change
      await recordBusinessCategoryChange(
        profile.business_id,
        business.primary_category,
        tempPrimaryCategory,
        business.secondary_categories || [],
        tempSecondaryCategories
      );

      // Update local state
      setBusiness(prev => prev ? { 
        ...prev, 
        primary_category: tempPrimaryCategory,
        secondary_categories: tempSecondaryCategories,
      } : null);
      setEditingCategories(false);
      
      // Refresh limit
      const newLimit = await canChangeBusinessCategories(profile.business_id);
      setCategoryChangeLimit(newLimit);

      toast({
        title: language === "es" ? "Categorías actualizadas" : "Categories updated",
        description: language === "es" ? "Las categorías han sido actualizadas" : "Categories have been updated",
      });
    } catch (error: any) {
      console.error("Error saving categories:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "No se pudieron actualizar las categorías" : "Could not update categories",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!business || !profile?.business_id) return;
    
    // Validate requirements if trying to enable public visibility (slug is no longer required)
    if (business.is_public) {
      setCheckingRequirements(true);
      try {
        const requirements = await validatePublicVisibilityRequirements(profile.business_id);
        setVisibilityRequirements(requirements);

        if (!requirements.isValid) {
          toast({
            title: language === "es" ? "Requisitos no cumplidos" : "Requirements not met",
            description: language === "es" 
              ? `Debes completar los siguientes requisitos antes de activar la visibilidad pública: ${requirements.missingRequirements.join(", ")}`
              : `You must complete the following requirements before enabling public visibility: ${requirements.missingRequirements.join(", ")}`,
            variant: "destructive",
          });
          // Revert is_public to false if requirements not met
          setBusiness(prev => prev ? { ...prev, is_public: false } : null);
          return;
        }
      } catch (error) {
        console.error("Error validating requirements:", error);
        toast({
          title: language === "es" ? "Error" : "Error",
          description: language === "es" ? "No se pudieron validar los requisitos" : "Could not validate requirements",
          variant: "destructive",
        });
        setBusiness(prev => prev ? { ...prev, is_public: false } : null);
        return;
      } finally {
        setCheckingRequirements(false);
      }
    }

    setSaving(true);
    try {
      // Build updated location_details with googleMapsUrl
      const updatedLocationDetails = {
        ...(business.location_details || {}),
        googleMapsUrl: business.google_maps_url || null,
      };

      const { error } = await supabase
        .from("businesses")
        .update({
          is_public: business.is_public,
          slug: business.slug || null,
          description: business.description || null,
          logo_url: business.logo_url || null,
          cover_image_url: business.cover_image_url || null,
          phone: business.phone || null,
          address: business.address || null,
          location_details: updatedLocationDetails,
        })
        .eq("id", profile.business_id);

      if (error) {
        if (error.code === "23505") {
          toast({
            title: language === "es" ? "Slug no disponible" : "Slug not available",
            description: language === "es" ? "Este slug ya está en uso" : "This slug is already in use",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: language === "es" ? "Guardado" : "Saved",
        description: language === "es" ? "Perfil actualizado correctamente" : "Profile updated successfully",
      });
      
      // Refresh requirements after saving
      if (business.is_public === false) {
        checkRequirements();
      }
    } catch (error) {
      console.error("Error saving:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "No se pudo guardar" : "Could not save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {language === "es" ? "Perfil Público" : "Public Profile"}
          </h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {language === "es" ? "Perfil Público" : "Public Profile"}
          </h1>
        </div>
        <div className="p-4 text-center text-muted-foreground">
          {language === "es" ? "No se encontró el negocio" : "Business not found"}
        </div>
      </div>
    );
  }

  // Preview Component
  const LivePreview = () => (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-lg">
      {/* Cover Image */}
      <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5">
        {business.cover_image_url ? (
          <img 
            src={business.cover_image_url} 
            alt="Cover" 
            className="w-full h-full object-cover"
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-3 right-3 w-8 h-8 bg-card/80 rounded-full flex items-center justify-center">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {business.logo_url ? (
              <img 
                src={business.logo_url} 
                alt="Logo" 
                className="w-12 h-12 rounded-full object-cover border-2 border-border"
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-foreground line-clamp-1">
                {business.business_name || "Mi Negocio"}
              </h3>
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium">{business.average_rating || 0}</span>
                <span className="text-muted-foreground">({business.total_reviews || 0})</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {business.primary_category || "Otros"}
          </Badge>
          {business.address && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {business.address.length > 20 ? business.address.substring(0, 20) + "..." : business.address}
            </span>
          )}
        </div>

        {business.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {business.description}
          </p>
        )}

        <Button variant="outline" className="w-full" disabled>
          {language === "es" ? "Ver más" : "View more"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {language === "es" ? "Perfil Público" : "Public Profile"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="hidden sm:flex"
          >
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? (language === "es" ? "Ocultar" : "Hide") : "Preview"}
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {language === "es" ? "Guardar" : "Save"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form Column */}
          <div className="space-y-6">
            {/* Status Banner */}
            {!business.onboarding_completed && (
              <Card className="border-amber-500/50 bg-amber-500/10">
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <p className="text-sm text-amber-700">
                    {language === "es" 
                      ? "Completa el onboarding para hacer público tu negocio" 
                      : "Complete onboarding to make your business public"}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Visibility Toggle */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">
                        {language === "es" ? "Visibilidad Pública" : "Public Visibility"}
                      </CardTitle>
                      <CardDescription>
                        {language === "es" 
                          ? "Permite que clientes encuentren tu negocio" 
                          : "Allow clients to discover your business"}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={business.is_public}
                    disabled={checkingRequirements}
                    onCheckedChange={handleVisibilityToggle}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {checkingRequirements && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {language === "es" ? "Verificando requisitos..." : "Checking requirements..."}
                    </span>
                  </div>
                )}
                {business.is_public && visibilityRequirements?.isValid && (
                  <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary">
                      {language === "es" 
                        ? "Tu negocio será visible en BookWise Client" 
                        : "Your business will be visible on BookWise Client"}
                    </span>
                  </div>
                )}
                {!business.is_public && visibilityRequirements && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {language === "es" ? "Requisitos para activar visibilidad pública" : "Requirements to enable public visibility"}
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      <div className="space-y-2">
                        <div className={`flex items-center gap-2 ${visibilityRequirements.requirements.logo ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {visibilityRequirements.requirements.logo ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          <span className="text-sm">
                            {language === "es" ? "Logo del establecimiento" : "Business logo"}
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 ${visibilityRequirements.requirements.coverImage ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {visibilityRequirements.requirements.coverImage ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          <span className="text-sm">
                            {language === "es" ? "Imagen de portada del establecimiento" : "Cover image"}
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 ${visibilityRequirements.requirements.phone ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {visibilityRequirements.requirements.phone ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          <span className="text-sm">
                            {language === "es" ? "Contacto (teléfono)" : "Contact (phone)"}
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 ${visibilityRequirements.requirements.address ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {visibilityRequirements.requirements.address ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          <span className="text-sm">
                            {language === "es" ? "Dirección del establecimiento" : "Business address"}
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 ${visibilityRequirements.requirements.googleMapsUrl ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {visibilityRequirements.requirements.googleMapsUrl ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          <span className="text-sm">
                            {language === "es" ? "URL de Google Maps" : "Google Maps URL"}
                          </span>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Business Info */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">
                    {language === "es" ? "Información del Negocio" : "Business Information"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{language === "es" ? "Nombre" : "Name"}</Label>
                    {!editingName && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (nameChangeLimit?.canChange) {
                            setEditingName(true);
                          } else {
                            toast({
                              title: language === "es" ? "Límite alcanzado" : "Limit reached",
                              description: nameChangeLimit?.message || (language === "es" ? "Ya has cambiado el nombre este año" : "You've already changed the name this year"),
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={!nameChangeLimit?.canChange}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        {language === "es" ? "Editar" : "Edit"}
                      </Button>
                    )}
                  </div>
                  {editingName ? (
                    <div className="space-y-2">
                      <Input 
                        value={tempBusinessName} 
                        onChange={(e) => setTempBusinessName(e.target.value)}
                        placeholder={language === "es" ? "Nombre del negocio" : "Business name"}
                      />
                      {nameChangeLimit && !nameChangeLimit.canChange && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {nameChangeLimit.message}
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveName}
                          disabled={saving || !tempBusinessName.trim()}
                        >
                          {language === "es" ? "Guardar" : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTempBusinessName(business.business_name);
                            setEditingName(false);
                          }}
                        >
                          {language === "es" ? "Cancelar" : "Cancel"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Input value={business.business_name} disabled className="bg-muted" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{language === "es" ? "Descripción" : "Description"}</Label>
                  <Textarea
                    placeholder={language === "es" ? "Describe tu negocio para atraer clientes..." : "Describe your business to attract clients..."}
                    value={business.description || ""}
                    onChange={(e) => setBusiness(prev => prev ? { ...prev, description: e.target.value } : null)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(business.description?.length || 0)}/200 {language === "es" ? "caracteres" : "characters"}
                  </p>
                </div>
                
                {/* Categories Section */}
                <div className="space-y-2 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label>{language === "es" ? "Categorías" : "Categories"}</Label>
                    {!editingCategories && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (categoryChangeLimit?.canChange) {
                            setEditingCategories(true);
                          } else {
                            toast({
                              title: language === "es" ? "Límite alcanzado" : "Limit reached",
                              description: categoryChangeLimit?.message || (language === "es" ? "Ya has cambiado las categorías 2 veces este año" : "You've already changed categories 2 times this year"),
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={!categoryChangeLimit?.canChange}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        {language === "es" ? "Editar" : "Edit"}
                      </Button>
                    )}
                  </div>
                  {editingCategories ? (
                    <div className="space-y-4">
                      {categoryChangeLimit && !categoryChangeLimit.canChange && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {categoryChangeLimit.message}
                          </AlertDescription>
                        </Alert>
                      )}
                      <div>
                        <Label className="text-sm mb-2 block">
                          {language === "es" ? "Categoría Principal" : "Primary Category"}
                        </Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {categories.map((category) => {
                            const Icon = category.icon;
                            const isPrimary = tempPrimaryCategory === category.id;
                            
                            return (
                              <button
                                key={category.id}
                                onClick={() => {
                                  if (isPrimary) {
                                    setTempPrimaryCategory("");
                                  } else {
                                    setTempPrimaryCategory(category.id);
                                  }
                                }}
                                className={`relative p-3 rounded-lg border-2 transition-all ${
                                  isPrimary
                                    ? "border-primary bg-primary/5"
                                    : "border-border bg-card hover:border-primary/50"
                                }`}
                              >
                                {isPrimary && (
                                  <Badge className="absolute -top-2 -right-2 text-xs">
                                    {language === "es" ? "Principal" : "Primary"}
                                  </Badge>
                                )}
                                <div className="flex flex-col items-center gap-1 text-center">
                                  <Icon className="w-5 h-5" />
                                  <span className="text-xs">{category.label}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {tempPrimaryCategory && (
                        <div>
                          <Label className="text-sm mb-2 block">
                            {language === "es" ? "Categorías Secundarias (hasta 3)" : "Secondary Categories (up to 3)"}
                          </Label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {categories
                              .filter(cat => cat.id !== tempPrimaryCategory)
                              .map((category) => {
                                const Icon = category.icon;
                                const isSecondary = tempSecondaryCategories.includes(category.id);
                                
                                return (
                                  <button
                                    key={category.id}
                                    onClick={() => handleCategoryClick(category.id)}
                                    disabled={!isSecondary && tempSecondaryCategories.length >= 3}
                                    className={`relative p-3 rounded-lg border-2 transition-all ${
                                      isSecondary
                                        ? "border-primary bg-primary/5"
                                        : tempSecondaryCategories.length >= 3
                                        ? "border-border bg-muted opacity-50 cursor-not-allowed"
                                        : "border-border bg-card hover:border-primary/50"
                                    }`}
                                  >
                                    {isSecondary && (
                                      <X 
                                        className="absolute -top-1 -right-1 h-4 w-4 text-destructive bg-background rounded-full border"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTempSecondaryCategories(tempSecondaryCategories.filter(id => id !== category.id));
                                        }}
                                      />
                                    )}
                                    <div className="flex flex-col items-center gap-1 text-center">
                                      <Icon className="w-5 h-5" />
                                      <span className="text-xs">{category.label}</span>
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveCategories}
                          disabled={saving || !tempPrimaryCategory}
                        >
                          {language === "es" ? "Guardar" : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTempPrimaryCategory(business.primary_category || "");
                            setTempSecondaryCategories(business.secondary_categories || []);
                            setEditingCategories(false);
                          }}
                        >
                          {language === "es" ? "Cancelar" : "Cancel"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {business.primary_category && (
                        <div>
                          <span className="text-xs text-muted-foreground">
                            {language === "es" ? "Principal: " : "Primary: "}
                          </span>
                          <Badge variant="default" className="ml-2">
                            {categories.find(c => c.id === business.primary_category)?.label || business.primary_category}
                          </Badge>
                        </div>
                      )}
                      {business.secondary_categories && business.secondary_categories.length > 0 && (
                        <div>
                          <span className="text-xs text-muted-foreground">
                            {language === "es" ? "Secundarias: " : "Secondary: "}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {business.secondary_categories.map((catId) => (
                              <Badge key={catId} variant="secondary">
                                {categories.find(c => c.id === catId)?.label || catId}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Images - Direct Upload */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">
                    {language === "es" ? "Imágenes" : "Images"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <Label>{language === "es" ? "Logo" : "Logo"}</Label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageSelect(e, 'logo')}
                  />
                  {business.logo_url ? (
                    <div className="flex items-center gap-3">
                      <img 
                        src={business.logo_url} 
                        alt="Logo" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-border"
                      />
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                        >
                          {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          {language === "es" ? "Cambiar" : "Change"}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeImage('logo')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full h-20 border-dashed"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {language === "es" ? "Subir logo" : "Upload logo"}
                          </span>
                        </div>
                      )}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {language === "es" ? "Se mostrará como imagen circular (max 5MB)" : "Will display as circular image (max 5MB)"}
                  </p>
                </div>

                {/* Cover Upload */}
                <div className="space-y-2">
                  <Label>{language === "es" ? "Imagen de Portada" : "Cover Image"}</Label>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageSelect(e, 'cover')}
                  />
                  {business.cover_image_url ? (
                    <div className="space-y-2">
                      <img 
                        src={business.cover_image_url} 
                        alt="Cover" 
                        className="w-full h-24 object-cover rounded-lg border border-border"
                      />
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => coverInputRef.current?.click()}
                          disabled={uploadingCover}
                        >
                          {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          {language === "es" ? "Cambiar" : "Change"}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeImage('cover')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full h-24 border-dashed"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={uploadingCover}
                    >
                      {uploadingCover ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {language === "es" ? "Subir portada" : "Upload cover"}
                          </span>
                        </div>
                      )}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {language === "es" ? "Recomendado: 1200x400px (max 5MB)" : "Recommended: 1200x400px (max 5MB)"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">
                    {language === "es" ? "Contacto" : "Contact"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{language === "es" ? "Teléfono" : "Phone"}</Label>
                  <Input
                    placeholder="+1 234 567 8900"
                    value={business.phone || ""}
                    onChange={(e) => setBusiness(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "es" ? "Dirección" : "Address"}</Label>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-3 text-muted-foreground" />
                    <Textarea
                      placeholder={language === "es" ? "Tu dirección completa..." : "Your full address..."}
                      value={business.address || ""}
                      onChange={(e) => setBusiness(prev => prev ? { ...prev, address: e.target.value } : null)}
                      rows={2}
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Google Maps URL */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">
                      {language === "es" ? "URL de Google Maps" : "Google Maps URL"}
                    </CardTitle>
                    <CardDescription>
                      {language === "es" 
                        ? "Comparte el enlace de Google Maps de tu ubicación" 
                        : "Share your Google Maps location link"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Input
                    type="url"
                    placeholder={language === "es" ? "https://maps.google.com/..." : "https://maps.google.com/..."}
                    value={business.google_maps_url || ""}
                    onChange={(e) => setBusiness(prev => prev ? { ...prev, google_maps_url: e.target.value } : null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "es" 
                      ? "Pega aquí la URL completa de Google Maps de tu establecimiento. Esto ayudará a los clientes a encontrarte fácilmente." 
                      : "Paste the full Google Maps URL of your business location. This will help clients find you easily."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Column */}
          <div className={`space-y-4 ${showPreview ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-24">
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    {language === "es" ? "Vista Previa en Tiempo Real" : "Live Preview"}
                  </CardTitle>
                  <CardDescription>
                    {language === "es" 
                      ? "Así se verá tu negocio en BookWise Client" 
                      : "This is how your business will appear on BookWise Client"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LivePreview />
                </CardContent>
              </Card>

              {/* Requirements checklist */}
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {language === "es" ? "Requisitos para ser visible" : "Visibility requirements"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {visibilityRequirements ? (
                    <>
                      {/* Imágenes del establecimiento */}
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`h-4 w-4 ${visibilityRequirements.requirements.logo && visibilityRequirements.requirements.coverImage ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <span className={`text-sm ${visibilityRequirements.requirements.logo && visibilityRequirements.requirements.coverImage ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {language === "es" ? "Imágenes del establecimiento (logo y portada)" : "Business images (logo and cover)"}
                        </span>
                      </div>
                      {/* Contacto y dirección */}
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`h-4 w-4 ${visibilityRequirements.requirements.phone && visibilityRequirements.requirements.address ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <span className={`text-sm ${visibilityRequirements.requirements.phone && visibilityRequirements.requirements.address ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {language === "es" ? "Contacto y dirección" : "Contact and address"}
                        </span>
                      </div>
                      {/* URL de Google Maps */}
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`h-4 w-4 ${visibilityRequirements.requirements.googleMapsUrl ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <span className={`text-sm ${visibilityRequirements.requirements.googleMapsUrl ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {language === "es" ? "Ubicación mapa (URL Google Maps)" : "Map location (Google Maps URL)"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {language === "es" ? "Imágenes del establecimiento (logo y portada)" : "Business images (logo and cover)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {language === "es" ? "Contacto y dirección" : "Contact and address"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {language === "es" ? "Ubicación mapa (URL Google Maps)" : "Map location (Google Maps URL)"}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
                <CardContent className="pt-0">
                  <Button 
                    onClick={() => navigate('/admin/business-profile')}
                    className="w-full"
                    variant="default"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {language === "es" ? "Editar" : "Edit"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Mobile Preview Toggle Button */}
        <div className="fixed bottom-20 right-4 sm:hidden">
          <Button 
            size="lg"
            className="rounded-full shadow-lg"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-5 w-5 mr-2" />
            {showPreview ? "Editar" : "Preview"}
          </Button>
        </div>
      </div>
    </div>
  );
}