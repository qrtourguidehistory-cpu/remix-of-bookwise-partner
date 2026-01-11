import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, FileText, BookOpen, ArrowLeft, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function RolesPermissionsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("privacy");

  const privacyPolicyContent = language === "es" ? `
# Política de Privacidad

Última actualización: Enero 2026

## 1. Información que Recopilamos

Recopilamos información que usted nos proporciona directamente, incluyendo:
- Nombre y datos de contacto del negocio
- Información de clientes (nombre, teléfono, email)
- Datos de citas y servicios
- Información de pagos y transacciones

## 2. Uso de la Información

Utilizamos la información recopilada para:
- Proporcionar y mantener nuestros servicios
- Enviar recordatorios de citas
- Procesar pagos y transacciones
- Mejorar nuestros servicios
- Comunicaciones relacionadas con el servicio

## 3. Compartir Información

No vendemos ni alquilamos su información personal. Solo compartimos datos cuando:
- Es necesario para proporcionar el servicio
- Usted da su consentimiento
- Es requerido por ley

## 4. Seguridad de Datos

Implementamos medidas de seguridad para proteger su información:
- Encriptación de datos en tránsito y en reposo
- Acceso restringido a datos personales
- Auditorías de seguridad regulares

## 5. Sus Derechos

Usted tiene derecho a:
- Acceder a sus datos personales
- Corregir información inexacta
- Solicitar eliminación de datos
- Exportar sus datos

## 6. Contacto

Para preguntas sobre privacidad, contáctenos en:
soporte@miturnow.com
  ` : `
# Privacy Policy

Last updated: January 2026

## 1. Information We Collect

We collect information you provide directly, including:
- Business name and contact details
- Client information (name, phone, email)
- Appointment and service data
- Payment and transaction information

## 2. Use of Information

We use collected information to:
- Provide and maintain our services
- Send appointment reminders
- Process payments and transactions
- Improve our services
- Service-related communications

## 3. Information Sharing

We do not sell or rent your personal information. We only share data when:
- Necessary to provide the service
- You give consent
- Required by law

## 4. Data Security

We implement security measures to protect your information:
- Encryption of data in transit and at rest
- Restricted access to personal data
- Regular security audits

## 5. Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate information
- Request data deletion
- Export your data

## 6. Contact

For privacy questions, contact us at:
support@miturnow.com
  `;

  const termsContent = language === "es" ? `
# Términos y Condiciones

Última actualización: Enero 2026

## 1. Aceptación de Términos

Al utilizar Mí Turnow Partner, usted acepta estos términos y condiciones.

## 2. Descripción del Servicio

Mí Turnow Partner es una plataforma de gestión de citas que permite:
- Programar y administrar citas
- Gestionar clientes y servicios
- Procesar pagos
- Enviar notificaciones y recordatorios

## 3. Responsabilidades del Usuario

Usted se compromete a:
- Proporcionar información veraz y actualizada
- Mantener la confidencialidad de su cuenta
- No usar el servicio para fines ilegales
- Respetar la privacidad de sus clientes

## 4. Pagos y Facturación

- Los precios están sujetos a cambios con aviso previo
- Las facturas se emiten mensualmente
- El impago puede resultar en suspensión del servicio

## 5. Propiedad Intelectual

Todo el contenido, marcas y software son propiedad de Mí Turnow o sus licenciantes.

## 6. Limitación de Responsabilidad

No somos responsables por:
- Pérdidas indirectas o consecuentes
- Interrupciones temporales del servicio
- Acciones de terceros

## 7. Terminación

Podemos suspender o terminar su acceso por violación de estos términos.

## 8. Modificaciones

Nos reservamos el derecho de modificar estos términos con notificación previa.
  ` : `
# Terms and Conditions

Last updated: January 2026

## 1. Acceptance of Terms

By using Mí Turnow Partner, you accept these terms and conditions.

## 2. Service Description

Mí Turnow Partner is an appointment management platform that allows:
- Scheduling and managing appointments
- Managing clients and services
- Processing payments
- Sending notifications and reminders

## 3. User Responsibilities

You agree to:
- Provide accurate and up-to-date information
- Maintain account confidentiality
- Not use the service for illegal purposes
- Respect your clients' privacy

## 4. Payments and Billing

- Prices are subject to change with prior notice
- Invoices are issued monthly
- Non-payment may result in service suspension

## 5. Intellectual Property

All content, trademarks, and software are property of Mí Turnow or its licensors.

## 6. Limitation of Liability

We are not responsible for:
- Indirect or consequential losses
- Temporary service interruptions
- Third-party actions

## 7. Termination

We may suspend or terminate your access for violation of these terms.

## 8. Modifications

We reserve the right to modify these terms with prior notification.
  `;

  const usageGuideContent = language === "es" ? `
# Guía de Uso

## Primeros Pasos

### 1. Configurar tu Negocio
- Ve a Configuración > Perfil Público
- Completa la información de tu negocio
- Añade tu logo y horarios de atención

### 2. Agregar Servicios
- Ve a la sección de Servicios
- Toca el botón + para agregar
- Define nombre, duración y precio

### 3. Agregar Personal
- Ve a Personal
- Añade miembros del equipo
- Configura sus horarios disponibles

## Gestión de Citas

### Crear una Cita
1. Abre el calendario
2. Toca en la hora deseada
3. Selecciona cliente, servicio y personal
4. Confirma la cita

### Estados de Citas
- **Confirmada**: Cita programada
- **Iniciada**: Servicio en progreso
- **Completada**: Servicio finalizado
- **Cancelada**: Cita cancelada
- **No-show**: Cliente no se presentó

## Gestión de Clientes

### Agregar Cliente
1. Ve a Clientes
2. Toca el botón +
3. Ingresa nombre, teléfono y email

### Notas de Cliente
- Puedes agregar notas de alergias
- Registra preferencias especiales
- Bloquea clientes problemáticos

## Ventas y Reportes

### Registrar Venta
1. Abre una cita completada
2. Ve a Checkout
3. Agrega productos adicionales si aplica
4. Procesa el pago

### Ver Reportes
- Ve a Reportes y Análisis
- Selecciona el período deseado
- Exporta en PDF, Excel o CSV

## Configuraciones Importantes

### Notificaciones
- Activa recordatorios automáticos
- Personaliza plantillas de SMS

### Métodos de Pago
- Configura los métodos que aceptas
- Define instrucciones para cada uno

## Soporte

¿Necesitas ayuda? Contáctanos:
- Email: soporte@miturnow.com
- Horario: Lunes a Viernes, 9am - 6pm
  ` : `
# Usage Guide

## Getting Started

### 1. Set Up Your Business
- Go to Settings > Public Profile
- Complete your business information
- Add your logo and business hours

### 2. Add Services
- Go to the Services section
- Tap the + button to add
- Define name, duration, and price

### 3. Add Staff
- Go to Staff
- Add team members
- Configure their available schedules

## Appointment Management

### Create an Appointment
1. Open the calendar
2. Tap on the desired time
3. Select client, service, and staff
4. Confirm the appointment

### Appointment Statuses
- **Confirmed**: Scheduled appointment
- **Started**: Service in progress
- **Completed**: Service finished
- **Cancelled**: Appointment cancelled
- **No-show**: Client didn't show up

## Client Management

### Add Client
1. Go to Clients
2. Tap the + button
3. Enter name, phone, and email

### Client Notes
- You can add allergy notes
- Record special preferences
- Block problematic clients

## Sales and Reports

### Record Sale
1. Open a completed appointment
2. Go to Checkout
3. Add additional products if applicable
4. Process the payment

### View Reports
- Go to Reports & Analytics
- Select the desired period
- Export to PDF, Excel, or CSV

## Important Settings

### Notifications
- Enable automatic reminders
- Customize SMS templates

### Payment Methods
- Configure accepted methods
- Define instructions for each

## Support

Need help? Contact us:
- Email: support@miturnow.com
- Hours: Monday to Friday, 9am - 6pm
  `;

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {language === "es" ? "Volver" : "Back"}
          </Button>
          <h2 className="text-lg font-semibold">
            {language === "es" ? "Legal y Ayuda" : "Legal & Help"}
          </h2>
        </div>
      </div>

      <div className="p-4 pb-24">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="privacy" className="text-xs sm:text-sm">
              <Shield className="h-4 w-4 mr-1 hidden sm:inline" />
              {language === "es" ? "Privacidad" : "Privacy"}
            </TabsTrigger>
            <TabsTrigger value="terms" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
              {language === "es" ? "Términos" : "Terms"}
            </TabsTrigger>
            <TabsTrigger value="guide" className="text-xs sm:text-sm">
              <BookOpen className="h-4 w-4 mr-1 hidden sm:inline" />
              {language === "es" ? "Guía" : "Guide"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  {language === "es" ? "Política de Privacidad" : "Privacy Policy"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh]">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {privacyPolicyContent.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace('# ', '')}</h1>;
                      } else if (line.startsWith('## ')) {
                        return <h2 key={i} className="text-lg font-semibold mt-4 mb-2">{line.replace('## ', '')}</h2>;
                      } else if (line.startsWith('- ')) {
                        return <li key={i} className="ml-4">{line.replace('- ', '')}</li>;
                      } else if (line.trim()) {
                        return <p key={i} className="mb-2">{line}</p>;
                      }
                      return null;
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {language === "es" ? "Términos y Condiciones" : "Terms and Conditions"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh]">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {termsContent.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace('# ', '')}</h1>;
                      } else if (line.startsWith('## ')) {
                        return <h2 key={i} className="text-lg font-semibold mt-4 mb-2">{line.replace('## ', '')}</h2>;
                      } else if (line.startsWith('- ')) {
                        return <li key={i} className="ml-4">{line.replace('- ', '')}</li>;
                      } else if (line.trim()) {
                        return <p key={i} className="mb-2">{line}</p>;
                      }
                      return null;
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guide">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {language === "es" ? "Guía de Uso" : "Usage Guide"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[60vh]">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {usageGuideContent.split('\n').map((line, i) => {
                      if (line.startsWith('# ')) {
                        return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace('# ', '')}</h1>;
                      } else if (line.startsWith('## ')) {
                        return <h2 key={i} className="text-lg font-semibold mt-4 mb-2">{line.replace('## ', '')}</h2>;
                      } else if (line.startsWith('### ')) {
                        return <h3 key={i} className="text-base font-medium mt-3 mb-1">{line.replace('### ', '')}</h3>;
                      } else if (line.startsWith('- ')) {
                        return <li key={i} className="ml-4">{line.replace('- ', '')}</li>;
                      } else if (line.match(/^\d+\./)) {
                        return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\./, '').trim()}</li>;
                      } else if (line.includes('**')) {
                        const parts = line.split('**');
                        return (
                          <p key={i} className="mb-1">
                            {parts.map((part, j) => 
                              j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                            )}
                          </p>
                        );
                      } else if (line.trim()) {
                        return <p key={i} className="mb-2">{line}</p>;
                      }
                      return null;
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MobileLayout>
  );
}
