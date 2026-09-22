import { completeJSON, fence } from '../llm/llmClient.js';

/**
 * Generates questions for ONE requirement + category at a time (Section 3:
 * "Generate questions for a given requirement and category" - a separate
 * call per requirement, not one call that returns everything). This is why
 * a requirement like "5+ years React" naturally produces technical
 * questions while "mentors junior engineers" produces behavioural ones:
 * each call only sees one requirement's text and is told which category to
 * write in, rather than one prompt guessing at all categories for
 * everything at once.
 */
export async function generateQuestionsForRequirement({ requirement, category, hiringPageText, existingIds }) {
  const system = `You write interview questions that test a SINGLE stated requirement, in a SINGLE category.
Categories: technical (hands-on knowledge/skills), behavioural (past experience, soft skills), system-design (architecture/scaling), company-fit (motivation, values alignment).
Write 1-3 questions. difficulty is 1 (easy) to 3 (hard). answer_outline is a short bullet-style outline of what a strong answer covers, not a full essay.`;

  const context = hiringPageText
    ? `The company's own hiring page describes their process as:\n${hiringPageText.slice(0, 1000)}\nShape question style/format to match this where relevant (e.g. if they mention a take-home or system design round).`
    : 'No information about this company\'s interview format is available; write general, well-scoped questions.';

  const user = `Requirement: "${requirement.text}" (kind: ${requirement.kind}, priority: ${requirement.priority})
Category to write in: ${category}
${fence('HIRING_CONTEXT', context)}

Return JSON exactly:
{ "questions": [ { "prompt": "", "answer_outline": "", "difficulty": 2 } ] }`;

  const result = await completeJSON({ system, user, maxTokens: 700 });
  const questions = Array.isArray(result.questions) ? result.questions : [];

  let n = existingIds.size;
  return questions.map((q) => {
    n += 1;
    const id = `q${n}`;
    existingIds.add(id);
    return {
      id,
      requirement_ids: [requirement.id],
      category,
      prompt: String(q.prompt || '').trim(),
      answer_outline: String(q.answer_outline || '').trim(),
      difficulty: [1, 2, 3].includes(q.difficulty) ? q.difficulty : 2,
    };
  }).filter((q) => q.prompt.length > 0);
}

// technical/domain requirements lean toward technical+system-design
// questions; behavioural requirements lean toward behavioural+company-fit.
// This is the deterministic *routing* of which categories to ask the model
// for per requirement - the model still writes the actual questions.
export function categoriesFor(requirement) {
  if (requirement.kind === 'behavioural') return ['behavioural', 'company-fit'];
  if (requirement.kind === 'domain') return ['technical', 'company-fit'];
  return ['technical', 'system-design'];
}
