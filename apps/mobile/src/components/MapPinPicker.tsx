import { useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { AppText } from "@/components/ui";

function mapsKey() {
  return (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
}

function html(key: string, lat: number, lng: number) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;}</style>
</head><body>
<div id="map"></div>
<script>
  let map, marker;
  function send(lat, lng) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ lat: lat, lng: lng }));
  }
  window.init = function() {
    const center = { lat: ${Number(lat) || 12.97}, lng: ${Number(lng) || 77.59} };
    map = new google.maps.Map(document.getElementById('map'), {
      zoom: 15, center: center, mapTypeControl: false, streetViewControl: false, fullscreenControl: false
    });
    marker = new google.maps.Marker({ map: map, position: center, draggable: true });
    map.addListener('click', function(e) {
      marker.setPosition(e.latLng);
      send(e.latLng.lat(), e.latLng.lng());
    });
    marker.addListener('dragend', function(e) {
      send(e.latLng.lat(), e.latLng.lng());
    });
  };
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=init"></script>
</body></html>`;
}

export function MapPinPicker({
  latitude,
  longitude,
  onChange,
  height = 220,
}: {
  latitude?: number | null;
  longitude?: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}) {
  const key = mapsKey();
  const ref = useRef<WebView>(null);
  const lat = latitude != null && Number.isFinite(latitude) ? latitude : 12.97;
  const lng = longitude != null && Number.isFinite(longitude) ? longitude : 77.59;
  const source = useMemo(() => ({ html: html(key, lat, lng) }), [key, lat, lng]);
  if (!key) {
    return <AppText variant="small">Set GPS with current location, or configure maps to drop a pin.</AppText>;
  }
  return (
    <View style={{ height, borderRadius: 10, overflow: "hidden" }}>
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={source}
        javaScriptEnabled
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data) as { lat: number; lng: number };
            if (Number.isFinite(data.lat) && Number.isFinite(data.lng)) onChange(data.lat, data.lng);
          } catch {
            /* ignore */
          }
        }}
        style={{ flex: 1 }}
      />
    </View>
  );
}
