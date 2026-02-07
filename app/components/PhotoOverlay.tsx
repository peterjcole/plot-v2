'use client';

import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ActivityPhoto } from '@/lib/types';

interface PhotoOverlayProps {
  photos: ActivityPhoto[];
}

// Custom icon for photo markers
const photoIcon = L.divIcon({
  className: 'photo-marker',
  html: `
    <div style="
      width: 32px;
      height: 32px;
      background: white;
      border: 3px solid #080357;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#080357">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9-2h-3.17L15 2H9L6.17 4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H3V6h4.05l2.83-2h6.24l2.83 2H21v14z"/>
      </svg>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export default function PhotoOverlay({ photos }: PhotoOverlayProps) {
  return (
    <>
      {photos.map((photo) => (
        <Marker
          key={photo.id}
          position={[photo.lat, photo.lng]}
          icon={photoIcon}
        >
          <Popup maxWidth={220} minWidth={220}>
            <div style={{ textAlign: 'center', margin: '-1px' }}>
              <img
                src={photo.url}
                alt={photo.caption || 'Activity photo'}
                style={{
                  width: '100%',
                  display: 'block',
                  borderRadius: '4px',
                }}
              />
              {photo.caption && (
                <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
                  {photo.caption}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
