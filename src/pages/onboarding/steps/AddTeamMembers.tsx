import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  specialties: string;
  commissionRate: number;
  avatarUrl?: string;
}

interface AddTeamMembersProps {
  data: any;
  onNext: (data: any) => void;
  onBack?: () => void;
}

export default function AddTeamMembers({ data, onNext, onBack }: AddTeamMembersProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(data.teamMembers || []);
  const [currentMember, setCurrentMember] = useState<TeamMember>({
    id: crypto.randomUUID(),
    fullName: "",
    email: "",
    phone: "",
    specialties: "",
    commissionRate: 40,
    avatarUrl: undefined,
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentMember({ ...currentMember, avatarUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMember = () => {
    if (!currentMember.fullName || !currentMember.email) {
      return;
    }

    // Check for duplicate email
    const emailExists = teamMembers.some(
      member => member.email.toLowerCase() === currentMember.email.toLowerCase()
    );

    if (emailExists) {
      alert("Este correo electrónico ya está en uso por otro miembro del equipo");
      return;
    }

    setTeamMembers([...teamMembers, currentMember]);
    setCurrentMember({
      id: crypto.randomUUID(),
      fullName: "",
      email: "",
      phone: "",
      specialties: "",
      commissionRate: 40,
      avatarUrl: undefined,
    });
  };

  const handleRemoveMember = (id: string) => {
    setTeamMembers(teamMembers.filter(member => member.id !== id));
  };

  const handleContinue = () => {
    onNext({ teamMembers });
  };

  const handleSkip = () => {
    onNext({ teamMembers: [] });
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Agrega los miembros de tu equipo (opcional)
      </p>

      {/* Lista de miembros agregados */}
      {teamMembers.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Miembros agregados ({teamMembers.length})</h3>
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="p-4 rounded-lg border bg-card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {member.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.fullName}</p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveMember(member.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario para agregar nuevo miembro */}
      <div className="space-y-4 p-4 rounded-lg border bg-muted/50">
        <h3 className="font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Agregar miembro del equipo
        </h3>

        <div className="flex flex-col items-center gap-3">
          <Avatar className="h-20 w-20">
            {currentMember.avatarUrl ? (
              <img src={currentMember.avatarUrl} alt="Avatar" className="object-cover" />
            ) : (
              <AvatarFallback className="bg-primary/10">
                <Upload className="h-8 w-8 text-primary" />
              </AvatarFallback>
            )}
          </Avatar>
          <Label htmlFor="avatar-upload" className="cursor-pointer text-sm text-primary hover:underline">
            Subir Foto
          </Label>
          <Input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Nombre Completo *</Label>
          <Input
            id="fullName"
            value={currentMember.fullName}
            onChange={(e) => setCurrentMember({ ...currentMember, fullName: e.target.value })}
            placeholder="Juan Pérez"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Correo Electrónico *</Label>
          <Input
            id="email"
            type="email"
            value={currentMember.email}
            onChange={(e) => setCurrentMember({ ...currentMember, email: e.target.value })}
            placeholder="juan@ejemplo.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={currentMember.phone}
            onChange={(e) => setCurrentMember({ ...currentMember, phone: e.target.value })}
            placeholder="+52 123 456 7890"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="specialties">Especialidades</Label>
          <Input
            id="specialties"
            value={currentMember.specialties}
            onChange={(e) => setCurrentMember({ ...currentMember, specialties: e.target.value })}
            placeholder="Corte, Color, Estilo..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="commissionRate">Comisión (%)</Label>
          <Input
            id="commissionRate"
            type="number"
            min="0"
            max="100"
            value={currentMember.commissionRate}
            onChange={(e) => setCurrentMember({ ...currentMember, commissionRate: parseInt(e.target.value) || 0 })}
          />
        </div>

        <Button
          onClick={handleAddMember}
          disabled={!currentMember.fullName || !currentMember.email}
          className="w-full"
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Miembro
        </Button>
      </div>

      {/* Botones de navegación */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="flex-1 h-12 text-base"
          >
            Saltar
          </Button>
          <Button
            onClick={handleContinue}
            className="flex-1 h-12 text-base"
          >
            Continuar
          </Button>
        </div>
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
