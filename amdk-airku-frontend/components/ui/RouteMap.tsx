
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon not appearing
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface Location {
  lat: number;
  lng: number;
}

interface Stop {
  storeName: string;
  address: string;
  location: Location;
}

interface Route {
  id: string;
  stops: Stop[];
}

interface RouteMapProps {
  routes: Route[];
}

const DEPOT_LOCATION: Location = { lat: -7.8664161, lng: 110.1486773 }; // PDAM Tirta Binangun

const depotIcon = L.divIcon({
    html: `<div style="background-color: #dc2626; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: bold; border: 2px solid white;">G</div>`,
    className: 'custom-div-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

const numberedStopIcon = (number: number) => new L.DivIcon({
    html: `<div style="background-color: blue; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${number}</div>`,
    className: 'custom-numbered-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

// Helper component to force map to fit bounds on route change
const FitBoundsToRoutes: React.FC<{ bounds: L.LatLngBounds }> = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};

const RouteMap: React.FC<RouteMapProps> = ({ routes }) => {
  if (!routes || !Array.isArray(routes) || routes.length === 0) {
    return <div className="text-center p-4 text-gray-500">Tidak ada rute untuk ditampilkan di peta.</div>;
  }

  const defaultCenter: Location = DEPOT_LOCATION; // Center on depot by default
  const defaultZoom = 13;

  // Calculate bounds to fit all routes including the depot
  const allPositions: L.LatLngExpression[] = [[DEPOT_LOCATION.lat, DEPOT_LOCATION.lng]];
  routes.forEach(route => {
    if (route.stops && Array.isArray(route.stops)) {
      route.stops.forEach(stop => {
        if (stop.location && typeof stop.location.lat === 'number' && typeof stop.location.lng === 'number' && (stop.location.lat !== 0 || stop.location.lng !== 0)) {
          allPositions.push([stop.location.lat, stop.location.lng]);
        }
      });
    }
  });

  const bounds = allPositions.length > 1 ? L.latLngBounds(allPositions) : L.latLng(DEPOT_LOCATION).toBounds(1000); // Fallback bounds

  return (
    <MapContainer 
      center={defaultCenter} 
      zoom={defaultZoom} 
      scrollWheelZoom={true} 
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBoundsToRoutes bounds={bounds} />

      {/* Depot Marker */}
      <Marker position={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lng]} icon={depotIcon}>
        <Popup>Gudang (PDAM Tirta Binangun)</Popup>
      </Marker>

      {routes.map(route => {
        let stopNumber = 0;
        const validStops = route.stops && Array.isArray(route.stops) ? 
                           route.stops.filter(stop => stop.location && typeof stop.location.lat === 'number' && typeof stop.location.lng === 'number') : [];

        return (
          <React.Fragment key={route.id}>
            {validStops.map((stop) => {
              stopNumber++;
              return (
                <Marker 
                  key={stop.storeName + stopNumber} 
                  position={[stop.location.lat, stop.location.lng]}
                  icon={numberedStopIcon(stopNumber)}
                >
                  <Popup>{stop.storeName}<br/>{stop.address}</Popup>
                </Marker>
              );
            })}
            {validStops.length > 0 && (
              <Polyline 
                positions={[
                  [DEPOT_LOCATION.lat, DEPOT_LOCATION.lng],
                  ...validStops.map(stop => [stop.location.lat, stop.location.lng]),
                  [DEPOT_LOCATION.lat, DEPOT_LOCATION.lng]
                ]} 
                color="blue" 
              />
            )}
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
};

export default RouteMap;
