'use client';
import { useSearchParams } from 'next/navigation';

export default function ClientNotFound() {
  const params = useSearchParams();
  const foo = params.get('foo');
  return <div>Không tìm thấy: foo = {foo}</div>;
}