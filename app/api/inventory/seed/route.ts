import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, getCurrentUserId } from 'lyzr-architect';
import getInventoryModel from '@/models/Inventory';

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
    const Model = await getInventoryModel();
    const existing = await Model.find({});
    if (existing.length > 0) {
      return NextResponse.json({ success: true, message: 'Already seeded', count: existing.length });
    }
    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'items array required' }, { status: 400 });
    }
    const userId = getCurrentUserId();
    for (const item of items) {
      await Model.create({ ...item, owner_user_id: userId });
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error: any) {
    console.error('[API] inventory/seed error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
});
