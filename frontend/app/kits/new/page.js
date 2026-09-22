'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import Navbar from '../../../components/Navbar';

export default function NewKit() {
  const [jd, setJd] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [days, setDays] = useState(5);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      let cases = [{ jd, companyUrl, days: Number(days) }];
      if (file) {
        const text = await file.text();
        const parsed = JSON.parse(text); // [{ jd, companyUrl, days }, ...]
        cases = Array.isArray(parsed) ? parsed : cases;
      }
      await api.createKits(cases);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <Navbar />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-4">New prep kit</h1>
        <form onSubmit={submit} className="space-y-4 bg-white p-6 rounded-lg border">
          <div>
            <label className="block text-sm font-medium mb-1">Job description</label>
            <textarea className="w-full border rounded px-3 py-2 h-40" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description here…" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Company website</label>
            <input className="w-full border rounded px-3 py-2" value={companyUrl} onChange={(e) => setCompanyUrl(e.target.value)} placeholder="https://company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Days until interview</label>
            <input type="number" min="1" max="60" className="w-32 border rounded px-3 py-2" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Or: batch upload (JSON of {'{jd, companyUrl, days}'})</label>
            <input type="file" accept=".json" onChange={(e) => setFile(e.target.files[0])} />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button className="bg-slate-900 text-white rounded px-4 py-2">Generate kit</button>
        </form>
      </div>
    </div>
  );
}
