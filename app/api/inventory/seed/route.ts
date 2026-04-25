import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, getCurrentUserId } from 'lyzr-architect';
import getInventoryModel from '@/models/Inventory';


const MAX_SEED_ITEMS = 20;

async function handler(req: NextRequest) {
  try {
    const Model = await getInventoryModel();
    const existing = await Model.find({});

    if (Array.isArray(existing) && existing.length >= MAX_SEED_ITEMS) {
      return NextResponse.json({ success: true, message: 'Already seeded', count: existing.length });
    }

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ success: true, message: 'Data already exists', count: existing.length });
    }

    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items.slice(0, MAX_SEED_ITEMS) : [];

    const userId = getCurrentUserId();
    for (const item of items) {
      await Model.create({ ...item, owner_user_id: userId });
    }

    return NextResponse.json({ success: true, message: 'Seeded', count: items.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

const protectedHandler = authMiddleware(handler);
export const POST = protectedHandler;
