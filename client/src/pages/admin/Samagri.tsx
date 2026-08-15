import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Plus, Edit, Trash2, Package, AlertTriangle, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Sample samagri data
const sampleSamagri = [
  {
    id: 1,
    name: "Kumkum (Sindoor)",
    nameHindi: "कुमकुम",
    category: "Essential",
    unit: "grams",
    currentStock: 5000,
    minThreshold: 1000,
    pricePerUnit: 0.5,
    supplier: "Puja Samagri Traders",
    lastRestocked: "2024-12-10",
  },
  {
    id: 2,
    name: "Haldi (Turmeric)",
    nameHindi: "हल्दी",
    category: "Essential",
    unit: "grams",
    currentStock: 3000,
    minThreshold: 500,
    pricePerUnit: 0.8,
    supplier: "Spice World",
    lastRestocked: "2024-12-08",
  },
  {
    id: 3,
    name: "Ghee (Clarified Butter)",
    nameHindi: "घी",
    category: "Havan",
    unit: "liters",
    currentStock: 50,
    minThreshold: 20,
    pricePerUnit: 600,
    supplier: "Amul Dairy",
    lastRestocked: "2024-12-12",
  },
  {
    id: 4,
    name: "Camphor (Kapoor)",
    nameHindi: "कपूर",
    category: "Essential",
    unit: "grams",
    currentStock: 200,
    minThreshold: 500,
    pricePerUnit: 2,
    supplier: "Puja Samagri Traders",
    lastRestocked: "2024-12-05",
  },
  {
    id: 5,
    name: "Sandalwood Powder",
    nameHindi: "चंदन",
    category: "Premium",
    unit: "grams",
    currentStock: 800,
    minThreshold: 200,
    pricePerUnit: 5,
    supplier: "Mysore Sandal",
    lastRestocked: "2024-12-15",
  },
  {
    id: 6,
    name: "Incense Sticks (Agarbatti)",
    nameHindi: "अगरबत्ती",
    category: "Essential",
    unit: "packets",
    currentStock: 1000,
    minThreshold: 200,
    pricePerUnit: 15,
    supplier: "Cycle Brand",
    lastRestocked: "2024-12-11",
  },
  {
    id: 7,
    name: "Coconut",
    nameHindi: "नारियल",
    category: "Essential",
    unit: "pieces",
    currentStock: 100,
    minThreshold: 50,
    pricePerUnit: 40,
    supplier: "Local Market",
    lastRestocked: "2024-12-14",
  },
  {
    id: 8,
    name: "Mango Leaves",
    nameHindi: "आम के पत्ते",
    category: "Seasonal",
    unit: "bunches",
    currentStock: 30,
    minThreshold: 20,
    pricePerUnit: 25,
    supplier: "Local Vendor",
    lastRestocked: "2024-12-13",
  },
];

const categoryColors: Record<string, string> = {
  Essential: "bg-blue-100 text-blue-800",
  Premium: "bg-purple-100 text-purple-800",
  Havan: "bg-orange-100 text-orange-800",
  Seasonal: "bg-green-100 text-green-800",
};

export default function Samagri() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<typeof sampleSamagri[0] | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    nameHindi: "",
    category: "Essential",
    unit: "grams",
    currentStock: 0,
    minThreshold: 0,
    pricePerUnit: 0,
    supplier: "",
  });

  const filteredSamagri = sampleSamagri.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nameHindi.includes(searchTerm);
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "low" && item.currentStock < item.minThreshold) ||
      (stockFilter === "ok" && item.currentStock >= item.minThreshold);
    return matchesSearch && matchesCategory && matchesStock;
  });

  const lowStockItems = sampleSamagri.filter(item => item.currentStock < item.minThreshold);
  const totalValue = sampleSamagri.reduce((sum, item) => sum + (item.currentStock * item.pricePerUnit), 0);

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      nameHindi: "",
      category: "Essential",
      unit: "grams",
      currentStock: 0,
      minThreshold: 0,
      pricePerUnit: 0,
      supplier: "",
    });
    setIsAddDialogOpen(true);
  };

  const handleEdit = (item: typeof sampleSamagri[0]) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      nameHindi: item.nameHindi,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      minThreshold: item.minThreshold,
      pricePerUnit: item.pricePerUnit,
      supplier: item.supplier,
    });
    setIsAddDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      toast.error("Please enter item name");
      return;
    }
    toast.success(editingItem ? "Item updated successfully" : "Item added successfully");
    setIsAddDialogOpen(false);
  };

  const handleDelete = (id: number) => {
    toast.success("Item deleted successfully");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Samagri Inventory</h1>
            <p className="text-muted-foreground">Manage puja materials and supplies</p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus size={16} className="mr-2" />
            Add Item
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package size={16} /> Total Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sampleSamagri.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle size={16} /> Low Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{lowStockItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle size={16} /> In Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {sampleSamagri.length - lowStockItems.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inventory Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by name (English or Hindi)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Essential">Essential</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                  <SelectItem value="Havan">Havan</SelectItem>
                  <SelectItem value="Seasonal">Seasonal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Stock Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="ok">In Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Samagri Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Min Threshold</TableHead>
                  <TableHead>Price/Unit</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSamagri.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{item.nameHindi}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={categoryColors[item.category]}>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.currentStock} {item.unit}
                    </TableCell>
                    <TableCell>
                      {item.minThreshold} {item.unit}
                    </TableCell>
                    <TableCell>₹{item.pricePerUnit}/{item.unit}</TableCell>
                    <TableCell>{item.supplier}</TableCell>
                    <TableCell>
                      {item.currentStock < item.minThreshold ? (
                        <Badge className="bg-red-100 text-red-800">
                          <AlertTriangle size={12} className="mr-1" />
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle size={12} className="mr-1" />
                          In Stock
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(item)}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name (English)</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Kumkum"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name (Hindi)</Label>
                  <Input
                    value={formData.nameHindi}
                    onChange={(e) => setFormData({ ...formData, nameHindi: e.target.value })}
                    placeholder="e.g., कुमकुम"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Essential">Essential</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                      <SelectItem value="Havan">Havan</SelectItem>
                      <SelectItem value="Seasonal">Seasonal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grams">Grams</SelectItem>
                      <SelectItem value="kg">Kilograms</SelectItem>
                      <SelectItem value="liters">Liters</SelectItem>
                      <SelectItem value="pieces">Pieces</SelectItem>
                      <SelectItem value="packets">Packets</SelectItem>
                      <SelectItem value="bunches">Bunches</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Stock</Label>
                  <Input
                    type="number"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Threshold</Label>
                  <Input
                    type="number"
                    value={formData.minThreshold}
                    onChange={(e) => setFormData({ ...formData, minThreshold: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price per Unit (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pricePerUnit}
                    onChange={(e) => setFormData({ ...formData, pricePerUnit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Input
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Supplier name"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingItem ? "Update" : "Add Item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
