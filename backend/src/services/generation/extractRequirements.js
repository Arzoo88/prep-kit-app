import { completeJSON, fence } from '../llm/llmClient.js';

/**
 * Extracts role info + a list of stable-id'd requirements from the pasted
 * job description. "must" vs "nice" is taken from how the posting words
 * the line (a "required" line vs a "bonus points for" line - Section 5),
 * and the model is explicitly told not to invent requirements the text
 * doesn't support (Section 10).
 */
export async function extractRequirements(jd) {
  const system = `You extract structured role information from a job description.
Rules:
- Only include requirements that are actually stated or clearly implied in the text. If the description is thin, return few requirements rather than inventing ones.
- priority "must" is for language like "required", "must have", "X+ years of"; priority "nice" is for "bonus", "nice to have", "preferred".
- kind is one of: technical, behavioural, domain.
- Give each requirement a short stable id like "r1", "r2", ...`;

  const user = `${fence('JOB_DESCRIPTION', jd)}

Return JSON exactly in this shape:
{
  "title": "",
  "seniority": "",
  "responsibilities": ["..."],
  "requirements": [
    { "id": "r1", "text": "", "kind": "technical", "priority": "must" }
  ]
}`;

  const result = await completeJSON({ system, user, maxTokens: 1200 });

  // Defensive normalisation - never trust the model's shape blindly.
  const requirements = Array.isArray(result.requirements) ? result.requirements : [];
  return {
    title: String(result.title || '').trim(),
    seniority: String(result.seniority || '').trim(),
    responsibilities: Array.isArray(result.responsibilities) ? result.responsibilities.map(String) : [],
    requirements: requirements.map((r, i) => ({
      id: r.id || `r${i + 1}`,
      text: String(r.text || '').trim(),
      kind: ['technical', 'behavioural', 'domain'].includes(r.kind) ? r.kind : 'technical',
      priority: r.priority === 'nice' ? 'nice' : 'must',
    })).filter((r) => r.text.length > 0),
  };
}
