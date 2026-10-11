export type Geo = { latitude: number; longitude: number; accuracy: number };

/**
 * Ask the phone where it is. Resolves to null (never throws, never blocks for long) when the person
 * says no, there is no GPS fix (a basement), or the browser has no location support.
 */
export function captureLocation(timeoutMs = 6000): Promise<Geo | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
