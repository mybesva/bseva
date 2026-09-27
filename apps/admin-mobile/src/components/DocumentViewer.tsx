import { useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import { WebView } from "react-native-webview";

export function prepareDocumentHtml(html: string, screenWidth: number) {
  const mobile = screenWidth < 768;
  const inject = `
<script>
(function() {
  var mobile = ${mobile ? "true" : "false"};
  if (mobile || (window.innerWidth || 0) < 768) {
    document.documentElement.classList.add("bseva-doc-mobile");
  }
})();
</script>
<style>
@media screen {
  html.bseva-doc-mobile, html.bseva-doc-mobile body {
    background: #eef2f7 !important;
  }
  html.bseva-doc-mobile .bseva-doc-viewport {
    padding: 0 !important;
    overflow: visible !important;
    min-height: auto !important;
  }
}
</style>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${inject}</head>`);
  }
  return inject + html;
}

export function DocumentViewer({ html }: { html: string }) {
  const { width, height } = useWindowDimensions();
  const prepared = useMemo(() => prepareDocumentHtml(html, width), [html, width]);
  const viewerHeight = Math.max(520, height - 160);

  return (
    <View style={{ flex: 1, minHeight: viewerHeight }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html: prepared }}
        scalesPageToFit={false}
        scrollEnabled
        nestedScrollEnabled
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        style={{ flex: 1, width: "100%", minHeight: viewerHeight, backgroundColor: "#eef2f7" }}
      />
    </View>
  );
}
