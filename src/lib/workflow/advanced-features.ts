// 多议题并行处理与交叉验证系统
import { callWithFallback } from '../providers/api';
import { ROLES, USER_PROFILE } from './config';

// ==================== 多议题并行处理 ====================

export interface TopicExecutionContext {
  topicId: number;
  topicContent: string;
  topicType: 'forward' | 'reverse' | 'compare';
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: Record<string, string>;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

// 并行执行多个议题
export async function executeTopicsInParallel(
  topics: { id: number; content: string; type: 'forward' | 'reverse' | 'compare' }[],
  onProgress?: (topicId: number, status: string) => void
): Promise<TopicExecutionContext[]> {
  const contexts: TopicExecutionContext[] = topics.map(t => ({
    topicId: t.id,
    topicContent: t.content,
    topicType: t.type,
    status: 'pending',
    results: {},
  }));
  
  // 并行执行所有议题
  const promises = contexts.map(async (ctx) => {
    ctx.status = 'running';
    ctx.startTime = new Date();
    onProgress?.(ctx.topicId, 'running');
    
    try {
      // 根据议题类型执行不同的角色序列
      const roles = getRolesForTopicType(ctx.topicType);
      
      for (const roleId of roles) {
        const role = ROLES.find(r => r.id === roleId);
        if (!role) continue;
        
        const result = await callWithFallback(
          `${ctx.topicId}_${roleId}`,
          role.systemPrompt,
          ctx.topicContent,
          role.models
        );
        
        if (result.success) {
          ctx.results[roleId] = result.content;
        }
      }
      
      ctx.status = 'completed';
      ctx.endTime = new Date();
      onProgress?.(ctx.topicId, 'completed');
      
    } catch (error: any) {
      ctx.status = 'failed';
      ctx.error = error.message;
      onProgress?.(ctx.topicId, 'failed');
    }
    
    return ctx;
  });
  
  // 等待所有议题完成
  await Promise.all(promises);
  
  return contexts;
}

// 获取议题对应的角色
function getRolesForTopicType(type: 'forward' | 'reverse' | 'compare'): string[] {
  switch (type) {
    case 'forward':
      return ['chief_researcher', 'market_analyst', 'financial_analyst', 'decision_advisor'];
    case 'reverse':
      return ['market_analyst', 'industry_analyst', 'financial_analyst', 'risk_assessor', 'decision_advisor'];
    case 'compare':
      return ['chief_researcher', 'financial_analyst', 'decision_advisor'];
    default:
      return ['decision_advisor'];
  }
}

// ==================== 议题间交叉验证 ====================

export interface CrossValidationBetweenTopics {
  topic1Id: number;
  topic2Id: number;
  comparisonType: 'consistency' | 'contradiction' | 'complementary';
  conflictingPoints: {
    point: string;
    topic1Value: string;
    topic2Value: string;
    resolution: string;
  }[];
  consistentPoints: string[];
  overallConsistency: number; // 0-100
  recommendation: string;
}

// 交叉验证两个议题的结果
export async function crossValidateTopics(
  ctx1: TopicExecutionContext,
  ctx2: TopicExecutionContext
): Promise<CrossValidationBetweenTopics> {
  const conflictingPoints: CrossValidationBetweenTopics['conflictingPoints'] = [];
  const consistentPoints: string[] = [];
  
  // 提取关键数据点进行对比
  const extractKeyPoints = (results: Record<string, string>): Map<string, string> => {
    const points = new Map<string, string>();
    
    for (const [roleId, content] of Object.entries(results)) {
      // 提取数字和结论
      const numberMatches = content.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨|%|个月)/g);
      for (const match of numberMatches) {
        points.set(`数字_${match[0]}`, match[0]);
      }
      
      // 提取结论性语句
      const conclusionMatches = content.matchAll(/(结论|建议|推荐|判断)[：:]\s*([^。\n]+)/g);
      for (const match of conclusionMatches) {
        points.set(`结论_${match[2]}`, match[2]);
      }
    }
    
    return points;
  };
  
  const points1 = extractKeyPoints(ctx1.results);
  const points2 = extractKeyPoints(ctx2.results);
  
  // 对比数据点
  for (const [key1, value1] of points1) {
    for (const [key2, value2] of points2) {
      // 检查是否有冲突
      if (key1.startsWith('数字_') && key2.startsWith('数字_')) {
        const num1 = parseFloat(value1);
        const num2 = parseFloat(value2);
        
        if (Math.abs(num1 - num2) > num1 * 0.3) {
          // 差异超过30%，认为是冲突
          conflictingPoints.push({
            point: '数值差异',
            topic1Value: value1,
            topic2Value: value2,
            resolution: '需要进一步核实数据来源',
          });
        } else {
          consistentPoints.push(`数值一致: ${value1}`);
        }
      }
    }
  }
  
  // 计算一致性
  const total = conflictingPoints.length + consistentPoints.length;
  const overallConsistency = total > 0 ? (consistentPoints.length / total) * 100 : 100;
  
  // 生成建议
  let recommendation = '';
  if (overallConsistency >= 80) {
    recommendation = '两个议题的分析结果高度一致，结论可信';
  } else if (overallConsistency >= 50) {
    recommendation = '两个议题的分析结果存在部分差异，建议核实关键数据';
  } else {
    recommendation = '两个议题的分析结果存在较大冲突，需要重新分析';
  }
  
  return {
    topic1Id: ctx1.topicId,
    topic2Id: ctx2.topicId,
    comparisonType: conflictingPoints.length > 0 ? 'contradiction' : 'consistency',
    conflictingPoints,
    consistentPoints,
    overallConsistency,
    recommendation,
  };
}

// 对所有议题进行交叉验证
export async function crossValidateAllTopics(
  contexts: TopicExecutionContext[]
): Promise<CrossValidationBetweenTopics[]> {
  const results: CrossValidationBetweenTopics[] = [];
  
  for (let i = 0; i < contexts.length; i++) {
    for (let j = i + 1; j < contexts.length; j++) {
      const validation = await crossValidateTopics(contexts[i], contexts[j]);
      results.push(validation);
    }
  }
  
  return results;
}

// ==================== 混合模式置信度评级 ====================

export interface MixedModeConfidence {
  overallConfidence: 'A' | 'B' | 'C';
  overallScore: number;
  
  // 各路径置信度
  forwardPath: {
    confidence: 'A' | 'B' | 'C';
    score: number;
    issues: string[];
  };
  reversePath: {
    confidence: 'A' | 'B' | 'C';
    score: number;
    issues: string[];
  };
  
  // 冲突分析
  conflicts: {
    type: 'data_conflict' | 'conclusion_conflict' | 'recommendation_conflict';
    description: string;
    severity: 'low' | 'medium' | 'high';
    resolution: string;
  }[];
  
  // 最终建议
  finalRecommendation: string;
}

// 计算混合模式置信度
export function calculateMixedModeConfidence(
  forwardResults: Record<string, string>,
  reverseResults: Record<string, string>,
  crossValidations: CrossValidationBetweenTopics[]
): MixedModeConfidence {
  const conflicts: MixedModeConfidence['conflicts'] = [];
  
  // 分析交叉验证结果
  for (const cv of crossValidations) {
    for (const cp of cv.conflictingPoints) {
      conflicts.push({
        type: 'data_conflict',
        description: `${cp.point}: 正推=${cp.topic1Value}, 倒推=${cp.topic2Value}`,
        severity: Math.abs(parseFloat(cp.topic1Value) - parseFloat(cp.topic2Value)) > 50 ? 'high' : 'medium',
        resolution: cp.resolution,
      });
    }
  }
  
  // 计算正推路径置信度
  const forwardIssues: string[] = [];
  let forwardScore = 100;
  
  if (!forwardResults['financial_analyst']) {
    forwardIssues.push('缺少财务分析');
    forwardScore -= 20;
  }
  if (!forwardResults['market_analyst']) {
    forwardIssues.push('缺少市场分析');
    forwardScore -= 20;
  }
  
  const forwardConfidence: 'A' | 'B' | 'C' = forwardScore >= 80 ? 'A' : forwardScore >= 60 ? 'B' : 'C';
  
  // 计算倒推路径置信度
  const reverseIssues: string[] = [];
  let reverseScore = 100;
  
  if (!reverseResults['risk_assessor']) {
    reverseIssues.push('缺少风险评估');
    reverseScore -= 20;
  }
  if (!reverseResults['industry_analyst']) {
    reverseIssues.push('缺少行业分析');
    reverseScore -= 20;
  }
  
  const reverseConfidence: 'A' | 'B' | 'C' = reverseScore >= 80 ? 'A' : reverseScore >= 60 ? 'B' : 'C';
  
  // 计算整体置信度
  let overallScore = (forwardScore + reverseScore) / 2;
  
  // 冲突扣分
  for (const conflict of conflicts) {
    if (conflict.severity === 'high') overallScore -= 15;
    else if (conflict.severity === 'medium') overallScore -= 8;
    else overallScore -= 3;
  }
  
  overallScore = Math.max(0, Math.min(100, overallScore));
  const overallConfidence: 'A' | 'B' | 'C' = overallScore >= 80 ? 'A' : overallScore >= 60 ? 'B' : 'C';
  
  // 生成最终建议
  let finalRecommendation = '';
  
  if (conflicts.length === 0) {
    finalRecommendation = '正推与倒推结果一致，结论高度可信';
  } else if (conflicts.filter(c => c.severity === 'high').length > 0) {
    finalRecommendation = '正推与倒推存在重大冲突，建议人工审核关键数据';
  } else {
    finalRecommendation = '正推与倒推存在轻微差异，结论基本可信';
  }
  
  return {
    overallConfidence,
    overallScore,
    forwardPath: { confidence: forwardConfidence, score: forwardScore, issues: forwardIssues },
    reversePath: { confidence: reverseConfidence, score: reverseScore, issues: reverseIssues },
    conflicts,
    finalRecommendation,
  };
}

// ==================== 对比模式基准对比 ====================

export interface BenchmarkComparison {
  baselineProject: {
    name: string;
    scores: {
      startupCost: number;
      riskLevel: number;
      profitPotential: number;
      resourceMatch: number;
      timeToProfit: number;
    };
    totalScore: number;
  };
  
  comparisonProject: {
    name: string;
    scores: {
      startupCost: number;
      riskLevel: number;
      profitPotential: number;
      resourceMatch: number;
      timeToProfit: number;
    };
    totalScore: number;
  };
  
  comparison: {
    dimension: string;
    baseline: number;
    comparison: number;
    winner: 'baseline' | 'comparison' | 'tie';
    difference: number;
    analysis: string;
  }[];
  
  overallWinner: 'baseline' | 'comparison' | 'tie';
  recommendation: string;
}

// 执行基准对比
export function executeBenchmarkComparison(
  baselineName: string,
  baselineAnalysis: Record<string, string>,
  comparisonName: string,
  comparisonAnalysis: Record<string, string>
): BenchmarkComparison {
  // 评分函数
  const scoreProject = (analysis: Record<string, string>) => {
    const content = Object.values(analysis).join('\n');
    
    // 启动成本评分（越低越好）
    let startupCost = 50;
    const costMatch = content.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
    if (costMatch) {
      const cost = parseFloat(costMatch[1]);
      startupCost = cost <= 5 ? 100 : cost <= 10 ? 80 : cost <= 15 ? 60 : 40;
    }
    
    // 风险评分（越低越好）
    let riskLevel = 50;
    if (content.includes('高风险') || content.includes('风险大')) {
      riskLevel = 30;
    } else if (content.includes('中等风险')) {
      riskLevel = 60;
    } else if (content.includes('低风险') || content.includes('风险小')) {
      riskLevel = 90;
    }
    
    // 利润潜力评分
    let profitPotential = 50;
    const profitMatch = content.match(/年净利润[^\d]*(\d+\.?\d*)\s*万/);
    if (profitMatch) {
      const profit = parseFloat(profitMatch[1]);
      profitPotential = profit >= 30 ? 100 : profit >= 20 ? 80 : profit >= 10 ? 60 : 40;
    }
    
    // 资源匹配评分
    let resourceMatch = 50;
    if (content.includes('完全匹配') || content.includes('高度匹配')) {
      resourceMatch = 90;
    } else if (content.includes('部分匹配')) {
      resourceMatch = 60;
    } else if (content.includes('不匹配')) {
      resourceMatch = 20;
    }
    
    // 回本周期评分
    let timeToProfit = 50;
    const roiMatch = content.match(/(\d+)\s*个?月.*回本/);
    if (roiMatch) {
      const months = parseInt(roiMatch[1]);
      timeToProfit = months <= 6 ? 100 : months <= 12 ? 80 : months <= 18 ? 60 : 40;
    }
    
    return {
      startupCost,
      riskLevel,
      profitPotential,
      resourceMatch,
      timeToProfit,
    };
  };
  
  const baselineScores = scoreProject(baselineAnalysis);
  const comparisonScores = scoreProject(comparisonAnalysis);
  
  const baselineTotal = Object.values(baselineScores).reduce((a, b) => a + b, 0);
  const comparisonTotal = Object.values(comparisonScores).reduce((a, b) => a + b, 0);
  
  // 维度对比
  const dimensions = [
    { key: 'startupCost', name: '启动成本' },
    { key: 'riskLevel', name: '风险等级' },
    { key: 'profitPotential', name: '利润潜力' },
    { key: 'resourceMatch', name: '资源匹配' },
    { key: 'timeToProfit', name: '回本周期' },
  ];
  
  const comparison = dimensions.map(dim => {
    const baseline = baselineScores[dim.key as keyof typeof baselineScores];
    const comparison = comparisonScores[dim.key as keyof typeof comparisonScores];
    const difference = baseline - comparison;
    
    let winner: 'baseline' | 'comparison' | 'tie' = 'tie';
    let analysis = '';
    
    if (difference > 10) {
      winner = 'baseline';
      analysis = `${baselineName}在此维度更优`;
    } else if (difference < -10) {
      winner = 'comparison';
      analysis = `${comparisonName}在此维度更优`;
    } else {
      analysis = '两者差异不大';
    }
    
    return {
      dimension: dim.name,
      baseline,
      comparison,
      winner,
      difference: Math.abs(difference),
      analysis,
    };
  });
  
  // 整体胜者
  let overallWinner: 'baseline' | 'comparison' | 'tie' = 'tie';
  if (baselineTotal > comparisonTotal + 20) {
    overallWinner = 'baseline';
  } else if (comparisonTotal > baselineTotal + 20) {
    overallWinner = 'comparison';
  }
  
  // 生成建议
  let recommendation = '';
  if (overallWinner === 'baseline') {
    recommendation = `综合评估，${baselineName}更适合当前条件，建议优先考虑`;
  } else if (overallWinner === 'comparison') {
    recommendation = `综合评估，${comparisonName}更适合当前条件，建议优先考虑`;
  } else {
    recommendation = '两个项目各有优劣，建议根据个人偏好和风险承受能力选择';
  }
  
  return {
    baselineProject: { name: baselineName, scores: baselineScores, totalScore: baselineTotal },
    comparisonProject: { name: comparisonName, scores: comparisonScores, totalScore: comparisonTotal },
    comparison,
    overallWinner,
    recommendation,
  };
}

// ==================== 深度三角验证 ====================

export interface DeepTriangulation {
  claim: string;
  sources: {
    source: string;
    url: string;
    content: string;
    level: 'level1' | 'level2' | 'level3';
    extractedValue: string;
    extractionMethod: 'direct' | 'calculated' | 'inferred';
  }[];
  verificationSteps: {
    step: number;
    description: string;
    result: 'pass' | 'fail' | 'warning';
    details: string;
  }[];
  finalVerification: 'verified' | 'partial' | 'unverified' | 'conflict';
  confidence: number;
  notes: string;
}

// 执行深度三角验证
export async function executeDeepTriangulation(
  claim: string,
  searchResults: { url: string; title: string; content: string }[]
): Promise<DeepTriangulation> {
  const sources: DeepTriangulation['sources'] = [];
  const verificationSteps: DeepTriangulation['verificationSteps'] = [];
  
  // 步骤1：提取来源
  verificationSteps.push({
    step: 1,
    description: '提取数据来源',
    result: searchResults.length >= 2 ? 'pass' : 'warning',
    details: `找到${searchResults.length}个来源`,
  });
  
  // 步骤2：分类来源等级
  for (const result of searchResults) {
    const level = classifySourceSimple(result.url);
    sources.push({
      source: result.title,
      url: result.url,
      content: result.content,
      level,
      extractedValue: extractValueFromContent(claim, result.content),
      extractionMethod: 'direct',
    });
  }
  
  const level1Count = sources.filter(s => s.level === 'level1').length;
  verificationSteps.push({
    step: 2,
    description: '验证来源等级',
    result: level1Count >= 1 ? 'pass' : 'warning',
    details: `一级来源${level1Count}个，二级来源${sources.filter(s => s.level === 'level2').length}个`,
  });
  
  // 步骤3：交叉验证数值
  const values = sources.map(s => s.extractedValue).filter(v => v);
  const uniqueValues = new Set(values);
  
  verificationSteps.push({
    step: 3,
    description: '交叉验证数值',
    result: uniqueValues.size === 1 ? 'pass' : uniqueValues.size <= 2 ? 'warning' : 'fail',
    details: `发现${uniqueValues.size}个不同数值: ${Array.from(uniqueValues).join(', ')}`,
  });
  
  // 步骤4：时效性检查
  const hasRecentData = searchResults.some(r => 
    r.content.includes('2024') || r.content.includes('2025') || r.content.includes('2026')
  );
  
  verificationSteps.push({
    step: 4,
    description: '检查数据时效性',
    result: hasRecentData ? 'pass' : 'warning',
    details: hasRecentData ? '数据为近期' : '数据可能过期',
  });
  
  // 计算置信度
  let confidence = 100;
  if (level1Count === 0) confidence -= 20;
  if (uniqueValues.size > 1) confidence -= 15 * (uniqueValues.size - 1);
  if (!hasRecentData) confidence -= 10;
  
  confidence = Math.max(0, Math.min(100, confidence));
  
  // 最终验证状态
  let finalVerification: DeepTriangulation['finalVerification'];
  if (confidence >= 80) {
    finalVerification = 'verified';
  } else if (confidence >= 60) {
    finalVerification = 'partial';
  } else if (confidence >= 40) {
    finalVerification = 'unverified';
  } else {
    finalVerification = 'conflict';
  }
  
  return {
    claim,
    sources,
    verificationSteps,
    finalVerification,
    confidence,
    notes: generateTriangulationNotes(verificationSteps),
  };
}

// 简单来源分类
function classifySourceSimple(url: string): 'level1' | 'level2' | 'level3' {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('gov.cn') || urlLower.includes('stats.gov')) {
    return 'level1';
  }
  if (urlLower.includes('reuters') || urlLower.includes('bloomberg') || urlLower.includes('caixin')) {
    return 'level2';
  }
  return 'level3';
}

// 从内容中提取数值
function extractValueFromContent(claim: string, content: string): string {
  const numbers = content.match(/\d+\.?\d*/g);
  return numbers && numbers.length > 0 ? numbers[0] : '';
}

// 生成验证备注
function generateTriangulationNotes(steps: DeepTriangulation['verificationSteps']): string {
  const warnings = steps.filter(s => s.result === 'warning' || s.result === 'fail');
  if (warnings.length === 0) {
    return '所有验证步骤通过，数据可信度高';
  }
  return `存在${warnings.length}个需要注意的问题: ${warnings.map(w => w.description).join(', ')}`;
}

// ==================== 双模型背对背真正执行 ====================

export interface DualModelValidation {
  claim: string;
  model1: {
    name: string;
    provider: string;
    analysis: string;
    conclusion: 'support' | 'oppose' | 'neutral';
    confidence: number;
  };
  model2: {
    name: string;
    provider: string;
    analysis: string;
    conclusion: 'support' | 'oppose' | 'neutral';
    confidence: number;
  };
  agreement: boolean;
  finalConclusion: string;
  confidence: number;
}

// 执行双模型背对背验证
export async function executeDualModelValidation(
  claim: string,
  context: string,
  model1Config: { provider: string; model: string; apiKey: string; baseUrl: string },
  model2Config: { provider: string; model: string; apiKey: string; baseUrl: string }
): Promise<DualModelValidation> {
  const prompt = `请独立分析以下结论是否正确。

背景信息：
${context}

待验证结论：
${claim}

请输出：
1. 分析过程
2. 结论（支持/反对/中立）
3. 置信度（0-100）`;

  // 并行调用两个模型
  const [result1, result2] = await Promise.all([
    callModel(model1Config, prompt),
    callModel(model2Config, prompt),
  ]);
  
  // 解析结论
  const parseConclusion = (text: string): 'support' | 'oppose' | 'neutral' => {
    if (text.includes('支持') || text.includes('正确') || text.includes('可行')) {
      return 'support';
    }
    if (text.includes('反对') || text.includes('错误') || text.includes('不可行')) {
      return 'oppose';
    }
    return 'neutral';
  };
  
  const parseConfidence = (text: string): number => {
    const match = text.match(/置信度[：:]\s*(\d+)/);
    return match ? parseInt(match[1]) : 50;
  };
  
  const model1Conclusion = parseConclusion(result1.content);
  const model2Conclusion = parseConclusion(result2.content);
  
  const model1Confidence = parseConfidence(result1.content);
  const model2Confidence = parseConfidence(result2.content);
  
  // 判断一致性
  const agreement = model1Conclusion === model2Conclusion;
  
  // 生成最终结论
  let finalConclusion = '';
  let confidence = 0;
  
  if (agreement) {
    confidence = (model1Confidence + model2Confidence) / 2;
    
    if (model1Conclusion === 'support') {
      finalConclusion = `两个模型一致支持该结论，置信度${confidence.toFixed(0)}%`;
    } else if (model1Conclusion === 'oppose') {
      finalConclusion = `两个模型一致反对该结论，置信度${confidence.toFixed(0)}%`;
    } else {
      finalConclusion = `两个模型均持中立态度，需要更多信息`;
    }
  } else {
    confidence = Math.abs(model1Confidence - model2Confidence);
    finalConclusion = `两个模型结论不一致（模型1: ${model1Conclusion}, 模型2: ${model2Conclusion}），建议人工裁决`;
  }
  
  return {
    claim,
    model1: {
      name: model1Config.model,
      provider: model1Config.provider,
      analysis: result1.content,
      conclusion: model1Conclusion,
      confidence: model1Confidence,
    },
    model2: {
      name: model2Config.model,
      provider: model2Config.provider,
      analysis: result2.content,
      conclusion: model2Conclusion,
      confidence: model2Confidence,
    },
    agreement,
    finalConclusion,
    confidence,
  };
}

// 调用单个模型
async function callModel(
  config: { provider: string; model: string; apiKey: string; baseUrl: string },
  prompt: string
): Promise<{ content: string }> {
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    const data = await response.json();
    return { content: data.choices?.[0]?.message?.content || '' };
  } catch (error) {
    return { content: '模型调用失败' };
  }
}
