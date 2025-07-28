import { Suspense } from 'react';
import ClientNotFound from './ClientNotFound';

export default function NotFoundPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ClientNotFound />
    </Suspense>
  );
}
