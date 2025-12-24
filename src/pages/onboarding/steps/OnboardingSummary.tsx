import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Building2, Users, Briefcase, MapPin, CheckCircle2, Pencil } from "lucide-react";

interface OnboardingSummaryProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
  onEdit?: (stepIndex: number) => void;
}

export default function OnboardingSummary({ data, onNext, onBack, onEdit }: OnboardingSummaryProps) {
  const handleComplete = () => {
    onNext({});
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">Resumen de tu Negocio</h2>
        <p className="text-muted-foreground">
          Revisa la información antes de completar la configuración
        </p>
      </div>

      <div className="space-y-4">
        {/* Business Information */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Información del Negocio
            </CardTitle>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(0)}
                className="gap-2"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Nombre del Negocio</p>
              <p className="font-medium">{data.businessName}</p>
            </div>
            {data.website && (
              <div>
                <p className="text-sm text-muted-foreground">Sitio Web</p>
                <p className="font-medium">{data.website}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5 text-primary" />
              Categorías
            </CardTitle>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(1)}
                className="gap-2"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Categoría Principal</p>
              <Badge variant="default">{data.primaryCategory}</Badge>
            </div>
            {data.secondaryCategories && data.secondaryCategories.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Categorías Secundarias</p>
                <div className="flex flex-wrap gap-2">
                  {data.secondaryCategories.map((category: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Information */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Equipo
            </CardTitle>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(2)}
                className="gap-2"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Tipo de Cuenta</p>
              <Badge variant="outline">
                {data.accountType === "independent" ? "Independiente" : "Equipo"}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Tamaño del Equipo</p>
              <p className="font-medium">{data.teamSize || "1"} {(data.teamSize || "1") === "1" ? "persona" : "personas"}</p>
            </div>
            
            {data.teamMembers && data.teamMembers.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Miembros del Equipo</p>
                  <div className="space-y-2">
                    {data.teamMembers.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {member.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{member.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {member.commissionRate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Service Type */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              Tipo de Servicio
            </CardTitle>
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(data.accountType === "independent" ? 5 : 5)}
                className="gap-2"
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="text-base px-4 py-2">
              {data.serviceType === "physical" && "Físico - En establecimiento"}
              {data.serviceType === "mobile" && "A Domicilio"}
              {data.serviceType === "virtual" && "Virtual - En línea"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-4">
        <Button onClick={handleComplete} className="w-full h-12 text-base">
          Completar Configuración
        </Button>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="w-full h-12 text-base">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
        )}
      </div>
    </div>
  );
}
