import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, FileUp, MapPin } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const LOCATION_PRESETS = [
  { label: "Jayanagar, Bangalore", lat: 12.9308, lng: 77.5838 },
  { label: "Indiranagar, Bangalore", lat: 12.9784, lng: 77.6408 },
  { label: "Yelahanka, Bangalore", lat: 13.1007, lng: 77.5963 },
  { label: "Koramangala, Bangalore", lat: 12.9352, lng: 77.6245 },
];

export default function PriestOnboardingPanel({ onComplete }: { onComplete?: () => void }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: onboarding, isLoading } = trpc.priests.onboarding.useQuery();
  const save = trpc.priests.completeOnboarding.useMutation({
    onSuccess: async () => {
      await utils.priests.onboarding.invalidate();
      toast.success("Profile & documents saved (demo)");
      onComplete?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const [bio, setBio] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [locationCity, setLocationCity] = useState("Bangalore");
  const [locationArea, setLocationArea] = useState("Jayanagar");
  const [pincode, setPincode] = useState("560041");
  const [backupPhone, setBackupPhone] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [lat, setLat] = useState(12.9308);
  const [lng, setLng] = useState(77.5838);
  const [docName, setDocName] = useState("");

  if (isLoading) return null;
  if (onboarding?.profileStatus === "complete") return null;

  const steps = onboarding?.completionSteps;

  return (
    <Card className="border-orange-200 mb-8">
      <CardHeader>
        <CardTitle className="font-heading text-xl">{t("priest.documents")} / Profile Completion</CardTitle>
        <CardDescription>
          Complete your profile to start receiving bookings. Demo uploads & map — no real KYC.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge className="bg-green-100 text-green-800">{t("priest.accountCreated")}</Badge>
          <Badge className={steps?.profileIncomplete ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
            {steps?.profileIncomplete ? t("priest.profileIncomplete") : "Profile Filled"}
          </Badge>
          <Badge className={steps?.documentsAdded ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
            {steps?.documentsAdded ? t("priest.documentsAdded") : "Documents Pending"}
          </Badge>
          <Badge className={steps?.profileComplete ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}>
            {t("priest.profileComplete")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Bio / Profile</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Years of experience, traditions..." />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Textarea value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} placeholder="Full residential address" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={locationCity} onChange={(e) => setLocationCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Area</Label>
            <Input value={locationArea} onChange={(e) => setLocationArea(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Pincode</Label>
            <Input value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <MapPin size={14} /> Google Maps-style location (demo)
          </Label>
          <Select
            onValueChange={(v) => {
              const preset = LOCATION_PRESETS.find((p) => p.label === v);
              if (preset) {
                setLat(preset.lat);
                setLng(preset.lng);
                setLocationArea(preset.label.split(",")[0]);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a demo map pin" />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_PRESETS.map((p) => (
                <SelectItem key={p.label} value={p.label}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Mock pin: {lat.toFixed(4)}, {lng.toFixed(4)}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Backup Phone</Label>
          <Input value={backupPhone} onChange={(e) => setBackupPhone(e.target.value)} placeholder="10-digit backup" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Bank Account</Label>
            <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="XXXX1234" />
          </div>
          <div className="space-y-2">
            <Label>IFSC</Label>
            <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} placeholder="HDFC0001234" />
          </div>
          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <FileUp size={14} /> Identity Document (mock upload)
          </Label>
          <Input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setDocName(f.name);
                toast.success(`Demo upload: ${f.name}`);
              }
            }}
          />
          {docName && (
            <p className="text-xs text-green-700 flex items-center gap-1">
              <CheckCircle2 size={12} /> {docName} ready
            </p>
          )}
        </div>

        <Button
          className="bg-primary"
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              bio: bio || "Dedicated Vedic priest",
              fullAddress: fullAddress || `${locationArea}, ${locationCity}`,
              locationCity,
              locationArea,
              pincode,
              backupPhone: backupPhone || undefined,
              bankAccount: bankAccount || "XXXXXXXX1234",
              bankIfsc: bankIfsc || "HDFC0000001",
              bankName: bankName || "Demo Bank",
              latitude: lat,
              longitude: lng,
              documentFileName: docName || "aadhaar-demo.pdf",
              profileStatus: "complete",
            })
          }
        >
          {save.isPending ? t("common.loading") : t("common.save") + " & Complete Profile"}
        </Button>
      </CardContent>
    </Card>
  );
}
