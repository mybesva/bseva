import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, rupees } from "@/lib/api";
import { toast } from "sonner";

export default function AdminPricingRules() {
  const [locations, setLocations] = useState<any[]>([]);
  const [surges, setSurges] = useState<any[]>([]);
  const [city, setCity] = useState("");
  const [adj, setAdj] = useState("0");
  const [surgeLabel, setSurgeLabel] = useState("Surge");
  const [surgePct, setSurgePct] = useState("0");
  const [surgeFixed, setSurgeFixed] = useState("0");

  async function load() {
    try {
      setLocations(await api<any[]>("/admin/location-prices"));
      setSurges(await api<any[]>("/admin/surge-rules"));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-heading font-bold mb-4">Location & Surge Pricing</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">City / location adjustments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[8rem]">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Hyderabad" />
              </div>
              <div className="space-y-1 w-36">
                <Label>Adjustment ₹</Label>
                <Input type="number" value={adj} onChange={(e) => setAdj(e.target.value)} />
              </div>
              <Button
                className="self-end"
                onClick={async () => {
                  try {
                    await api("/admin/location-prices", {
                      method: "POST",
                      body: JSON.stringify({
                        city: city.trim(),
                        adjustment_paise: Math.round(Number(adj) * 100),
                        active: true,
                      }),
                    });
                    toast.success("Location price added");
                    setCity("");
                    await load();
                  } catch (e: any) {
                    toast.error(e.message);
                  }
                }}
              >
                Add
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Adjustment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.city}</TableCell>
                    <TableCell>{rupees(r.adjustment_paise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Surge rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Label</Label>
                <Input value={surgeLabel} onChange={(e) => setSurgeLabel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>%</Label>
                <Input type="number" value={surgePct} onChange={(e) => setSurgePct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fixed ₹</Label>
                <Input type="number" value={surgeFixed} onChange={(e) => setSurgeFixed(e.target.value)} />
              </div>
            </div>
            <Button
              onClick={async () => {
                try {
                  await api("/admin/surge-rules", {
                    method: "POST",
                    body: JSON.stringify({
                      label: surgeLabel,
                      percent_increase: Number(surgePct),
                      fixed_paise: Math.round(Number(surgeFixed) * 100),
                      active: true,
                      priority: 1,
                    }),
                  });
                  toast.success("Surge rule added");
                  await load();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              Add surge rule
            </Button>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Fixed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surges.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell>{r.percent_increase}</TableCell>
                    <TableCell>{rupees(r.fixed_paise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
