import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import brain from 'brain';

export interface CityMarker {
  city: string;
  coords: [number, number]; // [lng, lat]
  totalFleet: number | null;
}

interface Props {
  markers: CityMarker[];
  onCityClick?: (city: string) => void;
}

const OperatorCityMap: React.FC<Props> = ({ markers, onCityClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapLoadedRef = useRef(false);
  const markersOnMapRef = useRef<mapboxgl.Marker[]>([]);
  const onCityClickRef = useRef(onCityClick);
  onCityClickRef.current = onCityClick;

  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Fetch Mapbox token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await brain.get_config();
        const data = await response.json();
        setMapboxToken(data.mapbox_token);
      } catch (err) {
        console.error('Failed to fetch config:', err);
        setError('Failed to load map configuration');
      } finally {
        setIsLoading(false);
      }
    };
    fetchToken();
  }, []);

  // Initialize map ONCE
  useEffect(() => {
    if (!containerRef.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [10, 50],
      zoom: 3,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      mapLoadedRef.current = true;
      setMapReady(true);
    });

    return () => {
      mapLoadedRef.current = false;
      markersOnMapRef.current.forEach(m => m.remove());
      markersOnMapRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  // Sync markers when markers prop or map readiness changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove old markers
    markersOnMapRef.current.forEach(m => m.remove());
    markersOnMapRef.current = [];

    // Add new markers
    markers.forEach(m => {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.innerHTML = `
        <div style="cursor: pointer; position: relative;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="#2563eb" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0 Z" stroke="#2563eb" stroke-width="2"/>
            <circle cx="12" cy="10" r="3" stroke="white" stroke-width="2" fill="#2563eb"/>
          </svg>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: [0, -32],
      });

      el.addEventListener('mouseenter', () => {
        const fleet = m.totalFleet;
        popup
          .setLngLat(m.coords)
          .setHTML(`<strong>${m.city}</strong><br/>${fleet !== null && fleet > 0 ? `${fleet.toLocaleString()} vehicles` : 'Loading...'}`)
          .addTo(map);
      });

      el.addEventListener('mouseleave', () => {
        popup.remove();
      });

      el.addEventListener('click', () => {
        onCityClickRef.current?.(m.city);
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat(m.coords)
        .addTo(map);

      markersOnMapRef.current.push(marker);
    });

    // Fit bounds on first load or when new cities appear
    if (markers.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const m of markers) bounds.extend(m.coords);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50, duration: 1000, maxZoom: 10 });
      }
    }
  }, [markers, mapReady]);

  if (isLoading) {
    return (
      <div className="w-full bg-muted rounded-lg flex items-center justify-center" style={{ height: '400px' }}>
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  if (error || !mapboxToken) {
    return (
      <div className="w-full bg-muted rounded-lg flex items-center justify-center" style={{ height: '400px' }}>
        <p className="text-muted-foreground">{error || 'Map token not configured'}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-3 left-3 z-10 bg-background/80 backdrop-blur-sm rounded-md px-3 py-1.5 text-xs font-medium border">
        LIVE COVERAGE
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden"
        style={{ height: '400px' }}
      />
    </div>
  );
};

export default OperatorCityMap;
