import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

function mapsKey() {
  return (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
}

function googleHtml(key: string, lat: number, lng: number) {
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
  window.setPin = function(lat, lng) {
    if (!map || !marker) return;
    const pos = { lat: Number(lat), lng: Number(lng) };
    marker.setPosition(pos);
    map.setCenter(pos);
    map.setZoom(16);
  };
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

function osmHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;}</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const center = [${Number(lat) || 12.97}, ${Number(lng) || 77.59}];
  const map = L.map('map', { tap: true }).setView(center, 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  const marker = L.marker(center, { draggable: true }).addTo(map);
  function send(ll) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ lat: ll.lat, lng: ll.lng }));
  }
  window.setPin = function(lat, lng) {
    const ll = L.latLng(Number(lat), Number(lng));
    marker.setLatLng(ll);
    map.setView(ll, 16);
    setTimeout(function() { map.invalidateSize(); }, 50);
  };
  marker.on('dragend', function() { send(marker.getLatLng()); });
  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    send(e.latlng);
  });
  setTimeout(function() { map.invalidateSize(); }, 200);
</script>
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
  const initial = useRef({ lat, lng, key });
  const source = useMemo(
    () => ({ html: initial.current.key ? googleHtml(initial.current.key, initial.current.lat, initial.current.lng) : osmHtml(initial.current.lat, initial.current.lng) }),
    [],
  );

  function injectPin(nextLat: number, nextLng: number) {
    ref.current?.injectJavaScript(
      `window.setPin && window.setPin(${Number(nextLat)}, ${Number(nextLng)}); true;`,
    );
  }

  useEffect(() => {
    injectPin(lat, lng);
  }, [lat, lng]);

  return (
    <View style={{ height, borderRadius: 10, overflow: "hidden" }}>
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={source}
        javaScriptEnabled
        nestedScrollEnabled
        setSupportMultipleWindows={false}
        onLoadEnd={() => injectPin(lat, lng)}
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
