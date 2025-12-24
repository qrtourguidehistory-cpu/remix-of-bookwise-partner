import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, AlertTriangle, BarChart3 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  current_stock: number;
  min_stock_level: number;
  unit_price: number;
  cost_price: number;
  is_active: boolean;
}

export default function InventoryManagement() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    loadInventory();
  }, [profile]);

  useEffect(() => {
    filterInventory();
  }, [searchQuery, inventory]);

  const loadInventory = async () => {
    if (!profile?.business_id) return;

    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("name");

      if (error) throw error;

      setInventory(data || []);
      const lowStock = (data || []).filter(item => 
        item.current_stock <= item.min_stock_level && item.is_active
      ).length;
      setLowStockCount(lowStock);
    } catch (error: any) {
      toast.error("Error loading inventory");
    } finally {
      setLoading(false);
    }
  };

  const filterInventory = () => {
    if (!searchQuery.trim()) {
      setFilteredInventory(inventory);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = inventory.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.sku?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    );
    setFilteredInventory(filtered);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("inventory")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(currentStatus ? "Product deactivated" : "Product activated");
      loadInventory();
    } catch (error: any) {
      toast.error("Error updating product");
      console.error(error);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.current_stock <= 0) return { label: "Out of Stock", color: "bg-destructive" };
    if (item.current_stock <= item.min_stock_level) return { label: "Low Stock", color: "bg-orange-500" };
    return { label: "In Stock", color: "bg-green-500" };
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="p-4 text-center">Loading inventory...</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Inventory Management</h2>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/admin/inventory/dashboard")} size="sm" variant="outline">
              <BarChart3 className="w-4 h-4 mr-1" />
              Dashboard
            </Button>
            <Button onClick={() => navigate("/admin/inventory/new")} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStockCount > 0 && (
          <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-medium">{lowStockCount} product(s) low on stock</span>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filteredInventory.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No products found" : "No inventory items yet"}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate("/admin/inventory/new")}>
                <Plus className="w-4 h-4 mr-1" />
                Add First Product
              </Button>
            )}
          </Card>
        ) : (
          filteredInventory.map((item) => {
            const status = getStockStatus(item);
            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{item.name}</h3>
                    {item.sku && <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">⋮</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/admin/inventory/edit/${item.id}`)}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/admin/inventory/movements/${item.id}`)}>
                        View Movements
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(item.id, item.is_active)}>
                        {item.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Category</p>
                    <Badge variant="outline">{item.category || "N/A"}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <Badge className={`${status.color} text-white`}>{status.label}</Badge>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Stock</p>
                    <p className="font-semibold">{item.current_stock}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Min Level</p>
                    <p className="font-semibold">{item.min_stock_level}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Unit Price</p>
                    <p className="font-semibold">${item.unit_price}</p>
                  </div>
                </div>

                {!item.is_active && (
                  <Badge variant="secondary" className="mt-3">Inactive</Badge>
                )}
              </Card>
            );
          })
        )}
      </div>
    </MobileLayout>
  );
}
