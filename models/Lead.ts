import { initDB, createModel } from 'lyzr-architect';
let _model: any = null;
export default async function getLeadModel() {
  if (!_model) {
    await initDB();
    _model = createModel('Lead', {
      buyer_profile_id: { type: String, required: true },
      buyer_name: { type: String },
      lead_score: { type: String, enum: ['Hot', 'Warm', 'Cold'] },
      score_reasoning: { type: String },
      ai_summary: { type: String },
      recommended_units: { type: String },
      pitch_message: { type: String },
      next_action: { type: String },
      status: { type: String, default: 'new' }
    });
  }
  return _model;
}
