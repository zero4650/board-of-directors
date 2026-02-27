import { NextRequest, NextResponse } from 'next/server';
import { createCloudStorageSync } from '@/lib/workflow/ultimate-completeness';

// 获取单个会话
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const storage = createCloudStorageSync();
  const data = await storage.load(params.id);
  
  if (!data) {
    return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  }
  
  return NextResponse.json(data);
}

// 删除会话
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const storage = createCloudStorageSync();
  const success = await storage.delete(params.id);
  
  return NextResponse.json({ success });
}
