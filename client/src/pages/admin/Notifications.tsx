import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Search, Plus, Edit, Bell, Mail, MessageSquare, Send, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Sample notification templates
const notificationTemplates = [
  {
    id: 1,
    name: "Booking Confirmation",
    type: "email",
    subject: "Your Puja Booking is Confirmed - {{booking_id}}",
    body: "Dear {{customer_name}},\n\nYour booking for {{puja_type}} has been confirmed.\n\nDate: {{date}}\nTime: {{time}}\nPriest: {{priest_name}}\n\nThank you for choosing B-Seva.",
    status: "active",
  },
  {
    id: 2,
    name: "Payment Receipt",
    type: "email",
    subject: "Payment Received - ₹{{amount}}",
    body: "Dear {{customer_name}},\n\nWe have received your payment of ₹{{amount}} for booking {{booking_id}}.\n\nTransaction ID: {{transaction_id}}\n\nThank you!",
    status: "active",
  },
  {
    id: 3,
    name: "Booking Reminder",
    type: "sms",
    subject: "",
    body: "Reminder: Your {{puja_type}} is scheduled for tomorrow at {{time}}. Priest {{priest_name}} will arrive at your location. - B-Seva",
    status: "active",
  },
  {
    id: 4,
    name: "Priest Assignment",
    type: "push",
    subject: "New Booking Assigned",
    body: "You have been assigned a new booking for {{puja_type}} on {{date}} at {{time}}. Location: {{location}}",
    status: "active",
  },
  {
    id: 5,
    name: "Review Request",
    type: "email",
    subject: "How was your Puja experience?",
    body: "Dear {{customer_name}},\n\nWe hope your {{puja_type}} was a blessed experience. Please take a moment to share your feedback.\n\n[Rate Your Experience]\n\nYour feedback helps us serve you better.",
    status: "active",
  },
];

// Sample sent notifications
const sentNotifications = [
  {
    id: 1,
    template: "Booking Confirmation",
    recipient: "rajesh.kumar@email.com",
    type: "email",
    sentAt: "2024-12-16 10:30 AM",
    status: "delivered",
  },
  {
    id: 2,
    template: "Payment Receipt",
    recipient: "priya.patel@email.com",
    type: "email",
    sentAt: "2024-12-16 09:45 AM",
    status: "delivered",
  },
  {
    id: 3,
    template: "Booking Reminder",
    recipient: "+91 98765 43210",
    type: "sms",
    sentAt: "2024-12-15 06:00 PM",
    status: "delivered",
  },
  {
    id: 4,
    template: "Priest Assignment",
    recipient: "Pandit Sharma",
    type: "push",
    sentAt: "2024-12-15 02:30 PM",
    status: "read",
  },
  {
    id: 5,
    template: "Review Request",
    recipient: "amit.singh@email.com",
    type: "email",
    sentAt: "2024-12-14 11:00 AM",
    status: "failed",
  },
];

const typeIcons: Record<string, React.ReactNode> = {
  email: <Mail size={14} />,
  sms: <MessageSquare size={14} />,
  push: <Bell size={14} />,
};

const typeColors: Record<string, string> = {
  email: "bg-blue-100 text-blue-800",
  sms: "bg-green-100 text-green-800",
  push: "bg-purple-100 text-purple-800",
};

const statusColors: Record<string, string> = {
  delivered: "bg-green-100 text-green-800",
  read: "bg-blue-100 text-blue-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
};

export default function Notifications() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isBroadcastDialogOpen, setIsBroadcastDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<typeof notificationTemplates[0] | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: "",
    type: "email",
    subject: "",
    body: "",
  });

  const [broadcastForm, setBroadcastForm] = useState({
    audience: "all_customers",
    type: "email",
    subject: "",
    message: "",
  });

  const handleEditTemplate = (template: typeof notificationTemplates[0]) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      type: template.type,
      subject: template.subject,
      body: template.body,
    });
    setIsTemplateDialogOpen(true);
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: "",
      type: "email",
      subject: "",
      body: "",
    });
    setIsTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name || !templateForm.body) {
      toast.error("Please fill in all required fields");
      return;
    }
    toast.success(editingTemplate ? "Template updated successfully" : "Template created successfully");
    setIsTemplateDialogOpen(false);
  };

  const handleSendBroadcast = () => {
    if (!broadcastForm.message) {
      toast.error("Please enter a message");
      return;
    }
    toast.success("Broadcast notification sent successfully");
    setIsBroadcastDialogOpen(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground">Manage templates and send notifications</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsBroadcastDialogOpen(true)}>
              <Send size={16} className="mr-2" />
              Broadcast
            </Button>
            <Button onClick={handleAddTemplate}>
              <Plus size={16} className="mr-2" />
              New Template
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail size={16} /> Emails Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <div className="text-sm text-muted-foreground">This month</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare size={16} /> SMS Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">567</div>
              <div className="text-sm text-muted-foreground">This month</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Bell size={16} /> Push Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">890</div>
              <div className="text-sm text-muted-foreground">This month</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Delivery Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">98.5%</div>
              <div className="text-sm text-muted-foreground">Average</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="history">Sent History</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Notification Templates</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                      placeholder="Search templates..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notificationTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge className={typeColors[template.type]}>
                            <span className="flex items-center gap-1">
                              {typeIcons[template.type]}
                              {template.type.toUpperCase()}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {template.subject || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[template.status]}>
                            {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Sent Notifications</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentNotifications.map((notification) => (
                      <TableRow key={notification.id}>
                        <TableCell className="font-medium">{notification.template}</TableCell>
                        <TableCell>{notification.recipient}</TableCell>
                        <TableCell>
                          <Badge className={typeColors[notification.type]}>
                            <span className="flex items-center gap-1">
                              {typeIcons[notification.type]}
                              {notification.type.toUpperCase()}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>{notification.sentAt}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[notification.status]}>
                            {notification.status.charAt(0).toUpperCase() + notification.status.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Template Dialog */}
        <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="e.g., Booking Confirmation"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={templateForm.type}
                    onValueChange={(value) => setTemplateForm({ ...templateForm, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="push">Push Notification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {templateForm.type !== "sms" && (
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    placeholder="Email subject line"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Message Body</Label>
                <Textarea
                  value={templateForm.body}
                  onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                  placeholder="Use {{variable}} for dynamic content"
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {"{{customer_name}}"}, {"{{booking_id}}"}, {"{{puja_type}}"}, {"{{date}}"}, {"{{time}}"}, {"{{priest_name}}"}, {"{{amount}}"}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate}>
                {editingTemplate ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Broadcast Dialog */}
        <Dialog open={isBroadcastDialogOpen} onOpenChange={setIsBroadcastDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Send Broadcast Notification</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select
                    value={broadcastForm.audience}
                    onValueChange={(value) => setBroadcastForm({ ...broadcastForm, audience: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_customers">All Customers</SelectItem>
                      <SelectItem value="all_priests">All Priests</SelectItem>
                      <SelectItem value="active_customers">Active Customers</SelectItem>
                      <SelectItem value="everyone">Everyone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={broadcastForm.type}
                    onValueChange={(value) => setBroadcastForm({ ...broadcastForm, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="push">Push Notification</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {broadcastForm.type === "email" && (
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={broadcastForm.subject}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
                    placeholder="Email subject"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                  placeholder="Enter your broadcast message..."
                  rows={5}
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users size={16} />
                <span>This will be sent to approximately 1,234 recipients</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBroadcastDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendBroadcast}>
                <Send size={16} className="mr-2" />
                Send Broadcast
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
