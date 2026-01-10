import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, X, Sparkles, Users, Calendar, TrendingUp, Lightbulb, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabaseClient";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ApprovalSuccessBannerProps {
  onDismiss?: () => void;
}

export function ApprovalSuccessBanner({ onDismiss }: ApprovalSuccessBannerProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [business, setBusiness] = useState<{ approval_status: string; is_public: boolean } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkApprovalStatus();
    
    // Listen for approval status changes
    if (profile?.business_id) {
      const channel = supabase
        .channel(`business-approval-${profile.business_id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'businesses',
            filter: `id=eq.${profile.business_id}`,
          },
          () => {
            checkApprovalStatus();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.business_id]);

  const checkApprovalStatus = async () => {
    if (!profile?.business_id) return;

    try {
      // Get business approval status and when it was approved
      const { data: businessData } = await supabase
        .from("businesses")
        .select("approval_status, is_public, updated_at")
        .eq("id", profile.business_id)
        .maybeSingle();

      // Get the most recent approval request to check when it was approved
      const { data: approvalRequest } = await supabase
        .from("business_approval_requests")
        .select("reviewed_at, status")
        .eq("business_id", profile.business_id)
        .eq("status", "approved")
        .order("reviewed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (businessData && businessData.approval_status === 'approved' && businessData.is_public) {
        // Check if user has dismissed this banner before
        const dismissedKey = `approval_banner_dismissed_${profile.business_id}`;
        const wasDismissed = localStorage.getItem(dismissedKey);
        
        // Show banner if:
        // 1. Not dismissed before
        // 2. Approval was recent (within last 7 days) OR no dismissal record exists
        const approvalDate = approvalRequest?.reviewed_at 
          ? new Date(approvalRequest.reviewed_at) 
          : businessData.updated_at 
            ? new Date(businessData.updated_at) 
            : null;
        
        const daysSinceApproval = approvalDate 
          ? (new Date().getTime() - approvalDate.getTime()) / (1000 * 60 * 60 * 24)
          : 0;
        
        if (!wasDismissed && !dismissed && daysSinceApproval <= 7) {
          setBusiness(businessData);
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      } else {
        setIsVisible(false);
      }
    } catch (error) {
      console.error("Error checking approval status:", error);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    if (profile?.business_id) {
      localStorage.setItem(`approval_banner_dismissed_${profile.business_id}`, 'true');
    }
    onDismiss?.();
  };

  if (!isVisible || !business || dismissed) return null;

  const tips = [
    {
      icon: Users,
      title: language === "es" ? "Atrae más clientes" : "Attract more clients",
      description: language === "es" 
        ? "Completa tu perfil con fotos de calidad, descripción atractiva y servicios claros para destacar."
        : "Complete your profile with quality photos, attractive description and clear services to stand out.",
    },
    {
      icon: Calendar,
      title: language === "es" ? "Mantén tu calendario actualizado" : "Keep your calendar updated",
      description: language === "es"
        ? "Asegúrate de tener horarios disponibles y servicios bien configurados para recibir más reservas."
        : "Make sure you have available schedules and well-configured services to receive more bookings.",
    },
    {
      icon: TrendingUp,
      title: language === "es" ? "Promociona tu negocio" : "Promote your business",
      description: language === "es"
        ? "Comparte tu perfil público con clientes y en redes sociales para aumentar tu visibilidad."
        : "Share your public profile with clients and on social media to increase your visibility.",
    },
    {
      icon: Sparkles,
      title: language === "es" ? "Responde rápido a las reservas" : "Respond quickly to bookings",
      description: language === "es"
        ? "Confirma o gestiona las reservas rápidamente para dar una mejor experiencia a tus clientes."
        : "Confirm or manage bookings quickly to provide a better experience for your clients.",
    },
  ];

  return (
    <Card className="border-green-500/50 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 mb-4 mx-4 shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="rounded-full bg-green-500 p-2 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-green-800 dark:text-green-300">
                  {language === "es" ? "¡Tu negocio está publicado!" : "Your business is published!"}
                </h3>
                <Badge className="bg-green-600 text-white">
                  {language === "es" ? "Publicado" : "Published"}
                </Badge>
              </div>
              <p className="text-sm text-green-700 dark:text-green-400 mb-3">
                {language === "es"
                  ? "Los clientes ahora pueden encontrarte en MiTurnow Client. ¡Sigue estos consejos para maximizar tu éxito!"
                  : "Clients can now find you on MiTurnow Client. Follow these tips to maximize your success!"}
              </p>

              {/* Tips Accordion */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="tips" className="border-none">
                  <AccordionTrigger className="text-sm text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 py-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      {language === "es" ? "Ver consejos y tips" : "View tips and advice"}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 space-y-3">
                    {tips.map((tip, index) => {
                      const Icon = tip.icon;
                      return (
                        <div key={index} className="flex items-start gap-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                          <Icon className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-sm text-green-800 dark:text-green-300 mb-1">
                              {tip.title}
                            </h4>
                            <p className="text-xs text-green-700 dark:text-green-400">
                              {tip.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-600 text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                  onClick={() => {
                    navigate("/admin/business-profile");
                    handleDismiss();
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  {language === "es" ? "Ver perfil" : "View profile"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                  onClick={handleDismiss}
                >
                  {language === "es" ? "Entendido" : "Got it"}
                </Button>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

