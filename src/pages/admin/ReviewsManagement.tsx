import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es, enUS } from "date-fns/locale";

interface Review {
  id: string;
  client: string;
  service: string;
  staff: string;
  rating: number;
  comment: string | null;
  date: string;
  isAddressed: boolean;
  adminResponse: string | null;
}

export default function ReviewsManagement() {
  const { profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [responses, setResponses] = useState<{ [key: string]: string }>({});
  const [stats, setStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    pendingResponse: 0,
    responseRate: 0,
  });

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
          is_addressed,
          created_at,
          clients!reviews_client_id_fkey(full_name),
          services!reviews_service_id_fkey(name),
          staff!reviews_staff_id_fkey(full_name)
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
            is_addressed,
            created_at,
            clients!reviews_client_id_fkey(full_name),
            services!reviews_service_id_fkey(name),
            staff!reviews_staff_id_fkey(full_name)
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
        client: review.clients?.full_name || "Cliente",
        service: review.services?.name || "Servicio",
        staff: review.staff?.full_name || "Personal",
        rating: review.rating || 0,
        comment: review.comment,
        date: review.created_at,
        isAddressed: review.is_addressed || !!review.admin_response,
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

      // Calculate stats
      const totalReviews = formattedReviews.length;
      const averageRating =
        totalReviews > 0
          ? formattedReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
          : 0;
      const pendingResponse = formattedReviews.filter((r) => !r.isAddressed).length;
      const responded = formattedReviews.filter((r) => r.isAddressed).length;
      const responseRate = totalReviews > 0 ? (responded / totalReviews) * 100 : 0;

      setStats({
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews,
        pendingResponse,
        responseRate: Math.round(responseRate),
      });
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      toast.error("Error loading reviews");
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
        toast.warning("admin_response column doesn't exist. Run the SQL migration.");
      } else if (error) {
        throw error;
      }

      toast.success("Response sent");
      setResponses({ ...responses, [reviewId]: "" });
      fetchReviews();
    } catch (error: any) {
      console.error("Error sending reply:", error);
      toast.error("Error sending response");
    }
  };

  const handleMarkAsAddressed = async (reviewId: string) => {
    if (!profile?.business_id) return;

    try {
      const { error } = await supabase
        .from("reviews")
        .update({
          is_addressed: true,
        })
        .eq("id", reviewId)
        .eq("business_id", profile.business_id);

      if (error) throw error;

      toast.success("Marked as addressed");
      fetchReviews();
    } catch (error: any) {
      console.error("Error marking as addressed:", error);
      toast.error("Error updating review");
    }
  };

  const filteredReviews = reviews.filter(
    (review) =>
      review.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.comment?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="text-center py-8">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reviews & Ratings</h1>
            <p className="text-muted-foreground mt-1">Monitor and respond to customer feedback</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <div className="text-2xl font-bold">{stats.averageRating || 0}</div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Average Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{stats.totalReviews}</div>
              <p className="text-sm text-muted-foreground mt-1">Total Reviews</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{stats.pendingResponse}</div>
              <p className="text-sm text-muted-foreground mt-1">Pending Response</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{stats.responseRate}%</div>
              <p className="text-sm text-muted-foreground mt-1">Response Rate</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Reviews</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reviews..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No reviews found" : "No reviews yet"}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredReviews.map((review) => (
                  <div key={review.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarImage src="" />
                          <AvatarFallback>
                            {review.client.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{review.client}</p>
                            <Badge variant="secondary" className="text-xs">
                              {review.service}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">with {review.staff}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < review.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-muted-foreground"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            review.isAddressed
                              ? "bg-green-500/10 text-green-700 border-green-500/20"
                              : "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
                          }
                        >
                          {review.isAddressed ? "Addressed" : "Pending"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(review.date), {
                            addSuffix: true,
                            locale: navigator.language.startsWith("es") ? es : enUS,
                          })}
                        </span>
                      </div>
                    </div>
                    {review.comment && <p className="text-sm">{review.comment}</p>}
                    {review.adminResponse && (
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm font-medium mb-1">Admin Response:</p>
                        <p className="text-sm">{review.adminResponse}</p>
                      </div>
                    )}
                    {!review.isAddressed && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Write your response..."
                          className="resize-none"
                          value={responses[review.id] || ""}
                          onChange={(e) =>
                            setResponses({ ...responses, [review.id]: e.target.value })
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleReply(review.id)}
                            disabled={!responses[review.id]}
                          >
                            Send Response
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAsAddressed(review.id)}
                          >
                            Mark as Addressed
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
