import { crawlCompanySite } from '../retrieval/crawler.js';
import { searchPublicDiscussion } from '../retrieval/discussionSearch.js';
import { extractRequirements } from './extractRequirements.js';
import { generateCompanyBrief } from './companyBrief.js';
import { generateQuestionsForRequirement, categoriesFor } from './generateQuestions.js';
import { checkCoverage } from './coverageCheck.js';
import { buildSchedule } from './schedule.js';
import { buildFlashcards } from './flashcards.js';
import { validateKit } from '../validation/kitSchema.js';

const MAX_COVERAGE_PASSES = 2;
// Two passes: draft, then one gap-filling pass. A kit that still has
// uncovered musts after that means the requirement itself was too vague
// for the model to write a question against twice in a row - at that
// point more retries buy little and burn free-tier tokens, so we stop and
// report the residual gap honestly (Section 4 leaves this choice to us).

/**
 * Runs the full research + generation pipeline for one case. This is the
 * SAME function used by the HTTP kit-creation route and by the batch CLI
 * (bin/evaluate.js), per Section 9's "the same code your application uses,
 * not a parallel implementation".
 *
 * The sequencing is deliberate and genuine, per Section 3:
 *  1. Pasted JD -> extractRequirements (no retrieval needed for this step)
 *  2. Company homepage -> crawlCompanySite (crawling required before the
 *     company brief can be written)
 *  3. Hiring page, if found -> changes question *style* (fed into
 *     generateQuestionsForRequirement as hiring context)
 *  4. Public discussion search
 *  5. Company brief generation (needs 2+4)
 *  6. Per-requirement, per-category question generation (needs 1+3)
 *  7. Deterministic coverage check -> second pass on gaps only
 *  8. Deterministic schedule allocation
 *  9. Flashcard derivation
 *  10. Structure validation against Appendix A
 */
export async function generateKit({ jd, companyUrl, days }, { allowLoopback = false } = {}) {
  const skipped = [];

  const roleInfo = await extractRequirements(jd);

  const crawl = await crawlCompanySite(companyUrl, { allowLoopback });
  skipped.push(...crawl.skipped);

  const companyName = crawl.pagesUsed[0]?.title || new URL(companyUrl).hostname;
  const discussion = await searchPublicDiscussion(companyName);

  const companyBrief = await generateCompanyBrief({
    companyName,
    companyUrl,
    pagesUsed: crawl.pagesUsed,
    hiringPage: crawl.hiringPage,
    discussion,
  });

  let questions = [];
  const usedIds = new Set();
  const hiringText = crawl.hiringPage?.text || '';

  async function generateForRequirements(requirements) {
    for (const requirement of requirements) {
      for (const category of categoriesFor(requirement)) {
        try {
          const qs = await generateQuestionsForRequirement({
            requirement,
            category,
            hiringPageText: hiringText,
            existingIds: usedIds,
          });
          questions.push(...qs);
        } catch (err) {
          // A single requirement/category call failing doesn't fail the
          // whole run - it just leaves that spot uncovered, which the
          // coverage pass below will catch and retry.
          skipped.push({ url: null, reason: err.code || 'LLM_ERROR', message: `requirement ${requirement.id}/${category}: ${err.message}` });
        }
      }
    }
  }

  await generateForRequirements(roleInfo.requirements);

  let coverage = checkCoverage(roleInfo.requirements, questions);
  let passes = 1;
  while (coverage.uncoveredMustHaveIds.length > 0 && passes < MAX_COVERAGE_PASSES) {
    const gapRequirements = roleInfo.requirements.filter((r) => coverage.uncoveredMustHaveIds.includes(r.id));
    await generateForRequirements(gapRequirements);
    coverage = checkCoverage(roleInfo.requirements, questions);
    passes += 1;
  }

  const schedule = buildSchedule({ requirements: roleInfo.requirements, questions, daysAvailable: days });
  const flashcards = buildFlashcards(questions);

  const kit = {
    source: {
      company: companyName,
      company_url: companyUrl,
      role: roleInfo.title,
      location: '',
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: crawl.pagesUsed.map((p) => p.url),
    },
    company_brief: companyBrief,
    role: {
      title: roleInfo.title,
      seniority: roleInfo.seniority,
      responsibilities: roleInfo.responsibilities,
      requirements: roleInfo.requirements,
    },
    questions,
    flashcards,
    schedule,
    coverage: {
      uncovered_requirement_ids: coverage.uncoveredRequirementIds,
      passes,
    },
  };

  const validation = validateKit(kit);
  return { kit, validation, skipped, discussion };
}

/**
 * Regenerates ONE section of an existing, persisted kit without discarding
 * user edits made elsewhere - and without discarding hand-edited/hand-added
 * questions or flashcards *within* the regenerated section either.
 *
 * State model (documented in README "How generated/edited/pinned state is
 * represented"): a kit's `pinned` sub-document on the Mongo record stores
 * the ids of questions/flashcards the user has hand-added or hand-edited.
 * When a section is regenerated:
 *  - "company_brief" / "schedule": fully replaced (they have no per-item
 *    user edits to preserve individually; schedule is rebuilt from
 *    whatever the current question set is, so builder edits to questions
 *    still flow through).
 *  - a question CATEGORY (e.g. "technical"): pinned questions in that
 *    category are kept as-is; only non-pinned, model-authored questions in
 *    that category are discarded and replaced with a fresh batch. The
 *    schedule and flashcards are then rebuilt from the merged question
 *    list so they stay consistent.
 */
export async function regenerateSection({ kitDoc, section, category }) {
  const data = kitDoc.data;
  const pinnedQuestionIds = new Set(kitDoc.pinned?.questionIds || []);

  if (section === 'company_brief') {
    const crawl = await crawlCompanySite(data.source.company_url, {});
    const discussion = await searchPublicDiscussion(data.source.company);
    data.company_brief = await generateCompanyBrief({
      companyName: data.source.company,
      companyUrl: data.source.company_url,
      pagesUsed: crawl.pagesUsed.length ? crawl.pagesUsed : [{ url: data.source.company_url, title: '', text: '' }],
      hiringPage: crawl.hiringPage,
      discussion,
    });
    return data;
  }

  if (section === 'schedule') {
    data.schedule = buildSchedule({ requirements: data.role.requirements, questions: data.questions, daysAvailable: data.schedule.days_available });
    return data;
  }

  if (section === 'questions' && category) {
    const kept = data.questions.filter((q) => q.category !== category || pinnedQuestionIds.has(q.id));
    const usedIds = new Set(data.questions.map((q) => q.id));
    const relevantRequirements = data.role.requirements.filter((r) => categoriesFor(r).includes(category));

    const fresh = [];
    for (const requirement of relevantRequirements) {
      const qs = await generateQuestionsForRequirement({
        requirement,
        category,
        hiringPageText: '',
        existingIds: usedIds,
      });
      fresh.push(...qs);
    }

    data.questions = [...kept, ...fresh];
    data.coverage = {
      uncovered_requirement_ids: checkCoverage(data.role.requirements, data.questions).uncoveredRequirementIds,
      passes: data.coverage.passes,
    };
    // Rebuild flashcards/schedule from the merged set, preserving pinned
    // flashcards the same way.
    const pinnedFlashcardIds = new Set(kitDoc.pinned?.flashcardIds || []);
    const keptFlashcards = data.flashcards.filter((f) => pinnedFlashcardIds.has(f.id));
    const keptFlashcardQIds = new Set(keptFlashcards.map((f) => f.requirement_ids?.join(',')));
    const freshFlashcards = buildFlashcards(data.questions.filter((q) => !pinnedQuestionIds.has(q.id) || !keptFlashcardQIds.has(q.requirement_ids?.join(','))));
    data.flashcards = [...keptFlashcards, ...freshFlashcards.filter((f) => !keptFlashcards.some((k) => k.front === f.front))];
    data.schedule = buildSchedule({ requirements: data.role.requirements, questions: data.questions, daysAvailable: data.schedule.days_available });
    return data;
  }

  const err = new Error(`Unknown regeneration target: section=${section} category=${category}`);
  err.code = 'INVALID_SECTION';
  throw err;
}
