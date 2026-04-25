import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, getCurrentUserId } from 'lyzr-architect';
import getBuyerProfileModel from '@/models/BuyerProfile';

async function handler(req: NextRequest) {
  try {
    const Model = await getBuyerProfileModel();

    if (req.method === 'GET') {
      const items = await Model.find({});
      return NextResponse.json({ success: true, data: items });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const item = await Model.create({ ...body, owner_user_id: getCurrentUserId() });
      return NextResponse.json({ success: true, data: item }, { status: 201 });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      const { id, ...updates } = body;
      if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
      const item = await Model.findByIdAndUpdate(id, updates);
      return NextResponse.json({ success: true, data: item });
    }

    if (req.method === 'DELETE') {
      const id = req.nextUrl.searchParams.get('id');
      if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
      await Model.findByIdAndDelete(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 });
  } catch (error: any) {
    console.error('[API] buyer-profiles error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

const protectedHandler = authMiddleware(handler);
export const GET = protectedHandler;
export const POST = protectedHandler;
export const PUT = protectedHandler;
export const DELETE = protectedHandler;
