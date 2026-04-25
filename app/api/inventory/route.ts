import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, getCurrentUserId } from 'lyzr-architect';
import getInventoryModel from '@/models/Inventory';

async function handler(req: NextRequest) {
  try {
    const Model = await getInventoryModel();

    if (req.method === 'GET') {
      const items = await Model.findAll();
      return NextResponse.json({ success: true, data: items });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const item = await Model.create({
        ...body,
        owner_user_id: getCurrentUserId(),
      });
      return NextResponse.json({ success: true, data: item });
    }

    return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

const protectedHandler = authMiddleware(handler);
export const GET = protectedHandler;
export const POST = protectedHandler;
