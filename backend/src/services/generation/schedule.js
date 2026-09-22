/**
 * Deterministic day-by-day schedule allocation (Section 8) - pure
 * arithmetic, no model call. Strategy, documented for the README:
 *
 *  1. Sort questions by (requirement priority desc, difficulty desc) so
 *     must-have and harder material is considered first.
 *  2. Walk the sorted list and round-robin-assign into `days` buckets, but
 *     bias early days to receive more minutes: day i's target share of the
 *     total time is weighted by (days - i), so day 1 gets the most, day N
 *     the least. This satisfies "harder and higher-priority material lands
 *     earlier, not the night before" without needing a topic taxonomy.
 *  3. Every must-have requirement is guaranteed a slot: if the weighted
 *     walk would leave a must-have requirement's only question(s) out of
 *     the schedule (can happen with very few days), they are force-placed
 *     into day 1 before the rest of the walk runs.
 *  4. Minutes per question are estimated from difficulty (10/15/20 min for
 *     difficulty 1/2/3) and rounded to whole minutes, satisfying "Durations
 *     are integer minutes."
 */
const MINUTES_BY_DIFFICULTY = { 1: 10, 2: 15, 3: 20 };

export function buildSchedule({ requirements, questions, daysAvailable }) {
  const days = Math.max(1, Math.min(60, Math.round(daysAvailable) || 1));

  const mustIds = new Set(requirements.filter((r) => r.priority === 'must').map((r) => r.id));
  const priorityRank = (q) => (q.requirement_ids?.some((id) => mustIds.has(id)) ? 0 : 1);

  const sorted = [...questions].sort((a, b) => {
    const p = priorityRank(a) - priorityRank(b);
    if (p !== 0) return p;
    return (b.difficulty || 2) - (a.difficulty || 2);
  });

  const buckets = Array.from({ length: days }, () => []);

  // Weighted round-robin: earlier days get proportionally more picks.
  const weights = Array.from({ length: days }, (_, i) => days - i);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const quota = weights.map((w) => Math.max(1, Math.round((w / totalWeight) * sorted.length)));

  let qi = 0;
  for (let d = 0; d < days && qi < sorted.length; d += 1) {
    let count = 0;
    while (count < quota[d] && qi < sorted.length) {
      buckets[d].push(sorted[qi]);
      qi += 1;
      count += 1;
    }
  }
  // Any leftover (rounding) spills into the last day.
  while (qi < sorted.length) {
    buckets[days - 1].push(sorted[qi]);
    qi += 1;
  }

  // Guarantee every must-have requirement appears somewhere; if it's
  // missing (edge case: 1-day schedule with more musts than quota[0]
  // captured), pull its question(s) into day 1.
  const placedRequirementIds = new Set();
  buckets.flat().forEach((q) => (q.requirement_ids || []).forEach((id) => placedRequirementIds.add(id)));
  for (const rid of mustIds) {
    if (placedRequirementIds.has(rid)) continue;
    const q = sorted.find((qq) => qq.requirement_ids?.includes(rid));
    if (q && !buckets[0].includes(q)) buckets[0].push(q);
  }

  return {
    days_available: days,
    days: buckets.map((qs, i) => {
      const minutes = qs.reduce((sum, q) => sum + (MINUTES_BY_DIFFICULTY[q.difficulty] || 15), 0);
      const focus = qs.length
        ? [...new Set(qs.map((q) => q.category))].join(' + ')
        : 'Light review / buffer';
      return {
        day: i + 1,
        focus,
        question_ids: qs.map((q) => q.id),
        minutes: Math.round(minutes),
      };
    }),
  };
}
