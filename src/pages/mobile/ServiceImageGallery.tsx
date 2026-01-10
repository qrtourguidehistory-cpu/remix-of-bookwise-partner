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

const MAX_IMAGES = 3;
const BUCKET_NAME = "business-images";

interface GalleryImage {
  name: string;
  url: string;
  path: string;
}

export default function ServiceImageGallery() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteImage, setDeleteImage] = useState<GalleryImage | null>(null);

  useEffect(() => {
    if (profile?.business_id) {
      loadImages();
    }
  }, [profile?.business_id]);

  const loadImages = async () => {
    if (!profile?.business_id) return;
    
    setLoading(true);
    try {
      const folderPath = `${profile.business_id}/gallery`;
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(folderPath, {
          limit: MAX_IMAGES,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const imageList: GalleryImage[] = (data || [])
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => {
          const path = `${folderPath}/${file.name}`;
          const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(path);
          
          return {
            name: file.name,
            url: urlData.publicUrl,
            path
          };
        });

      setImages(imageList);
    } catch (error) {
      console.error("Error loading images:", error);
      toast.error(t("errorLoadingImages") || "Error al cargar imágenes");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !profile?.business_id) return;

    // Check limit
    if (images.length + files.length > MAX_IMAGES) {
      toast.error(
        t("maxImagesReached") || 
        `Máximo ${MAX_IMAGES} imágenes permitidas. Tienes ${images.length} actualmente.`
      );
      return;
    }

    setUploading(true);
    
    for (const file of files) {
      try {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(t("invalidFileType") || "Solo se permiten imágenes");
          continue;
        }

        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
          toast.error(t("fileTooLarge") || "La imagen debe ser menor a 5MB");
          continue;
        }

        const timestamp = Date.now();
        const ext = file.name.split('.').pop();
        const fileName = `${timestamp}.${ext}`;
        const filePath = `${profile.business_id}/gallery/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        toast.success(t("imageAdded") || "Imagen agregada");
      } catch (error: any) {
        console.error("Error uploading image:", error);
        toast.error(error.message || t("errorUploadingImage") || "Error al subir imagen");
      }
    }

    // Reset input and reload
    e.target.value = '';
    await loadImages();
    setUploading(false);
  };

  const handleDelete = async () => {
    if (!deleteImage) return;

    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([deleteImage.path]);

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
            <p className="text-sm text-muted-foreground">
              {images.length}/{MAX_IMAGES} {t("images") || "imágenes"}
            </p>
          </div>
        </div>

        {images.length < MAX_IMAGES && (
          <div className="mb-6">
            <Label htmlFor="images" className="cursor-pointer">
              <div className="flex items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors">
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : (
                  <Upload className="h-6 w-6 text-primary" />
                )}
                <span className="font-medium">
                  {uploading 
                    ? (t("uploading") || "Subiendo...") 
                    : (t("uploadImages") || "Subir imágenes")
                  }
                </span>
              </div>
              <Input
                id="images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploading}
              />
            </Label>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {t("noImages") || "No hay imágenes. Sube algunas para empezar."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {images.map((image) => (
              <div key={image.path} className="relative group aspect-square">
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => setDeleteImage(image)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
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
