import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule } from '../src/services/generation/schedule.js';

test('schedule spans exactly the days requested', () => {
  const requirements = [{ id: 'r1', priority: 'must' }, { id: 'r2', priority: 'nice' }];
  const questions = [
    { id: 'q1', requirement_ids: ['r1'], difficulty: 3, category: 'technical' },
    { id: 'q2', requirement_ids: ['r2'], difficulty: 1, category: 'behavioural' },
    { id: 'q3', requirement_ids: ['r1'], difficulty: 2, category: 'system-design' },
  ];
  const schedule = buildSchedule({ requirements, questions, daysAvailable: 3 });
  assert.equal(schedule.days.length, 3);
  assert.equal(schedule.days_available, 3);
  schedule.days.forEach((d) => assert.ok(Number.isInteger(d.minutes)));
});

test('every must-have requirement appears somewhere in the schedule', () => {
  const requirements = [{ id: 'r1', priority: 'must' }];
  const questions = [{ id: 'q1', requirement_ids: ['r1'], difficulty: 1, category: 'technical' }];
  const schedule = buildSchedule({ requirements, questions, daysAvailable: 1 });
  const allQIds = schedule.days.flatMap((d) => d.question_ids);
  assert.ok(allQIds.includes('q1'));
});

test('clamps absurd day counts into a sane range', () => {
  const schedule = buildSchedule({ requirements: [], questions: [], daysAvailable: 400 });
  assert.equal(schedule.days_available, 60);
});
