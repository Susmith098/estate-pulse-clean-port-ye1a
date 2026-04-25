import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, getCurrentUserId } from 'lyzr-architect';
import getLeadModel from '@/models/Lead';

async function handler(req: NextRequest) {
  try {
    const Model = await getLeadModel();

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

    if (req.method === 'PUT') {
      const body = await req.json();
      const { id, ...updates } = body;
      if (!id) {
        return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
      }
      const item = await Model.update(id, updates);
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
export const PUT = protectedHandler;
