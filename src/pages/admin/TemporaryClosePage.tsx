import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function TemporaryClosePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [isCurrentlyClosed, setIsCurrentlyClosed] = useState(false);
  const [closeUntil, setCloseUntil] = useState<Date | null>(null);

  useEffect(() => {
    checkCurrentStatus();
  }, [profile?.business_id]);

  const checkCurrentStatus = async () => {
    if (!profile?.business_id) return;

    const { data } = await (supabase
      .from("businesses")
      .select("*")
      .eq("id", profile.business_id)
      .single() as any);

    if (data) {
      setIsCurrentlyClosed((data as any).temporarily_closed || false);
      if ((data as any).closed_until) {
        setCloseUntil(new Date((data as any).closed_until));
      }
    }
  };

  const handleTemporaryClose = async (duration: '30min' | '1hour' | 'tomorrow') => {
    if (!profile?.business_id) {
      toast.error(language === "es" ? "No se encontró el negocio" : "Business not found");
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      let untilDate: Date;

      switch (duration) {
        case '30min':
          untilDate = new Date(now.getTime() + 30 * 60 * 1000);
          break;
        case '1hour':
          untilDate = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case 'tomorrow':
          untilDate = new Date(now);
          untilDate.setDate(untilDate.getDate() + 1);
          untilDate.setHours(8, 0, 0, 0); // 8 AM tomorrow
          break;
      }

      const { error } = await (supabase
        .from("businesses")
        .update({
          temporarily_closed: true,
          closed_until: untilDate.toISOString()
        } as any)
        .eq("id", profile.business_id) as any);

      if (error) throw error;

      setIsCurrentlyClosed(true);
      setCloseUntil(untilDate);
      
      const durationText = 
        duration === '30min' ? (language === "es" ? "30 minutos" : "30 minutes") :
        duration === '1hour' ? (language === "es" ? "1 hora" : "1 hour") :
        (language === "es" ? "mañana" : "tomorrow");

      toast.success(
        language === "es" 
          ? `Establecimiento cerrado temporalmente hasta ${durationText}`
          : `Business temporarily closed until ${durationText}`
      );
    } catch (error: any) {
      toast.error(error.message || (language === "es" ? "Error al cerrar establecimiento" : "Error closing business"));
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!profile?.business_id) return;

    setLoading(true);
    try {
      const { error } = await (supabase
        .from("businesses")
        .update({
          temporarily_closed: false,
          closed_until: null
        } as any)
        .eq("id", profile.business_id) as any);

      if (error) throw error;

      setIsCurrentlyClosed(false);
      setCloseUntil(null);
      toast.success(language === "es" ? "Establecimiento reabierto" : "Business reopened");
    } catch (error: any) {
      toast.error(error.message || (language === "es" ? "Error al reabrir establecimiento" : "Error reopening business"));
    } finally {
      setLoading(false);
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
            {language === "es" ? "Cerrar Establecimiento Temporalmente" : "Temporarily Close Business"}
          </h1>
        </div>

        {isCurrentlyClosed && closeUntil && (
          <Card className="mb-6 border-orange-500">
            <CardHeader>
              <CardTitle className="text-orange-600">
                {language === "es" ? "Establecimiento Cerrado" : "Business Closed"}
              </CardTitle>
              <CardDescription>
                {language === "es" 
                  ? `Cerrado hasta: ${closeUntil.toLocaleString(language === "es" ? "es-ES" : "en-US")}`
                  : `Closed until: ${closeUntil.toLocaleString("en-US")}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleReopen} 
                disabled={loading}
                className="w-full"
              >
                {language === "es" ? "Reabrir Establecimiento" : "Reopen Business"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {language === "es" ? "Cerrar Temporalmente" : "Temporary Close"}
            </CardTitle>
            <CardDescription>
              {language === "es" 
                ? "Cierra tu establecimiento por un período específico. Los clientes no podrán reservar durante este tiempo."
                : "Close your business for a specific period. Clients won't be able to book during this time."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleTemporaryClose('30min')}
              disabled={loading || isCurrentlyClosed}
            >
              <Clock className="mr-2 h-4 w-4" />
              {language === "es" ? "30 minutos" : "30 minutes"}
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleTemporaryClose('1hour')}
              disabled={loading || isCurrentlyClosed}
            >
              <Clock className="mr-2 h-4 w-4" />
              {language === "es" ? "1 hora" : "1 hour"}
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleTemporaryClose('tomorrow')}
              disabled={loading || isCurrentlyClosed}
            >
              <Clock className="mr-2 h-4 w-4" />
              {language === "es" ? "Hasta mañana" : "Until tomorrow"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}

