import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import MobileLayout from "@/components/mobile/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertCircle, Package, TrendingUp, AlertTriangle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface InventoryItem {
  id: string;
  name: string;
  current_stock: number;
  min_stock_level: number;
  category: string;
}

interface MovementStats {
  product_name: string;
  total_used: number;
  category: string;
}

interface CategoryStats {
  category: string;
  count: number;
  value: number;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [mostUsedProducts, setMostUsedProducts] = useState<MovementStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get business_id from profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user.id)
        .single() as any;

      if (!profileData?.business_id) return;

      // Load low stock items
      const { data: inventoryData } = await supabase
        .from("inventory" as any)
        .select("*")
        .eq("business_id", profileData.business_id)
        .eq("is_active", true) as any;

      if (inventoryData) {
        const lowStock = (inventoryData as InventoryItem[]).filter(
          (item) => item.current_stock <= item.min_stock_level
        );
        setLowStockItems(lowStock);
        setTotalProducts(inventoryData.length);

        const total = inventoryData.reduce(
          (sum, item) => sum + (item.current_stock * item.unit_price),
          0
        );
        setTotalValue(total);

        // Calculate category stats
        const categoryMap = new Map<string, { count: number; value: number }>();
        inventoryData.forEach((item) => {
          const category = item.category || 'Sin categoría';
          const existing = categoryMap.get(category) || { count: 0, value: 0 };
          categoryMap.set(category, {
            count: existing.count + 1,
            value: existing.value + (item.current_stock * item.unit_price)
          });
        });

        const categoryData = Array.from(categoryMap.entries()).map(([category, stats]) => ({
          category,
          ...stats
        }));
        setCategoryStats(categoryData);
      }

      // Load most used products from movements
      const { data: movementsData } = await supabase
        .from("inventory_movements" as any)
        .select(`
          inventory_id,
          quantity,
          movement_type,
          inventory (
            name,
            category
          )
        `)
        .eq("business_id", profileData.business_id)
        .eq("movement_type", "out") as any;

      if (movementsData) {
        const productMap = new Map<string, { name: string; total: number; category: string }>();
        
        movementsData.forEach((movement: any) => {
          if (movement.inventory) {
            const name = movement.inventory.name;
            const category = movement.inventory.category || 'Sin categoría';
            const existing = productMap.get(name) || { name, total: 0, category };
            productMap.set(name, {
              ...existing,
              total: existing.total + Math.abs(movement.quantity)
            });
          }
        });

        const topProducts = Array.from(productMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
          .map(p => ({
            product_name: p.name,
            total_used: p.total,
            category: p.category
          }));

        setMostUsedProducts(topProducts);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/inventory")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Dashboard de Inventario</h1>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="border-b border-border px-4 py-3 mb-4 sticky top-[57px] bg-card z-30">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/inventory")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Dashboard de Inventario</h1>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Total Productos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Valor Total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Alerta de Stock Bajo</AlertTitle>
            <AlertDescription>
              {lowStockItems.length} producto(s) con stock bajo o agotado
              <Button
                variant="link"
                className="p-0 h-auto ml-2"
                onClick={() => navigate("/admin/inventory")}
              >
                Ver detalles
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Most Used Products Chart */}
        {mostUsedProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Productos Más Usados</CardTitle>
              <CardDescription>Top 10 productos por salidas de inventario</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  total_used: {
                    label: "Cantidad Usada",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mostUsedProducts} margin={{ left: 0, right: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="product_name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="total_used" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Category Distribution Chart */}
        {categoryStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Categoría</CardTitle>
              <CardDescription>Cantidad de productos por categoría</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  count: {
                    label: "Cantidad",
                  },
                }}
                className="h-[250px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryStats}
                      dataKey="count"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${entry.category}: ${entry.count}`}
                    >
                      {categoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Low Stock Items List */}
        {lowStockItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Productos con Stock Bajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent"
                    onClick={() => navigate(`/admin/inventory/edit/${item.id}`)}
                  >
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-destructive font-bold">{item.current_stock}</div>
                      <div className="text-xs text-muted-foreground">
                        Mín: {item.min_stock_level}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
}
