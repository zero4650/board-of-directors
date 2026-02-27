import { NextRequest, NextResponse } from 'next/server';
import { 
  loadDeepLearningSystem, 
  saveDeepLearningSystem,
  learnFromFeedbackDeep,
  getLearningEffectReport 
} from '@/lib/workflow/final-completeness';

// 获取学习效果报告
export async function GET() {
  const report = getLearningEffectReport();
  return NextResponse.json(report);
}

// 处理反馈并学习
export async function POST(request: NextRequest) {
  try {
    const feedback = await request.json();
    
    // 深度学习
    learnFromFeedbackDeep(feedback);
    
    // 获取学习效果
    const report = getLearningEffectReport();
    
    return NextResponse.json({ 
      success: true, 
      message: '反馈已保存，系统已深度学习',
      learningEffect: report,
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
