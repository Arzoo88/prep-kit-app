'use client';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';

export default function Navbar() {
  const router = useRouter();
  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-white border-b">
      <a href="/dashboard" className="font-semibold">AI Interview Prep Kit</a>
      <button
        className="text-sm text-slate-600 hover:underline"
        onClick={async () => { await api.logout(); router.push('/login'); }}
      >
        Log out
      </button>
    </nav>
  );
}
