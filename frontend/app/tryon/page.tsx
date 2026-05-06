// 'use client';

// import { Suspense } from 'react';
// import TryOnContent from './TryOnContent';

// export default function TryOnPage() {
//   return (
//     <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-73px)]"><div className="w-10 h-10 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin"></div></div>}>
//       <TryOnContent />
//     </Suspense>
//   );
// }

import { Suspense } from 'react';
import TryOnContent from './TryOnContent';

export default function TryOnPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TryOnContent />
    </Suspense>
  );
}
