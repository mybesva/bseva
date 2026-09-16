import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
  latitude: number;
  longitude: number;
  destLat?: number | null;
  destLng?: number | null;
  height?: number;
};

function mapsKey() {
  return (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
}

function htmlShell(key: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#f6f3ee;}
</style>
</head>
<body>
<div id="map"></div>
<script>
  const ROUTE_MOVE_METERS = 120;
  const ROUTE_MAX_AGE_MS = 180000;
  let map, pujari, dest, renderer, lastRoute = null, pending = null;
  function haversine(a, b) {
    const r = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
    const h = s1*s1 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*s2*s2;
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  window.init = function init() {
    map = new google.maps.Map(document.getElementById('map'), {
      zoom: 14, center: {lat: 12.97, lng: 77.59},
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false
    });
    if (pending) window.updateTrack.apply(null, pending);
  }
  window.updateTrack = function(lat, lng, dlat, dlng) {
    if (!map || typeof google === 'undefined') {
      pending = [lat, lng, dlat, dlng];
      return;
    }
    const origin = { lat: Number(lat), lng: Number(lng) };
    map.setCenter(origin);
    if (!pujari) {
      pujari = new google.maps.Marker({ map, position: origin, title: 'Pujari', label: { text: 'P', color: 'white', fontWeight: '700' } });
    } else {
      pujari.setPosition(origin);
    }
    if (dlat == null || dlng == null || Number.isNaN(Number(dlat))) return;
    const destination = { lat: Number(dlat), lng: Number(dlng) };
    if (!dest) {
      dest = new google.maps.Marker({
        map, position: destination, title: 'Puja location',
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#1A2B4A', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
      });
    } else {
      dest.setPosition(destination);
    }
    const moved = !lastRoute || haversine(lastRoute, origin) >= ROUTE_MOVE_METERS;
    const stale = !lastRoute || (Date.now() - lastRoute.at) >= ROUTE_MAX_AGE_MS;
    if (!moved && !stale) return;
    if (!renderer) {
      renderer = new google.maps.DirectionsRenderer({
        map, suppressMarkers: true,
        polylineOptions: { strokeColor: '#E87722', strokeWeight: 5, strokeOpacity: 0.9 }
      });
    }
    const svc = new google.maps.DirectionsService();
    svc.route({ origin, destination, travelMode: google.maps.TravelMode.DRIVING }, function(res, status) {
      if (status === 'OK' && res) {
        renderer.setDirections(res);
        lastRoute = { lat: origin.lat, lng: origin.lng, at: Date.now() };
      }
    });
  };
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=init"></script>
</body>
</html>`;
}

export function TrackingMap({ latitude, longitude, destLat, destLng, height = 220 }: Props) {
  const ref = useRef<WebView>(null);
  const key = mapsKey();
  const source = useMemo(() => ({ html: htmlShell(key) }), [key]);

  useEffect(() => {
    if (!key) return;
    const js = `window.updateTrack && window.updateTrack(${latitude},${longitude},${destLat ?? "null"},${destLng ?? "null"}); true;`;
    const t = setTimeout(() => ref.current?.injectJavaScript(js), 400);
    return () => clearTimeout(t);
  }, [key, latitude, longitude, destLat, destLng]);

  if (!key) {
    return <View style={{ height: 8 }} />;
  }

  return (
    <View style={{ height, borderRadius: 10, overflow: "hidden" }}>
      <WebView
        ref={ref}
        originWhitelist={["*"]}
        source={source}
        javaScriptEnabled
        scrollEnabled={false}
        style={{ flex: 1, backgroundColor: "transparent" }}
      />
    </View>
  );
}
