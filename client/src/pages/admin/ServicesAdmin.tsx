import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Edit, Trash2, MoreHorizontal, Sparkles, IndianRupee, Clock, Download, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ServiceFormData {
  name: string;
  slug: string;
  categoryId: number;
  estimatedDuration: number;
  basePriceEssential: number;
  basePriceStandard: number;
  basePricePremium: number;
  shortDescription: string;
  fullDescription: string;
}

const categoryOptions = [
  { id: 1, name: "Daily Pujas" },
  { id: 2, name: "Life Events" },
  { id: 3, name: "Festival Pujas" },
  { id: 4, name: "Havan & Homam" },
  { id: 5, name: "Shanti Pujas" },
  { id: 6, name: "Ancestral Rites" },
];

export default function ServicesAdminPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: "",
    slug: "",
    categoryId: 1,
    estimatedDuration: 60,
    basePriceEssential: 0,
    basePriceStandard: 0,
    basePricePremium: 0,
    shortDescription: "",
    fullDescription: "",
  });

  // Fetch services
  const { data: services, isLoading, refetch } = trpc.admin.getServices.useQuery({
    search: searchTerm,
  });

  // Mutations
  const createService = trpc.admin.createService.useMutation({
    onSuccess: () => {
      toast.success("Service created successfully");
      setIsDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create service");
    },
  });

  const updateService = trpc.admin.updateService.useMutation({
    onSuccess: () => {
      toast.success("Service updated successfully");
      setIsDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update service");
    },
  });

  const deleteService = trpc.admin.deleteService.useMutation({
    onSuccess: () => {
      toast.success("Service deleted successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete service");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      categoryId: 1,
      estimatedDuration: 60,
      basePriceEssential: 0,
      basePriceStandard: 0,
      basePricePremium: 0,
      shortDescription: "",
      fullDescription: "",
    });
    setEditingService(null);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const handleOpenDialog = (service?: any) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name || "",
        slug: service.slug || "",
        categoryId: service.categoryId || 1,
        estimatedDuration: service.estimatedDuration || 60,
        basePriceEssential: (service.basePriceEssential || 0) / 100,
        basePriceStandard: (service.basePriceStandard || 0) / 100,
        basePricePremium: (service.basePricePremium || 0) / 100,
        shortDescription: service.shortDescription || "",
        fullDescription: service.fullDescription || "",
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      name: formData.name,
      slug: formData.slug || generateSlug(formData.name),
      categoryId: formData.categoryId,
      estimatedDuration: formData.estimatedDuration,
      basePriceEssential: Math.round(formData.basePriceEssential * 100),
      basePriceStandard: Math.round(formData.basePriceStandard * 100),
      basePricePremium: Math.round(formData.basePricePremium * 100),
      shortDescription: formData.shortDescription || undefined,
      fullDescription: formData.fullDescription || undefined,
    };

    if (editingService) {
      updateService.mutate({
        id: editingService.id,
        ...submitData,
      });
    } else {
      createService.mutate(submitData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this service?")) {
      deleteService.mutate({ id });
    }
  };

  const totalServices = services?.length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Services / Pujas Management</h2>
            <p className="text-muted-foreground">Manage puja services, pricing, and rituals</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download size={16} className="mr-2" />
              Export
            </Button>
            <Button variant="outline">
              <Upload size={16} className="mr-2" />
              Bulk Import
            </Button>
            <Button onClick={() => handleOpenDialog()} className="bg-saffron-500 hover:bg-saffron-600">
              <Plus size={16} className="mr-2" />
              Add Service
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Services</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalServices}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Sparkles className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{categoryOptions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
              <Clock className="h-4 w-4 text-saffron-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-saffron-600">90 mins</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : services && services.length > 0 ? (
                services.map((service: any) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {service.shortDescription}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categoryOptions.find(c => c.id === service.categoryId)?.name || "Uncategorized"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {service.estimatedDuration} mins
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-blue-600">
                        ₹{((service.basePriceStandard || 0) / 100).toLocaleString('en-IN')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-saffron-600">
                        ₹{((service.basePricePremium || 0) / 100).toLocaleString('en-IN')}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(service)}>
                            <Edit size={14} className="mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(service.id)}
                            className="text-destructive"
                          >
                            <Trash2 size={14} className="mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No services found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
            <DialogDescription>
              {editingService ? "Update service details and pricing" : "Create a new puja service"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      name: e.target.value,
                      slug: generateSlug(e.target.value)
                    });
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Category *</Label>
                <Select
                  value={formData.categoryId.toString()}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedDuration">Duration (minutes) *</Label>
                <Input
                  id="estimatedDuration"
                  type="number"
                  min="15"
                  step="15"
                  value={formData.estimatedDuration}
                  onChange={(e) => setFormData({ ...formData, estimatedDuration: parseInt(e.target.value) || 60 })}
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="shortDescription">Short Description</Label>
                <Input
                  id="shortDescription"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  placeholder="Brief description for listings"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="fullDescription">Full Description</Label>
                <Textarea
                  id="fullDescription"
                  value={formData.fullDescription}
                  onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
                  rows={4}
                  placeholder="Detailed description of the puja..."
                />
              </div>
              <div className="col-span-2">
                <Label className="text-base font-semibold">Pricing Tiers (₹)</Label>
                <p className="text-sm text-muted-foreground mb-3">Set prices for each service tier</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="basePriceStandard" className="text-blue-600">Standard</Label>
                    <Input
                      id="basePriceStandard"
                      type="number"
                      min="0"
                      value={formData.basePriceStandard}
                      onChange={(e) => setFormData({ ...formData, basePriceStandard: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="basePricePremium" className="text-saffron-600">Premium</Label>
                    <Input
                      id="basePricePremium"
                      type="number"
                      min="0"
                      value={formData.basePricePremium}
                      onChange={(e) => setFormData({ ...formData, basePricePremium: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createService.isPending || updateService.isPending}
                className="bg-saffron-500 hover:bg-saffron-600"
              >
                {editingService ? "Update" : "Create"} Service
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
