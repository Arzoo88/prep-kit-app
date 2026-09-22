'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';
import Navbar from '../../../components/Navbar';
import KitBuilder from '../../../components/KitBuilder';

export default function KitPage() {
  const { id } = useParams();
  const [kit, setKit] = useState(null);

  async function load() {
    setKit(await api.getKit(id));
  }

  useEffect(() => {
    load();
    const t = setInterval(() => {
      setKit((prev) => {
        if (prev?.status === 'generating') load();
        return prev;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [id]);

  if (!kit) return <div><Navbar /><p className="p-6">Loading…</p></div>;

  return (
    <div>
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        {kit.status === 'generating' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4 text-sm">
            Generating your kit — researching the company, extracting requirements, and writing questions. This can take a minute.
          </div>
        )}
        {kit.status === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4 text-sm text-red-700">
            Generation failed: {kit.error?.message}
          </div>
        )}
        {kit.status === 'ready' && kit.data && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-xl font-semibold">{kit.data.role.title || kit.input.companyUrl}</h1>
              <a href={`/kits/${id}/practice`} className="bg-slate-900 text-white rounded px-4 py-2 text-sm">Practice mode</a>
            </div>
            <KitBuilder kit={kit} onChange={(data) => setKit({ ...kit, data })} />
          </>
        )}
      </div>
    </div>
  );
}
