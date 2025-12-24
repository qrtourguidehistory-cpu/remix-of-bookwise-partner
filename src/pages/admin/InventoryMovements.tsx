import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, TrendingDown, RefreshCcw } from "lucide-react";
import { format } from "date-fns";

interface Movement {
  id: string;
  movement_type: string;
  quantity: number;
  reference_type: string;
  notes: string;
  created_at: string;
  staff: { full_name: string } | null;
}

export default function InventoryMovements() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    movement_type: "in",
    quantity: 0,
    notes: "",
  });

  useEffect(() => {
    if (id) {
      loadProductAndMovements();
    }
  }, [id]);

  const loadProductAndMovements = async () => {
    if (!id) return;

    try {
      const [productRes, movementsRes] = await Promise.all([
        supabase.from("inventory").select("*").eq("id", id).single(),
        supabase
          .from("inventory_movements")
          .select(`
            *,
            staff:staff_id (full_name)
          `)
          .eq("inventory_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (productRes.error) throw productRes.error;
      if (movementsRes.error) throw movementsRes.error;

      setProduct(productRes.data);
      setMovements(movementsRes.data || []);
    } catch (error: any) {
      toast.error("Error loading data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.business_id || !id) return;

    try {
      const quantity = formData.movement_type === "out" ? -Math.abs(formData.quantity) : Math.abs(formData.quantity);
      const newStock = product.current_stock + quantity;

      if (newStock < 0) {
        toast.error("Insufficient stock for this operation");
        return;
      }

      const { error: movementError } = await supabase.from("inventory_movements").insert({
        business_id: profile.business_id,
        inventory_id: id,
        movement_type: formData.movement_type,
        quantity: Math.abs(formData.quantity),
        reference_type: "adjustment",
        notes: formData.notes,
        staff_id: profile.id,
      });

      if (movementError) throw movementError;

      const { error: updateError } = await supabase
        .from("inventory")
        .update({ current_stock: newStock })
        .eq("id", id);

      if (updateError) throw updateError;

      toast.success("Movement recorded successfully");
      setShowAddForm(false);
      setFormData({ movement_type: "in", quantity: 0, notes: "" });
      loadProductAndMovements();
    } catch (error: any) {
      toast.error("Error recording movement");
      console.error(error);
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "in":
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "out":
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <RefreshCcw className="w-4 h-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="p-4 text-center">Loading...</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/inventory")}>
              ← Back
            </Button>
            <div>
              <h2 className="text-lg font-semibold">{product?.name}</h2>
              <p className="text-sm text-muted-foreground">Stock: {product?.current_stock}</p>
            </div>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Movement
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {showAddForm && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Record Movement</h3>
            <form onSubmit={handleAddMovement} className="space-y-4">
              <div className="space-y-2">
                <Label>Movement Type</Label>
                <Select value={formData.movement_type} onValueChange={(value) => setFormData({ ...formData, movement_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Stock In (Add)</SelectItem>
                    <SelectItem value="out">Stock Out (Remove)</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Record Movement
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-3">
          <h3 className="font-semibold">Movement History</h3>
          {movements.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No movements recorded yet
            </Card>
          ) : (
            movements.map((movement) => (
              <Card key={movement.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getMovementIcon(movement.movement_type)}
                    <div>
                      <p className="font-semibold capitalize">{movement.movement_type}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(movement.created_at), "PPp")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={movement.movement_type === "in" ? "default" : "destructive"}>
                    {movement.movement_type === "in" ? "+" : "-"}
                    {movement.quantity}
                  </Badge>
                </div>

                {movement.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{movement.notes}</p>
                )}

                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Reference</span>
                  <Badge variant="outline">{movement.reference_type}</Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
