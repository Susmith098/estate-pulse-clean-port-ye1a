import { initDB, createModel } from 'lyzr-architect';
let _model: any = null;
export default async function getInventoryModel() {
  if (!_model) {
    await initDB();
    _model = createModel('Inventory', {
      project_name: { type: String, required: true },
      tower: { type: String },
      unit_number: { type: String, required: true },
      bhk: { type: Number, required: true },
      area_sqft: { type: Number, required: true },
      price: { type: Number, required: true },
      location: { type: String, required: true },
      floor: { type: Number },
      amenities: [{ type: String }],
      status: { type: String, default: 'available', enum: ['available', 'sold', 'reserved'] }
    });
  }
  return _model;
}
