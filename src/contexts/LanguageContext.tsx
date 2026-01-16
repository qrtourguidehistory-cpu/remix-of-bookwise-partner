import { createContext, useContext, useState } from "react";

type Language = "en" | "es";

interface Translations {
  [key: string]: {
    en: string;
    es: string;
  };
}

const translations: Translations = {
  appName: { en: "Mí Turnow", es: "Mí Turnow" },
  calendar: { en: "Calendar", es: "Agenda" },
  sales: { en: "Sales", es: "Ventas" },
  add: { en: "Add", es: "Agregar" },
  clients: { en: "Clients", es: "Clientes" },
  menu: { en: "Menu", es: "Menú" },
  home: { en: "Home", es: "Inicio" },
  appointments: { en: "Appointments", es: "Citas" },
  gallery: { en: "Gallery", es: "Galería" },
  team: { en: "Team", es: "Equipo" },
  reports: { en: "Reports", es: "Reportes" },
  settings: { en: "Settings", es: "Configuración" },
  profile: { en: "Profile", es: "Perfil" },
  reviews: { en: "Reviews", es: "Reseñas" },
  bookAppointment: { en: "Book Appointment", es: "Reservar Cita" },
  selectService: { en: "Select Service", es: "Seleccionar Servicio" },
  selectStaff: { en: "Select Staff", es: "Seleccionar Personal" },
  selectDate: { en: "Select Date", es: "Seleccionar Fecha" },
  selectTime: { en: "Select Time", es: "Seleccionar Hora" },
  confirm: { en: "Confirm", es: "Confirmar" },
  cancel: { en: "Cancel", es: "Cancelar" },
  next: { en: "Next", es: "Siguiente" },
  back: { en: "Back", es: "Atrás" },
  confirmation: { en: "Confirmation", es: "Confirmación" },
  appointmentConfirmed: { en: "Appointment Confirmed!", es: "¡Cita Confirmada!" },
  newClient: { en: "New Client", es: "Nuevo Cliente" },
  editClient: { en: "Edit Client", es: "Editar Cliente" },
  deleteClient: { en: "Delete Client", es: "Eliminar Cliente" },
  clientList: { en: "Client List", es: "Lista de Clientes" },
  fullName: { en: "Full Name", es: "Nombre Completo" },
  email: { en: "Email", es: "Correo Electrónico" },
  phone: { en: "Phone", es: "Teléfono" },
  save: { en: "Save", es: "Guardar" },
  rating: { en: "Rating", es: "Calificación" },
  comment: { en: "Comment", es: "Comentario" },
  reply: { en: "Reply", es: "Responder" },
  notifications: { en: "Notifications", es: "Notificaciones" },
  darkMode: { en: "Dark Mode", es: "Modo Oscuro" },
  lightMode: { en: "Light Mode", es: "Modo Claro" },
  language: { en: "Language", es: "Idioma" },
  filter: { en: "Filter", es: "Filtrar" },
  showCompleted: { en: "Show Completed", es: "Mostrar Completadas" },
  showPending: { en: "Show Pending", es: "Mostrar Pendientes" },
  showCancelled: { en: "Show Cancelled", es: "Mostrar Canceladas" },
  day: { en: "Day", es: "Día" },
  week: { en: "Week", es: "Semana" },
  month: { en: "Month", es: "Mes" },
  notes: { en: "Notes", es: "Notas" },
  clientUpdated: { en: "Client Updated", es: "Cliente Actualizado" },
  clientAdded: { en: "Client Added", es: "Cliente Agregado" },
  clientDeleted: { en: "Client Deleted", es: "Cliente Eliminado" },
  deleteClientConfirm: { en: "Are you sure you want to delete this client?", es: "¿Está seguro de que desea eliminar este cliente?" },
  delete: { en: "Delete", es: "Eliminar" },
  search: { en: "Search", es: "Buscar" },
  staffUpdated: { en: "Staff Updated", es: "Personal Actualizado" },
  staffAdded: { en: "Staff Added", es: "Personal Agregado" },
  staffDeleted: { en: "Staff Deleted", es: "Personal Eliminado" },
  deleteStaffConfirm: { en: "Are you sure you want to delete this staff member?", es: "¿Está seguro de que desea eliminar este miembro del personal?" },
  editStaff: { en: "Edit Staff", es: "Editar Personal" },
  addStaff: { en: "Add Staff", es: "Agregar Personal" },
  uploadPhoto: { en: "Upload Photo", es: "Subir Foto" },
  specialties: { en: "Specialties", es: "Especialidades" },
  commission: { en: "Commission", es: "Comisión" },
  bio: { en: "Bio", es: "Biografía" },
  deleteStaff: { en: "Delete Staff", es: "Eliminar Personal" },
  uploadImages: { en: "Upload Images", es: "Subir Imágenes" },
  imageAdded: { en: "Image Added", es: "Imagen Agregada" },
  imageDeleted: { en: "Image Deleted", es: "Imagen Eliminada" },
  deleteImage: { en: "Delete Image", es: "Eliminar Imagen" },
  deleteImageConfirm: { en: "Are you sure you want to delete this image?", es: "¿Está seguro de que desea eliminar esta imagen?" },
  noImages: { en: "No images. Upload some to get started.", es: "No hay imágenes. Sube algunas para empezar." },
  description: { en: "Description", es: "Descripción" },
  category: { en: "Category", es: "Categoría" },
  price: { en: "Price", es: "Precio" },
  priceUSD: { en: "Price USD", es: "Precio USD" },
  priceMXN: { en: "Price MXN", es: "Precio MXN" },
  success: { en: "Success", es: "Éxito" },
  loading: { en: "Loading...", es: "Cargando..." },
  serviceName: { en: "Service Name", es: "Nombre del Servicio" },
  addService: { en: "Add Service", es: "Agregar Servicio" },
  editService: { en: "Edit Service", es: "Editar Servicio" },
  serviceAdded: { en: "Service added successfully", es: "Servicio agregado exitosamente" },
  serviceUpdated: { en: "Service updated successfully", es: "Servicio actualizado exitosamente" },
  uploadImage: { en: "Upload Image", es: "Subir Imagen" },
  duration: { en: "Duration", es: "Duración" },
  image: { en: "Image", es: "Imagen" },
  selectClient: { en: "Select Client", es: "Seleccionar Cliente" },
  reportsAndAnalytics: { en: "Reports & Analytics", es: "Reportes y Análisis" },
  businessInsights: { en: "Business insights and performance metrics", es: "Métricas e información del negocio" },
  revenueOverview: { en: "Revenue Overview", es: "Resumen de Ingresos" },
  totalRevenue: { en: "Total Revenue", es: "Ingresos Totales" },
  cashPayments: { en: "Cash Payments", es: "Pagos en Efectivo" },
  cardPayments: { en: "Card Payments", es: "Pagos con Tarjeta" },
  onlinePayments: { en: "Online Payments", es: "Pagos en Línea" },
  exportReport: { en: "Export Report", es: "Exportar Reporte" },
  exportAsPDF: { en: "Export as PDF", es: "Exportar como PDF" },
  exportAsExcel: { en: "Export as Excel", es: "Exportar como Excel" },
  exportAsCSV: { en: "Export as CSV", es: "Exportar como CSV" },
  last7Days: { en: "Last 7 days", es: "Últimos 7 días" },
  last30Days: { en: "Last 30 days", es: "Últimos 30 días" },
  last90Days: { en: "Last 90 days", es: "Últimos 90 días" },
  thisYear: { en: "This year", es: "Este año" },
  nextTurnow: { en: "Next Turnow", es: "Siguiente Turno" },
  calendarNextTurnow: { en: "Calendar - Next Turnow", es: "Calendario - Siguiente Turno" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem("language");
    return (stored as Language) || "es"; // Default to Spanish
  });

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
