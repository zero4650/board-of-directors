import { NextRequest, NextResponse } from 'next/server';
import { getLearningEffectReport, loadDeepLearningSystem } from '@/lib/workflow/final-completeness';

export async function GET() {
  const report = getLearningEffectReport();
  const system = loadDeepLearningSystem();
  
  return NextResponse.json({
    overall: system.accuracy.overall.total > 0 
      ? system.accuracy.overall.correct / system.accuracy.overall.total 
      : 0,
    byRole: Object.fromEntries(
      Object.entries(system.accuracy.byRole).map(([k, v]) => [
        k, 
        v.total > 0 ? v.correct / v.total : 0
      ])
    ),
    recentTrend: report.accuracyTrend,
    rulesLearned: report.rulesLearned,
    casesCollected: report.casesCollected,
    overallImprovement: report.overallImprovement,
    topRules: report.topRules,
  });
}
