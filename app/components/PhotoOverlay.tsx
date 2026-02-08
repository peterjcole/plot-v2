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
}

// Pin/teardrop SVG with camera icon
const pinIconHtml = `
  <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 38 C15 38, 2 22, 2 14 C2 6.82 7.82 1 15 1 C22.18 1 28 6.82 28 14 C28 22 15 38 15 38Z"
      fill="white" stroke="#080357" stroke-width="2"/>
    <g transform="translate(8, 7)">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#080357">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9-2h-3.17L15 2H9L6.17 4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H3V6h4.05l2.83-2h6.24l2.83 2H21v14z"/>
      </svg>
    </g>
  </svg>
`;

const photoIcon = L.divIcon({
  className: 'photo-marker-pin',
  html: pinIconHtml,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -40],
});

export default function PhotoOverlay({ photos }: PhotoOverlayProps) {
  const map = useMap();

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            width: 34px;
            height: 34px;
            background: white;
            border: 2px solid #080357;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 600;
            color: #080357;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">${count}</div>`,
          className: 'photo-cluster-icon',
          iconSize: L.point(34, 34),
          iconAnchor: L.point(17, 17),
        });
      },
    });

    photos.forEach((photo) => {
      const marker = L.marker([photo.lat, photo.lng], { icon: photoIcon });
      const popupContent = `
        <div style="text-align: center; margin: -1px;">
          <img
            src="${photo.url}"
            alt="${photo.caption || 'Activity photo'}"
            style="width: 100%; display: block; border-radius: 4px;"
          />
          ${photo.caption ? `<p style="margin: 8px 0 0; font-size: 12px;">${photo.caption}</p>` : ''}
        </div>
      `;
      marker.bindPopup(popupContent, { maxWidth: 220, minWidth: 220 });
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, photos]);

  return null;
}
