import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Globe, Bell, CreditCard, Shield, Palette } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const [generalSettings, setGeneralSettings] = useState({
    siteName: "B-Seva",
    tagline: "Traditional Indian Spiritual Services",
    supportEmail: "support@bseva.com",
    supportPhone: "+91 98765 43210",
    address: "123 Temple Street, Bangalore, Karnataka 560001",
    timezone: "Asia/Kolkata",
    currency: "INR",
    language: "en",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: true,
    bookingConfirmation: true,
    paymentReceipt: true,
    bookingReminder: true,
    reviewRequest: true,
    marketingEmails: false,
  });

  const [paymentSettings, setPaymentSettings] = useState({
    razorpayEnabled: true,
    razorpayKeyId: "rzp_test_xxxxx",
    upiEnabled: true,
    upiId: "bseva@upi",
    codEnabled: true,
    minBookingAmount: 500,
    advancePaymentPercent: 20,
  });

  const [commissionSettings, setCommissionSettings] = useState({
    defaultCommission: 15,
    premiumCommission: 12,
    newPriestCommission: 20,
    referralBonus: 100,
  });

  const handleSaveGeneral = () => {
    toast.success("General settings saved successfully");
  };

  const handleSaveNotifications = () => {
    toast.success("Notification settings saved successfully");
  };

  const handleSavePayment = () => {
    toast.success("Payment settings saved successfully");
  };

  const handleSaveCommission = () => {
    toast.success("Commission settings saved successfully");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure platform settings and preferences</p>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Globe size={16} /> General
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell size={16} /> Notifications
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard size={16} /> Payments
            </TabsTrigger>
            <TabsTrigger value="commission" className="flex items-center gap-2">
              <Shield size={16} /> Commission
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette size={16} /> Appearance
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic platform configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Site Name</Label>
                    <Input
                      value={generalSettings.siteName}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, siteName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tagline</Label>
                    <Input
                      value={generalSettings.tagline}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, tagline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Email</Label>
                    <Input
                      type="email"
                      value={generalSettings.supportEmail}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Phone</Label>
                    <Input
                      value={generalSettings.supportPhone}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, supportPhone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address</Label>
                    <Textarea
                      value={generalSettings.address}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, address: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={generalSettings.timezone}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, timezone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                        <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Default Language</Label>
                    <Select
                      value={generalSettings.language}
                      onValueChange={(value) => setGeneralSettings({ ...generalSettings, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                        <SelectItem value="kn">Kannada</SelectItem>
                        <SelectItem value="ta">Tamil</SelectItem>
                        <SelectItem value="te">Telugu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleSaveGeneral}>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure how notifications are sent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Notification Channels</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Send emails to users</p>
                      </div>
                      <Switch
                        checked={notificationSettings.emailEnabled}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, emailEnabled: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>SMS Notifications</Label>
                        <p className="text-sm text-muted-foreground">Send SMS to users</p>
                      </div>
                      <Switch
                        checked={notificationSettings.smsEnabled}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, smsEnabled: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">Send push to app</p>
                      </div>
                      <Switch
                        checked={notificationSettings.pushEnabled}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, pushEnabled: checked })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Notification Types</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <Label>Booking Confirmation</Label>
                      <Switch
                        checked={notificationSettings.bookingConfirmation}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, bookingConfirmation: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <Label>Payment Receipt</Label>
                      <Switch
                        checked={notificationSettings.paymentReceipt}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, paymentReceipt: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <Label>Booking Reminder</Label>
                      <Switch
                        checked={notificationSettings.bookingReminder}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, bookingReminder: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <Label>Review Request</Label>
                      <Switch
                        checked={notificationSettings.reviewRequest}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, reviewRequest: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <Label>Marketing Emails</Label>
                      <Switch
                        checked={notificationSettings.marketingEmails}
                        onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, marketingEmails: checked })}
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveNotifications}>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Settings */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
                <CardDescription>Configure payment gateways and options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Payment Gateways</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Razorpay</Label>
                        <Switch
                          checked={paymentSettings.razorpayEnabled}
                          onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, razorpayEnabled: checked })}
                        />
                      </div>
                      {paymentSettings.razorpayEnabled && (
                        <div className="space-y-2">
                          <Label className="text-sm">Key ID</Label>
                          <Input
                            value={paymentSettings.razorpayKeyId}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, razorpayKeyId: e.target.value })}
                            placeholder="rzp_live_xxxxx"
                          />
                        </div>
                      )}
                    </div>
                    <div className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>UPI</Label>
                        <Switch
                          checked={paymentSettings.upiEnabled}
                          onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, upiEnabled: checked })}
                        />
                      </div>
                      {paymentSettings.upiEnabled && (
                        <div className="space-y-2">
                          <Label className="text-sm">UPI ID</Label>
                          <Input
                            value={paymentSettings.upiId}
                            onChange={(e) => setPaymentSettings({ ...paymentSettings, upiId: e.target.value })}
                            placeholder="yourname@upi"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Cash on Delivery</Label>
                      <p className="text-sm text-muted-foreground">Allow payment after service</p>
                    </div>
                    <Switch
                      checked={paymentSettings.codEnabled}
                      onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, codEnabled: checked })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Minimum Booking Amount (₹)</Label>
                    <Input
                      type="number"
                      value={paymentSettings.minBookingAmount}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, minBookingAmount: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Advance Payment (%)</Label>
                    <Input
                      type="number"
                      value={paymentSettings.advancePaymentPercent}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, advancePaymentPercent: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <Button onClick={handleSavePayment}>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commission Settings */}
          <TabsContent value="commission">
            <Card>
              <CardHeader>
                <CardTitle>Commission Settings</CardTitle>
                <CardDescription>Configure platform commission rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Default Commission (%)</Label>
                    <Input
                      type="number"
                      value={commissionSettings.defaultCommission}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, defaultCommission: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-sm text-muted-foreground">Applied to regular priests</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Premium Priest Commission (%)</Label>
                    <Input
                      type="number"
                      value={commissionSettings.premiumCommission}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, premiumCommission: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-sm text-muted-foreground">Applied to verified premium priests</p>
                  </div>
                  <div className="space-y-2">
                    <Label>New Priest Commission (%)</Label>
                    <Input
                      type="number"
                      value={commissionSettings.newPriestCommission}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, newPriestCommission: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-sm text-muted-foreground">Applied during first 3 months</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Referral Bonus (₹)</Label>
                    <Input
                      type="number"
                      value={commissionSettings.referralBonus}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, referralBonus: parseInt(e.target.value) || 0 })}
                    />
                    <p className="text-sm text-muted-foreground">Bonus for successful referrals</p>
                  </div>
                </div>

                <Button onClick={handleSaveCommission}>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Settings */}
          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input type="color" defaultValue="#1e3a5f" className="w-16 h-10" />
                      <Input defaultValue="#1e3a5f" className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <Input type="color" defaultValue="#f5a623" className="w-16 h-10" />
                      <Input defaultValue="#f5a623" className="flex-1" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                      <img src="/images/bseva-logo.png" alt="Logo" className="max-w-full max-h-full" />
                    </div>
                    <Button variant="outline">Upload New Logo</Button>
                  </div>
                </div>

                <Button>
                  <Save size={16} className="mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
