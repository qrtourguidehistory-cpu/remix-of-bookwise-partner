import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function InventoryForm() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    category: "",
    current_stock: 0,
    min_stock_level: 5,
    unit_price: 0,
    cost_price: 0,
    supplier: "",
    is_active: true,
  });

  useEffect(() => {
    if (isEditMode) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setFormData(data);
    } catch (error: any) {
      toast.error("Error loading product");
      console.error(error);
      navigate("/admin/inventory");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.business_id) return;

    setLoading(true);
    try {
      const productData = {
        ...formData,
        business_id: profile.business_id,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from("inventory")
          .update(productData)
          .eq("id", id);

        if (error) throw error;
        toast.success("Product updated successfully");
      } else {
        const { error } = await supabase
          .from("inventory")
          .insert(productData);

        if (error) throw error;
        toast.success("Product added successfully");
      }

      navigate("/admin/inventory");
    } catch (error: any) {
      toast.error(isEditMode ? "Error updating product" : "Error adding product");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/inventory")}>
            ← Back
          </Button>
          <h2 className="text-lg font-semibold">{isEditMode ? "Edit" : "Add"} Product</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku || ""}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category || ""}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hair">Hair Products</SelectItem>
                  <SelectItem value="skin">Skin Care</SelectItem>
                  <SelectItem value="nails">Nail Products</SelectItem>
                  <SelectItem value="makeup">Makeup</SelectItem>
                  <SelectItem value="tools">Tools & Equipment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="font-semibold">Stock Information</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_stock">Current Stock *</Label>
              <Input
                id="current_stock"
                type="number"
                min="0"
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_stock_level">Min Stock Level *</Label>
              <Input
                id="min_stock_level"
                type="number"
                min="0"
                value={formData.min_stock_level}
                onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 5 })}
                required
              />
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="font-semibold">Pricing</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_price">Unit Price *</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Input
              id="supplier"
              value={formData.supplier || ""}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_active">Active Product</Label>
              <p className="text-sm text-muted-foreground">Make this product available for use</p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/admin/inventory")} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? "Saving..." : isEditMode ? "Update Product" : "Add Product"}
          </Button>
        </div>
      </form>
    </MobileLayout>
  );
}
