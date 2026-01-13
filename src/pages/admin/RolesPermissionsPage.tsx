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
- Información de suscripción y facturación mensual

**IMPORTANTE:** Mí Turnow NO procesa pagos de clientes del establecimiento. Solo procesamos la suscripción mensual del establecimiento mediante débito automático.

## 2. Uso de la Información

Utilizamos la información recopilada para:
- Proporcionar y mantener nuestros servicios de gestión de citas
- Enviar recordatorios de citas a sus clientes
- Procesar la suscripción mensual del establecimiento mediante PayPal o tarjeta de crédito/débito
- Mejorar nuestros servicios
- Comunicaciones relacionadas con el servicio

## 3. Procesamiento de Pagos

**Mí Turnow NO procesa pagos de clientes del establecimiento:**
- Los pagos entre establecimiento y clientes se realizan directamente en el establecimiento
- Mí Turnow NO tiene acceso a información de tarjetas de crédito de clientes del establecimiento
- Mí Turnow NO almacena información de pagos de servicios prestados por el establecimiento
- Solo procesamos la suscripción mensual del establecimiento mediante débito automático por PayPal o tarjeta de crédito/débito registrada

## 4. Compartir Información

No vendemos ni alquilamos su información personal. Solo compartimos datos cuando:
- Es necesario para proporcionar el servicio
- Usted da su consentimiento explícito
- Es requerido por ley o orden judicial

## 5. Seguridad de Datos

Implementamos medidas de seguridad para proteger su información:
- Encriptación de datos en tránsito (TLS/SSL) y en reposo
- Acceso restringido a datos personales mediante autenticación
- Auditorías de seguridad regulares
- Cumplimiento con estándares de seguridad de la industria

## 6. Sus Derechos

Usted tiene derecho a:
- Acceder a sus datos personales
- Corregir información inexacta
- Solicitar eliminación de datos (sujeto a retención legal)
- Exportar sus datos en formato estándar
- Revocar consentimiento en cualquier momento

## 7. Limitación de Responsabilidad

Mí Turnow no se hace responsable por:
- Pagos no procesados entre establecimiento y clientes (no procesamos estos pagos)
- Disputas de pago entre establecimiento y clientes
- Pérdidas de datos debido a uso indebido de la plataforma
- Daños indirectos o consecuentes derivados del uso del servicio

## 8. Contacto

Para preguntas sobre privacidad, contáctenos:
- Teléfono: +1 809-219-5141
- Email: soporte@miturnow.com
- Horario de atención: Lunes a Viernes, 9:00 AM - 6:00 PM (Hora del Este)
  ` : `
# Privacy Policy

Last updated: January 2026

## 1. Information We Collect

We collect information you provide directly, including:
- Business name and contact details
- Client information (name, phone, email)
- Appointment and service data
- Subscription and monthly billing information

**IMPORTANT:** Mí Turnow does NOT process payments from establishment clients. We only process the establishment's monthly subscription via automatic debit.

## 2. Use of Information

We use collected information to:
- Provide and maintain our appointment management services
- Send appointment reminders to your clients
- Process the establishment's monthly subscription via PayPal or credit/debit card
- Improve our services
- Service-related communications

## 3. Payment Processing

**Mí Turnow does NOT process payments from establishment clients:**
- Payments between establishment and clients are made directly at the establishment
- Mí Turnow does NOT have access to establishment clients' credit card information
- Mí Turnow does NOT store payment information for services provided by the establishment
- We only process the establishment's monthly subscription via automatic debit through PayPal or registered credit/debit card

## 4. Information Sharing

We do not sell or rent your personal information. We only share data when:
- Necessary to provide the service
- You give explicit consent
- Required by law or court order

## 5. Data Security

We implement security measures to protect your information:
- Encryption of data in transit (TLS/SSL) and at rest
- Restricted access to personal data through authentication
- Regular security audits
- Compliance with industry security standards

## 6. Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate information
- Request data deletion (subject to legal retention)
- Export your data in standard format
- Revoke consent at any time

## 7. Limitation of Liability

Mí Turnow is not responsible for:
- Unprocessed payments between establishment and clients (we do not process these payments)
- Payment disputes between establishment and clients
- Data loss due to misuse of the platform
- Indirect or consequential damages arising from use of the service

## 8. Contact

For privacy questions, contact us:
- Phone: +1 809-219-5141
- Email: support@miturnow.com
- Business hours: Monday to Friday, 9:00 AM - 6:00 PM (Eastern Time)
  `;

  const termsContent = language === "es" ? `
# Términos y Condiciones

Última actualización: Enero 2026

## 1. Aceptación de Términos

Al utilizar Mí Turnow Partner, usted acepta estos términos y condiciones en su totalidad. Si no está de acuerdo, no debe utilizar el servicio.

## 2. Descripción del Servicio

Mí Turnow Partner es una plataforma de gestión de citas que permite:
- Programar y administrar citas
- Gestionar clientes y servicios
- Enviar notificaciones y recordatorios
- Gestionar inventario y ventas de productos

**IMPORTANTE - PROCESAMIENTO DE PAGOS:**
Mí Turnow NO procesa pagos de clientes del establecimiento. Los pagos entre establecimiento y clientes se realizan directamente en el establecimiento. Mí Turnow solo procesa la suscripción mensual del establecimiento mediante débito automático por PayPal o tarjeta de crédito/débito registrada.

## 3. Responsabilidades del Usuario

Usted se compromete a:
- Proporcionar información veraz, completa y actualizada
- Mantener la confidencialidad de su cuenta y credenciales
- No usar el servicio para fines ilegales o fraudulentos
- Respetar la privacidad de sus clientes y cumplir con leyes de protección de datos
- Ser responsable de todos los pagos realizados desde su cuenta
- Notificar inmediatamente cualquier uso no autorizado de su cuenta

## 4. Suscripción y Facturación

**Suscripción Mensual:**
- La suscripción se cobra automáticamente cada mes mediante PayPal o tarjeta de crédito/débito registrada
- Los precios están sujetos a cambios con aviso previo de 30 días
- El impago puede resultar en suspensión inmediata del servicio
- No hay reembolsos por períodos parciales de suscripción
- Usted autoriza el débito automático mensual al aceptar estos términos

**Pagos del Establecimiento:**
- Mí Turnow NO procesa, almacena ni tiene acceso a pagos entre establecimiento y clientes
- El establecimiento es responsable de procesar sus propios pagos de servicios
- Mí Turnow no se hace responsable por disputas de pago entre establecimiento y clientes

## 5. Propiedad Intelectual

Todo el contenido, marcas, logos y software son propiedad exclusiva de Mí Turnow o sus licenciantes. Está prohibido:
- Copiar, modificar o distribuir el software sin autorización
- Usar las marcas sin permiso escrito
- Realizar ingeniería inversa del software

## 6. Limitación de Responsabilidad (Cláusula Anti-Demandas)

**EXENCIÓN TOTAL DE RESPONSABILIDAD:**

Mí Turnow, sus afiliados, directores, empleados y agentes NO serán responsables bajo ninguna circunstancia por:

- **Pérdidas financieras:** Pérdidas de ingresos, beneficios, datos, oportunidades comerciales o daños indirectos, consecuentes o punitivos
- **Pagos no procesados:** Disputas de pago entre establecimiento y clientes (no procesamos estos pagos)
- **Interrupciones del servicio:** Pérdidas por interrupciones temporales, mantenimiento programado o no programado
- **Acciones de terceros:** Daños causados por proveedores de servicios externos, clientes del establecimiento o terceros
- **Uso indebido:** Daños resultantes del uso incorrecto o no autorizado del servicio
- **Pérdida de datos:** Pérdida de datos debido a errores del usuario, fallos técnicos o causas fuera de nuestro control razonable

**LÍMITE MÁXIMO DE RESPONSABILIDAD:**

En ningún caso la responsabilidad total de Mí Turnow excederá el monto pagado por el usuario en los últimos 12 meses.

**RENUNCIA DE GARANTÍAS:**

El servicio se proporciona "TAL CUAL" y "SEGÚN DISPONIBILIDAD" sin garantías de ningún tipo, expresas o implícitas, incluyendo pero no limitado a garantías de comerciabilidad, idoneidad para un propósito particular o no infracción.

## 7. Indemnización

Usted acepta indemnizar, defender y eximir de responsabilidad a Mí Turnow, sus afiliados, directores, empleados y agentes de cualquier reclamo, demanda, pérdida, responsabilidad y gasto (incluyendo honorarios legales razonables) que surjan de:
- Su uso del servicio
- Violación de estos términos
- Violación de derechos de terceros
- Disputas con sus clientes relacionadas con pagos o servicios

## 8. Terminación

Podemos suspender o terminar su acceso inmediatamente sin previo aviso por:
- Violación de estos términos
- Uso fraudulento o ilegal del servicio
- Impago de suscripción
- Cualquier actividad que consideremos perjudicial para el servicio

## 9. Modificaciones

Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor 30 días después de la notificación. El uso continuado del servicio después de la modificación constituye aceptación de los nuevos términos.

## 10. Ley Aplicable y Jurisdicción

Estos términos se rigen por las leyes de la República Dominicana. Cualquier disputa se resolverá exclusivamente en los tribunales competentes de la República Dominicana.

## 11. Contacto

Para consultas sobre estos términos:
- Teléfono: +1 809-219-5141
- Email: soporte@miturnow.com
- Horario: Lunes a Viernes, 9:00 AM - 6:00 PM (Hora del Este)
  ` : `
# Terms and Conditions

Last updated: January 2026

## 1. Acceptance of Terms

By using Mí Turnow Partner, you fully accept these terms and conditions. If you do not agree, you must not use the service.

## 2. Service Description

Mí Turnow Partner is an appointment management platform that allows:
- Scheduling and managing appointments
- Managing clients and services
- Sending notifications and reminders
- Managing inventory and product sales

**IMPORTANT - PAYMENT PROCESSING:**
Mí Turnow does NOT process payments from establishment clients. Payments between establishment and clients are made directly at the establishment. Mí Turnow only processes the establishment's monthly subscription via automatic debit through PayPal or registered credit/debit card.

## 3. User Responsibilities

You agree to:
- Provide truthful, complete, and up-to-date information
- Maintain confidentiality of your account and credentials
- Not use the service for illegal or fraudulent purposes
- Respect your clients' privacy and comply with data protection laws
- Be responsible for all payments made from your account
- Immediately notify any unauthorized use of your account

## 4. Subscription and Billing

**Monthly Subscription:**
- Subscription is automatically charged monthly via PayPal or registered credit/debit card
- Prices are subject to change with 30 days prior notice
- Non-payment may result in immediate service suspension
- No refunds for partial subscription periods
- You authorize automatic monthly debit by accepting these terms

**Establishment Payments:**
- Mí Turnow does NOT process, store, or have access to payments between establishment and clients
- The establishment is responsible for processing its own service payments
- Mí Turnow is not responsible for payment disputes between establishment and clients

## 5. Intellectual Property

All content, trademarks, logos, and software are the exclusive property of Mí Turnow or its licensors. It is prohibited to:
- Copy, modify, or distribute the software without authorization
- Use trademarks without written permission
- Reverse engineer the software

## 6. Limitation of Liability (Anti-Lawsuit Clause)

**TOTAL LIABILITY EXEMPTION:**

Mí Turnow, its affiliates, directors, employees, and agents shall NOT be liable under any circumstances for:

- **Financial losses:** Loss of income, profits, data, business opportunities, or indirect, consequential, or punitive damages
- **Unprocessed payments:** Payment disputes between establishment and clients (we do not process these payments)
- **Service interruptions:** Losses due to temporary interruptions, scheduled or unscheduled maintenance
- **Third-party actions:** Damages caused by external service providers, establishment clients, or third parties
- **Misuse:** Damages resulting from incorrect or unauthorized use of the service
- **Data loss:** Data loss due to user errors, technical failures, or causes beyond our reasonable control

**MAXIMUM LIABILITY LIMIT:**

In no case shall Mí Turnow's total liability exceed the amount paid by the user in the last 12 months.

**WARRANTY DISCLAIMER:**

The service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.

## 7. Indemnification

You agree to indemnify, defend, and hold harmless Mí Turnow, its affiliates, directors, employees, and agents from any claim, demand, loss, liability, and expense (including reasonable legal fees) arising from:
- Your use of the service
- Violation of these terms
- Violation of third-party rights
- Disputes with your clients related to payments or services

## 8. Termination

We may suspend or terminate your access immediately without prior notice for:
- Violation of these terms
- Fraudulent or illegal use of the service
- Subscription non-payment
- Any activity we consider harmful to the service

## 9. Modifications

We reserve the right to modify these terms at any time. Modifications will take effect 30 days after notification. Continued use of the service after modification constitutes acceptance of the new terms.

## 10. Applicable Law and Jurisdiction

These terms are governed by the laws of the Dominican Republic. Any dispute shall be resolved exclusively in the competent courts of the Dominican Republic.

## 11. Contact

For inquiries about these terms:
- Phone: +1 809-219-5141
- Email: support@miturnow.com
- Business hours: Monday to Friday, 9:00 AM - 6:00 PM (Eastern Time)
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
- Teléfono: +1 809-219-5141
- Email: soporte@miturnow.com
- Horario: Lunes a Viernes, 9:00 AM - 6:00 PM (Hora del Este)
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
- Phone: +1 809-219-5141
- Email: support@miturnow.com
- Business hours: Monday to Friday, 9:00 AM - 6:00 PM (Eastern Time)
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
