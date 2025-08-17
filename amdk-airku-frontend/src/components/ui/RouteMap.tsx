
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
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
  // A stop can be from a delivery route (with orderId) or a sales visit route (with visitId)
  id: string; // Unique ID for the key, will be mapped from orderId or visitId
  storeName: string;
  location: Location;
  sequence?: number;
}

interface Route {
  id: string;
  stops: Stop[];
  // Add other route properties if needed, e.g., driverId, vehicleId
}

interface RouteMapProps {
  routes: Route[];
}

"""
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- Helper Functions & Constants ---

const DEPOT_LOCATION: Location = { lat: -7.8664161, lng: 110.1486773 };
const DEPOT_NAME = "Gudang (PDAM Tirta Binangun)";

// Function to create a numbered icon
const createNumberedIcon = (number: number) => {
  return L.divIcon({
    html: `<div style="background-color: #3b82f6; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white;">${number}</div>`,
    className: 'custom-div-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Icon for the Depot
const depotIcon = L.divIcon({
    html: `<div style="background-color: #16a34a; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: bold; border: 2px solid white;">G</div>`,
    className: 'custom-div-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});


// --- Component Interfaces ---

interface Location {
  lat: number;
  lng: number;
}

interface Stop {
  storeName: string;
  location: Location;
  sequence?: number; // Sequence is expected now
}

interface Route {
  id: string;
  stops: Stop[];
}

interface RouteMapProps {
  routes: Route[];
}


// --- The Component ---

const RouteMap: React.FC<RouteMapProps> = ({ routes }) => {
  const defaultCenter: Location = { lat: -7.801373, lng: 110.364706 }; // Yogyakarta
  const defaultZoom = 13;

  // Calculate bounds to fit all routes including the depot
  const allPositions: L.LatLngExpression[] = [
      [DEPOT_LOCATION.lat, DEPOT_LOCATION.lng]
  ];
  routes.forEach(route => {
    route.stops.forEach(stop => {
      allPositions.push([stop.location.lat, stop.location.lng]);
    });
  });

  const bounds = allPositions.length > 1 ? L.latLngBounds(allPositions) : undefined;

  return (
    <MapContainer 
      center={defaultCenter} 
      zoom={defaultZoom} 
      scrollWheelZoom={true} 
      style={{ height: '500px', width: '100%' }}
      bounds={bounds}
      boundsOptions={{ padding: [50, 50] }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Depot Marker */}
      <Marker position={[DEPOT_LOCATION.lat, DEPOT_LOCATION.lng]} icon={depotIcon}>
        <Popup>{DEPOT_NAME}</Popup>
      </Marker>

      {routes.map(route => {
        // Create the full polyline path: Depot -> Stops -> Depot
        const polylinePositions = [
          [DEPOT_LOCATION.lat, DEPOT_LOCATION.lng],
          ...route.stops.map(stop => [stop.location.lat, stop.location.lng]),
          [DEPOT_LOCATION.lat, DEPOT_LOCATION.lng]
        ];

        return (
          <React.Fragment key={route.id}>
            {/* Stop Markers with Numbers */}
            {route.stops.map((stop, index) => (
              <Marker 
                key={stop.id} // Use the unique ID for the key
                position={[stop.location.lat, stop.location.lng]}
                icon={createNumberedIcon(index + 1)}
              >
                <Popup>
                  <b>{index + 1}. {stop.storeName}</b>
                </Popup>
              </Marker>
            ))}
            
            {/* Draw the full closed-loop polyline */}
            {route.stops.length > 0 && (
              <Polyline 
                positions={polylinePositions} 
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
""
  // Default center if no routes are provided
  const defaultCenter: Location = { lat: -7.801373, lng: 110.364706 }; // Yogyakarta
  const defaultZoom = 13;

  // Calculate bounds to fit all routes
  const allPositions: L.LatLngExpression[] = [];
  routes.forEach(route => {
    route.stops.forEach(stop => {
      allPositions.push([stop.location.lat, stop.location.lng]);
    });
  });

  const bounds = allPositions.length > 0 ? L.latLngBounds(allPositions) : undefined;

  return (
    <MapContainer 
      center={defaultCenter} 
      zoom={defaultZoom} 
      scrollWheelZoom={true} 
      style={{ height: '500px', width: '100%' }}
      bounds={bounds} // Fit map to bounds if available
      boundsOptions={{ padding: [50, 50] }} // Add some padding around the bounds
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {routes.map(route => (
        <React.Fragment key={route.id}>
          {route.stops.map((stop, index) => (
            <Marker key={index} position={[stop.location.lat, stop.location.lng]}>
              <Popup>{stop.storeName}</Popup>
            </Marker>
          ))}
          {/* Draw polyline for the route */}
          {route.stops.length > 1 && (
            <Polyline 
              positions={route.stops.map(stop => [stop.location.lat, stop.location.lng])} 
              color="blue" 
            />
          )}
        </React.Fragment>
      ))}
    </MapContainer>
  );
};

export default RouteMap;
