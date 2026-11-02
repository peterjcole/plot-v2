import { notFound } from 'next/navigation';
import StyleLabClient from './StyleLabClient';

// Dev-only: renders the OS Vector style (or the OS 1:25k raster it's compared
// against) at a fixed place and zoom for tools/style-lab-shots.mjs.
export default function StyleLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <StyleLabClient />;
}
