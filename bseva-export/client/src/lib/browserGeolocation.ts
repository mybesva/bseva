/** Chrome treats http://localhost as secure, but not http://0.0.0.0 or LAN IPs. */
export function browserGeolocationBlock(): "unsupported" | "insecure" | null {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
    return "unsupported";
  }
  const host = window.location.hostname;
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (host === "0.0.0.0" || host === "[::]" || (!window.isSecureContext && !loopback)) {
    return "insecure";
  }
  return null;
}

export function insecureOriginHint(): string {
  if (typeof window === "undefined") return "http://localhost:3000";
  const port = window.location.port ? `:${window.location.port}` : "";
  return `http://localhost${port}${window.location.pathname}`;
}

export function requestBrowserPosition(): Promise<GeolocationPosition> {
  const block = browserGeolocationBlock();
  if (block) {
    const err = Object.assign(new Error(block), { geoBlock: block as "unsupported" | "insecure" });
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 60_000,
    });
  });
}
