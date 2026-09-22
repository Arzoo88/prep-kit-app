import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCoverage } from '../src/services/generation/coverageCheck.js';

test('flags requirements with no referencing question', () => {
  const requirements = [
    { id: 'r1', priority: 'must' },
    { id: 'r2', priority: 'must' },
  ];
  const questions = [{ id: 'q1', requirement_ids: ['r1'] }];
  const result = checkCoverage(requirements, questions);
  assert.deepEqual(result.uncoveredRequirementIds, ['r2']);
  assert.deepEqual(result.uncoveredMustHaveIds, ['r2']);
});

test('fully covered requirements report no gaps', () => {
  const requirements = [{ id: 'r1', priority: 'must' }];
  const questions = [{ id: 'q1', requirement_ids: ['r1'] }];
  const result = checkCoverage(requirements, questions);
  assert.deepEqual(result.uncoveredRequirementIds, []);
});
