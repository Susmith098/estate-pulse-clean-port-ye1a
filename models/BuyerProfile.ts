import { initDB, createModel } from 'lyzr-architect';
let _model: any = null;
export default async function getBuyerProfileModel() {
  if (!_model) {
    await initDB();
    _model = createModel('BuyerProfile', {
      buyer_name: { type: String },
      budget_min: { type: Number },
      budget_max: { type: Number },
      location_pref: { type: String },
      bhk: { type: Number },
      amenities: [{ type: String }],
      purpose: { type: String },
      timeline: { type: String }
    });
  }
  return _model;
}
