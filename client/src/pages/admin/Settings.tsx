import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Globe, CreditCard, Shield, IndianRupee } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n/I18nProvider";

export default function Settings() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: settings } = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: async () => {
      await utils.settings.get.invalidate();
      toast.success("Demo settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const [gstPercent, setGstPercent] = useState("18");
  const [peakDayFee, setPeakDayFee] = useState("500");
  const [platformFeePercent, setPlatformFeePercent] = useState("15");
  const [virtualPujaEnabled, setVirtualPujaEnabled] = useState(true);
  const [defaultCalendar, setDefaultCalendar] = useState("north");
  const [peakDays, setPeakDays] = useState("Saturday,Sunday,Ekadashi,Purnima");

  useEffect(() => {
    if (!settings) return;
    setGstPercent(settings.gstPercent || "18");
    setPeakDayFee(String(Number(settings.peakDayFee || 50000) / 100));
    setPlatformFeePercent(settings.platformFeePercent || "15");
    setVirtualPujaEnabled(settings.virtualPujaEnabled !== "false");
    setDefaultCalendar(settings.defaultCalendar || "north");
    setPeakDays(settings.peakDays || "Saturday,Sunday,Ekadashi,Purnima");
  }, [settings]);

  const savePricing = () => {
    updateSettings.mutate({
      gstPercent,
      peakDayFee: String(Math.round(Number(peakDayFee) * 100)),
      platformFeePercent,
      virtualPujaEnabled: String(virtualPujaEnabled),
      defaultCalendar,
      peakDays,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.settings")}</h1>
          <p className="text-muted-foreground">Configure GST, peak fees, pricing & calendar (demo)</p>
        </div>

        <Tabs defaultValue="pricing" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="pricing" className="flex items-center gap-2">
              <IndianRupee size={16} /> {t("admin.pricing")}
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Globe size={16} /> General
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard size={16} /> Payments
            </TabsTrigger>
            <TabsTrigger value="commission" className="flex items-center gap-2">
              <Shield size={16} /> Commission
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle>Billing & Calendar Controls</CardTitle>
                <CardDescription>
                  Standard & Premium prices live on each service. GST and peak-day fee apply at booking.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>{t("admin.gst")} (%)</Label>
                    <Input
                      type="number"
                      value={gstPercent}
                      onChange={(e) => setGstPercent(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("admin.peakFee")} (₹)</Label>
                    <Input
                      type="number"
                      value={peakDayFee}
                      onChange={(e) => setPeakDayFee(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Example: Standard ₹2,000 + Peak ₹{peakDayFee} + GST {gstPercent}%
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Platform Fee (%)</Label>
                    <Input
                      type="number"
                      value={platformFeePercent}
                      onChange={(e) => setPlatformFeePercent(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Calendar</Label>
                    <Select value={defaultCalendar} onValueChange={setDefaultCalendar}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="north">{t("calendar.north")}</SelectItem>
                        <SelectItem value="south">{t("calendar.south")}</SelectItem>
                        <SelectItem value="lunar">{t("calendar.lunar")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Peak Day Labels (demo)</Label>
                  <Input value={peakDays} onChange={(e) => setPeakDays(e.target.value)} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>Virtual Puja Availability</Label>
                    <p className="text-xs text-muted-foreground">Allow customers to book virtual mode</p>
                  </div>
                  <Switch checked={virtualPujaEnabled} onCheckedChange={setVirtualPujaEnabled} />
                </div>

                <div className="rounded-lg bg-orange-50 border border-orange-100 p-4 text-sm space-y-1">
                  <p className="font-medium">Sample bill preview</p>
                  <p>Service (Standard): ₹2,000</p>
                  <p>Peak Day Fee: ₹{Number(peakDayFee).toLocaleString("en-IN")}</p>
                  <p>Subtotal: ₹{(2000 + Number(peakDayFee || 0)).toLocaleString("en-IN")}</p>
                  <p>
                    GST {gstPercent}%: ₹
                    {Math.floor(((2000 + Number(peakDayFee || 0)) * Number(gstPercent || 0)) / 100).toLocaleString(
                      "en-IN"
                    )}
                  </p>
                  <p className="font-bold">
                    Total: ₹
                    {(
                      2000 +
                      Number(peakDayFee || 0) +
                      Math.floor(((2000 + Number(peakDayFee || 0)) * Number(gstPercent || 0)) / 100)
                    ).toLocaleString("en-IN")}
                  </p>
                </div>

                <Button onClick={savePricing} disabled={updateSettings.isPending} className="gap-2">
                  <Save size={16} /> {t("common.save")} Pricing Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
                <CardDescription>Demo site metadata (local only)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Site Name</Label>
                  <Input defaultValue="B-Seva" />
                </div>
                <Button
                  onClick={() => toast.success("General settings saved (demo)")}
                  className="gap-2"
                >
                  <Save size={16} /> Save
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
                <CardDescription>Demo wallets only — no real gateways</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Customer/Pujari wallets are mock. Booking payment deducts from customer wallet and credits pujari.
                </p>
                <Button onClick={() => toast.success("Payment settings noted (demo)")}>Save</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commission">
            <Card>
              <CardHeader>
                <CardTitle>Commission</CardTitle>
                <CardDescription>Uses platform fee % from Pricing tab</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">Current platform fee: {platformFeePercent}%</p>
                <Button className="mt-4" onClick={savePricing}>
                  Sync from Pricing
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
