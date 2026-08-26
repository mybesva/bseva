import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { 
  MessageSquare, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye,
  Code,
  Variable,
  Copy,
  Check,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface SMSTemplate {
  id: number;
  name: string;
  type: "booking_confirmation" | "booking_reminder" | "otp" | "payment" | "custom";
  content: string;
  variables: string[];
  isActive: boolean;
  characterCount: number;
  createdAt: string;
  updatedAt: string;
}

// Sample templates
const sampleTemplates: SMSTemplate[] = [
  {
    id: 1,
    name: "OTP Verification",
    type: "otp",
    content: "B-Seva: Your OTP is {{otp}}. Valid for 10 mins. Do not share with anyone.",
    variables: ["otp"],
    isActive: true,
    characterCount: 72,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: 2,
    name: "Booking Confirmation",
    type: "booking_confirmation",
    content: "B-Seva: Booking {{booking_number}} confirmed for {{puja_name}} on {{booking_date}}. Amount: Rs.{{amount}}. Om Shanti!",
    variables: ["booking_number", "puja_name", "booking_date", "amount"],
    isActive: true,
    characterCount: 115,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-20",
  },
  {
    id: 3,
    name: "Booking Reminder",
    type: "booking_reminder",
    content: "B-Seva: Reminder - Your {{puja_name}} is scheduled for tomorrow at {{booking_time}}. Pujari will arrive 30 mins early.",
    variables: ["puja_name", "booking_time"],
    isActive: true,
    characterCount: 118,
    createdAt: "2024-01-16",
    updatedAt: "2024-01-16",
  },
  {
    id: 4,
    name: "Payment Received",
    type: "payment",
    content: "B-Seva: Payment of Rs.{{amount}} received for booking {{booking_number}}. Thank you!",
    variables: ["amount", "booking_number"],
    isActive: false,
    characterCount: 85,
    createdAt: "2024-01-17",
    updatedAt: "2024-01-17",
  },
];

const templateTypes = [
  { value: "booking_confirmation", label: "Booking Confirmation" },
  { value: "booking_reminder", label: "Booking Reminder" },
  { value: "otp", label: "OTP Verification" },
  { value: "payment", label: "Payment" },
  { value: "custom", label: "Custom" },
];

const availableVariables = [
  { name: "customer_name", description: "Customer's name" },
  { name: "puja_name", description: "Name of the puja" },
  { name: "booking_number", description: "Booking reference" },
  { name: "booking_date", description: "Date of puja" },
  { name: "booking_time", description: "Time of puja" },
  { name: "amount", description: "Payment amount" },
  { name: "otp", description: "One-time password" },
  { name: "pujari_name", description: "Pujari's name" },
];

export default function SMSTemplates() {
  const [templates, setTemplates] = useState<SMSTemplate[]>(sampleTemplates);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    type: "custom" as SMSTemplate["type"],
    content: "",
    isActive: true,
  });

  const handleOpenDialog = (template?: SMSTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        type: template.type,
        content: template.content,
        isActive: template.isActive,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: "",
        type: "custom",
        content: "",
        isActive: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (editingTemplate) {
      setTemplates(templates.map(t => 
        t.id === editingTemplate.id 
          ? { 
              ...t, 
              ...formData, 
              characterCount: formData.content.length,
              updatedAt: new Date().toISOString().split('T')[0] 
            }
          : t
      ));
      toast.success("Template updated successfully");
    } else {
      const newTemplate: SMSTemplate = {
        id: Math.max(...templates.map(t => t.id)) + 1,
        ...formData,
        variables: [],
        characterCount: formData.content.length,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      setTemplates([...templates, newTemplate]);
      toast.success("Template created successfully");
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: number) => {
    setTemplates(templates.filter(t => t.id !== id));
    toast.success("Template deleted");
  };

  const handleToggleActive = (id: number) => {
    setTemplates(templates.map(t => 
      t.id === id ? { ...t, isActive: !t.isActive } : t
    ));
  };

  const copyVariable = (varName: string) => {
    navigator.clipboard.writeText(`{{${varName}}}`);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 2000);
    toast.success(`Copied {{${varName}}} to clipboard`);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      booking_confirmation: "bg-green-100 text-green-700",
      booking_reminder: "bg-yellow-100 text-yellow-700",
      otp: "bg-purple-100 text-purple-700",
      payment: "bg-blue-100 text-blue-700",
      custom: "bg-gray-100 text-gray-700",
    };
    return colors[type] || colors.custom;
  };

  const getCharacterStatus = (count: number) => {
    if (count <= 160) return { color: "text-green-600", label: "1 SMS" };
    if (count <= 306) return { color: "text-yellow-600", label: "2 SMS" };
    return { color: "text-red-600", label: `${Math.ceil(count / 153)} SMS` };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1E3A5F]">SMS Templates</h1>
          <p className="text-gray-600 mt-1">Manage automated SMS templates for notifications</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-[#F7931E] hover:bg-[#e8850d]">
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* SMS Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">SMS Character Limits</p>
              <p className="mt-1">Standard SMS: 160 characters (1 SMS) | Long SMS: 153 chars per segment</p>
              <p>Keep messages concise to minimize costs. Variables are replaced at send time.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variable Reference Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Variable className="w-5 h-5" />
            Available Variables
          </CardTitle>
          <CardDescription>Click to copy variable placeholder to clipboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((v) => (
              <button
                key={v.name}
                onClick={() => copyVariable(v.name)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors"
                title={v.description}
              >
                <Code className="w-3 h-3" />
                {`{{${v.name}}}`}
                {copiedVar === v.name ? (
                  <Check className="w-3 h-3 text-green-600" />
                ) : (
                  <Copy className="w-3 h-3 opacity-50" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Content Preview</TableHead>
                <TableHead>Characters</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => {
                const charStatus = getCharacterStatus(template.characterCount);
                return (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                        {template.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTypeColor(template.type)}>
                        {templateTypes.find(t => t.value === template.type)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm text-gray-600">
                      {template.content}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={charStatus.color}>{template.characterCount}</span>
                        <Badge variant="outline" className={charStatus.color}>
                          {charStatus.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.isActive}
                          onCheckedChange={() => handleToggleActive(template.id)}
                        />
                        <span className={template.isActive ? "text-green-600" : "text-gray-400"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(template)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit SMS Template" : "Create SMS Template"}
            </DialogTitle>
            <DialogDescription>
              Configure the SMS template with dynamic variables
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., OTP Verification"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Template Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as SMSTemplate["type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">SMS Content *</Label>
                <span className={`text-sm ${getCharacterStatus(formData.content.length).color}`}>
                  {formData.content.length} characters ({getCharacterStatus(formData.content.length).label})
                </span>
              </div>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="B-Seva: Your OTP is {{otp}}. Valid for 10 mins."
                rows={4}
              />
              <p className="text-xs text-gray-500">Use variables like {"{{customer_name}}"} for dynamic content</p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Active (template will be used for sending SMS)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-[#F7931E] hover:bg-[#e8850d]">
              {editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
