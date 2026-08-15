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
import { Search, Plus, Edit, Trash2, MoreHorizontal, MapPin, Building2, Download, Upload, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TempleFormData {
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  deity: string;
  timings: string;
  contactPhone: string;
  contactEmail: string;
}

const deityOptions = [
  "Lord Ganesha", "Lord Shiva", "Lord Vishnu", "Lord Krishna", "Lord Rama",
  "Goddess Durga", "Goddess Lakshmi", "Goddess Saraswati", "Goddess Kali",
  "Lord Hanuman", "Lord Murugan", "Lord Ayyappa", "Lord Venkateshwara",
  "Goddess Parvati", "Lord Brahma", "Multiple Deities"
];

export default function TemplesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemple, setEditingTemple] = useState<any>(null);
  const [formData, setFormData] = useState<TempleFormData>({
    name: "",
    description: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    deity: "",
    timings: "",
    contactPhone: "",
    contactEmail: "",
  });

  // Fetch temples
  const { data: temples, isLoading, refetch } = trpc.admin.getTemples.useQuery({
    search: searchTerm,
  });

  // Mutations
  const createTemple = trpc.admin.createTemple.useMutation({
    onSuccess: () => {
      toast.success("Temple created successfully");
      setIsDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create temple");
    },
  });

  const updateTemple = trpc.admin.updateTemple.useMutation({
    onSuccess: () => {
      toast.success("Temple updated successfully");
      setIsDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update temple");
    },
  });

  const deleteTemple = trpc.admin.deleteTemple.useMutation({
    onSuccess: () => {
      toast.success("Temple deleted successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete temple");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      deity: "",
      timings: "",
      contactPhone: "",
      contactEmail: "",
    });
    setEditingTemple(null);
  };

  const handleOpenDialog = (temple?: any) => {
    if (temple) {
      setEditingTemple(temple);
      setFormData({
        name: temple.name || "",
        description: temple.description || "",
        address: temple.address || "",
        city: temple.city || "",
        state: temple.state || "",
        pincode: temple.pincode || "",
        deity: temple.deity || "",
        timings: temple.timings || "",
        contactPhone: temple.contactPhone || "",
        contactEmail: temple.contactEmail || "",
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTemple) {
      updateTemple.mutate({
        id: editingTemple.id,
        ...formData,
      });
    } else {
      createTemple.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this temple?")) {
      deleteTemple.mutate({ id });
    }
  };

  // Get unique cities for filter
  const cities = Array.from(new Set(temples?.map((t: any) => t.city).filter(Boolean) || []));
  const totalTemples = temples?.length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Temple Management</h2>
            <p className="text-muted-foreground">Manage temple listings and information</p>
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
              Add Temple
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Temples</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTemples}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cities Covered</CardTitle>
              <MapPin className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{cities.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              <Clock className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalTemples}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by name, deity, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city: string) => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Temple Name</TableHead>
                <TableHead>Deity</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Timings</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : temples && temples.length > 0 ? (
                temples.map((temple: any) => (
                  <TableRow key={temple.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{temple.name}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {temple.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{temple.deity || "Multiple"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{temple.city}, {temple.state}</div>
                        <div className="text-muted-foreground">{temple.pincode}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{temple.timings || "Not specified"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{temple.contactPhone}</div>
                        <div className="text-muted-foreground">{temple.contactEmail}</div>
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
                          <DropdownMenuItem onClick={() => handleOpenDialog(temple)}>
                            <Edit size={14} className="mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(temple.id)}
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No temples found
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
            <DialogTitle>{editingTemple ? "Edit Temple" : "Add New Temple"}</DialogTitle>
            <DialogDescription>
              {editingTemple ? "Update temple information" : "Add a new temple to the directory"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Temple Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deity">Primary Deity</Label>
                <Select
                  value={formData.deity}
                  onValueChange={(value) => setFormData({ ...formData, deity: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select deity" />
                  </SelectTrigger>
                  <SelectContent>
                    {deityOptions.map((deity) => (
                      <SelectItem key={deity} value={deity}>{deity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timings">Timings</Label>
                <Input
                  id="timings"
                  value={formData.timings}
                  onChange={(e) => setFormData({ ...formData, timings: e.target.value })}
                  placeholder="e.g., 6:00 AM - 9:00 PM"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTemple.isPending || updateTemple.isPending}
                className="bg-saffron-500 hover:bg-saffron-600"
              >
                {editingTemple ? "Update" : "Create"} Temple
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
