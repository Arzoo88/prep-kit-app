/**
 * Validates a generated kit against the exact structure in Appendix A
 * before it is persisted or written to the batch output file. Hand-rolled
 * rather than a schema library dependency, kept deliberately close to the
 * literal field list in the brief so it's easy to audit against Appendix A
 * line by line.
 */
export function validateKit(kit) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };

  req(kit && typeof kit === 'object', 'kit must be an object');
  if (!kit) return { valid: false, errors };

  req(kit.source && typeof kit.source === 'object', 'source missing');
  req(typeof kit.source?.company === 'string', 'source.company must be a string');
  req(typeof kit.source?.company_url === 'string', 'source.company_url must be a string');
  req(Array.isArray(kit.source?.pages_used), 'source.pages_used must be an array');

  req(kit.company_brief && typeof kit.company_brief.summary === 'string', 'company_brief.summary missing');

  req(kit.role && typeof kit.role === 'object', 'role missing');
  req(Array.isArray(kit.role?.requirements), 'role.requirements must be an array');
  const reqIds = new Set();
  (kit.role?.requirements || []).forEach((r, i) => {
    req(typeof r.id === 'string' && r.id.length > 0, `role.requirements[${i}].id missing`);
    req(['technical', 'behavioural', 'domain'].includes(r.kind), `role.requirements[${i}].kind invalid`);
    req(['must', 'nice'].includes(r.priority), `role.requirements[${i}].priority invalid`);
    reqIds.add(r.id);
  });

  req(Array.isArray(kit.questions), 'questions must be an array');
  const qIds = new Set();
  (kit.questions || []).forEach((q, i) => {
    req(typeof q.id === 'string' && q.id.length > 0, `questions[${i}].id missing`);
    req(Array.isArray(q.requirement_ids), `questions[${i}].requirement_ids must be an array`);
    req(Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 3, `questions[${i}].difficulty must be int 1-3`);
    req(['technical', 'behavioural', 'system-design', 'company-fit'].includes(q.category), `questions[${i}].category invalid`);
    qIds.add(q.id);
  });

  req(Array.isArray(kit.flashcards), 'flashcards must be an array');

  req(kit.schedule && typeof kit.schedule === 'object', 'schedule missing');
  req(Number.isInteger(kit.schedule?.days_available), 'schedule.days_available must be an integer');
  req(Array.isArray(kit.schedule?.days), 'schedule.days must be an array');
  req(kit.schedule?.days?.length === kit.schedule?.days_available, 'schedule.days length must equal days_available');
  (kit.schedule?.days || []).forEach((d, i) => {
    req(Number.isInteger(d.minutes), `schedule.days[${i}].minutes must be an integer`);
    (d.question_ids || []).forEach((qid) => req(qIds.has(qid), `schedule.days[${i}] references unknown question id ${qid}`));
  });

  req(kit.coverage && Array.isArray(kit.coverage.uncovered_requirement_ids), 'coverage.uncovered_requirement_ids missing');
  req(Number.isInteger(kit.coverage?.passes), 'coverage.passes must be an integer');

  return { valid: errors.length === 0, errors };
}
