/**
 * /stores – Nearby Fashion Stores
 *
 * Server component shell. All browser-only code (Leaflet, react-leaflet)
 * lives inside StoresContent which is a 'use client' component that handles
 * its own dynamic import with ssr:false.
 */
import StoresContent from './StoresContent';

export default function StoresPage() {
  return <StoresContent />;
}
