import { Router } from 'express';
import crypto from 'node:crypto';
import { Kit } from '../models/Kit.js';
import { requireAuth } from '../middleware/auth.js';
import { generateKit, regenerateSection } from '../services/generation/pipeline.js';

const router = Router();
router.use(requireAuth);

function dedupeKey({ jd, companyUrl, days }) {
  return crypto.createHash('sha256').update(`${jd}::${companyUrl}::${days}`).digest('hex');
}

router.get('/', async (req, res, next) => {
  try {
    const kits = await Kit.find({ owner: req.session.userId }).select('-data').sort('-createdAt');
    res.json(kits);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const kit = await Kit.findOne({ _id: req.params.id, owner: req.session.userId });
    if (!kit) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    res.json(kit);
  } catch (err) { next(err); }
});

// Create a kit (or a batch of them) and generate asynchronously so the
// interface can show progress rather than blocking a 90s+ request.
router.post('/', async (req, res, next) => {
  try {
    const cases = Array.isArray(req.body.cases) ? req.body.cases : [req.body];
    const created = [];
    for (const c of cases) {
      const { jd, companyUrl, days } = c;
      if (!jd || !companyUrl || !days) {
        created.push({ error: 'jd, companyUrl and days are required' });
        continue;
      }
      const key = dedupeKey({ jd, companyUrl, days });
      const existing = await Kit.findOne({ owner: req.session.userId, dedupeKey: key });
      if (existing) {
        created.push(existing);
        continue;
      }
      const kit = await Kit.create({
        owner: req.session.userId,
        status: 'generating',
        input: { jd, companyUrl, days },
        dedupeKey: key,
      });
      created.push(kit);
      runGeneration(kit._id, { jd, companyUrl, days });
    }
    res.status(202).json(created);
  } catch (err) { next(err); }
});

async function runGeneration(kitId, input) {
  try {
    const { kit, validation, skipped } = await generateKit(input);
    if (!validation.valid) {
      await Kit.findByIdAndUpdate(kitId, {
        status: 'failed',
        error: { code: 'INVALID_KIT_STRUCTURE', message: validation.errors.join('; ') },
      });
      return;
    }
    await Kit.findByIdAndUpdate(kitId, { status: 'ready', data: kit, error: null, 'input.skipped': skipped });
  } catch (err) {
    await Kit.findByIdAndUpdate(kitId, {
      status: 'failed',
      error: { code: err.code || 'GENERATION_ERROR', message: err.message },
    });
  }
}

router.post('/:id/regenerate', async (req, res, next) => {
  try {
    const kit = await Kit.findOne({ _id: req.params.id, owner: req.session.userId });
    if (!kit) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    const { section, category } = req.body;
    kit.data = await regenerateSection({ kitDoc: kit, section, category });
    await kit.save();
    res.json(kit);
  } catch (err) { next(err); }
});

// Generic edit endpoint for the builder: replace kit.data wholesale after
// client-side edit/reorder/add/delete, and record which question/flashcard
// ids are now hand-authored so future regenerations preserve them.
router.put('/:id', async (req, res, next) => {
  try {
    const kit = await Kit.findOne({ _id: req.params.id, owner: req.session.userId });
    if (!kit) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    const { data, pinnedQuestionIds, pinnedFlashcardIds } = req.body;
    if (data) kit.data = data;
    if (pinnedQuestionIds) kit.pinned.questionIds = pinnedQuestionIds;
    if (pinnedFlashcardIds) kit.pinned.flashcardIds = pinnedFlashcardIds;
    await kit.save();
    res.json(kit);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Kit.deleteOne({ _id: req.params.id, owner: req.session.userId });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
