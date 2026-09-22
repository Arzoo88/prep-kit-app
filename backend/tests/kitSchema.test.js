import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKit } from '../src/services/validation/kitSchema.js';

function validKit() {
  return {
    source: { company: 'Acme', company_url: 'https://acme.com', role: '', location: '', jd_chars: 10, researched_at: '', pages_used: [] },
    company_brief: { summary: 'x', what_they_do: '', sources: [] },
    role: { title: '', seniority: '', responsibilities: [], requirements: [{ id: 'r1', text: 'x', kind: 'technical', priority: 'must' }] },
    questions: [{ id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'x', answer_outline: 'x', difficulty: 2 }],
    flashcards: [],
    schedule: { days_available: 1, days: [{ day: 1, focus: '', question_ids: ['q1'], minutes: 15 }] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

test('accepts a well-formed kit', () => {
  const { valid, errors } = validateKit(validKit());
  assert.equal(valid, true, errors.join('; '));
});

test('rejects a kit whose schedule references an unknown question id', () => {
  const kit = validKit();
  kit.schedule.days[0].question_ids = ['q-missing'];
  const { valid } = validateKit(kit);
  assert.equal(valid, false);
});

test('rejects a kit with non-integer difficulty', () => {
  const kit = validKit();
  kit.questions[0].difficulty = 2.5;
  const { valid } = validateKit(kit);
  assert.equal(valid, false);
});
