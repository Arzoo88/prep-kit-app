'use client';
import { useState } from 'react';
import { api } from '../lib/api';

const CATEGORIES = ['technical', 'behavioural', 'system-design', 'company-fit'];

export default function KitBuilder({ kit, onChange }) {
  const [pinnedQuestionIds, setPinnedQuestionIds] = useState(new Set(kit.pinned?.questionIds || []));
  const [regenerating, setRegenerating] = useState(null);
  const data = kit.data;

  function save(newData, pinned = pinnedQuestionIds) {
    onChange(newData);
    api.updateKit(kit._id, { data: newData, pinnedQuestionIds: [...pinned] });
  }

  function updateQuestion(id, field, value) {
    const questions = data.questions.map((q) => (q.id === id ? { ...q, [field]: value } : q));
    const pinned = new Set(pinnedQuestionIds).add(id);
    setPinnedQuestionIds(pinned);
    save({ ...data, questions }, pinned);
  }

  function deleteQuestion(id) {
    const questions = data.questions.filter((q) => q.id !== id);
    save({ ...data, questions });
  }

  function moveQuestion(id, direction) {
    const questions = [...data.questions];
    const i = questions.findIndex((q) => q.id === id);
    const j = i + direction;
    if (j < 0 || j >= questions.length) return;
    [questions[i], questions[j]] = [questions[j], questions[i]];
    save({ ...data, questions });
  }

  function changeCategory(id, category) {
    const questions = data.questions.map((q) => (q.id === id ? { ...q, category } : q));
    const pinned = new Set(pinnedQuestionIds).add(id);
    setPinnedQuestionIds(pinned);
    save({ ...data, questions }, pinned);
  }

  function addQuestion(category) {
    const id = `manual-${Date.now()}`;
    const q = { id, requirement_ids: [], category, prompt: 'New question', answer_outline: '', difficulty: 2 };
    const pinned = new Set(pinnedQuestionIds).add(id);
    setPinnedQuestionIds(pinned);
    save({ ...data, questions: [...data.questions, q] }, pinned);
  }

  async function regenerate(section, category) {
    setRegenerating(`${section}:${category || ''}`);
    try {
      const updated = await api.regenerate(kit._id, section, category);
      onChange(updated.data);
    } finally {
      setRegenerating(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg border p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Company brief</h2>
          <button className="text-xs underline" disabled={regenerating} onClick={() => regenerate('company_brief')}>
            {regenerating === 'company_brief:' ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
        <textarea
          className="w-full border rounded px-2 py-1 text-sm"
          value={data.company_brief.summary}
          onChange={(e) => save({ ...data, company_brief: { ...data.company_brief, summary: e.target.value } })}
        />
      </section>

      <section className="bg-white rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Requirements</h2>
        <ul className="text-sm space-y-1">
          {data.role.requirements.map((r) => (
            <li key={r.id} className="flex gap-2">
              <span className={`text-xs px-1.5 rounded ${r.priority === 'must' ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>{r.priority}</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
        {data.coverage.uncovered_requirement_ids.length > 0 && (
          <p className="text-xs text-amber-600 mt-2">Uncovered: {data.coverage.uncovered_requirement_ids.join(', ')}</p>
        )}
      </section>

      {CATEGORIES.map((cat) => {
        const qs = data.questions.filter((q) => q.category === cat);
        if (qs.length === 0) return null;
        return (
          <section key={cat} className="bg-white rounded-lg border p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-semibold capitalize">{cat.replace('-', ' ')}</h2>
              <div className="flex gap-2">
                <button className="text-xs underline" onClick={() => addQuestion(cat)}>+ Add</button>
                <button className="text-xs underline" disabled={regenerating} onClick={() => regenerate('questions', cat)}>
                  {regenerating === `questions:${cat}` ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            </div>
            <ul className="space-y-3">
              {qs.map((q) => (
                <li key={q.id} className="border rounded p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <textarea className="flex-1 border rounded px-2 py-1" value={q.prompt} onChange={(e) => updateQuestion(q.id, 'prompt', e.target.value)} />
                    <div className="flex flex-col gap-1 shrink-0">
                      <button title="Move up" onClick={() => moveQuestion(q.id, -1)}>↑</button>
                      <button title="Move down" onClick={() => moveQuestion(q.id, 1)}>↓</button>
                      <button title="Delete" className="text-red-600" onClick={() => deleteQuestion(q.id)}>✕</button>
                    </div>
                  </div>
                  <textarea className="w-full border rounded px-2 py-1 mt-2 text-slate-600" value={q.answer_outline} onChange={(e) => updateQuestion(q.id, 'answer_outline', e.target.value)} />
                  <div className="flex gap-2 mt-2 items-center">
                    <select className="border rounded text-xs px-1 py-0.5" value={q.category} onChange={(e) => changeCategory(q.id, e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="text-xs text-slate-400">difficulty {q.difficulty}</span>
                    {pinnedQuestionIds.has(q.id) && <span className="text-xs text-blue-600">edited (won't be discarded)</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="bg-white rounded-lg border p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Schedule</h2>
          <button className="text-xs underline" disabled={regenerating} onClick={() => regenerate('schedule')}>
            {regenerating === 'schedule:' ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
        <ul className="text-sm space-y-1">
          {data.schedule.days.map((d) => (
            <li key={d.day}>Day {d.day}: {d.focus} — {d.minutes} min ({d.question_ids.length} questions)</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
