/**
 * Flashcards are derived deterministically from the final question bank
 * rather than via another model call: front = the question prompt, back =
 * a condensed answer outline. This keeps flashcards guaranteed-consistent
 * with the questions (same requirement coverage, no extra hallucination
 * surface) and avoids burning additional free-tier tokens on content that
 * is a re-shaping of data we already generated. Documented as a deliberate
 * choice in the README.
 */
export function buildFlashcards(questions) {
  return questions.map((q, i) => ({
    id: `f${i + 1}`,
    front: q.prompt,
    back: q.answer_outline || '(no outline generated)',
    requirement_ids: q.requirement_ids || [],
  }));
}
