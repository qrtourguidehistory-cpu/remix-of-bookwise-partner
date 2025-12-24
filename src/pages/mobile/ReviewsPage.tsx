import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";

interface Review {
  id: string;
  clientName: string;
  rating: number;
  comment: string | null;
  date: string;
  adminResponse: string | null;
}

export default function ReviewsPage() {
  const [responses, setResponses] = useState<{ [key: string]: string }>({});
  const [showReplyFor, setShowReplyFor] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.business_id) {
      fetchReviews();
    }
  }, [profile?.business_id]);

  const fetchReviews = async () => {
    if (!profile?.business_id) return;

    try {
      // Fetch reviews - try to include admin_response
      const { data: initialData, error } = await supabase
        .from("reviews")
        .select(`
          id,
          rating,
          comment,
          admin_response,
          created_at,
          clients!reviews_client_id_fkey(full_name)
        `)
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false });

      let data = initialData;

      // If column doesn't exist, fetch without it
      if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        const { data: retryData, error: retryError } = await supabase
          .from("reviews")
          .select(`
            id,
            rating,
            comment,
            created_at,
            clients!reviews_client_id_fkey(full_name)
          `)
          .eq("business_id", profile.business_id)
          .order("created_at", { ascending: false });
        
        if (retryError) throw retryError;
        data = retryData as any;
      } else if (error) {
        throw error;
      }

      const formattedReviews: Review[] = (data || []).map((review: any) => ({
        id: review.id,
        clientName: review.clients?.full_name || "Cliente",
        rating: review.rating || 0,
        comment: review.comment,
        date: review.created_at,
        adminResponse: review.admin_response || null,
      }));

      setReviews(formattedReviews);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      toast.error(language === "es" ? "Error al cargar reseñas" : "Error loading reviews");
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (reviewId: string) => {
    if (!profile?.business_id || !responses[reviewId]) return;

    try {
      // Try to update with admin_response
      const { error } = await supabase
        .from("reviews")
        .update({
          admin_response: responses[reviewId],
          is_addressed: true,
        })
        .eq("id", reviewId)
        .eq("business_id", profile.business_id);

      // If column doesn't exist, only update is_addressed
      if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        const { error: retryError } = await supabase
          .from("reviews")
          .update({
            is_addressed: true,
          })
          .eq("id", reviewId)
          .eq("business_id", profile.business_id);
        
        if (retryError) throw retryError;
        toast.warning(language === "es" ? "Columna admin_response no existe. Ejecuta la migración SQL." : "admin_response column doesn't exist. Run the SQL migration.");
      } else if (error) {
        throw error;
      }

      toast.success(language === "es" ? "Respuesta enviada" : "Response sent");
      setShowReplyFor(null);
      setResponses({ ...responses, [reviewId]: "" });
      fetchReviews();
    } catch (error: any) {
      console.error("Error sending reply:", error);
      toast.error(language === "es" ? "Error al enviar respuesta" : "Error sending response");
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="p-4 pb-24 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">{t("reviews")}</h1>
          <div className="text-center py-8 text-muted-foreground">
            {language === "es" ? "Cargando reseñas..." : "Loading reviews..."}
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t("reviews")}</h1>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === "es" ? "No hay reseñas aún" : "No reviews yet"}
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border rounded-lg p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {review.clientName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{review.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(review.date), {
                          addSuffix: true,
                          locale: language === "es" ? es : enUS,
                        })}
                      </p>
                    </div>
                  </div>
                  {/* Rating */}
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < review.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-border"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Comment */}
                {review.comment && <p className="text-sm">{review.comment}</p>}

                {/* Admin Response */}
                {review.adminResponse && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Admin {t("reply")}:</p>
                    <p className="text-sm">{review.adminResponse}</p>
                  </div>
                )}

                {/* Reply Form */}
                {showReplyFor === review.id ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder={`${t("reply")}...`}
                      value={responses[review.id] || ""}
                      onChange={(e) =>
                        setResponses({ ...responses, [review.id]: e.target.value })
                      }
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleReply(review.id)}
                        disabled={!responses[review.id]}
                      >
                        {t("reply")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowReplyFor(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : !review.adminResponse ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowReplyFor(review.id)}
                  >
                    {t("reply")}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
