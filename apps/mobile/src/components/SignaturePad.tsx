import * as FileSystem from "expo-file-system";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, Text, View, type ImageSourcePropType } from "react-native";
import { WebView } from "react-native-webview";
import { radius } from "@bseva/tokens";
import { AppText } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";
import { useI18n } from "@/providers/I18nProvider";

const PAD_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#fff;touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}
  canvas{width:100%;height:100%;display:block;touch-action:none;background:#fff;}
</style>
</head><body>
<canvas id="c"></canvas>
<script>
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  let drawing = false;
  let ink = 0;
  let saved = null;

  function post(obj) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj));
  }

  function pos(e) {
    const t = e.touches && e.touches[0]
      ? e.touches[0]
      : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : e);
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    return { x: (t.clientX - r.left) * scaleX, y: (t.clientY - r.top) * scaleY };
  }

  function strokeStyle() {
    const r = window.devicePixelRatio || 1;
    ctx.strokeStyle = '#1E3A5F';
    ctx.lineWidth = 2.5 * r;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function size() {
    const r = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    if (ink > 0) saved = c.toDataURL('image/png');
    c.width = Math.floor(w * r);
    c.height = Math.floor(h * r);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    strokeStyle();
    if (saved) {
      const img = new Image();
      img.onload = function() {
        ctx.drawImage(img, 0, 0, c.width, c.height);
      };
      img.src = saved;
    }
  }

  function start(e) {
    e.preventDefault();
    e.stopPropagation();
    drawing = true;
    post({ type: 'drawing', active: true });
    strokeStyle();
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    e.stopPropagation();
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ink++;
    if (ink % 4 === 0) post({ type: 'ink', hasInk: true });
  }

  function end(e) {
    if (!drawing) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    drawing = false;
    post({ type: 'drawing', active: false, hasInk: ink > 4 });
  }

  function bind() {
    c.addEventListener('pointerdown', start, { passive: false });
    c.addEventListener('pointermove', move, { passive: false });
    c.addEventListener('pointerup', end, { passive: false });
    c.addEventListener('pointercancel', end, { passive: false });
    c.addEventListener('pointerleave', end, { passive: false });
  }

  bind();
  size();
  window.addEventListener('resize', size);

  function canvasHasInk() {
    if (ink < 8) return false;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let pixels = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 10) {
        pixels++;
        if (pixels > 40) return true;
      }
    }
    return false;
  }

  window.clearPad = function() {
    ctx.clearRect(0, 0, c.width, c.height);
    ink = 0;
    saved = null;
    post({ type: 'ink', hasInk: false });
  };

  window.exportPad = function() {
    if (!canvasHasInk()) {
      post({ type: 'error', code: 'empty' });
      return;
    }
    const tmp = document.createElement('canvas');
    tmp.width = c.width;
    tmp.height = c.height;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = '#ffffff';
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(c, 0, 0);
    post({ type: 'export', dataUrl: tmp.toDataURL('image/png') });
  };
</script>
</body></html>`;

async function dataUrlToFile(dataUrl: string) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const path = `${FileSystem.cacheDirectory}signature-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    uri: path,
    name: "signature.png",
    type: "image/png",
  };
}

function existingImageUri(source?: ImageSourcePropType | null): string | null {
  if (!source) return null;
  if (typeof source === "number") return null;
  if (Array.isArray(source)) return source[0]?.uri ?? null;
  return source.uri ?? null;
}

function ActionButton({
  title,
  onPress,
  disabled,
  outline,
  primary,
}: {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  outline?: boolean;
  primary?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 36,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: radius.md,
        borderWidth: outline ? 1.5 : 0,
        borderColor: colors.primary,
        backgroundColor: primary ? colors.primary : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: primary ? colors.primaryForeground : colors.primary,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function SignaturePad({
  existingUri,
  onSave,
  busy,
  onDrawingChange,
}: {
  existingUri?: ImageSourcePropType | null;
  onSave: (file: { uri: string; name: string; type: string }) => Promise<void>;
  busy?: boolean;
  onDrawingChange?: (drawing: boolean) => void;
}) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const ref = useRef<WebView>(null);
  const savingRef = useRef(false);
  const source = useMemo(() => ({ html: PAD_HTML }), []);
  const previewUri = existingImageUri(existingUri);
  const [mode, setMode] = useState<"preview" | "draw">(previewUri ? "preview" : "draw");
  const [hasInk, setHasInk] = useState(false);
  const [padKey, setPadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const isBusy = busy || saving;

  useEffect(() => {
    if (previewUri) {
      setMode("preview");
      setHasInk(false);
    } else {
      setMode("draw");
    }
  }, [previewUri]);

  function clearCanvas() {
    ref.current?.injectJavaScript("window.clearPad && window.clearPad(); true;");
    setHasInk(false);
  }

  function startDraw() {
    setMode("draw");
    setHasInk(false);
    setPadKey((k) => k + 1);
    onDrawingChange?.(false);
  }

  async function saveSignature() {
    if (mode === "preview" || !hasInk || isBusy) {
      Alert.alert(t("mobile.signature"), t("mobile.signatureDrawFirst"));
      return;
    }
    ref.current?.injectJavaScript("window.exportPad && window.exportPad(); true;");
  }

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          height: 180,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: radius.md,
          overflow: "hidden",
          backgroundColor: "#fff",
        }}
      >
        {mode === "preview" && previewUri ? (
          <Image
            source={existingUri!}
            accessibilityLabel={t("mobile.signature")}
            style={{ width: "100%", height: "100%", resizeMode: "contain", backgroundColor: "#fff" }}
          />
        ) : (
            <WebView
              key={padKey}
              ref={ref}
              originWhitelist={["*"]}
              source={source}
              javaScriptEnabled
              scrollEnabled={false}
              bounces={false}
              overScrollMode="never"
              nestedScrollEnabled
              androidLayerType="hardware"
              automaticallyAdjustContentInsets={false}
              setSupportMultipleWindows={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              onMessage={async (e) => {
                try {
                  const payload = JSON.parse(e.nativeEvent.data) as {
                    type?: string;
                    active?: boolean;
                    hasInk?: boolean;
                    dataUrl?: string;
                    code?: string;
                  };
                  if (payload.type === "drawing") {
                    onDrawingChange?.(!!payload.active);
                    if (payload.hasInk != null) setHasInk(payload.hasInk);
                    return;
                  }
                  if (payload.type === "ink") {
                    setHasInk(!!payload.hasInk);
                    return;
                  }
                  if (payload.type === "error" && payload.code === "empty") {
                    Alert.alert(t("mobile.signature"), t("mobile.signatureDrawFirst"));
                    return;
                  }
                  if (payload.type === "export" && payload.dataUrl) {
                    if (savingRef.current || busy) return;
                    savingRef.current = true;
                    setSaving(true);
                    try {
                      await onSave(await dataUrlToFile(payload.dataUrl));
                      setMode("preview");
                      setHasInk(false);
                    } catch {
                      /* parent handles error feedback */
                    } finally {
                      savingRef.current = false;
                      setSaving(false);
                    }
                  }
                } catch {
                  /* ignore malformed messages */
                }
              }}
              style={{ flex: 1, backgroundColor: "#fff" }}
            />
        )}
      </View>

      {mode === "preview" && previewUri ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ActionButton title={t("pujari.sign.redraw")} outline onPress={startDraw} disabled={isBusy} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ActionButton title={t("pujari.sign.clear")} outline onPress={clearCanvas} disabled={isBusy} />
          <ActionButton title={t("pujari.sign.redraw")} outline onPress={startDraw} disabled={isBusy} />
          <ActionButton
            title={isBusy ? t("mobile.saving") : t("pujari.sign.save")}
            primary
            onPress={() => void saveSignature()}
            disabled={isBusy || !hasInk}
          />
        </View>
      )}

      {mode === "draw" && !hasInk ? (
        <AppText variant="small" color={colors.mutedForeground}>
          {t("mobile.signatureDrawHint")}
        </AppText>
      ) : null}
    </View>
  );
}
