import { useState } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

export default function ServiceImageGallery() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [images, setImages] = useState<string[]>([]);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => [...prev, reader.result as string]);
        toast.success(t("imageAdded") || "Imagen agregada");
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDelete = () => {
    if (deleteIndex !== null) {
      setImages((prev) => prev.filter((_, i) => i !== deleteIndex));
      toast.success(t("imageDeleted") || "Imagen eliminada");
      setDeleteIndex(null);
    }
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t("gallery") || "Galería"}</h1>
        </div>

        <div className="mb-6">
          <Label htmlFor="images" className="cursor-pointer">
            <div className="flex items-center justify-center gap-3 p-8 border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors">
              <Upload className="h-6 w-6 text-primary" />
              <span className="font-medium">{t("uploadImages") || "Subir imágenes"}</span>
            </div>
            <Input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
          </Label>
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {t("noImages") || "No hay imágenes. Sube algunas para empezar."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {images.map((image, index) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={image}
                  alt={`Service ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => setDeleteIndex(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <AlertDialog open={deleteIndex !== null} onOpenChange={() => setDeleteIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteImage") || "Eliminar imagen"}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("deleteImageConfirm") || "¿Está seguro de que desea eliminar esta imagen?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
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
