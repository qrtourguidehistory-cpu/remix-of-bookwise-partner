import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Eye, Globe, Building2, Image as ImageIcon, Phone, MapPin, Link2, Loader2, Star, Clock, CheckCircle2, Upload, X, AlertTriangle, CheckCircle, Scissors, Sparkles, Heart, Droplet, Users, HandMetal, Waves, Flame, Activity, Stethoscope, PawPrint, MoreHorizontal, AlertCircle, Pencil, Send, Ban, RefreshCw, FileCheck, XCircle, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
// Switch removed - visibility is now handled through approval system
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { validatePublicVisibilityRequirements, PublicVisibilityRequirements } from "@/lib/validatePublicVisibility";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canChangeBusinessName, canChangeBusinessCategories, recordBusinessNameChange, recordBusinessCategoryChange } from "@/lib/businessChangeLimits";
import { useMapbox } from "@/hooks/useMapbox";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Geolocation } from '@capacitor/geolocation';
import MobileLayout from "@/components/mobile/MobileLayout";

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
  latitude: number | null;
  longitude: number | null;
  approval_status: 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended' | null;
}

interface ApprovalRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export default function BusinessProfileSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const { status: subscriptionStatus } = useSubscriptionStatus();
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
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [originalBusinessData, setOriginalBusinessData] = useState<BusinessProfile | null>(null);
  
  // Wait for auth to be ready before rendering content
  if (authLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  
  // Token de Mapbox desde variables de entorno (opcional)
  // Verificar ambos nombres posibles de variable de entorno
  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
  
  // Solo inicializar Mapbox si hay token disponible, de lo contrario usar string vacío
  const { isLoaded: mapLoaded } = useMapbox({
    accessToken: MAPBOX_TOKEN || 'dummy-token', // Usar dummy si no hay token real
  });
  
  // Si no hay token, marcar como no cargado para deshabilitar funciones del mapa
  const hasMapboxToken = !!MAPBOX_TOKEN && MAPBOX_TOKEN !== 'dummy-token';
  
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
    fetchApprovalRequest();
  }, [profile?.business_id]);

  // Suscripción realtime para escuchar cambios en la solicitud de aprobación
  useEffect(() => {
    if (!profile?.business_id) return;

    const channel = supabase
      .channel(`business-approval-${profile.business_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'business_approval_requests',
          filter: `business_id=eq.${profile.business_id}`,
        },
        (payload) => {
          console.log('Approval request changed:', payload);
          fetchApprovalRequest();
          fetchBusiness();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${profile.business_id}`,
        },
        (payload) => {
          console.log('Business updated:', payload);
          fetchBusiness();
          
          // Si fue aprobado o rechazado, actualizar y mostrar notificación
          const newStatus = payload.new.approval_status;
          const oldStatus = payload.old?.approval_status;
          
          if (newStatus === 'approved' && oldStatus !== 'approved') {
            // Guardar los datos originales cuando se aprueba
            fetchBusiness().then(() => {
              // Los datos originales se guardarán en fetchBusiness
            });
            
            toast({
              title: language === "es" ? "¡Aprobado!" : "Approved!",
              description: language === "es" 
                ? "Tu negocio ha sido aprobado y ahora es visible en Mí Turnow Client. Se ha iniciado un período de prueba de 30 días."
                : "Your business has been approved and is now visible on Mí Turnow Client. A 30-day trial period has started.",
            });
          } else if (newStatus === 'rejected' && oldStatus !== 'rejected') {
            toast({
              title: language === "es" ? "Solicitud rechazada" : "Request rejected",
              description: language === "es" 
                ? "Tu solicitud de publicación ha sido rechazada. Revisa los comentarios y envía una nueva solicitud."
                : "Your publication request has been rejected. Review the comments and submit a new request.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id, business?.approval_status]);

  useEffect(() => {
    if (business?.id && business.approval_status !== 'approved') {
      // Check requirements when not approved
      checkRequirements();
    }
  }, [business?.id, business?.approval_status]);

  // Verificar si está bloqueado (solicitud pendiente) - usar useMemo para evitar problemas de inicialización
  const isLocked = useMemo(() => {
    return business ? (approvalRequest?.status === 'pending' || business.approval_status === 'pending') : false;
  }, [business, approvalRequest?.status]);
  
  // Detectar cambios después de aprobación - usar useMemo para evitar problemas de inicialización
  const hasChangesAfterApproval = useMemo(() => {
    if (!business || business.approval_status !== 'approved' || !originalBusinessData) return false;
    return (
      business.business_name !== originalBusinessData.business_name ||
      business.logo_url !== originalBusinessData.logo_url ||
      business.cover_image_url !== originalBusinessData.cover_image_url ||
      business.description !== originalBusinessData.description ||
      business.phone !== originalBusinessData.phone ||
      business.address !== originalBusinessData.address ||
      business.google_maps_url !== originalBusinessData.google_maps_url ||
      business.primary_category !== originalBusinessData.primary_category ||
      JSON.stringify(business.secondary_categories) !== JSON.stringify(originalBusinessData.secondary_categories)
    );
  }, [business, originalBusinessData]);

  const fetchBusiness = async () => {
    if (!profile?.business_id) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await (supabase
        .from("businesses")
        .select("id, business_name, is_public, slug, description, logo_url, cover_image_url, phone, address, website, primary_category, secondary_categories, average_rating, total_reviews, onboarding_completed, location_details, latitude, longitude, approval_status")
        .eq("id", profile.business_id)
        .maybeSingle() as any);

      if (error) throw error;
      
      if (data) {
        // Extract google_maps_url from location_details if not set directly
        const locationDetails = data.location_details as any;
        const googleMapsUrl = locationDetails?.googleMapsUrl || null;
        
        const businessData = {
          ...data,
          google_maps_url: googleMapsUrl,
          latitude: data.latitude,
          longitude: data.longitude,
          approval_status: data.approval_status || 'draft',
        } as unknown as BusinessProfile;
        
        setBusiness(businessData);
        setTempBusinessName((data as any).business_name || "");
        setTempPrimaryCategory((data as any).primary_category || "");
        setTempSecondaryCategories((data as any).secondary_categories || []);
        
        // Si el negocio está aprobado, guardar los datos originales para detectar cambios
        if (businessData.approval_status === 'approved' && !originalBusinessData) {
          setOriginalBusinessData(businessData);
        }
        
        // Check change limits
        const nameLimit = await canChangeBusinessName(profile.business_id);
        setNameChangeLimit(nameLimit);
        
        const categoryLimit = await canChangeBusinessCategories(profile.business_id);
        setCategoryChangeLimit(categoryLimit);
      } else {
        // Si no hay datos, establecer business como null
        setBusiness(null);
      }
    } catch (error) {
      console.error("Error fetching business:", error);
      setBusiness(null);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "No se pudo cargar el perfil" : "Could not load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovalRequest = async () => {
    if (!profile?.business_id) return;
    
    try {
      const { data, error } = await supabase
        .from("business_approval_requests")
        .select("id, status, submitted_at, reviewed_at, rejection_reason")
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      const request = data as ApprovalRequest | null;
      setApprovalRequest(request);
      
      // Si hay una solicitud pendiente, actualizar el approval_status del negocio
      if (request?.status === 'pending') {
        // Forzar actualización del estado en la BD si no está sincronizado
        if (business?.approval_status !== 'pending') {
          await supabase
            .from("businesses")
            .update({ approval_status: 'pending' })
            .eq("id", profile.business_id);
          setBusiness(prev => prev ? { ...prev, approval_status: 'pending' } : null);
        }
      }
    } catch (error) {
      console.error("Error fetching approval request:", error);
    }
  };

  const handleSubmitApprovalRequest = async () => {
    if (!profile?.business_id || !profile?.id) return;
    
    // Validate requirements first
    setCheckingRequirements(true);
    try {
      const requirements = await validatePublicVisibilityRequirements(profile.business_id);
      setVisibilityRequirements(requirements);

      if (!requirements.isValid) {
        toast({
          title: language === "es" ? "Requisitos no cumplidos" : "Requirements not met",
          description: language === "es" 
            ? `Debes completar todos los requisitos antes de enviar la solicitud.`
            : `You must complete all requirements before submitting the request.`,
          variant: "destructive",
        });
        return;
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

    // BLOQUEO ESTRICTO: Verificar si ya existe una solicitud pendiente ANTES de hacer cualquier cosa
    const { data: existingRequest } = await supabase
      .from("business_approval_requests")
      .select("id, status")
      .eq("business_id", profile.business_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      toast({
        title: language === "es" ? "Solicitud existente" : "Existing request",
        description: language === "es" 
          ? "Ya tienes una solicitud pendiente de revisión. Espera a que sea aprobada o rechazada antes de enviar una nueva."
          : "You already have a pending review request. Wait for it to be approved or rejected before submitting a new one.",
        variant: "destructive",
      });
      setSubmittingRequest(false);
      // Forzar actualización del estado
      await fetchApprovalRequest();
      return;
    }

    setSubmittingRequest(true);
    try {
      // Guardar los datos originales del negocio al momento de enviar la solicitud
      if (business) {
        setOriginalBusinessData({ ...business });
      }

      const { data, error } = await supabase
        .from("business_approval_requests")
        .insert({
          business_id: profile.business_id,
          owner_id: profile.id,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message?.includes('already exists')) {
          toast({
            title: language === "es" ? "Solicitud existente" : "Existing request",
            description: language === "es" 
              ? "Ya tienes una solicitud pendiente de revisión."
              : "You already have a pending review request.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      setApprovalRequest(data as ApprovalRequest);
      
      // Actualizar el negocio en la base de datos también
      await supabase
        .from("businesses")
        .update({ approval_status: 'pending' })
        .eq("id", profile.business_id);
      
      setBusiness(prev => prev ? { ...prev, approval_status: 'pending' } : null);
      
      toast({
        title: language === "es" ? "¡Solicitud enviada!" : "Request submitted!",
        description: language === "es" 
          ? "Tu solicitud será revisada en las próximas 24 horas. Te notificaremos cuando sea aprobada."
          : "Your request will be reviewed within 24 hours. We'll notify you when it's approved.",
      });
    } catch (error) {
      console.error("Error submitting approval request:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? "No se pudo enviar la solicitud. Intenta nuevamente."
          : "Could not submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleResubmitRequest = async () => {
    if (!profile?.business_id) return;
    
    // Reset approval_status to draft to allow re-submission
    try {
      const { error } = await supabase
        .from("businesses")
        .update({ approval_status: 'draft' })
        .eq("id", profile.business_id);

      if (error) throw error;
      
      setBusiness(prev => prev ? { ...prev, approval_status: 'draft' } : null);
      setApprovalRequest(null);
      
      toast({
        title: language === "es" ? "Listo para re-enviar" : "Ready to resubmit",
        description: language === "es" 
          ? "Corrige los problemas mencionados y envía una nueva solicitud."
          : "Fix the issues mentioned and submit a new request.",
      });
    } catch (error) {
      console.error("Error resetting approval status:", error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" 
          ? "No se pudo restablecer el estado."
          : "Could not reset status.",
        variant: "destructive",
      });
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
    
    // BLOQUEO ESTRICTO: No permitir subir imágenes si hay solicitud pendiente
    if (approvalRequest?.status === 'pending' || business?.approval_status === 'pending') {
      toast({
        title: language === "es" ? "Acción bloqueada" : "Action blocked",
        description: language === "es" 
          ? "No puedes modificar imágenes mientras hay una solicitud en revisión."
          : "You cannot modify images while there is a request under review.",
        variant: "destructive",
      });
      e.target.value = ''; // Reset input
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "Solo se permiten imágenes" : "Only images are allowed",
        variant: "destructive",
      });
      e.target.value = ''; // Reset input
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "La imagen no debe superar 5MB" : "Image must be less than 5MB",
        variant: "destructive",
      });
      e.target.value = ''; // Reset input
      return;
    }
    
    const url = await uploadImage(file, type);
    if (url) {
      setBusiness(prev => prev ? { 
        ...prev, 
        [type === 'logo' ? 'logo_url' : 'cover_image_url']: url 
      } : null);
      
      // If logo is uploaded, also sync with profile avatar_url
      if (type === 'logo' && profile?.id) {
        try {
          await supabase
            .from('profiles')
            .update({ avatar_url: url })
            .eq('id', profile.id);
        } catch (error) {
          console.warn("Could not sync logo with profile avatar:", error);
          // Don't fail the whole operation
        }
      }
      
      // Si estaba aprobado, marcar como draft por cambios
      if (business?.approval_status === 'approved' && originalBusinessData) {
        await supabase
          .from("businesses")
          .update({ approval_status: 'draft', is_public: false })
          .eq("id", profile.business_id);
        
        setBusiness(prev => prev ? { ...prev, approval_status: 'draft', is_public: false } : null);
        setOriginalBusinessData(null);
        
        toast({
          title: language === "es" ? "Cambio detectado" : "Change detected",
          description: language === "es" 
            ? `Has cambiado la ${type === 'logo' ? 'logo' : 'imagen de portada'} de tu perfil aprobado. Debes enviar una nueva solicitud de aprobación.`
            : `You have changed the ${type === 'logo' ? 'logo' : 'cover image'} of your approved profile. You must submit a new approval request.`,
          variant: "default",
        });
      } else {
        toast({
          title: language === "es" ? "Imagen subida" : "Image uploaded",
          description: language === "es" ? "Recuerda guardar los cambios" : "Remember to save changes",
        });
      }
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

  // Geocodificación inversa usando Mapbox
  const reverseGeocode = async (lng: number, lat: number) => {
    if (!hasMapboxToken) {
      console.warn('Mapbox token not available, skipping reverse geocoding');
      return null;
    }
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=es`
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const address = feature.place_name || feature.text || "";
        
        setBusiness(prev => prev ? {
          ...prev,
          address,
          latitude: lat,
          longitude: lng,
        } : null);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      // Si falla, solo guardar coordenadas
      setBusiness(prev => prev ? {
        ...prev,
        latitude: lat,
        longitude: lng,
      } : null);
    }
  };

  // Obtener ubicación actual del usuario (GPS)
  const handleGetCurrentLocation = async () => {
    toast({
      title: language === "es" ? "Obteniendo ubicación..." : "Getting location...",
      description: language === "es" ? "Esto puede tardar unos segundos" : "This may take a few seconds",
    });

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (mapRef.current && markerRef.current) {
        // Animar el mapa hacia la nueva ubicación
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: 16,
          duration: 2000,
        });
        
        markerRef.current.setLngLat([lng, lat]);
        await reverseGeocode(lng, lat);
      }

      toast({
        title: language === "es" ? "Ubicación obtenida" : "Location obtained",
        description: language === "es" ? "El mapa se ha actualizado con tu ubicación" : "The map has been updated with your location",
      });
    } catch (error: any) {
      console.error('Geolocation error:', error);
      toast({
        title: language === "es" ? "Error" : "Error",
        description: language === "es" ? "No se pudo obtener tu ubicación" : "Could not get your location",
        variant: "destructive",
      });
    }
  };

  // Inicializar mapa cuando se carga Mapbox y hay datos del negocio
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || mapRef.current || !business || !hasMapboxToken || isLocked) return;

    // Coordenadas por defecto o las existentes
    const defaultLat = business.latitude || 19.4326;
    const defaultLng = business.longitude || -99.1332;

    // Crear mapa
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [defaultLng, defaultLat],
      zoom: business.latitude ? 16 : 12,
    });

    // Crear marcador draggable (rojo) - BLOQUEAR si hay solicitud pendiente
    const marker = new mapboxgl.Marker({
      draggable: !isLocked, // Solo draggable si NO está bloqueado
      color: '#ef4444', // Rojo
    })
      .setLngLat([defaultLng, defaultLat])
      .addTo(map);

    // Evento: cuando el usuario arrastra el marcador
    marker.on('dragend', () => {
      if (isLocked) {
        // Revertir posición si está bloqueado
        marker.setLngLat([business.longitude || defaultLng, business.latitude || defaultLat]);
        return;
      }
      const lngLat = marker.getLngLat();
      reverseGeocode(lngLat.lng, lngLat.lat);
    });

    // Evento: cuando el usuario hace clic en el mapa
    map.on('click', (e) => {
      if (isLocked) return; // Bloquear clics en el mapa
      marker.setLngLat(e.lngLat);
      reverseGeocode(e.lngLat.lng, e.lngLat.lat);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
    };
  }, [mapLoaded, business?.id, isLocked]);

  const handleSave = async () => {
    if (!business || !profile?.business_id) return;
    
    // BLOQUEO ESTRICTO: No permitir guardar si hay solicitud pendiente
    if (isLocked) {
      toast({
        title: language === "es" ? "Acción bloqueada" : "Action blocked",
        description: language === "es" 
          ? "No puedes modificar el perfil mientras hay una solicitud en revisión."
          : "You cannot modify the profile while there is a request under review.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Build updated location_details with googleMapsUrl and coordinates
      const updatedLocationDetails = {
        ...(business.location_details || {}),
        googleMapsUrl: business.google_maps_url || null,
        latitude: business.latitude,
        longitude: business.longitude,
      };

      // Note: is_public is NOT included - it can only be changed through the approval system
      const { error } = await supabase
        .from("businesses")
        .update({
          slug: business.slug || null,
          description: business.description || null,
          logo_url: business.logo_url || null,
          cover_image_url: business.cover_image_url || null,
          phone: business.phone || null,
          address: business.address || null,
          latitude: business.latitude,
          longitude: business.longitude,
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

      // Sync logo_url with profile avatar_url
      if (business.logo_url && profile?.id) {
        try {
          await supabase
            .from('profiles')
            .update({ avatar_url: business.logo_url })
            .eq('id', profile.id);
        } catch (error) {
          console.warn("Could not sync logo with profile avatar:", error);
          // Don't fail the whole operation
        }
      }

      toast({
        title: language === "es" ? "Guardado" : "Saved",
        description: language === "es" ? "Perfil actualizado correctamente" : "Profile updated successfully",
      });
      
      // Refresh requirements after saving (to update the checklist)
      if (business.approval_status !== 'approved') {
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
      <MobileLayout>
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
      </MobileLayout>
    );
  }

  if (!business) {
    return (
      <MobileLayout>
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
      </MobileLayout>
    );
  }

  // Preview Component - solo si business existe
  const LivePreview = () => {
    if (!business) return null;
    
    return (
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
  };

  return (
    <MobileLayout>
      <div className="pb-20">
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
          {!isLocked && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="hidden sm:flex"
              >
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? (language === "es" ? "Ocultar" : "Hide") : "Preview"}
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || isLocked} 
                size="sm"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {language === "es" ? "Guardar" : "Save"}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Si está bloqueado, mostrar SOLO la alerta, sin scroll */}
        {isLocked && (
          <div className="max-w-2xl mx-auto">
            <Card className="border-amber-500/50 bg-amber-500/10">
              <CardHeader>
                <CardTitle className="text-amber-700 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {language === "es" ? "Establecimiento en revisión" : "Establishment under review"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-700">
                    {language === "es" ? "Establecimiento en revisión" : "Establishment under review"}
                  </AlertTitle>
                  <AlertDescription className="text-amber-600">
                    <p className="mb-2">
                      {language === "es" 
                        ? "Tu solicitud será revisada en las próximas 24 horas para saber si cumple con los estándares de seguridad. Te notificaremos cuando sea aprobada."
                        : "Your request will be reviewed within 24 hours to verify it meets security standards. We'll notify you when it's approved."}
                    </p>
                    {approvalRequest?.submitted_at && (
                      <p className="mt-2 text-xs">
                        {language === "es" ? "Enviada: " : "Submitted: "}
                        {new Date(approvalRequest.submitted_at).toLocaleString()}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        )}
        {!isLocked && business && (
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

            {/* Publication Status & Approval Request */}
            <Card className={
              business.approval_status === 'approved' ? 'border-green-500/50' :
              business.approval_status === 'pending' ? 'border-amber-500/50' :
              business.approval_status === 'rejected' ? 'border-red-500/50' :
              business.approval_status === 'suspended' ? 'border-red-700/50' :
              ''
            }>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">
                        {language === "es" ? "Estado de Publicación" : "Publication Status"}
                      </CardTitle>
                      <CardDescription>
                        {language === "es" 
                          ? "Tu negocio debe ser aprobado para ser visible en MiTurnow Client" 
                          : "Your business must be approved to be visible on MiTurnow Client"}
                      </CardDescription>
                    </div>
                  </div>
                  {/* Status Badge */}
                  {business.approval_status === 'approved' && (
                    <Badge className="bg-green-500 hover:bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {language === "es" ? "Publicado" : "Published"}
                    </Badge>
                  )}
                  {business.approval_status === 'pending' && (
                    <Badge className="bg-amber-500 hover:bg-amber-600">
                      <Clock className="h-3 w-3 mr-1" />
                      {language === "es" ? "En revisión" : "Under review"}
                    </Badge>
                  )}
                  {business.approval_status === 'rejected' && (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      {language === "es" ? "Rechazado" : "Rejected"}
                    </Badge>
                  )}
                  {business.approval_status === 'suspended' && (
                    <Badge className="bg-red-700 hover:bg-red-800">
                      <Ban className="h-3 w-3 mr-1" />
                      {language === "es" ? "Suspendido" : "Suspended"}
                    </Badge>
                  )}
                  {(!business.approval_status || business.approval_status === 'draft') && (
                    <Badge variant="secondary">
                      {language === "es" ? "Borrador" : "Draft"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* APPROVED Status */}
                {business.approval_status === 'approved' && (
                  <>
                    {/* Solo mostrar "Publicado" si is_public es realmente true */}
                    {business.is_public === true ? (
                      <Alert className="border-green-500/50 bg-green-500/10">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle className="text-green-700">
                          {language === "es" ? "¡Tu negocio está publicado!" : "Your business is published!"}
                        </AlertTitle>
                        <AlertDescription className="text-green-600">
                          {language === "es" 
                            ? "Los clientes pueden encontrarte en MiTurnow Client."
                            : "Clients can find you on MiTurnow Client."}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      /* Si is_public es false pero tiene suscripción activa, mostrar aviso */
                      (subscriptionStatus === 'active' || profile?.is_premium === true) ? (
                        <Alert className="border-yellow-500/50 bg-yellow-500/10">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <AlertTitle className="text-yellow-700">
                            {language === "es" ? "Suscripción activa" : "Active subscription"}
                          </AlertTitle>
                          <AlertDescription className="text-yellow-600">
                            {language === "es" 
                              ? "Tu suscripción está activa pero tu negocio aún no es público. Esto puede tardar unos momentos en actualizarse."
                              : "Your subscription is active but your business is not yet public. This may take a few moments to update."}
                          </AlertDescription>
                        </Alert>
                      ) : (
                        /* Si no tiene suscripción activa y no es público */
                        <Alert className="border-orange-500/50 bg-orange-500/10">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <AlertTitle className="text-orange-700">
                            {language === "es" ? "Negocio aprobado pero no público" : "Business approved but not public"}
                          </AlertTitle>
                          <AlertDescription className="text-orange-600">
                            {language === "es" 
                              ? "Tu negocio está aprobado pero no es visible para los clientes. Activa tu suscripción para hacerlo público."
                              : "Your business is approved but not visible to clients. Activate your subscription to make it public."}
                          </AlertDescription>
                        </Alert>
                      )
                    )}
                    {/* Aviso sobre suscripción activa (solo si es público) */}
                    {business.is_public === true && (subscriptionStatus === 'active' || profile?.is_premium === true) && (
                      <Alert className="border-blue-500/50 bg-blue-500/10 mt-4">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-600 text-sm">
                          {language === "es" 
                            ? "Tu negocio es visible para los clientes porque tienes una suscripción activa."
                            : "Your business is visible to clients because you have an active subscription."}
                        </AlertDescription>
                      </Alert>
                    )}
                    {hasChangesAfterApproval && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>
                          {language === "es" ? "Cambios detectados" : "Changes detected"}
                        </AlertTitle>
                        <AlertDescription>
                          {language === "es" 
                            ? "Has realizado cambios en tu perfil aprobado. Debes enviar una nueva solicitud de aprobación para que estos cambios sean visibles."
                            : "You have made changes to your approved profile. You must submit a new approval request for these changes to be visible."}
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}

                {/* PENDING Status - BLOQUEO TOTAL */}
                {isLocked && (
                  <Alert className="border-amber-500/50 bg-amber-500/10">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700">
                      {language === "es" ? "Establecimiento en revisión" : "Establishment under review"}
                    </AlertTitle>
                    <AlertDescription className="text-amber-600">
                      <p className="mb-2">
                        {language === "es" 
                          ? "Tu solicitud será revisada en las próximas 24 horas para saber si cumple con los estándares de seguridad. Te notificaremos cuando sea aprobada."
                          : "Your request will be reviewed within 24 hours to verify it meets security standards. We'll notify you when it's approved."}
                      </p>
                      {approvalRequest?.submitted_at && (
                        <p className="mt-2 text-xs">
                          {language === "es" ? "Enviada: " : "Submitted: "}
                          {new Date(approvalRequest.submitted_at).toLocaleString()}
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* REJECTED Status */}
                {business.approval_status === 'rejected' && (
                  <>
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>
                        {language === "es" ? "Solicitud rechazada" : "Request rejected"}
                      </AlertTitle>
                      <AlertDescription>
                        {approvalRequest?.rejection_reason || (
                          language === "es" 
                            ? "Tu solicitud no cumple con los requisitos. Por favor revisa y corrige los problemas mencionados."
                            : "Your request doesn't meet the requirements. Please review and fix the issues mentioned."
                        )}
                      </AlertDescription>
                    </Alert>
                    <Button 
                      onClick={handleResubmitRequest}
                      variant="outline"
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {language === "es" ? "Corregir y volver a enviar" : "Fix and resubmit"}
                    </Button>
                  </>
                )}

                {/* SUSPENDED Status */}
                {business.approval_status === 'suspended' && (
                  <Alert className="border-red-700/50 bg-red-700/10">
                    <Ban className="h-4 w-4 text-red-700" />
                    <AlertTitle className="text-red-800">
                      {language === "es" ? "Negocio suspendido" : "Business suspended"}
                    </AlertTitle>
                    <AlertDescription className="text-red-700">
                      {language === "es" 
                        ? "Tu negocio ha sido suspendido por el administrador. Contacta soporte para más información."
                        : "Your business has been suspended by the administrator. Contact support for more information."}
                    </AlertDescription>
                  </Alert>
                )}

                {/* DRAFT Status - Show requirements and submit button - SOLO si NO está bloqueado */}
                {!isLocked && (!business.approval_status || business.approval_status === 'draft') && (
                  <>
                    {checkingRequirements && (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">
                          {language === "es" ? "Verificando requisitos..." : "Checking requirements..."}
                        </span>
                      </div>
                    )}
                    
                    {visibilityRequirements && (
                      <Alert>
                        <FileCheck className="h-4 w-4" />
                        <AlertTitle>
                          {language === "es" ? "Requisitos para solicitar publicación" : "Requirements to request publication"}
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
                                {language === "es" ? "Imagen de portada" : "Cover image"}
                              </span>
                            </div>
                            <div className={`flex items-center gap-2 ${visibilityRequirements.requirements.phone ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {visibilityRequirements.requirements.phone ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                              <span className="text-sm">
                                {language === "es" ? "Teléfono de contacto" : "Contact phone"}
                              </span>
                            </div>
                            <div className={`flex items-center gap-2 ${visibilityRequirements.requirements.address ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {visibilityRequirements.requirements.address ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                              <span className="text-sm">
                                {language === "es" ? "Dirección del negocio" : "Business address"}
                              </span>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {!isLocked && (
                    <Button 
                      onClick={handleSubmitApprovalRequest}
                      disabled={submittingRequest || checkingRequirements || !visibilityRequirements?.isValid || isLocked}
                      className="w-full"
                      size="lg"
                    >
                      {submittingRequest ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {language === "es" ? "Solicitar publicación" : "Request publication"}
                    </Button>
                    )}
                    
                    {visibilityRequirements && !visibilityRequirements.isValid && (
                      <p className="text-xs text-muted-foreground text-center">
                        {language === "es" 
                          ? "Completa todos los requisitos para poder enviar la solicitud"
                          : "Complete all requirements to submit the request"}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Business Info - SOLO si NO está bloqueado */}
            {!isLocked && (
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
                {/* Bloquear edición si hay solicitud pendiente */}
                {((business.approval_status === 'pending' || approvalRequest?.status === 'pending') && (
                  <Alert className="border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-600 text-sm">
                      {language === "es" 
                        ? "No puedes modificar la información del negocio mientras tu solicitud está en revisión."
                        : "You cannot modify business information while your request is under review."}
                    </AlertDescription>
                  </Alert>
                ))}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{language === "es" ? "Nombre" : "Name"}</Label>
                    {!editingName && !(business.approval_status === 'pending' || approvalRequest?.status === 'pending') && (
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
                        disabled={!nameChangeLimit?.canChange || (business.approval_status as any) === 'pending' || (approvalRequest?.status as any) === 'pending'}
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
                        disabled={business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
                          disabled={saving || !tempBusinessName.trim() || business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
                    <Input 
                      value={business.business_name} 
                      disabled 
                      className="bg-muted" 
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{language === "es" ? "Descripción" : "Description"}</Label>
                  <Textarea
                    placeholder={language === "es" ? "Describe tu negocio para atraer clientes..." : "Describe your business to attract clients..."}
                    value={business.description || ""}
                    onChange={(e) => setBusiness(prev => prev ? { ...prev, description: e.target.value } : null)}
                    disabled={business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
                    {!editingCategories && !(business.approval_status === 'pending' || approvalRequest?.status === 'pending') && (
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
                        disabled={!categoryChangeLimit?.canChange || (business.approval_status as any) === 'pending' || (approvalRequest?.status as any) === 'pending'}
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
                                  if (business.approval_status === 'pending' || approvalRequest?.status === 'pending') return;
                                  if (isPrimary) {
                                    setTempPrimaryCategory("");
                                  } else {
                                    setTempPrimaryCategory(category.id);
                                  }
                                }}
                                disabled={business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
                                    onClick={() => {
                                      if (business.approval_status === 'pending' || approvalRequest?.status === 'pending') return;
                                      handleCategoryClick(category.id);
                                    }}
                                    disabled={(!isSecondary && tempSecondaryCategories.length >= 3) || business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
                          disabled={saving || !tempPrimaryCategory || business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
            )}

            {/* Images - Direct Upload - SOLO si NO está bloqueado */}
            {!isLocked && (
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
                  <Label>{language === "es" ? "Logo o imagen de perfil" : "Logo or profile image"}</Label>
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
                          onClick={() => {
                            if (business.approval_status === 'pending' || approvalRequest?.status === 'pending') return;
                            logoInputRef.current?.click();
                          }}
                          disabled={uploadingLogo || business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
                      onClick={() => {
                        if (business.approval_status === 'pending' || approvalRequest?.status === 'pending') return;
                        logoInputRef.current?.click();
                      }}
                      disabled={uploadingLogo || business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
                          onClick={() => {
                            if (business.approval_status === 'pending' || approvalRequest?.status === 'pending') return;
                            coverInputRef.current?.click();
                          }}
                          disabled={uploadingCover || business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
                      onClick={() => {
                        if (business.approval_status === 'pending' || approvalRequest?.status === 'pending') return;
                        coverInputRef.current?.click();
                      }}
                      disabled={uploadingCover || business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
            )}

            {/* Contact - SOLO si NO está bloqueado */}
            {!isLocked && (
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
                    disabled={business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
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
                      disabled={business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
                      rows={2}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Mapa interactivo */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {language === "es" ? "Ubicación en el mapa" : "Map location"}
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGetCurrentLocation}
                      disabled={!mapLoaded || !hasMapboxToken || business.approval_status === 'pending' || approvalRequest?.status === 'pending'}
                      className="gap-2"
                    >
                      <Navigation className="w-4 h-4" />
                      {language === "es" ? "Mi ubicación" : "My location"}
                    </Button>
                  </div>
                  
                  <div 
                    ref={mapContainerRef} 
                    className="w-full h-[300px] rounded-lg border-2 border-border overflow-hidden bg-muted"
                  >
                    {!hasMapboxToken ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center space-y-2 p-4">
                          <AlertTriangle className="w-6 h-6 mx-auto text-amber-600" />
                          <p className="text-sm text-muted-foreground">
                            {language === "es" 
                              ? "El token de Mapbox no está configurado. Configura VITE_MAPBOX_TOKEN en tu archivo .env para habilitar el mapa." 
                              : "Mapbox token is not configured. Set VITE_MAPBOX_TOKEN in your .env file to enable the map."}
                          </p>
                        </div>
                      </div>
                    ) : !mapLoaded ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                          <p className="text-xs text-muted-foreground">
                            {language === "es" ? "Cargando mapa..." : "Loading map..."}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    💡 <strong>{language === "es" ? "Tip:" : "Tip:"}</strong>{" "}
                    {language === "es" 
                      ? "Arrastra el marcador rojo o haz clic en el mapa para ajustar tu ubicación exacta"
                      : "Drag the red marker or click on the map to adjust your exact location"}
                  </p>

                  {business.latitude && business.longitude && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                      <MapPin className="w-3 h-3" />
                      <span>
                        {business.latitude.toFixed(6)}, {business.longitude.toFixed(6)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            {/* Google Maps URL - SOLO si NO está bloqueado */}
            {!isLocked && (
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
                    disabled={isLocked}
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "es" 
                      ? "Pega aquí la URL completa de Google Maps de tu establecimiento. Esto ayudará a los clientes a encontrarte fácilmente." 
                      : "Paste the full Google Maps URL of your business location. This will help clients find you easily."}
                  </p>
                </div>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Preview Column - SOLO si NO está bloqueado */}
          {!isLocked && (
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
                      ? "Así se verá tu negocio en MiTurnow Client" 
                      : "This is how your business will appear on MiTurnow Client"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {business && <LivePreview />}
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
          )}
        </div>
        )}
      </div>

      {/* Mobile Preview Toggle Button - SOLO si NO está bloqueado */}
      {!isLocked && business && (
      <div 
        className="fixed right-4 sm:hidden z-50"
        style={{ 
          bottom: "calc(var(--bottom-nav-height, 76px) + max(24px, var(--app-safe-bottom, 0px)))" 
        }}
      >
        <Button 
          size="lg"
          className="rounded-full shadow-lg"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="h-5 w-5 mr-2" />
          {showPreview ? "Editar" : "Preview"}
        </Button>
      </div>
      )}
      </div>
    </MobileLayout>
  );
}