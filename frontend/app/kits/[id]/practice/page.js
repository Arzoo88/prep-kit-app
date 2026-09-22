'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import Navbar from '../../../../components/Navbar';

// Confidence-weighted ordering: each flashcard's next-session priority is
// 1 / (1 + timesSeenConfidently). Cards never seen, or seen with low
// confidence, sort first. Simple, transparent, and explainable in a demo
// video - a proper spaced-repetition interval (SM-2 etc.) is noted in the
// README as the natural next step if this needed real longevity.
export default function Practice() {
  const { id } = useParams();
  const [kit, setKit] = useState(null);
  const [confidence, setConfidence] = useState({}); // id -> [scores]
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [order, setOrder] = useState([]);

  useEffect(() => {
    api.getKit(id).then((k) => {
      setKit(k);
      setOrder(k.data.flashcards.map((f) => f.id));
    });
  }, [id]);

  if (!kit || !kit.data) return <div><Navbar /><p className="p-6">Loading…</p></div>;

  const cards = kit.data.flashcards;
  const currentId = order[index];
  const current = cards.find((c) => c.id === currentId);
  const covered = Object.keys(confidence).length;

  function rate(score) {
    const next = { ...confidence, [currentId]: [...(confidence[currentId] || []), score] };
    setConfidence(next);
    setRevealed(false);
    if (index + 1 < order.length) {
      setIndex(index + 1);
    } else {
      // Re-sort remaining/all cards by average confidence, ascending.
      const avg = (id) => {
        const scores = next[id];
        if (!scores) return -1; // unseen sorts first
        return scores.reduce((a, b) => a + b, 0) / scores.length;
      };
      const resorted = [...cards.map((c) => c.id)].sort((a, b) => avg(a) - avg(b));
      setOrder(resorted);
      setIndex(0);
    }
  }

  if (!current) return <div><Navbar /><p className="p-6">No flashcards in this kit.</p></div>;

  return (
    <div>
      <Navbar />
      <div className="max-w-xl mx-auto p-6">
        <p className="text-sm text-slate-500 mb-2">{covered}/{cards.length} cards covered this session</p>
        <div className="bg-white border rounded-lg p-6 min-h-[200px] flex flex-col justify-between">
          <p className="text-lg">{current.front}</p>
          {revealed && <p className="text-slate-600 mt-4 border-t pt-4">{current.back}</p>}
        </div>
        {!revealed ? (
          <button className="mt-4 bg-slate-900 text-white rounded px-4 py-2" onClick={() => setRevealed(true)}>Reveal answer</button>
        ) : (
          <div className="mt-4 flex gap-2">
            <span className="text-sm self-center">How confident were you?</span>
            {[1, 2, 3].map((s) => (
              <button key={s} className="border rounded px-3 py-1 text-sm" onClick={() => rate(s)}>
                {s === 1 ? 'Low' : s === 2 ? 'OK' : 'Confident'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
