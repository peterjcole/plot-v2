'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { ActivityPhoto } from '@/lib/types';

interface PhotoOverlayProps {
  photos: ActivityPhoto[];
  onPinClick?: (index: number) => void;
}

function createNumberedIcon(number: number) {
  return L.divIcon({
    className: 'photo-numbered-pin',
    html: `<div style="
      width: 28px;
      height: 28px;
      background: rgba(8, 3, 87, 0.75);
      border: 2px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
    ">${number}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function PhotoOverlay({ photos, onPinClick }: PhotoOverlayProps) {
  const map = useMap();

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: (cluster) => {
        const markers = cluster.getAllChildMarkers();
        const numbers = markers
          .map((m) => (m as L.Marker & { _photoNumber?: number })._photoNumber)
          .filter((n): n is number => n !== undefined)
          .sort((a, b) => a - b);
        const label = numbers.join(', ');
        const width = Math.max(34, label.length * 8 + 10);
        return L.divIcon({
          html: `<div style="
            min-width: 34px;
            width: ${width}px;
            height: 34px;
            background: rgba(8, 3, 87, 0.75);
            border: 2px solid white;
            border-radius: 17px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            color: white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            padding: 0 4px;
            white-space: nowrap;
          ">${label}</div>`,
          className: 'photo-cluster-icon',
          iconSize: L.point(width, 34),
          iconAnchor: L.point(width / 2, 17),
        });
      },
    });

    photos.forEach((photo, index) => {
      const marker = L.marker([photo.lat, photo.lng], {
        icon: createNumberedIcon(index + 1),
      }) as L.Marker & { _photoNumber?: number };
      marker._photoNumber = index + 1;

      if (onPinClick) {
        marker.on('click', () => onPinClick(index));
      }

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, photos, onPinClick]);

  return null;
}
