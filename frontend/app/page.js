'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    api.me().then(() => router.replace('/dashboard')).catch(() => router.replace('/login'));
  }, [router]);
  return <p className="p-8">Loading…</p>;
}
