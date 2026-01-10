import { useState, useEffect } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, Camera, MapPin, Wifi, Bell, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";

type PermissionStatus = "granted" | "denied" | "prompt" | "unknown" | "loading";

interface PermissionState {
  camera: PermissionStatus;
  location: PermissionStatus;
  notifications: PermissionStatus;
  network: "online" | "offline" | "unknown";
}

export default function PermissionsSettingsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: "loading",
    location: "loading",
    notifications: "loading",
    network: "unknown"
  });
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    await Promise.all([
      checkCameraPermission(),
      checkLocationPermission(),
      checkNotificationPermission(),
      checkNetworkStatus()
    ]);
  };

  const checkCameraPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Camera } = await import("@capacitor/camera");
        const status = await Camera.checkPermissions();
        setPermissions(prev => ({
          ...prev,
          camera: status.camera === "granted" ? "granted" : 
                  status.camera === "denied" ? "denied" : "prompt"
        }));
      } else {
        // Web fallback
        const result = await navigator.permissions.query({ name: "camera" as PermissionName });
        setPermissions(prev => ({
          ...prev,
          camera: result.state as PermissionStatus
        }));
      }
    } catch (error) {
      console.error("Error checking camera permission:", error);
      setPermissions(prev => ({ ...prev, camera: "unknown" }));
    }
  };

  const checkLocationPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import("@capacitor/geolocation");
        const status = await Geolocation.checkPermissions();
        setPermissions(prev => ({
          ...prev,
          location: status.location === "granted" ? "granted" : 
                    status.location === "denied" ? "denied" : "prompt"
        }));
      } else {
        // Web fallback
        const result = await navigator.permissions.query({ name: "geolocation" });
        setPermissions(prev => ({
          ...prev,
          location: result.state as PermissionStatus
        }));
      }
    } catch (error) {
      console.error("Error checking location permission:", error);
      setPermissions(prev => ({ ...prev, location: "unknown" }));
    }
  };

  const checkNotificationPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const status = await PushNotifications.checkPermissions();
        setPermissions(prev => ({
          ...prev,
          notifications: status.receive === "granted" ? "granted" : 
                         status.receive === "denied" ? "denied" : "prompt"
        }));
      } else if ("Notification" in window) {
        setPermissions(prev => ({
          ...prev,
          notifications: Notification.permission as PermissionStatus
        }));
      }
    } catch (error) {
      console.error("Error checking notification permission:", error);
      setPermissions(prev => ({ ...prev, notifications: "unknown" }));
    }
  };

  const checkNetworkStatus = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Network } = await import("@capacitor/network");
        const status = await Network.getStatus();
        setPermissions(prev => ({
          ...prev,
          network: status.connected ? "online" : "offline"
        }));
      } else {
        setPermissions(prev => ({
          ...prev,
          network: navigator.onLine ? "online" : "offline"
        }));
      }
    } catch (error) {
      console.error("Error checking network:", error);
      setPermissions(prev => ({ ...prev, network: "unknown" }));
    }
  };

  const requestCameraPermission = async () => {
    setRequesting("camera");
    try {
      if (Capacitor.isNativePlatform()) {
        const { Camera } = await import("@capacitor/camera");
        const result = await Camera.requestPermissions();
        setPermissions(prev => ({
          ...prev,
          camera: result.camera === "granted" ? "granted" : "denied"
        }));
        if (result.camera === "granted") {
          toast.success(language === "es" ? "Cámara habilitada" : "Camera enabled");
        }
      } else {
        // Web fallback - request by trying to access camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setPermissions(prev => ({ ...prev, camera: "granted" }));
        toast.success(language === "es" ? "Cámara habilitada" : "Camera enabled");
      }
    } catch (error) {
      console.error("Error requesting camera permission:", error);
      setPermissions(prev => ({ ...prev, camera: "denied" }));
      toast.error(language === "es" ? "Permiso de cámara denegado" : "Camera permission denied");
    }
    setRequesting(null);
  };

  const requestLocationPermission = async () => {
    setRequesting("location");
    try {
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import("@capacitor/geolocation");
        const result = await Geolocation.requestPermissions();
        setPermissions(prev => ({
          ...prev,
          location: result.location === "granted" ? "granted" : "denied"
        }));
        if (result.location === "granted") {
          toast.success(language === "es" ? "Ubicación habilitada" : "Location enabled");
        }
      } else {
        // Web fallback
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setPermissions(prev => ({ ...prev, location: "granted" }));
              resolve();
            },
            () => {
              setPermissions(prev => ({ ...prev, location: "denied" }));
              reject();
            }
          );
        });
        toast.success(language === "es" ? "Ubicación habilitada" : "Location enabled");
      }
    } catch (error) {
      console.error("Error requesting location permission:", error);
      toast.error(language === "es" ? "Permiso de ubicación denegado" : "Location permission denied");
    }
    setRequesting(null);
  };

  const requestNotificationPermission = async () => {
    setRequesting("notifications");
    try {
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const result = await PushNotifications.requestPermissions();
        if (result.receive === "granted") {
          await PushNotifications.register();
          setPermissions(prev => ({ ...prev, notifications: "granted" }));
          toast.success(language === "es" ? "Notificaciones habilitadas" : "Notifications enabled");
        } else {
          setPermissions(prev => ({ ...prev, notifications: "denied" }));
        }
      } else if ("Notification" in window) {
        const result = await Notification.requestPermission();
        setPermissions(prev => ({
          ...prev,
          notifications: result as PermissionStatus
        }));
        if (result === "granted") {
          toast.success(language === "es" ? "Notificaciones habilitadas" : "Notifications enabled");
        }
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast.error(language === "es" ? "Permiso de notificaciones denegado" : "Notification permission denied");
    }
    setRequesting(null);
  };

  const getStatusIcon = (status: PermissionStatus | "online" | "offline") => {
    if (status === "loading") return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    if (status === "granted" || status === "online") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === "denied" || status === "offline") return <XCircle className="h-5 w-5 text-red-500" />;
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusText = (status: PermissionStatus | "online" | "offline") => {
    if (status === "loading") return language === "es" ? "Verificando..." : "Checking...";
    if (status === "granted") return language === "es" ? "Permitido" : "Allowed";
    if (status === "denied") return language === "es" ? "Denegado" : "Denied";
    if (status === "online") return language === "es" ? "Conectado" : "Connected";
    if (status === "offline") return language === "es" ? "Sin conexión" : "Offline";
    if (status === "prompt") return language === "es" ? "No solicitado" : "Not requested";
    return language === "es" ? "Desconocido" : "Unknown";
  };

  const permissionItems = [
    {
      key: "camera",
      icon: Camera,
      title: language === "es" ? "Cámara" : "Camera",
      description: language === "es" 
        ? "Necesario para escanear códigos y tomar fotos" 
        : "Required for scanning codes and taking photos",
      status: permissions.camera,
      onRequest: requestCameraPermission,
      canRequest: permissions.camera !== "granted" && permissions.camera !== "loading"
    },
    {
      key: "location",
      icon: MapPin,
      title: language === "es" ? "Ubicación" : "Location",
      description: language === "es" 
        ? "Necesario para mostrar mapas y direcciones" 
        : "Required for showing maps and directions",
      status: permissions.location,
      onRequest: requestLocationPermission,
      canRequest: permissions.location !== "granted" && permissions.location !== "loading"
    },
    {
      key: "notifications",
      icon: Bell,
      title: language === "es" ? "Notificaciones" : "Notifications",
      description: language === "es" 
        ? "Recibe alertas de nuevas citas y recordatorios" 
        : "Receive alerts for new appointments and reminders",
      status: permissions.notifications,
      onRequest: requestNotificationPermission,
      canRequest: permissions.notifications !== "granted" && permissions.notifications !== "loading"
    },
    {
      key: "network",
      icon: Wifi,
      title: language === "es" ? "Estado de Red" : "Network Status",
      description: language === "es" 
        ? "Conexión a Internet" 
        : "Internet connection",
      status: permissions.network,
      canRequest: false
    }
  ];

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {language === "es" ? "Permisos del Dispositivo" : "Device Permissions"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {language === "es" 
                ? "Gestiona los permisos de la aplicación" 
                : "Manage app permissions"
              }
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {permissionItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.key}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-muted">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {item.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status as PermissionStatus)}
                      <span className="text-sm text-muted-foreground">
                        {getStatusText(item.status as PermissionStatus)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                {item.canRequest && (
                  <CardContent className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={item.onRequest}
                      disabled={requesting === item.key}
                    >
                      {requesting === item.key ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {language === "es" ? "Solicitando..." : "Requesting..."}
                        </>
                      ) : (
                        language === "es" ? "Solicitar Permiso" : "Request Permission"
                      )}
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            {language === "es" 
              ? "Si un permiso está denegado, puedes habilitarlo desde la configuración del sistema de tu dispositivo."
              : "If a permission is denied, you can enable it from your device's system settings."
            }
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}
