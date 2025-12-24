import { useEffect, useMemo, useState } from "react";
import MobileLayout from "@/components/mobile/MobileLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, ShieldOff, Shield, Plus } from "lucide-react";
import { toast } from "sonner";
import { ClientNoteDialog } from "@/components/mobile/clients/ClientNoteDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ClientRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_blocked: boolean | null;
  blocked_reason: string | null;
  blocked_at: string | null;
};

export default function BlockedClients() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);

  const [pickOpen, setPickOpen] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);

  const fetchClients = async () => {
    if (!profile?.business_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, first_name, last_name, email, phone, avatar_url, is_blocked, blocked_reason, blocked_at")
        .eq("business_id", profile.business_id)
        .order("full_name");
      if (error) throw error;
      setClients((data || []) as any);
    } catch (e: any) {
      toast.error(e?.message || (language === "es" ? "No se pudo cargar" : "Could not load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.business_id]);

  const blocked = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => c.is_blocked)
      .filter((c) => {
        if (!q) return true;
        return (
          (c.full_name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
        );
      });
  }, [clients, search]);

  const unblockedForPick = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return clients
      .filter((c) => !c.is_blocked)
      .filter((c) => {
        if (!q) return true;
        return (
          (c.full_name || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 25);
  }, [clients, pickSearch]);

  const handleUnblock = async (clientId: string) => {
    if (!profile?.business_id) return;
    try {
      const { error } = await supabase
        .from("clients")
        .update({ is_blocked: false, blocked_reason: null, blocked_at: null })
        .eq("id", clientId)
        .eq("business_id", profile.business_id);
      if (error) throw error;
      toast.success(language === "es" ? "Cliente desbloqueado" : "Client unblocked");
      fetchClients();
    } catch (e: any) {
      toast.error(e?.message || (language === "es" ? "No se pudo desbloquear" : "Could not unblock"));
    }
  };

  const handleBlock = async () => {
    if (!profile?.business_id || !selectedClient) return;
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          is_blocked: true,
          blocked_reason: blockReason || null,
          blocked_at: new Date().toISOString(),
        })
        .eq("id", selectedClient.id)
        .eq("business_id", profile.business_id);
      if (error) throw error;
      toast.success(language === "es" ? "Cliente bloqueado" : "Client blocked");
      setReasonOpen(false);
      setPickOpen(false);
      setBlockReason("");
      setSelectedClient(null);
      fetchClients();
    } catch (e: any) {
      toast.error(e?.message || (language === "es" ? "No se pudo bloquear" : "Could not block"));
    }
  };

  return (
    <MobileLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{language === "es" ? "Clientes bloqueados" : "Blocked clients"}</h1>
          <Button onClick={() => setPickOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {language === "es" ? "Bloquear" : "Block"}
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={language === "es" ? "Buscar..." : "Search..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          {blocked.map((c) => (
            <div key={c.id} className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarImage src={c.avatar_url || ""} />
                  <AvatarFallback>
                    {(c.full_name || "C")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{c.full_name || "-"}</h3>
                    <Badge variant="destructive" className="gap-1">
                      <Shield className="h-3 w-3" />
                      {language === "es" ? "Bloqueado" : "Blocked"}
                    </Badge>
                  </div>
                  {c.email && <p className="text-sm text-muted-foreground truncate">{c.email}</p>}
                  {c.phone && <p className="text-sm text-muted-foreground">{c.phone}</p>}
                  {c.blocked_reason && (
                    <p className="text-sm mt-2 text-muted-foreground whitespace-pre-wrap">{c.blocked_reason}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleUnblock(c.id)}>
                  <ShieldOff className="h-4 w-4" />
                  {language === "es" ? "Desbloquear" : "Unblock"}
                </Button>
              </div>
            </div>
          ))}

          {!loading && blocked.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
              {language === "es" ? "No hay clientes bloqueados" : "No blocked clients"}
            </div>
          )}
        </div>
      </div>

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "es" ? "Bloquear cliente" : "Block client"}</DialogTitle>
            <DialogDescription>
              {language === "es"
                ? "Selecciona un cliente para bloquearlo."
                : "Select a client to block."}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={language === "es" ? "Buscar..." : "Search..."}
              value={pickSearch}
              onChange={(e) => setPickSearch(e.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-auto border rounded-lg">
            {unblockedForPick.map((c) => (
              <button
                key={c.id}
                className="w-full text-left px-4 py-3 hover:bg-muted/40 border-b last:border-b-0"
                onClick={() => {
                  setSelectedClient(c);
                  setReasonOpen(true);
                }}
              >
                <div className="font-medium">{c.full_name || "-"}</div>
                <div className="text-sm text-muted-foreground">{c.email || c.phone || ""}</div>
              </button>
            ))}
            {unblockedForPick.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                {language === "es" ? "No hay clientes para bloquear" : "No clients to block"}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ClientNoteDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title={language === "es" ? "Motivo del bloqueo" : "Block reason"}
        description={language === "es" ? "Opcional. Ayuda a tu equipo." : "Optional. Helps your team."}
        label={language === "es" ? "Motivo" : "Reason"}
        placeholder={language === "es" ? "Ej: no-shows repetidos..." : "e.g. repeated no-shows..."}
        value={blockReason}
        onChange={setBlockReason}
        saving={false}
        onSave={handleBlock}
      />
    </MobileLayout>
  );
}


