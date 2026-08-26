import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Users,
  Building2,
  Sparkles,
  Package,
  UserCheck
} from "lucide-react";
import { toast } from "sonner";

type EntityType = "customers" | "pujaris" | "temples" | "services" | "samagri";

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

const entityConfig: Record<EntityType, { 
  label: string; 
  icon: any; 
  fields: string[];
  sampleData: string;
}> = {
  customers: {
    label: "Customers",
    icon: Users,
    fields: ["name", "email", "phone", "city", "state", "pincode", "gotra", "nakshatra", "rashi", "preferredLanguage"],
    sampleData: "name,email,phone,city,state,pincode,gotra,nakshatra,rashi,preferredLanguage\nRajesh Kumar,rajesh@email.com,9876543210,Bangalore,Karnataka,560001,Kashyap,Rohini,Vrishabha,Hindi\nPriya Sharma,priya@email.com,9876543211,Mumbai,Maharashtra,400001,Bharadwaj,Ashwini,Mesha,Hindi"
  },
  pujaris: {
    label: "Pujaris/Priests",
    icon: UserCheck,
    fields: ["name", "email", "phone", "city", "state", "experience", "specializations", "languages", "qualification"],
    sampleData: "name,email,phone,city,state,experience,specializations,languages,qualification\nPandit Sharma,sharma@email.com,9876543212,Delhi,Delhi,15,Satyanarayan|Griha Pravesh,Hindi|Sanskrit,Shastri\nAcharya Mishra,mishra@email.com,9876543213,Varanasi,Uttar Pradesh,20,Wedding|Havan,Hindi|Sanskrit|English,Acharya"
  },
  temples: {
    label: "Temples",
    icon: Building2,
    fields: ["name", "description", "address", "city", "state", "pincode", "deity", "timings", "contactPhone", "contactEmail"],
    sampleData: "name,description,address,city,state,pincode,deity,timings,contactPhone,contactEmail\nShri Ganesh Temple,Ancient temple dedicated to Lord Ganesha,MG Road,Bangalore,Karnataka,560001,Lord Ganesha,6:00 AM - 9:00 PM,9876543214,temple@email.com"
  },
  services: {
    label: "Services/Pujas",
    icon: Sparkles,
    fields: ["name", "slug", "categoryId", "estimatedDuration", "basePriceEssential", "basePriceStandard", "basePricePremium", "shortDescription"],
    sampleData: "name,slug,categoryId,estimatedDuration,basePriceEssential,basePriceStandard,basePricePremium,shortDescription\nNavgraha Shanti,navgraha-shanti,5,120,350000,550000,850000,Pacify the nine planets for harmony"
  },
  samagri: {
    label: "Samagri Items",
    icon: Package,
    fields: ["name", "description", "unit", "defaultQuantity", "pricePerUnit", "category"],
    sampleData: "name,description,unit,defaultQuantity,pricePerUnit,category\nCamphor,Pure camphor for aarti,grams,50,500,Essential\nSandalwood Paste,Fragrant sandalwood paste,grams,25,1500,Premium"
  }
};

export default function BulkImportPage() {
  const [selectedEntity, setSelectedEntity] = useState<EntityType>("customers");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; field: string; message: string }>>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const config = entityConfig[selectedEntity];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error("Please upload a CSV file");
        return;
      }
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const data = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim());
        const row: any = { _rowIndex: index + 2 };
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });
        return row;
      });

      setPreviewData(data);
      validateData(data, headers);
    };
    reader.readAsText(file);
  };

  const validateData = (data: any[], headers: string[]) => {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const requiredFields = config.fields.slice(0, 3); // First 3 fields are usually required

    // Check headers
    const missingHeaders = requiredFields.filter(f => !headers.includes(f));
    if (missingHeaders.length > 0) {
      errors.push({ row: 1, field: 'headers', message: `Missing required columns: ${missingHeaders.join(', ')}` });
    }

    // Validate each row
    data.forEach((row, index) => {
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push({ row: index + 2, field, message: `${field} is required` });
        }
      });

      // Email validation
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push({ row: index + 2, field: 'email', message: 'Invalid email format' });
      }

      // Phone validation
      if (row.phone && !/^\d{10}$/.test(row.phone.replace(/\D/g, ''))) {
        errors.push({ row: index + 2, field: 'phone', message: 'Phone must be 10 digits' });
      }

      // Pincode validation
      if (row.pincode && !/^\d{6}$/.test(row.pincode)) {
        errors.push({ row: index + 2, field: 'pincode', message: 'Pincode must be 6 digits' });
      }
    });

    setValidationErrors(errors);
  };

  const downloadTemplate = () => {
    const blob = new Blob([config.sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEntity}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded successfully");
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      toast.error("Please fix validation errors before importing");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    // Simulate import process
    const total = previewData.length;
    let success = 0;
    let failed = 0;
    const errors: Array<{ row: number; field: string; message: string }> = [];

    for (let i = 0; i < total; i++) {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate 95% success rate
      if (Math.random() > 0.05) {
        success++;
      } else {
        failed++;
        errors.push({ row: i + 2, field: 'general', message: 'Database error' });
      }

      setImportProgress(Math.round(((i + 1) / total) * 100));
    }

    setImportResult({ total, success, failed, errors });
    setIsImporting(false);
    
    if (failed === 0) {
      toast.success(`Successfully imported ${success} ${config.label.toLowerCase()}`);
    } else {
      toast.warning(`Imported ${success} of ${total} records. ${failed} failed.`);
    }
  };

  const resetImport = () => {
    setFile(null);
    setPreviewData([]);
    setValidationErrors([]);
    setImportResult(null);
    setImportProgress(0);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bulk Data Management</h2>
          <p className="text-muted-foreground">Import and manage large datasets via CSV uploads</p>
        </div>

        {/* Entity Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Entity Type</CardTitle>
            <CardDescription>Choose the type of data you want to import</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(Object.keys(entityConfig) as EntityType[]).map((entity) => {
                const EntityIcon = entityConfig[entity].icon;
                return (
                  <Button
                    key={entity}
                    variant={selectedEntity === entity ? "default" : "outline"}
                    className={`h-auto py-4 flex flex-col gap-2 ${selectedEntity === entity ? 'bg-saffron-500 hover:bg-saffron-600' : ''}`}
                    onClick={() => {
                      setSelectedEntity(entity);
                      resetImport();
                    }}
                  >
                    <EntityIcon className="h-6 w-6" />
                    <span className="text-sm">{entityConfig[entity].label}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="import" className="space-y-4">
          <TabsList>
            <TabsTrigger value="import">Import Data</TabsTrigger>
            <TabsTrigger value="history">Import History</TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="space-y-4">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upload {config.label} CSV</CardTitle>
                    <CardDescription>
                      Required fields: {config.fields.slice(0, 3).join(', ')}
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download size={16} className="mr-2" />
                    Download Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {!file ? (
                    <div className="space-y-4">
                      <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
                      <div>
                        <p className="text-lg font-medium">Drop your CSV file here</p>
                        <p className="text-sm text-muted-foreground">or click to browse</p>
                      </div>
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="max-w-xs mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                      <div>
                        <p className="text-lg font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{previewData.length} records found</p>
                      </div>
                      <Button variant="outline" onClick={resetImport}>
                        Choose Different File
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Validation Results */}
            {previewData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {validationErrors.length === 0 ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Validation Passed
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        Validation Errors ({validationErrors.length})
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {validationErrors.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationErrors.slice(0, 10).map((error, i) => (
                            <TableRow key={i}>
                              <TableCell>{error.row}</TableCell>
                              <TableCell><Badge variant="outline">{error.field}</Badge></TableCell>
                              <TableCell className="text-destructive">{error.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {validationErrors.length > 10 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          ...and {validationErrors.length - 10} more errors
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-green-600">All {previewData.length} records passed validation</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Preview Table */}
            {previewData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Data Preview (First 5 rows)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {config.fields.slice(0, 5).map(field => (
                            <TableHead key={field}>{field}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {config.fields.slice(0, 5).map(field => (
                              <TableCell key={field} className="max-w-[200px] truncate">
                                {row[field] || '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Import Progress */}
            {isImporting && (
              <Card>
                <CardHeader>
                  <CardTitle>Importing Data...</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={importProgress} />
                  <p className="text-center text-muted-foreground">{importProgress}% complete</p>
                </CardContent>
              </Card>
            )}

            {/* Import Results */}
            {importResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Import Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{importResult.total}</p>
                      <p className="text-sm text-muted-foreground">Total Records</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
                      <p className="text-sm text-green-600">Successful</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-destructive">{importResult.failed}</p>
                      <p className="text-sm text-destructive">Failed</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-4">
                      <p className="font-medium mb-2">Failed Records:</p>
                      <div className="max-h-32 overflow-y-auto">
                        {importResult.errors.map((error, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                            <XCircle className="h-4 w-4" />
                            Row {error.row}: {error.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            {previewData.length > 0 && !importResult && (
              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={resetImport}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || validationErrors.length > 0}
                  className="bg-saffron-500 hover:bg-saffron-600"
                >
                  <Upload size={16} className="mr-2" />
                  Import {previewData.length} Records
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Recent Imports</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Dec 15, 2024</TableCell>
                      <TableCell><Badge variant="outline">Customers</Badge></TableCell>
                      <TableCell>customers_batch_1.csv</TableCell>
                      <TableCell>150</TableCell>
                      <TableCell><Badge className="bg-green-500">Completed</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Dec 14, 2024</TableCell>
                      <TableCell><Badge variant="outline">Pujaris</Badge></TableCell>
                      <TableCell>priests_onboarding.csv</TableCell>
                      <TableCell>25</TableCell>
                      <TableCell><Badge className="bg-green-500">Completed</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Dec 13, 2024</TableCell>
                      <TableCell><Badge variant="outline">Temples</Badge></TableCell>
                      <TableCell>temples_karnataka.csv</TableCell>
                      <TableCell>45</TableCell>
                      <TableCell><Badge variant="destructive">Failed</Badge></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
