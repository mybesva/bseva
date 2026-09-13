import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api, openPujariDocument, uploadPujariDocument } from "@/lib/api";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";

type DocType = "identity" | "driving_licence" | "certificate" | "supporting";

function fileLabel(path: string) {
  const name = path.split("/").pop() || path;
  const parts = name.split("_");
  return parts.length > 1 ? parts.slice(1).join("_") : name;
}

function docTypeLabel(type: DocType) {
  if (type === "identity") return "Aadhaar";
  if (type === "driving_licence") return "Driving Licence";
  if (type === "certificate") return "Professional Certificate";
  return "Additional Documents";
}

export default function PriestOnboardingPanel() {
  const [docs, setDocs] = useState<any[]>([]);
  const [busyType, setBusyType] = useState<DocType | null>(null);
  const [hasDrivingLicence, setHasDrivingLicence] = useState(false);
  const [savingFlag, setSavingFlag] = useState(false);

  async function loadDocs() {
    setDocs(await api<any[]>("/pujari/documents"));
  }

  async function loadProfileFlag() {
    const p = await api<any>("/pujari/profile");
    const t = String(p.licence_type || "none").toLowerCase();
    setHasDrivingLicence(t === "driving_licence" || t === "cab_commercial");
  }

  useEffect(() => {
    void loadDocs().catch((e) => toast.error(e.message));
    void loadProfileFlag().catch(() => undefined);
  }, []);

  const latestByType = useMemo(() => {
    const map: Partial<Record<DocType, any>> = {};
    for (const d of docs) {
      const t = d.document_type as DocType;
      if (!map[t]) map[t] = d;
    }
    return map;
  }, [docs]);

  async function setDrivingLicenceFlag(on: boolean) {
    setHasDrivingLicence(on);
    setSavingFlag(true);
    try {
      await api("/pujari/profile", {
        method: "PATCH",
        body: JSON.stringify({
          licence_type: on ? "driving_licence" : "none",
          licence_number: on ? undefined : null,
        }),
      });
    } catch (e: any) {
      setHasDrivingLicence(!on);
      toast.error(e.message || "Could not save");
    } finally {
      setSavingFlag(false);
    }
  }

  async function handleUpload(type: DocType, file: File) {
    setBusyType(type);
    try {
      await uploadPujariDocument(file, type);
      toast.success(`${docTypeLabel(type)} uploaded`);
      await loadDocs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyType(null);
    }
  }

  function renderSlot(opts: {
    type: DocType;
    label: string;
    hint: string;
    required: boolean;
  }) {
    const uploaded = latestByType[opts.type];
    const busy = busyType === opts.type;
    return (
      <div key={opts.type} className="rounded-md border p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-medium">
              {opts.label}
              {opts.required ? (
                <span className="text-destructive"> *</span>
              ) : (
                <span className="text-muted-foreground font-normal"> (optional)</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{opts.hint}</p>
          </div>
          {uploaded ? <Badge variant="secondary">{uploaded.status || "uploaded"}</Badge> : null}
        </div>
        {uploaded ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground truncate max-w-[220px]">
              {fileLabel(uploaded.storage_path)}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openPujariDocument(uploaded.id).catch((e) => toast.error(e.message))}
              >
                View
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleUpload(opts.type, file);
                  }}
                />
                <Button type="button" size="sm" variant="secondary" disabled={busy} asChild>
                  <span>{busy ? "Uploading…" : "Replace"}</span>
                </Button>
              </label>
            </div>
          </div>
        ) : (
          <label className="inline-flex">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleUpload(opts.type, file);
              }}
            />
            <Button type="button" size="sm" disabled={busy} asChild>
              <span className="gap-2">
                <Upload size={14} />
                {busy ? "Uploading…" : "Upload file"}
              </span>
            </Button>
          </label>
        )}
        {opts.required && !uploaded ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Upload required before you can submit for verification.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="border-border mb-8">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <FileText size={18} /> Certificates & Aadhaar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Aadhaar is required. If you have a driving licence, tick the box below and upload the document.
        </p>

        {renderSlot({
          type: "identity",
          label: "Aadhaar",
          hint: "Upload your Aadhaar card (PDF or image).",
          required: true,
        })}

        <div className="rounded-md border p-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              className="mt-0.5"
              checked={hasDrivingLicence}
              disabled={savingFlag}
              onCheckedChange={(v) => void setDrivingLicenceFlag(!!v)}
            />
            <span>
              <span className="font-medium">I have a driving licence</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tick this if you hold a driving licence. You must then upload it below.
              </p>
            </span>
          </label>
        </div>

        {hasDrivingLicence
          ? renderSlot({
              type: "driving_licence",
              label: "Driving Licence",
              hint: "Upload your driving licence (PDF or image).",
              required: true,
            })
          : null}

        {renderSlot({
          type: "certificate",
          label: "Professional Certificate",
          hint: "Upload your main pujari qualification certificate (PDF or image).",
          required: false,
        })}

        {renderSlot({
          type: "supporting",
          label: "Additional Documents",
          hint: "Upload additional documents (PDF or image).",
          required: false,
        })}
      </CardContent>
    </Card>
  );
}
