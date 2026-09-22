/**
 * Deterministic gap-check (Section 3/4): compares generated questions
 * against extracted requirements in plain code, no model call. Any
 * requirement with zero questions referencing its id in
 * question.requirement_ids comes back as a gap. Must-have gaps are what
 * the pipeline's second pass acts on (see pipeline.js); "nice" gaps are
 * still reported but don't block a kit from being marked ok.
 */
export function checkCoverage(requirements, questions) {
  const covered = new Set();
  for (const q of questions) {
    for (const rid of q.requirement_ids || []) covered.add(rid);
  }
  const uncovered = requirements.filter((r) => !covered.has(r.id));
  return {
    uncoveredRequirementIds: uncovered.map((r) => r.id),
    uncoveredMustHaveIds: uncovered.filter((r) => r.priority === 'must').map((r) => r.id),
  };
}
