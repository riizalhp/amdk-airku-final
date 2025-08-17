
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon not appearing
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface Location {
  lat: number;
  lng: number;
}

interface RouteStop {
  id: string;
  orderId?: string;
  visitId?: string;
  storeId: string;
  storeName: string;
  address: string;
  location: Location;
  sequence?: number;
}

interface RouteMapProps {
  stops: RouteStop[];
  depot: { lat: number, lng: number };
}

const depotIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-icon-red.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const stopIcon = (index: number) => new L.DivIcon({
    html: `<div class="w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">${index + 1}</div>`,
    className: 'bg-transparent border-0',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});


const RecenterAutomatically = ({bounds}: {bounds: L.LatLngBounds}) => {
    const map = useMap();
    React.useEffect(() => {
        if(bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [bounds, map]);
    return null;
}

export const RouteMap: React.FC<RouteMapProps> = ({ stops, depot }) => {
  // Filter stops that have valid coordinates
  const stopsWithCoords = stops.filter(stop => 
    stop.location && 
    typeof stop.location.lat === 'number' && 
    typeof stop.location.lng === 'number' &&
    stop.location.lat !== 0 && 
    stop.location.lng !== 0
  );

  if (stopsWithCoords.length === 0) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
          <p>Koordinat untuk perhentian tidak tersedia.</p>
        </div>
      );
  }

  // Sort stops by sequence if available
  const sortedStops = [...stopsWithCoords].sort((a, b) => {
    if (a.sequence && b.sequence) {
      return a.sequence - b.sequence;
    }
    return 0;
  });

  const pathPositions: L.LatLngExpression[] = [
      [depot.lat, depot.lng],
      ...sortedStops.map(s => [s.location.lat, s.location.lng] as [number, number]),
      [depot.lat, depot.lng] // Return to depot
  ];

  const bounds = L.latLngBounds(pathPositions);

  return (
    <MapContainer 
      center={[depot.lat, depot.lng]} 
      zoom={13} 
      style={{ height: '500px', width: '100%' }} 
      className="rounded-lg z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
       <RecenterAutomatically bounds={bounds} />

      <Marker position={[depot.lat, depot.lng]} icon={depotIcon}>
        <Popup>Gudang (PDAM Tirta Binangun)</Popup>
      </Marker>
      
      {sortedStops.map((stop, index) => (
        <Marker key={stop.id} position={[stop.location.lat, stop.location.lng]} icon={stopIcon(index)}>
          <Popup>
            <b>{index + 1}. {stop.storeName}</b><br/>
            {stop.address}
          </Popup>
        </Marker>
      ))}

      <Polyline positions={pathPositions} color="#0077B6" weight={4} opacity={0.7} />
    </MapContainer>
  );
};
