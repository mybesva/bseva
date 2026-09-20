import { useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { AppText, PrimaryButton } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";

const PAD_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;height:100%;background:#fff;}
  canvas{width:100%;height:100%;display:block;touch-action:none;}
</style>
</head><body>
<canvas id="c"></canvas>
<script>
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  function size() {
    const r = window.devicePixelRatio || 1;
    c.width = c.clientWidth * r;
    c.height = c.clientHeight * r;
    ctx.setTransform(r,0,0,r,0,0);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  size();
  window.addEventListener('resize', size);
  let drawing = false, ink = 0;
  function pos(e) {
    const t = e.touches ? e.touches[0] : e;
    const r = c.getBoundingClientRect();
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  function start(e) { e.preventDefault(); drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ink++;
  }
  function end() { drawing = false; }
  c.addEventListener('pointerdown', start);
  c.addEventListener('pointermove', move);
  c.addEventListener('pointerup', end);
  c.addEventListener('pointerleave', end);
  c.addEventListener('touchstart', start, {passive:false});
  c.addEventListener('touchmove', move, {passive:false});
  c.addEventListener('touchend', end);
  window.clearPad = function() { ctx.clearRect(0,0,c.clientWidth,c.clientHeight); ink = 0; };
  window.exportPad = function() {
    if (ink < 8) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'empty' }));
      return;
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({ dataUrl: c.toDataURL('image/png') }));
  };
</script>
</body></html>`;

function dataUrlToFile(dataUrl: string) {
  return {
    uri: dataUrl,
    name: "signature.png",
    type: "image/png",
  };
}

export function SignaturePad({
  existingUri,
  onSave,
  busy,
}: {
  existingUri?: string | null;
  onSave: (file: { uri: string; name: string; type: string }) => Promise<void>;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<WebView>(null);
  const source = useMemo(() => ({ html: PAD_HTML }), []);
  return (
    <View style={{ gap: 8 }}>
      {existingUri ? <AppText variant="small">{t("mobile.signature")}</AppText> : null}
      <View style={{ height: 160, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff" }}>
        <WebView
          ref={ref}
          originWhitelist={["*"]}
          source={source}
          javaScriptEnabled
          onMessage={async (e) => {
            try {
              const payload = JSON.parse(e.nativeEvent.data) as { dataUrl?: string; error?: string };
              if (payload.error === "empty") return;
              if (payload.dataUrl) await onSave(dataUrlToFile(payload.dataUrl));
            } catch {
              /* ignore */
            }
          }}
          style={{ flex: 1 }}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton title={t("common.cancel")} variant="outline" onPress={() => ref.current?.injectJavaScript("window.clearPad && window.clearPad(); true;")} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton title={busy ? t("mobile.saving") : t("mobile.save")} loading={busy} onPress={() => ref.current?.injectJavaScript("window.exportPad && window.exportPad(); true;")} />
        </View>
      </View>
    </View>
  );
}
