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
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Edit, Trash2, MoreHorizontal, CheckCircle, XCircle, Star, Users, UserCheck, Clock, Download, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PujariFormData {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  experience: number;
  languages: string[];
  specializations: string[];
  bio: string;
  basePrice: number;
  // New location fields
  locationCity: string;
  locationArea: string;
  fullAddress: string;
  landmark: string;
  pincode: string;
  categoryId: number | null;
}

const languageOptions = ["Hindi", "English", "Sanskrit", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati"];
const specializationOptions = [
  "Satyanarayan Puja", "Griha Pravesh", "Wedding Ceremonies", "Vastu Shanti",
  "Navagraha Puja", "Rudra Abhishek", "Ganesh Puja", "Lakshmi Puja",
  "Durga Puja", "Kali Puja", "Shradh/Pind Daan", "Mundan Ceremony",
  "Namkaran", "Havan/Homam", "Sunderkand Path"
];

export default function PujarisPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  const [editingPujari, setEditingPujari] = useState<any>(null);
  const [selectedPujari, setSelectedPujari] = useState<any>(null);
  const [formData, setFormData] = useState<PujariFormData>({
    name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    experience: 0,
    languages: ["Hindi"],
    specializations: [],
    bio: "",
    basePrice: 0,
    locationCity: "",
    locationArea: "",
    fullAddress: "",
    landmark: "",
    pincode: "",
    categoryId: null,
  });

  // Fetch categories for dropdown
  const { data: categories } = trpc.categories.getAll.useQuery({ applicableTo: "pujari" });

  // Fetch pujaris
  const { data: pujaris, isLoading, refetch } = trpc.admin.getPriests.useQuery({
    search: searchTerm,
    verified: verificationFilter === "all" ? undefined : verificationFilter === "verified",
  });

  // Mutations
  const createPujari = trpc.admin.createPriest.useMutation({
    onSuccess: () => {
      toast.success("Pujari created successfully");
      setIsDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create pujari");
    },
  });

  const updatePujari = trpc.admin.updatePriest.useMutation({
    onSuccess: () => {
      toast.success("Pujari updated successfully");
      setIsDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update pujari");
    },
  });

  const deletePujari = trpc.admin.deletePriest.useMutation({
    onSuccess: () => {
      toast.success("Pujari deleted successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete pujari");
    },
  });

  const verifyPujari = trpc.admin.updatePriest.useMutation({
    onSuccess: () => {
      toast.success("Pujari verification status updated");
      setIsVerifyDialogOpen(false);
      setSelectedPujari(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update verification");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      city: "",
      state: "",
      experience: 0,
      languages: ["Hindi"],
      specializations: [],
      bio: "",
      basePrice: 0,
      locationCity: "",
      locationArea: "",
      fullAddress: "",
      landmark: "",
      pincode: "",
      categoryId: null,
    });
    setEditingPujari(null);
  };

  const handleOpenDialog = (pujari?: any) => {
    if (pujari) {
      setEditingPujari(pujari);
      setFormData({
        name: pujari.name || "",
        email: pujari.email || "",
        phone: pujari.phone || "",
        city: pujari.city || "",
        state: pujari.state || "",
        experience: pujari.experience || 0,
        languages: pujari.languages || ["Hindi"],
        specializations: pujari.specializations || [],
        bio: pujari.bio || "",
        basePrice: (pujari.basePrice || 0) / 100,
        locationCity: pujari.locationCity || "",
        locationArea: pujari.locationArea || "",
        fullAddress: pujari.fullAddress || "",
        landmark: pujari.landmark || "",
        pincode: pujari.pincode || "",
        categoryId: pujari.categoryId || null,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      basePrice: Math.round(formData.basePrice * 100), // Convert to paise
    };

    if (editingPujari) {
      updatePujari.mutate({
        id: editingPujari.id,
        ...submitData,
      });
    } else {
      createPujari.mutate(submitData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this pujari?")) {
      deletePujari.mutate({ id });
    }
  };

  const handleVerify = (pujari: any, verified: boolean) => {
    setSelectedPujari(pujari);
    if (verified) {
      verifyPujari.mutate({
        id: pujari.id,
        name: pujari.name,
        email: pujari.email,
        phone: pujari.phone,
        city: pujari.city,
        state: pujari.state,
        experience: pujari.experience,
        languages: pujari.languages,
        specializations: pujari.specializations,
        bio: pujari.bio,
        basePrice: pujari.basePrice,
        isVerified: true,
      });
    } else {
      setIsVerifyDialogOpen(true);
    }
  };

  const toggleLanguage = (lang: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
  };

  const toggleSpecialization = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec]
    }));
  };

  // Stats
  const totalPujaris = pujaris?.length || 0;
  const verifiedPujaris = pujaris?.filter((p: any) => p.isVerified).length || 0;
  const pendingVerification = totalPujaris - verifiedPujaris;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Pujari Management</h2>
            <p className="text-muted-foreground">Manage priest profiles, verification, and assignments</p>
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
              Add Pujari
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Pujaris</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPujaris}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{verifiedPujaris}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingVerification}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-4 w-4 text-saffron-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-saffron-600">4.8</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={verificationFilter} onValueChange={setVerificationFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Verification Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pujaris</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="pending">Pending Verification</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Specializations</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : pujaris && pujaris.length > 0 ? (
                pujaris.map((pujari: any) => (
                  <TableRow key={pujari.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pujari.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {pujari.city}, {pujari.state}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{pujari.email}</div>
                        <div className="text-muted-foreground">{pujari.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>{pujari.experience} years</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(pujari.specializations || []).slice(0, 2).map((spec: string) => (
                          <Badge key={spec} variant="outline" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                        {(pujari.specializations || []).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{pujari.specializations.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-saffron-500 text-saffron-500" />
                        <span>{pujari.rating || "N/A"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {pujari.isVerified ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(pujari)}>
                            <Edit size={14} className="mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {!pujari.isVerified && (
                            <DropdownMenuItem onClick={() => handleVerify(pujari, true)}>
                              <CheckCircle size={14} className="mr-2" />
                              Verify
                            </DropdownMenuItem>
                          )}
                          {pujari.isVerified && (
                            <DropdownMenuItem onClick={() => handleVerify(pujari, false)}>
                              <XCircle size={14} className="mr-2" />
                              Revoke Verification
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(pujari.id)}
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
                    No pujaris found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPujari ? "Edit Pujari" : "Add New Pujari"}</DialogTitle>
            <DialogDescription>
              {editingPujari ? "Update pujari profile and qualifications" : "Create a new pujari account with qualifications"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div>
              <h4 className="font-semibold mb-3">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience">Experience (Years) *</Label>
                  <Input
                    id="experience"
                    type="number"
                    min="0"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: parseInt(e.target.value) || 0 })}
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
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="bio">Bio / Description</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={3}
                    placeholder="Brief description about the pujari's background and expertise..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="basePrice">Base Price (₹)</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    min="0"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Location Details */}
            <div>
              <h4 className="font-semibold mb-3">Location Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="locationCity">Location (City)</Label>
                  <Input
                    id="locationCity"
                    value={formData.locationCity}
                    onChange={(e) => setFormData({ ...formData, locationCity: e.target.value })}
                    placeholder="e.g., Bangalore"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationArea">Area / Locality</Label>
                  <Input
                    id="locationArea"
                    value={formData.locationArea}
                    onChange={(e) => setFormData({ ...formData, locationArea: e.target.value })}
                    placeholder="e.g., Jayanagar"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="fullAddress">Full Address (Street, Locality)</Label>
                  <Textarea
                    id="fullAddress"
                    value={formData.fullAddress}
                    onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                    rows={2}
                    placeholder="Complete address with street name and locality..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="landmark">Landmark</Label>
                  <Input
                    id="landmark"
                    value={formData.landmark}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                    placeholder="e.g., Near XYZ Temple"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode / ZIP Code</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="e.g., 560041"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Category</Label>
                  <Select
                    value={formData.categoryId?.toString() || ""}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value ? parseInt(value) : null })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Languages */}
            <div>
              <h4 className="font-semibold mb-3">Languages</h4>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((lang) => (
                  <div key={lang} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${lang}`}
                      checked={formData.languages.includes(lang)}
                      onCheckedChange={() => toggleLanguage(lang)}
                    />
                    <label htmlFor={`lang-${lang}`} className="text-sm cursor-pointer">
                      {lang}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Specializations */}
            <div>
              <h4 className="font-semibold mb-3">Specializations</h4>
              <div className="grid grid-cols-3 gap-2">
                {specializationOptions.map((spec) => (
                  <div key={spec} className="flex items-center space-x-2">
                    <Checkbox
                      id={`spec-${spec}`}
                      checked={formData.specializations.includes(spec)}
                      onCheckedChange={() => toggleSpecialization(spec)}
                    />
                    <label htmlFor={`spec-${spec}`} className="text-sm cursor-pointer">
                      {spec}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPujari.isPending || updatePujari.isPending}
                className="bg-saffron-500 hover:bg-saffron-600"
              >
                {editingPujari ? "Update" : "Create"} Pujari
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Verification Revoke Dialog */}
      <Dialog open={isVerifyDialogOpen} onOpenChange={setIsVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Verification</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke verification for {selectedPujari?.name}? 
              This will remove their verified badge and may affect their visibility to customers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVerifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedPujari) {
                  verifyPujari.mutate({
                    id: selectedPujari.id,
                    name: selectedPujari.name,
                    email: selectedPujari.email,
                    phone: selectedPujari.phone,
                    city: selectedPujari.city,
                    state: selectedPujari.state,
                    experience: selectedPujari.experience,
                    languages: selectedPujari.languages,
                    specializations: selectedPujari.specializations,
                    bio: selectedPujari.bio,
                    basePrice: selectedPujari.basePrice,
                    isVerified: false,
                  });
                }
              }}
            >
              Revoke Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
