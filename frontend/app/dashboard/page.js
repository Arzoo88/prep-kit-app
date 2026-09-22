'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import Navbar from '../../components/Navbar';

export default function Dashboard() {
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function load() {
    try {
      setKits(await api.listKits());
    } catch {
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // poll for in-progress generations
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">Your kits</h1>
          <a href="/kits/new" className="bg-slate-900 text-white rounded px-4 py-2 text-sm">+ New kit</a>
        </div>
        {loading && <p>Loading…</p>}
        {!loading && kits.length === 0 && <p className="text-slate-500">No kits yet. Create your first one.</p>}
        <ul className="space-y-2">
          {kits.map((k) => (
            <li key={k._id}>
              <a href={`/kits/${k._id}`} className="block bg-white rounded-lg border p-4 hover:shadow">
                <div className="flex justify-between">
                  <span className="font-medium">{k.input?.companyUrl || 'Untitled'}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    k.status === 'ready' ? 'bg-green-100 text-green-700' : k.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{k.status}</span>
                </div>
                {k.error?.message && <p className="text-sm text-red-600 mt-1">{k.error.message}</p>}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
