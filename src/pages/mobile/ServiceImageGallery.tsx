import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BUCKET_NAME = "business-images";

interface GalleryImage {
  name: string;
  url: string;
  path: string;
  category: 'front' | 'team' | 'interior';
}

type GalleryCategory = {
  id: 'front' | 'team' | 'interior';
  label: string;
  labelEs: string;
};

const GALLERY_CATEGORIES: GalleryCategory[] = [
  { id: 'front', label: 'Store Front', labelEs: 'Imagen del frente del local' },
  { id: 'team', label: 'Team Photo', labelEs: 'Imagen del equipo de trabajo' },
  { id: 'interior', label: 'Store Interior', labelEs: 'Imagen del local por dentro' },
];

export default function ServiceImageGallery() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const [images, setImages] = useState<Record<string, GalleryImage | null>>({
    front: null,
    team: null,
    interior: null,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({
    front: false,
    team: false,
    interior: false,
  });
  const [deleteImage, setDeleteImage] = useState<{ image: GalleryImage; category: string } | null>(null);

  useEffect(() => {
    if (profile?.business_id) {
      loadImages();
    }
  }, [profile?.business_id]);

  const loadImages = async () => {
    if (!profile?.business_id) return;
    
    setLoading(true);
    try {
      const loadedImages: Record<string, GalleryImage | null> = {
        front: null,
        team: null,
        interior: null,
      };

      // Load images for each category
      for (const category of GALLERY_CATEGORIES) {
        const folderPath = `${profile.business_id}/gallery/${category.id}`;
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .list(folderPath, {
            limit: 1,
            sortBy: { column: 'created_at', order: 'desc' }
          });

        if (error && error.message !== 'The resource was not found') {
          console.error(`Error loading ${category.id}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          const file = data.find(f => f.name !== '.emptyFolderPlaceholder');
          if (file) {
            const path = `${folderPath}/${file.name}`;
            const { data: urlData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(path);
            
            loadedImages[category.id] = {
              name: file.name,
              url: urlData.publicUrl,
              path,
              category: category.id,
            };
          }
        }
      }

      setImages(loadedImages);
    } catch (error) {
      console.error("Error loading images:", error);
      toast.error(t("errorLoadingImages") || "Error al cargar imágenes");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: 'front' | 'team' | 'interior') => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !profile?.business_id) return;

    const file = files[0]; // Only one file per category

    // Check if category already has an image
    if (images[category]) {
      toast.error(
        t("categoryHasImage") || 
        "Esta categoría ya tiene una imagen. Elimina la imagen actual antes de subir una nueva."
      );
      e.target.value = '';
      return;
    }

    setUploading(prev => ({ ...prev, [category]: true }));
    
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(t("invalidFileType") || "Solo se permiten imágenes");
        return;
      }

      // Max 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("fileTooLarge") || "La imagen debe ser menor a 5MB");
        return;
      }

      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const fileName = `${timestamp}.${ext}`;
      const folderPath = `${profile.business_id}/gallery/${category}`;
      const filePath = `${folderPath}/${fileName}`;

      // Delete old image if exists (shouldn't happen, but just in case)
      const oldImage = images[category];
      if (oldImage) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([oldImage.path]);
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      toast.success(t("imageAdded") || "Imagen agregada");
      await loadImages();
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(error.message || t("errorUploadingImage") || "Error al subir imagen");
    } finally {
      setUploading(prev => ({ ...prev, [category]: false }));
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (!deleteImage) return;

    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([deleteImage.image.path]);

      if (error) throw error;

      toast.success(t("imageDeleted") || "Imagen eliminada");
      await loadImages();
    } catch (error: any) {
      console.error("Error deleting image:", error);
      toast.error(error.message || t("errorDeletingImage") || "Error al eliminar imagen");
    } finally {
      setDeleteImage(null);
    }
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{t("gallery") || "Galería"}</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {GALLERY_CATEGORIES.map((category) => {
              const categoryImage = images[category.id];
              const isUploading = uploading[category.id];
              const categoryLabel = language === "es" ? category.labelEs : category.label;
              
              return (
                <div key={category.id} className="space-y-2">
                  <Label className="text-base font-semibold">{categoryLabel}</Label>
                  
                  {categoryImage ? (
                    <div className="relative group">
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-border">
                        <img
                          src={categoryImage.url}
                          alt={categoryLabel}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteImage({ image: categoryImage, category: category.id })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t("delete") || "Eliminar"}
                          </Button>
                          <Label htmlFor={`upload-${category.id}`} className="cursor-pointer">
                            <Button
                              variant="secondary"
                              size="sm"
                              asChild
                            >
                              <span>
                                <Upload className="h-4 w-4 mr-2" />
                                {t("change") || "Cambiar"}
                              </span>
                            </Button>
                          </Label>
                        </div>
                      </div>
                      <Input
                        id={`upload-${category.id}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, category.id)}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </div>
                  ) : (
                    <Label htmlFor={`upload-${category.id}`} className="cursor-pointer">
                      <div className="flex items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors">
                        {isUploading ? (
                          <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        ) : (
                          <Upload className="h-6 w-6 text-primary" />
                        )}
                        <span className="font-medium">
                          {isUploading 
                            ? (t("uploading") || "Subiendo...") 
                            : (t("uploadImage") || "Subir imagen")
                          }
                        </span>
                      </div>
                      <Input
                        id={`upload-${category.id}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, category.id)}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </Label>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <AlertDialog open={deleteImage !== null} onOpenChange={() => setDeleteImage(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteImage") || "Eliminar imagen"}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteImageConfirm") || "¿Está seguro de que desea eliminar esta imagen?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel") || "Cancelar"}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                {t("delete") || "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MobileLayout>
  );
}

