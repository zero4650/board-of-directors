import { NextRequest, NextResponse } from 'next/server';
import { createCloudStorageSync } from '@/lib/workflow/ultimate-completeness';

// 获取会话列表
export async function GET() {
  const storage = createCloudStorageSync();
  const sessions = await storage.list();
  
  const sessionData = await Promise.all(
    sessions.map(async (id) => {
      const data = await storage.load(id);
      return {
        id,
        userInput: data?.userInput || '',
        timestamp: data?.timestamp || null,
      };
    })
  );
  
  return NextResponse.json(sessionData);
}

// 保存新会话
export async function POST(request: NextRequest) {
  const data = await request.json();
  
  const storage = createCloudStorageSync();
  const id = `session_${Date.now()}`;
  
  const success = await storage.save(id, {
    ...data,
    timestamp: new Date(),
  });
  
  return NextResponse.json({ success, id });
}
