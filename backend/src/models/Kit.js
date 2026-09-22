import mongoose from 'mongoose';

// The `data` field stores the kit in the exact shape required by Appendix A
// of the brief. We keep it as a loosely-typed sub-document (rather than a
// fully expanded Mongoose schema for every nested field) so the pipeline's
// output can be validated once, centrally, by services/validation/kitSchema.js
// and then persisted verbatim - one source of truth for "what a kit looks
// like", not two schemas that can drift apart.
const kitSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: ['generating', 'ready', 'failed'],
      default: 'generating',
    },
    // Raw input, kept so a kit can be regenerated/resumed later.
    input: {
      jd: String,
      companyUrl: String,
      days: Number,
    },
    error: {
      code: String,
      message: String,
    },
    // Per-request idempotency: hash of (jd + companyUrl + days) for the
    // owner, used to detect "same description and company submitted twice".
    dedupeKey: { type: String, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    // Tracks which question/flashcard ids were hand-added or hand-edited by
    // the user so a section regeneration can preserve them. See
    // services/generation/pipeline.js regenerateSection().
    pinned: {
      questionIds: { type: [String], default: [] },
      flashcardIds: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

export const Kit = mongoose.model('Kit', kitSchema);
