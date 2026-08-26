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
  Mail, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye,
  Code,
  Variable,
  Copy,
  Check
} from "lucide-react";
import { toast } from "sonner";

interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  type: "booking_confirmation" | "booking_reminder" | "payment_receipt" | "otp" | "welcome" | "custom";
  htmlContent: string;
  textContent: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Sample templates
const sampleTemplates: EmailTemplate[] = [
  {
    id: 1,
    name: "Booking Confirmation",
    subject: "🙏 Booking Confirmed - {{puja_name}} | B-Seva",
    type: "booking_confirmation",
    htmlContent: `<h1>Booking Confirmed!</h1><p>Dear {{customer_name}},</p><p>Your booking for {{puja_name}} has been confirmed.</p><p>Booking Number: {{booking_number}}</p><p>Date: {{booking_date}}</p><p>Amount: ₹{{total_amount}}</p>`,
    textContent: "Dear {{customer_name}}, Your booking for {{puja_name}} has been confirmed. Booking Number: {{booking_number}}",
    variables: ["customer_name", "puja_name", "booking_number", "booking_date", "total_amount", "tithi", "nakshatra"],
    isActive: true,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-20",
  },
  {
    id: 2,
    name: "OTP Verification",
    subject: "🔐 OTP for Booking Verification - B-Seva",
    type: "otp",
    htmlContent: `<h1>Verify Your Booking</h1><p>Dear {{customer_name}},</p><p>Your OTP is: <strong>{{otp}}</strong></p><p>Valid for 10 minutes.</p>`,
    textContent: "Dear {{customer_name}}, Your OTP for B-Seva booking verification is: {{otp}}. Valid for 10 minutes.",
    variables: ["customer_name", "otp"],
    isActive: true,
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15",
  },
  {
    id: 3,
    name: "Payment Receipt",
    subject: "💳 Payment Receipt - {{booking_number}} | B-Seva",
    type: "payment_receipt",
    htmlContent: `<h1>Payment Received</h1><p>Dear {{customer_name}},</p><p>We have received your payment of ₹{{amount}} for booking {{booking_number}}.</p>`,
    textContent: "Dear {{customer_name}}, Payment of ₹{{amount}} received for booking {{booking_number}}.",
    variables: ["customer_name", "booking_number", "amount", "payment_date", "transaction_id"],
    isActive: true,
    createdAt: "2024-01-16",
    updatedAt: "2024-01-16",
  },
  {
    id: 4,
    name: "Booking Reminder",
    subject: "⏰ Reminder: Your Puja is Tomorrow | B-Seva",
    type: "booking_reminder",
    htmlContent: `<h1>Puja Reminder</h1><p>Dear {{customer_name}},</p><p>This is a reminder that your {{puja_name}} is scheduled for tomorrow.</p>`,
    textContent: "Dear {{customer_name}}, Reminder: Your {{puja_name}} is scheduled for tomorrow at {{booking_time}}.",
    variables: ["customer_name", "puja_name", "booking_date", "booking_time", "pujari_name"],
    isActive: false,
    createdAt: "2024-01-17",
    updatedAt: "2024-01-17",
  },
];

const templateTypes = [
  { value: "booking_confirmation", label: "Booking Confirmation" },
  { value: "booking_reminder", label: "Booking Reminder" },
  { value: "payment_receipt", label: "Payment Receipt" },
  { value: "otp", label: "OTP Verification" },
  { value: "welcome", label: "Welcome Email" },
  { value: "custom", label: "Custom" },
];

const availableVariables = [
  { name: "customer_name", description: "Customer's full name" },
  { name: "customer_email", description: "Customer's email address" },
  { name: "puja_name", description: "Name of the puja service" },
  { name: "booking_number", description: "Unique booking reference" },
  { name: "booking_date", description: "Date of the puja" },
  { name: "booking_time", description: "Time of the puja" },
  { name: "total_amount", description: "Total booking amount" },
  { name: "tithi", description: "Vedic calendar tithi" },
  { name: "nakshatra", description: "Vedic calendar nakshatra" },
  { name: "pujari_name", description: "Assigned pujari's name" },
  { name: "location", description: "Puja location address" },
  { name: "otp", description: "One-time password" },
  { name: "transaction_id", description: "Payment transaction ID" },
];

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(sampleTemplates);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    type: "custom" as EmailTemplate["type"],
    htmlContent: "",
    textContent: "",
    isActive: true,
  });

  const handleOpenDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        subject: template.subject,
        type: template.type,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        isActive: template.isActive,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: "",
        subject: "",
        type: "custom",
        htmlContent: "",
        textContent: "",
        isActive: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (editingTemplate) {
      setTemplates(templates.map(t => 
        t.id === editingTemplate.id 
          ? { ...t, ...formData, updatedAt: new Date().toISOString().split('T')[0] }
          : t
      ));
      toast.success("Template updated successfully");
    } else {
      const newTemplate: EmailTemplate = {
        id: Math.max(...templates.map(t => t.id)) + 1,
        ...formData,
        variables: [],
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
      payment_receipt: "bg-blue-100 text-blue-700",
      otp: "bg-purple-100 text-purple-700",
      welcome: "bg-pink-100 text-pink-700",
      custom: "bg-gray-100 text-gray-700",
    };
    return colors[type] || colors.custom;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1E3A5F]">Email Templates</h1>
          <p className="text-gray-600 mt-1">Manage automated email templates for notifications</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-[#F7931E] hover:bg-[#e8850d]">
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

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
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {template.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTypeColor(template.type)}>
                      {templateTypes.find(t => t.value === template.type)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-gray-600">
                    {template.subject}
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
                  <TableCell className="text-sm text-gray-500">
                    {template.updatedAt}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPreviewTemplate(template);
                          setIsPreviewOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Email Template" : "Create Email Template"}
            </DialogTitle>
            <DialogDescription>
              Configure the email template with dynamic variables
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
                  placeholder="e.g., Booking Confirmation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Template Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as EmailTemplate["type"] })}
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
              <Label htmlFor="subject">Email Subject *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., 🙏 Booking Confirmed - {{puja_name}} | B-Seva"
              />
              <p className="text-xs text-gray-500">Use variables like {"{{customer_name}}"} for dynamic content</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="htmlContent">HTML Content *</Label>
              <Textarea
                id="htmlContent"
                value={formData.htmlContent}
                onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                placeholder="<h1>Hello {{customer_name}}</h1>..."
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="textContent">Plain Text Content</Label>
              <Textarea
                id="textContent"
                value={formData.textContent}
                onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                placeholder="Hello {{customer_name}}..."
                rows={4}
              />
              <p className="text-xs text-gray-500">Fallback for email clients that don't support HTML</p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Active (template will be used for sending emails)</Label>
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

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              Subject: {previewTemplate?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-4 bg-white">
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewTemplate?.htmlContent || "" }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
