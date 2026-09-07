export const MAP_STYLE = '/map-style.json';

export type RoutePoint = [number, number];

export function toMapLibreCoordinates(points: RoutePoint[]) {
  return points.map(([latitude, longitude]) => [longitude, latitude] as [number, number]);
}

export function distanceBetween(from: RoutePoint, to: RoutePoint) {
  const earthRadius = 6_371_000;
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(to[0] - from[0]);
  const deltaLongitude = radians(to[1] - from[1]);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(from[0])) * Math.cos(radians(to[0])) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
