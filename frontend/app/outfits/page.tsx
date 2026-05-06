import { Suspense } from 'react';
import OutfitsContent from './OutfitsContent';

export default function OutfitsPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-96 bg-gray-100 dark:bg-gray-800/50 rounded-3xl animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <OutfitsContent />
    </Suspense>
  );
}
