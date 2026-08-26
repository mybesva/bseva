import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, openPujariDocument, uploadPujariDocument } from "@/lib/api";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";

const DOC_SLOTS = [
  {
    type: "certificate",
    label: "Professional Certificate",
    hint: "Upload your main pujari qualification certificate (PDF or image).",
  },
  {
    type: "identity",
    label: "Aadhar",
    hint: "Upload your Aadhar card (PDF or image).",
  },
  {
    type: "supporting",
    label: "Supporting Certificate",
    hint: "Upload an additional supporting certificate (PDF or image).",
  },
] as const;

type DocType = (typeof DOC_SLOTS)[number]["type"];

function fileLabel(path: string) {
  const name = path.split("/").pop() || path;
  const parts = name.split("_");
  return parts.length > 1 ? parts.slice(1).join("_") : name;
}

function docTypeLabel(type: string) {
  return DOC_SLOTS.find((s) => s.type === type)?.label || type;
}

export default function PriestOnboardingPanel() {
  const [docs, setDocs] = useState<any[]>([]);
  const [busyType, setBusyType] = useState<DocType | null>(null);

  async function load() {
    setDocs(await api<any[]>("/pujari/documents"));
  }

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, []);

  const latestByType = useMemo(() => {
    const map: Partial<Record<DocType, any>> = {};
    for (const d of docs) {
      const t = d.document_type as DocType;
      if (!map[t]) map[t] = d;
    }
    return map;
  }, [docs]);

  async function handleUpload(type: DocType, file: File) {
    setBusyType(type);
    try {
      await uploadPujariDocument(file, type);
      toast.success(`${docTypeLabel(type)} uploaded`);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyType(null);
    }
  }

  return (
    <Card className="border-border mb-8">
      <CardHeader>
        <CardTitle className="font-heading text-xl flex items-center gap-2">
          <FileText size={18} /> Certificates & Aadhar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Upload all three documents below. Each file can be a PDF or image.
        </p>
        {DOC_SLOTS.map((slot) => {
          const uploaded = latestByType[slot.type];
          const busy = busyType === slot.type;
          return (
            <div key={slot.type} className="rounded-md border p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{slot.label}</div>
                  <p className="text-xs text-muted-foreground mt-1">{slot.hint}</p>
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
                          if (file) void handleUpload(slot.type, file);
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
                      if (file) void handleUpload(slot.type, file);
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
