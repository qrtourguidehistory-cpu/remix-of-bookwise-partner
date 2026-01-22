import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import ProgressStepper from "@/components/onboarding/ProgressStepper";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Loader2, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import SelectCategories from "./steps/SelectCategories";
import BusinessName from "./steps/BusinessName";
import IndependentOrTeam from "./steps/IndependentOrTeam";
import ServiceType from "./steps/ServiceType";
import BusinessLocationStep from "./steps/BusinessLocationStep";
import PhysicalLocationDetails from "./steps/PhysicalLocationDetails";
import TeamSize from "./steps/TeamSize";
import AddTeamMembers from "./steps/AddTeamMembers";
import OnboardingSummary from "./steps/OnboardingSummary";

export default function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState({
    businessName: "",
    website: "",
    ownerFirstName: "",
    ownerLastName: "",
    phone: "",
    address: "",
    description: "",
    primaryCategory: "",
    secondaryCategories: [] as string[],
    accountType: "",
    serviceType: "",
    teamSize: "",
    teamMembers: [] as any[],
    locationDetails: null as any,
  });
  const { user, profile, refreshProfile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Redirect if onboarding is already completed
  useEffect(() => {
    if (!loading && profile?.business_id) {
      // If user has business_id, onboarding is complete, redirect to admin
      navigate("/admin", { replace: true });
    }
  }, [profile, loading, navigate]);

  // Show loading state while auth is loading
  if (loading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  const steps = [
    { title: "Business name", component: BusinessName },
    { title: "Select business categories", component: SelectCategories },
    { title: "Choose account type", component: IndependentOrTeam },
    { title: "Team size", component: TeamSize },
    { title: "Add team members", component: AddTeamMembers },
    { title: "Service type", component: ServiceType },
    { title: "Business location", component: BusinessLocationStep },
    { title: "Location details", component: PhysicalLocationDetails },
    { title: "Review and complete", component: OnboardingSummary },
  ];

  const handleNext = (stepData: any) => {
    const newData = { ...data, ...stepData };
    setData(newData);
    
    // Special handling: Skip team size and add team members if account type is "independent"
    if (currentStep === 2 && stepData.accountType === "independent") {
      setCurrentStep(5);
      return;
    }
    
    // Skip location steps if service type is not physical
    if (currentStep === 5 && stepData.serviceType !== "physical") {
      setCurrentStep(8); // Skip both location steps
      return;
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding(newData);
    }
  };

  const handleBack = () => {
    if (currentStep === 0) return; // Can't go back from first step
    
    // Handle special cases where steps were skipped
    if (currentStep === 8) {
      // From summary, go back to location details or service type
      if (data.serviceType === "physical") {
        setCurrentStep(7); // Go to PhysicalLocationDetails
      } else {
        setCurrentStep(5); // Go to ServiceType
      }
    } else if (currentStep === 7) {
      // From PhysicalLocationDetails, go to BusinessLocationStep
      setCurrentStep(6);
    } else if (currentStep === 6) {
      // From BusinessLocationStep, go to ServiceType
      setCurrentStep(5);
    } else if (currentStep === 5) {
      // From ServiceType, check if we skipped team steps
      if (data.accountType === "independent") {
        setCurrentStep(2); // Go back to IndependentOrTeam
      } else {
        setCurrentStep(4); // Go back to AddTeamMembers
      }
    } else if (currentStep === 4) {
      // From AddTeamMembers, go to TeamSize
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // From TeamSize, go to IndependentOrTeam
      setCurrentStep(2);
    } else {
      // Normal backward navigation
      setCurrentStep(currentStep - 1);
    }
  };

  const handleEdit = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  const completeOnboarding = async (finalData: typeof data) => {
    if (!user) return;

    try {
      // Extract location data from locationDetails
      const googleMapsUrl = finalData.locationDetails?.googleMapsUrl ?? null;
      const latitude = finalData.locationDetails?.latitude ?? null;
      const longitude = finalData.locationDetails?.longitude ?? null;

      // Prepare business data with defaults for required fields
      const businessData = {
        owner_id: user.id,
        business_name: finalData.businessName,
        website: finalData.website || null,
        phone: finalData.phone || finalData.locationDetails?.businessPhone || null,
        address: finalData.address || null,
        description: finalData.description || null,
        primary_category: finalData.primaryCategory || "general",
        secondary_categories: finalData.secondaryCategories || [],
        service_type: finalData.serviceType || "physical",
        team_size: finalData.teamSize || "1",
        account_type: finalData.accountType || "independent",
        location_details: finalData.locationDetails || null,
        latitude: latitude, // ⭐ Guardar coordenadas directamente
        longitude: longitude, // ⭐ Guardar coordenadas directamente
        google_maps_url: googleMapsUrl, // ⭐ Opcional
        onboarding_completed: true,
        is_public: false, // New businesses start with public visibility disabled
      };

      // Check if business already exists for this user (UPSERT logic)
      const { data: existingBusiness } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      let business;
      
      if (existingBusiness) {
        // UPDATE existing business
        const { data: updatedBusiness, error: updateError } = await supabase
          .from("businesses")
          .update(businessData as any)
          .eq("owner_id", user.id)
          .select()
          .single();

        if (updateError) throw updateError;
        business = updatedBusiness;
      } else {
        // INSERT new business
        // NOTE: The database trigger will automatically sync profile.business_id
        const { data: newBusiness, error: insertError } = await supabase
          .from("businesses")
          .insert(businessData as any)
          .select()
          .single();

        if (insertError) throw insertError;
        business = newBusiness;
        
        // Ensure profile.business_id is set (trigger should handle this, but we ensure it)
        // This is a safety measure in case the trigger fails
        await supabase
          .from("profiles")
          .update({ business_id: business.id })
          .eq("id", user.id);
      }

      // Update profile with business_id and owner name
      const ownerFullName = [finalData.ownerFirstName, finalData.ownerLastName]
        .filter(Boolean)
        .join(" ");
      
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          business_id: business.id, 
          onboarding_step: steps.length,
          full_name: ownerFullName || null,
        } as any)
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Assign admin role (ignore if already exists)
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: "admin" } as any);

      if (roleError && roleError.code !== "23505") throw roleError;

      // Add team members if any
      if (finalData.teamMembers && finalData.teamMembers.length > 0) {
        const staffMembers = finalData.teamMembers.map((member: any) => ({
          business_id: business.id,
          full_name: member.fullName,
          email: member.email,
          phone: member.phone,
          specialties: member.specialties ? member.specialties.split(',').map((s: string) => s.trim()) : [],
          commission_rate: member.commissionRate,
          avatar_url: member.avatarUrl,
        }));

        const { error: staffError } = await supabase
          .from("staff")
          .insert(staffMembers);

        if (staffError) {
          // Silently handle staff member errors - not critical for onboarding completion
        }
      }

      // Refresh the profile to update the context with new business_id
      await refreshProfile();

      toast.success("¡Configuración completada!");
      navigate("/", { replace: true });
    } catch (error: any) {
      toast.error(error.message || "Error al completar la configuración");
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await signOut();
  };

  return (
    <MobileLayout>
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="w-full max-w-2xl mx-auto space-y-6">
          {/* Header with logout button */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <ProgressStepper
                currentStep={currentStep}
                totalSteps={steps.length}
                stepTitle={steps[currentStep].title}
              />
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogoutConfirm(true)}
                className="ml-2 flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <User className="w-4 h-4" />
                <LogOut className="w-4 h-4" />
              </Button>
              
              {/* Logout confirmation dialog */}
              <AnimatePresence>
                {showLogoutConfirm && (
                  <div 
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowLogoutConfirm(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-background rounded-lg p-6 max-w-sm w-full space-y-4 shadow-lg"
                    >
                      <h3 className="text-lg font-semibold">¿Cambiar de cuenta?</h3>
                      <p className="text-sm text-muted-foreground">
                        Se cerrará tu sesión actual y podrás iniciar sesión con otra cuenta.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setShowLogoutConfirm(false)}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleLogout}
                          className="flex-1"
                        >
                          Cerrar sesión
                        </Button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {CurrentStepComponent && (
                <CurrentStepComponent
                  data={data}
                  onNext={handleNext}
                  onBack={currentStep > 0 ? handleBack : undefined}
                  {...(currentStep === steps.length - 1 ? { onEdit: handleEdit } : {})}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MobileLayout>
  );
}
