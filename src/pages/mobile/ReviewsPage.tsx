import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, User, Mail, Phone } from "lucide-react";
import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Review {
  id: string;
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAvatar: string | null;
  rating: number;
  comment: string | null;
  date: string;
  adminResponse: string | null;
}

type ReviewFilter = 'all' | 'good' | 'neutral' | 'critical';

export default function ReviewsPage() {
  const [responses, setResponses] = useState<{ [key: string]: string }>({});
  const [showReplyFor, setShowReplyFor] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('all');
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.business_id) {
      fetchReviews();
    }
  }, [profile?.business_id]);

  const fetchReviews = async () => {
    if (!profile?.business_id) return;

    try {
      // Fetch reviews - try to include admin_response and client info
      const { data: initialData, error } = await supabase
        .from("reviews")
        .select(`
          id,
          rating,
          comment,
          admin_response,
          created_at,
          client_id,
          clients!reviews_client_id_fkey(
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
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
        clientId: review.client_id || review.clients?.id || null,
        clientName: review.clients?.full_name || "Cliente",
        clientEmail: review.clients?.email || null,
        clientPhone: review.clients?.phone || null,
        clientAvatar: review.clients?.avatar_url || null,
        rating: review.rating || 0,
        comment: review.comment,
        date: review.created_at,
        adminResponse: review.admin_response || null,
      }));

      // Filter to max 10 per category (good: 4-5, neutral: 3, negative: 1-2)
      const goodReviews = formattedReviews.filter(r => r.rating >= 4).slice(0, 10);
      const neutralReviews = formattedReviews.filter(r => r.rating === 3).slice(0, 10);
      const negativeReviews = formattedReviews.filter(r => r.rating <= 2).slice(0, 10);
      
      // Combine and sort by date (newest first)
      const filteredReviews = [...goodReviews, ...neutralReviews, ...negativeReviews]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setReviews(filteredReviews);
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
          response_created_at: new Date().toISOString(),
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

  // Filter reviews based on active filter
  const filteredReviews = reviews.filter(review => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'good') return review.rating >= 4;
    if (activeFilter === 'neutral') return review.rating === 3;
    if (activeFilter === 'critical') return review.rating <= 2;
    return true;
  });

  // Count reviews by category
  const counts = {
    good: reviews.filter(r => r.rating >= 4).length,
    neutral: reviews.filter(r => r.rating === 3).length,
    critical: reviews.filter(r => r.rating <= 2).length,
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{t("reviews")}</h1>
        
        {/* Info Message */}
        <div className="bg-muted/50 border border-border rounded-lg p-3 mb-4">
          <p className="text-xs text-muted-foreground text-center">
            {language === "es" 
              ? "Solo se conservan las 10 reseñas más recientes de cada categoría para optimizar el rendimiento"
              : "Only the 10 most recent reviews of each category are kept to optimize performance"}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('all')}
            className="flex-shrink-0"
          >
            {language === "es" ? "Todas" : "All"} ({reviews.length})
          </Button>
          <Button
            variant={activeFilter === 'good' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('good')}
            className="flex-shrink-0"
          >
            <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
            {language === "es" ? "Buenas" : "Good"} ({counts.good})
          </Button>
          <Button
            variant={activeFilter === 'neutral' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('neutral')}
            className="flex-shrink-0"
          >
            <Star className="w-3 h-3 mr-1 fill-orange-400 text-orange-400" />
            {language === "es" ? "Neutrales" : "Neutral"} ({counts.neutral})
          </Button>
          <Button
            variant={activeFilter === 'critical' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter('critical')}
            className="flex-shrink-0"
          >
            <Star className="w-3 h-3 mr-1 fill-red-400 text-red-400" />
            {language === "es" ? "Críticas" : "Critical"} ({counts.critical})
          </Button>
        </div>

        {/* Reviews List */}
        {filteredReviews.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === "es" ? "No hay reseñas en esta categoría" : "No reviews in this category"}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <div key={review.id} className="border rounded-lg p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      if (review.clientId) {
                        // Dispatch event to open client profile
                        window.dispatchEvent(new CustomEvent('openClientProfile', {
                          detail: { clientId: review.clientId }
                        }));
                      }
                    }}
                  >
                    <Avatar>
                      <AvatarImage src={review.clientAvatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {review.clientName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{review.clientName}</p>
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {review.clientEmail && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span>{review.clientEmail}</span>
                          </div>
                        )}
                        {review.clientPhone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{review.clientPhone}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(review.date), {
                            addSuffix: true,
                            locale: language === "es" ? es : enUS,
                          })}
                        </p>
                      </div>
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
