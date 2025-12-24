import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

export default function ServiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "", // RD$ (Pesos Dominicanos)
    price_usd: "", // USD (Dólares)
    duration_minutes: "",
    category: "",
    image_url: "",
  });

  useEffect(() => {
    if (id) {
      fetchService();
    }
  }, [id]);

  const fetchService = async () => {
    if (!id || !profile?.business_id) return;
    
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("id", id)
      .eq("business_id", profile.business_id)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load service",
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setFormData({
        name: data.name,
        description: data.description || "",
        price: data.price?.toString() || "", // RD$
        price_usd: data.price_usd?.toString() || "", // USD
        duration_minutes: data.duration_minutes.toString(),
        category: data.category,
        image_url: data.image_url || "",
      });
      if (data.image_url) {
        setImagePreview(data.image_url);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setFormData({ ...formData, image_url: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!profile?.business_id && !id) {
      toast({
        title: "Error",
        description: "No business found. Please complete onboarding first.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const serviceData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price) || 0, // RD$ (Pesos Dominicanos)
        price_usd: parseFloat(formData.price_usd) || null, // USD (Dólares)
        duration_minutes: parseInt(formData.duration_minutes),
        category: formData.category,
        image_url: formData.image_url,
        is_active: true,
      };

      if (id) {
        if (!profile?.business_id) {
          toast({
            title: "Error",
            description: "No business found",
            variant: "destructive",
          });
          return;
        }
        
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", id)
          .eq("business_id", profile.business_id);

        if (error) throw error;

        toast({
          title: t("success") || "Success",
          description: t("serviceUpdated") || "Service updated successfully",
        });
      } else {
        // Include business_id when creating new service
        const { error } = await supabase.from("services").insert({
          ...serviceData,
          business_id: profile?.business_id,
        });

        if (error) throw error;

        toast({
          title: t("success") || "Success",
          description: t("serviceAdded") || "Service added successfully",
        });
      }

      navigate("/admin/services");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save service",
        variant: "destructive",
      });
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
            {id ? t("editService") || "Edit Service" : t("addService") || "Add Service"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="image">{t("image") || "Image"}</Label>
            {imagePreview ? (
              <div className="relative mt-2">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setImagePreview("");
                    setFormData({ ...formData, image_url: "" });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Label htmlFor="image" className="cursor-pointer">
                <div className="flex items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors mt-2">
                  <Upload className="h-6 w-6 text-primary" />
                  <span className="font-medium">{t("uploadImage") || "Upload Image"}</span>
                </div>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </Label>
            )}
          </div>

          <div>
            <Label htmlFor="name">{t("serviceName") || "Service Name"}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="category">{t("category") || "Category"}</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="description">{t("description") || "Description"}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-2"
              rows={4}
            />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">
                  {t("price") || "Price"} (RD$)
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  className="mt-2"
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="price_usd">
                  {t("price") || "Price"} (USD $)
                </Label>
                <Input
                  id="price_usd"
                  type="number"
                  step="0.01"
                  value={formData.price_usd}
                  onChange={(e) => setFormData({ ...formData, price_usd: e.target.value })}
                  className="mt-2"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="duration">{t("duration") || "Duration"} (min)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, duration_minutes: e.target.value })
                }
                required
                className="mt-2"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1"
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? t("loading") || "Loading..." : t("save") || "Save"}
            </Button>
          </div>
        </form>
      </div>
    </MobileLayout>
  );
}
