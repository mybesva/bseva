import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { toast } from "sonner";

type Props = {
  onSave: (file: File) => void | Promise<void>;
  /** Existing signature — shown in the same single box until redrawn */
  existingUrl?: string | null;
};

function canvasHasInk(canvas: HTMLCanvasElement, minPixels = 40): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let ink = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 10) {
      ink += 1;
      if (ink > minPixels) return true;
    }
  }
  return false;
}

export default function SignaturePad({ onSave, existingUrl }: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"preview" | "draw">(existingUrl ? "preview" : "draw");

  useEffect(() => {
    if (existingUrl) {
      setMode("preview");
      setHasInk(false);
    } else {
      setMode("draw");
    }
  }, [existingUrl]);

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  function startDraw() {
    setMode("draw");
    // Clear after canvas mounts (preview → draw swap)
    requestAnimationFrame(() => clearCanvas());
  }

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    const src = "touches" in e ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1E3A5F";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  }

  function end() {
    drawing.current = false;
  }

  async function save() {
    if (mode === "preview" || !hasInk) {
      toast.error("Please draw your signature before saving");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !canvasHasInk(canvas)) {
      toast.error("Please draw a clear signature before saving");
      setHasInk(false);
      return;
    }

    setSaving(true);
    try {
      // Flatten onto white so stored PNG is never a blank transparent image
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ectx = exportCanvas.getContext("2d");
      if (!ectx) {
        toast.error("Could not capture signature");
        return;
      }
      ectx.fillStyle = "#ffffff";
      ectx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      ectx.drawImage(canvas, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) =>
        exportCanvas.toBlob(resolve, "image/png"),
      );
      if (!blob || blob.size < 200) {
        toast.error("Please draw a clear signature before saving");
        return;
      }
      await onSave(new File([blob], "signature.png", { type: "image/png" }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 max-w-lg">
      <div className="w-full h-40 border rounded-md bg-white overflow-hidden">
        {mode === "preview" && existingUrl ? (
          <img src={existingUrl} alt="Saved signature" className="w-full h-full object-contain bg-white" />
        ) : (
          <canvas
            ref={canvasRef}
            width={480}
            height={160}
            className="w-full h-full touch-none block bg-white"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={startDraw}>
          {t("pujari.sign.clear")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={startDraw}>
          {t("pujari.sign.redraw")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving || !hasInk || mode === "preview"}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : t("pujari.sign.save")}
        </Button>
      </div>
    </div>
  );
}
