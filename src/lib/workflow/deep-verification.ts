// 深度验证系统 - 弥补所有不足
import { searchWithVerification } from '../providers/api';
import { USER_PROFILE } from './config';

// ==================== 1. 三角验证深度优化 ====================

export interface DeepTriangulationResult {
  claim: string;
  value: string;
  
  // 来源独立性检查
  sourceIndependence: {
    sources: {
      url: string;
      title: string;
      domain: string;
      publishDate?: Date;
    }[];
    independenceScore: number; // 0-100
    isIndependent: boolean;
    reasoning: string;
  };
  
  // 交叉验证
  crossValidation: {
    method: 'direct_match' | 'range_overlap' | 'trend_consistency';
    result: 'consistent' | 'inconsistent' | 'inconclusive';
    details: string;
  };
  
  // 最终验证
  finalVerification: 'verified' | 'partial' | 'unverified' | 'conflict';
  confidence: number;
  recommendation: string;
}

// 检查来源独立性
export function checkSourceIndependence(
  sources: { url: string; title: string; content: string }[]
): { score: number; isIndependent: boolean; reasoning: string } {
  if (sources.length < 2) {
    return { score: 0, isIndependent: false, reasoning: '来源数量不足' };
  }
  
  // 提取域名
  const domains = sources.map(s => {
    try {
      const url = new URL(s.url);
      return url.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  });
  
  // 检查域名是否相同
  const uniqueDomains = new Set(domains);
  if (uniqueDomains.size === 1) {
    return { score: 20, isIndependent: false, reasoning: '所有来源来自同一网站' };
  }
  
  // 检查内容相似度
  const contents = sources.map(s => s.content.toLowerCase());
  let similarityScore = 0;
  
  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      // 简单的文本相似度检查
      const words1 = contents[i].split(/\s+/);
      const words2 = contents[j].split(/\s+/);
      const common = words1.filter(w => words2.includes(w)).length;
      const similarity = common / Math.max(words1.length, words2.length);
      similarityScore += similarity;
    }
  }
  
  const avgSimilarity = similarityScore / (sources.length * (sources.length - 1) / 2);
  
  // 计算独立性分数
  let score = 100;
  score -= (100 - uniqueDomains.size * 20); // 域名多样性
  score -= avgSimilarity * 30; // 内容相似度惩罚
  
  score = Math.max(0, Math.min(100, score));
  
  const isIndependent = score >= 60;
  
  let reasoning = '';
  if (isIndependent) {
    reasoning = `来源来自${uniqueDomains.size}个不同网站，内容相似度${(avgSimilarity * 100).toFixed(0)}%，独立性良好`;
  } else {
    reasoning = `来源独立性不足，内容相似度${(avgSimilarity * 100).toFixed(0)}%，可能来自同一数据源`;
  }
  
  return { score, isIndependent, reasoning };
}

// 执行深度三角验证
export async function executeDeepTriangulation(
  claim: string,
  value: string,
  searchResults: { url: string; title: string; content: string }[]
): Promise<DeepTriangulationResult> {
  // 1. 检查来源独立性
  const independence = checkSourceIndependence(searchResults);
  
  // 2. 交叉验证
  const extractedValues: number[] = [];
  for (const result of searchResults) {
    const numbers = result.content.match(/\d+\.?\d*/g);
    if (numbers) {
      for (const num of numbers) {
        const n = parseFloat(num);
        if (!isNaN(n) && n > 0) {
          extractedValues.push(n);
        }
      }
    }
  }
  
  let crossValidation: DeepTriangulationResult['crossValidation'];
  
  if (extractedValues.length >= 2) {
    // 检查数值是否在合理范围内
    const targetValue = parseFloat(value);
    const tolerance = targetValue * 0.2; // 20%容差
    
    const inRange = extractedValues.filter(v => 
      Math.abs(v - targetValue) <= tolerance
    );
    
    if (inRange.length >= 2) {
      crossValidation = {
        method: 'range_overlap',
        result: 'consistent',
        details: `${inRange.length}个数值在目标值±20%范围内`,
      };
    } else {
      crossValidation = {
        method: 'range_overlap',
        result: 'inconsistent',
        details: `数值差异较大，目标值${value}，提取值范围${Math.min(...extractedValues)}-${Math.max(...extractedValues)}`,
      };
    }
  } else {
    crossValidation = {
      method: 'direct_match',
      result: 'inconclusive',
      details: '无法提取足够数值进行验证',
    };
  }
  
  // 3. 计算最终验证结果
  let confidence = 0;
  let finalVerification: DeepTriangulationResult['finalVerification'];
  
  if (independence.isIndependent && crossValidation.result === 'consistent') {
    confidence = 90;
    finalVerification = 'verified';
  } else if (independence.isIndependent || crossValidation.result === 'consistent') {
    confidence = 70;
    finalVerification = 'partial';
  } else if (crossValidation.result === 'inconsistent') {
    confidence = 30;
    finalVerification = 'conflict';
  } else {
    confidence = 40;
    finalVerification = 'unverified';
  }
  
  // 4. 生成建议
  let recommendation = '';
  if (finalVerification === 'verified') {
    recommendation = '数据已通过深度三角验证，可信度高';
  } else if (finalVerification === 'partial') {
    recommendation = '数据部分验证通过，建议进一步核实';
  } else if (finalVerification === 'conflict') {
    recommendation = '数据存在冲突，需要人工核实';
  } else {
    recommendation = '数据未能验证，谨慎使用';
  }
  
  return {
    claim,
    value,
    sourceIndependence: {
      sources: searchResults.map(s => ({
        url: s.url,
        title: s.title,
        domain: new URL(s.url).hostname.replace('www.', ''),
      })),
      independenceScore: independence.score,
      isIndependent: independence.isIndependent,
      reasoning: independence.reasoning,
    },
    crossValidation,
    finalVerification,
    confidence,
    recommendation,
  };
}

// ==================== 2. 双模型背对背确保不同模型 ====================

export interface DualModelValidationConfig {
  model1: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl: string;
  };
  model2: {
    provider: string;
    model: string;
    apiKey: string;
    baseUrl: string;
  };
}

// 确保两个模型配置不同
export function ensureDifferentModels(
  availableModels: { provider: string; model: string; apiKey: string; baseUrl: string }[]
): DualModelValidationConfig | null {
  if (availableModels.length < 2) {
    return null;
  }
  
  // 优先选择不同平台的模型
  for (let i = 0; i < availableModels.length; i++) {
    for (let j = i + 1; j < availableModels.length; j++) {
      if (availableModels[i].provider !== availableModels[j].provider) {
        return {
          model1: availableModels[i],
          model2: availableModels[j],
        };
      }
    }
  }
  
  // 如果没有不同平台，选择不同模型
  for (let i = 0; i < availableModels.length; i++) {
    for (let j = i + 1; j < availableModels.length; j++) {
      if (availableModels[i].model !== availableModels[j].model) {
        return {
          model1: availableModels[i],
          model2: availableModels[j],
        };
      }
    }
  }
  
  return null;
}

// ==================== 3. 实时纠偏深度优化 ====================

export interface DeepCorrectionResult {
  originalContent: string;
  correctedContent: string;
  
  issues: {
    type: 'logical_contradiction' | 'data_conflict' | 'constraint_violation' | 
          'missing_source' | 'calculation_error' | 'inconsistency';
    severity: 'critical' | 'warning' | 'info';
    location: string;
    description: string;
    originalText: string;
    suggestedFix: string;
  }[];
  
  corrections: {
    original: string;
    corrected: string;
    reason: string;
    autoFixed: boolean;
  }[];
  
  verificationPassed: boolean;
  confidenceScore: number;
}

// 检查逻辑矛盾
function checkLogicalContradictions(content: string): DeepCorrectionResult['issues'] {
  const issues: DeepCorrectionResult['issues'] = [];
  
  // 检查"可行"和"不可行"同时出现
  if (content.includes('可行') && content.includes('不可行')) {
    issues.push({
      type: 'logical_contradiction',
      severity: 'critical',
      location: '全文',
      description: '同时出现"可行"和"不可行"的表述',
      originalText: '',
      suggestedFix: '需要明确结论，避免矛盾表述',
    });
  }
  
  // 检查"盈利"和"亏损"同时出现
  if (content.includes('盈利') && content.includes('亏损')) {
    const profitMatch = content.match(/盈利[^\d]*(\d+\.?\d*)\s*万/);
    const lossMatch = content.match(/亏损[^\d]*(\d+\.?\d*)\s*万/);
    
    if (profitMatch && lossMatch) {
      issues.push({
        type: 'logical_contradiction',
        severity: 'warning',
        location: '财务分析部分',
        description: `同时预测盈利${profitMatch[1]}万和亏损${lossMatch[1]}万`,
        originalText: `${profitMatch[0]} / ${lossMatch[0]}`,
        suggestedFix: '应区分不同情景或明确主要预测',
      });
    }
  }
  
  // 检查时间矛盾
  const timePatterns = content.matchAll(/(\d+)\s*(个?月|年)/g);
  const times: { value: number; unit: string; context: string }[] = [];
  
  for (const match of timePatterns) {
    times.push({
      value: parseInt(match[1]),
      unit: match[2],
      context: content.substring(Math.max(0, match.index! - 20), match.index! + match[0].length + 20),
    });
  }
  
  // 检查回本周期矛盾
  const roiTimes = times.filter(t => t.context.includes('回本') || t.context.includes('ROI'));
  if (roiTimes.length >= 2) {
    const values = roiTimes.map(t => t.unit.includes('年') ? t.value * 12 : t.value);
    const maxDiff = Math.max(...values) - Math.min(...values);
    
    if (maxDiff > 6) {
      issues.push({
        type: 'inconsistency',
        severity: 'warning',
        location: '回本周期分析',
        description: `回本周期预测不一致：${roiTimes.map(t => t.value + t.unit).join(' vs ')}`,
        originalText: roiTimes.map(t => t.context).join(' / '),
        suggestedFix: '统一回本周期预测或说明不同情景',
      });
    }
  }
  
  return issues;
}

// 检查数据冲突
function checkDataConflicts(content: string): DeepCorrectionResult['issues'] {
  const issues: DeepCorrectionResult['issues'] = [];
  
  // 提取所有数字
  const numberMatches = content.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨|公斤|%)/g);
  const numbers: { value: number; unit: string; context: string }[] = [];
  
  for (const match of numberMatches) {
    numbers.push({
      value: parseFloat(match[1]),
      unit: match[2],
      context: content.substring(Math.max(0, match.index! - 30), match.index! + match[0].length + 30),
    });
  }
  
  // 检查相同单位但差异大的数字
  const byUnit: Record<string, { value: number; context: string }[]> = {};
  for (const n of numbers) {
    if (!byUnit[n.unit]) byUnit[n.unit] = [];
    byUnit[n.unit].push({ value: n.value, context: n.context });
  }
  
  for (const [unit, items] of Object.entries(byUnit)) {
    if (items.length >= 2) {
      const values = items.map(i => i.value);
      const maxDiff = Math.max(...values) - Math.min(...values);
      const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
      
      if (maxDiff > avgValue * 0.5 && avgValue > 0) {
        issues.push({
          type: 'data_conflict',
          severity: 'warning',
          location: `数据单位: ${unit}`,
          description: `相同单位"${unit}"的数值差异超过50%`,
          originalText: items.map(i => `${i.value}${unit}`).join(' vs '),
          suggestedFix: '核实数据来源，确保数据一致',
        });
      }
    }
  }
  
  return issues;
}

// 检查约束违反
function checkConstraintViolations(content: string): DeepCorrectionResult['issues'] {
  const issues: DeepCorrectionResult['issues'] = [];
  
  // 检查资金约束
  const investmentMatch = content.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
  if (investmentMatch) {
    const investment = parseFloat(investmentMatch[1]);
    if (investment > 13) {
      issues.push({
        type: 'constraint_violation',
        severity: 'critical',
        location: '投资分析',
        description: `投资金额${investment}万超过用户预算上限13万`,
        originalText: investmentMatch[0],
        suggestedFix: `建议调整为13万以内，或说明资金缺口解决方案`,
      });
    }
  }
  
  // 检查ROI约束
  const roiMatch = content.match(/(\d+)\s*个?月.*回本/);
  if (roiMatch) {
    const roi = parseInt(roiMatch[1]);
    if (roi > 12) {
      issues.push({
        type: 'constraint_violation',
        severity: 'critical',
        location: 'ROI分析',
        description: `回本周期${roi}个月超过用户要求的12个月`,
        originalText: roiMatch[0],
        suggestedFix: `建议说明如何缩短回本周期，或标注为不推荐`,
      });
    }
  }
  
  // 检查合规约束
  const illegalKeywords = ['灰色', '违规', '逃税', '无证经营', '黑市'];
  for (const keyword of illegalKeywords) {
    if (content.includes(keyword)) {
      issues.push({
        type: 'constraint_violation',
        severity: 'critical',
        location: '合规分析',
        description: `内容包含不合规关键词"${keyword}"`,
        originalText: keyword,
        suggestedFix: '删除不合规建议，或明确标注为禁止事项',
      });
    }
  }
  
  return issues;
}

// 执行深度纠偏
export function executeDeepCorrection(
  content: string,
  context?: { previousResults?: Record<string, string>; userProfile?: typeof USER_PROFILE }
): DeepCorrectionResult {
  const issues: DeepCorrectionResult['issues'] = [];
  const corrections: DeepCorrectionResult['corrections'] = [];
  
  // 1. 检查逻辑矛盾
  issues.push(...checkLogicalContradictions(content));
  
  // 2. 检查数据冲突
  issues.push(...checkDataConflicts(content));
  
  // 3. 检查约束违反
  issues.push(...checkConstraintViolations(content));
  
  // 4. 检查与前文的一致性
  if (context?.previousResults) {
    for (const [role, prevContent] of Object.entries(context.previousResults)) {
      // 提取前文中的关键数字
      const prevNumbers = prevContent.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨)/g);
      for (const match of prevNumbers) {
        const prevValue = parseFloat(match[1]);
        const unit = match[2];
        
        // 检查当前内容中是否有相同单位但不同数值
        const currentMatch = content.match(new RegExp(`(\\d+\\.?\\d*)\\s*${unit}`));
        if (currentMatch) {
          const currentValue = parseFloat(currentMatch[1]);
          if (Math.abs(currentValue - prevValue) > prevValue * 0.3) {
            issues.push({
              type: 'inconsistency',
              severity: 'warning',
              location: `与${role}的分析对比`,
              description: `当前内容${currentValue}${unit}与${role}分析的${prevValue}${unit}差异超过30%`,
              originalText: currentMatch[0],
              suggestedFix: `核实数据，或说明差异原因`,
            });
          }
        }
      }
    }
  }
  
  // 5. 自动修正
  let correctedContent = content;
  
  for (const issue of issues) {
    if (issue.severity === 'critical' && issue.suggestedFix) {
      // 对于关键问题，添加警告标注
      const warning = `\n\n【⚠️ 警告：${issue.description}】\n${issue.suggestedFix}\n`;
      
      if (issue.location === '全文') {
        correctedContent = warning + correctedContent;
      } else {
        correctedContent += warning;
      }
      
      corrections.push({
        original: issue.originalText,
        corrected: `已添加警告：${issue.description}`,
        reason: issue.description,
        autoFixed: true,
      });
    }
  }
  
  // 6. 计算置信度
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  let confidenceScore = 100;
  confidenceScore -= criticalCount * 20;
  confidenceScore -= warningCount * 5;
  confidenceScore = Math.max(0, confidenceScore);
  
  const verificationPassed = criticalCount === 0;
  
  return {
    originalContent: content,
    correctedContent,
    issues,
    corrections,
    verificationPassed,
    confidenceScore,
  };
}

// ==================== 4. 后验审计深度优化 ====================

export interface DeepAuditResult {
  reportId: string;
  timestamp: Date;
  
  claims: {
    claim: string;
    type: 'fact' | 'prediction' | 'recommendation';
    verification: {
      method: string;
      result: 'verified' | 'disputed' | 'unverifiable';
      sources: string[];
      confidence: number;
    };
  }[];
  
  factCheck: {
    total: number;
    verified: number;
    disputed: number;
    unverifiable: number;
  };
  
  overallAssessment: {
    grade: 'A' | 'B' | 'C' | 'D';
    score: number;
    summary: string;
    criticalIssues: string[];
  };
}

// 执行深度后验审计
export async function executeDeepAudit(
  report: string,
  originalQuery: string
): Promise<DeepAuditResult> {
  const claims: DeepAuditResult['claims'] = [];
  
  // 1. 提取所有声明
  const factPatterns = [
    /市场规模[^\d]*(\d+\.?\d*)\s*(亿|万)/g,
    /增长率[^\d]*(\d+\.?\d*)\s*%/g,
    /价格[^\d]*(\d+\.?\d*)\s*元/g,
  ];
  
  for (const pattern of factPatterns) {
    const matches = report.matchAll(pattern);
    for (const match of matches) {
      claims.push({
        claim: match[0],
        type: 'fact',
        verification: {
          method: 'search_verification',
          result: 'unverifiable',
          sources: [],
          confidence: 50,
        },
      });
    }
  }
  
  // 2. 对每个事实声明进行验证
  for (const claim of claims.filter(c => c.type === 'fact')) {
    const searchResult = await searchWithVerification(`${originalQuery} ${claim.claim}`);
    
    if (searchResult.combined.length >= 2) {
      claim.verification.sources = searchResult.combined.slice(0, 3).map(r => r.url || r.link || '');
      claim.verification.confidence = 80;
      claim.verification.result = 'verified';
    } else if (searchResult.combined.length === 1) {
      claim.verification.sources = [searchResult.combined[0].url || ''];
      claim.verification.confidence = 60;
      claim.verification.result = 'unverifiable';
    }
  }
  
  // 3. 统计验证结果
  const factCheck = {
    total: claims.length,
    verified: claims.filter(c => c.verification.result === 'verified').length,
    disputed: claims.filter(c => c.verification.result === 'disputed').length,
    unverifiable: claims.filter(c => c.verification.result === 'unverifiable').length,
  };
  
  // 4. 计算整体评分
  let score = 100;
  if (factCheck.total > 0) {
    score = (factCheck.verified / factCheck.total) * 100;
  }
  
  const grade: 'A' | 'B' | 'C' | 'D' = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  
  // 5. 识别关键问题
  const criticalIssues: string[] = [];
  
  for (const claim of claims) {
    if (claim.verification.result === 'disputed') {
      criticalIssues.push(`争议声明: ${claim.claim}`);
    }
  }
  
  if (factCheck.unverifiable > factCheck.total * 0.5) {
    criticalIssues.push('超过50%的声明无法验证');
  }
  
  // 6. 生成摘要
  let summary = '';
  if (grade === 'A') {
    summary = '报告事实核查通过，数据可信度高';
  } else if (grade === 'B') {
    summary = '报告大部分事实已验证，部分需要进一步核实';
  } else if (grade === 'C') {
    summary = '报告存在较多未验证的事实，建议谨慎参考';
  } else {
    summary = '报告事实核查不通过，建议重新分析';
  }
  
  return {
    reportId: `audit_${Date.now()}`,
    timestamp: new Date(),
    claims,
    factCheck,
    overallAssessment: {
      grade,
      score,
      summary,
      criticalIssues,
    },
  };
}

// ==================== 5. 议题依赖关系处理 ====================

export interface TopicDependency {
  topicId: number;
  dependsOn: number[];
  dependencyType: 'data' | 'result' | 'conclusion';
}

// 解析议题依赖关系
export function parseTopicDependencies(
  topics: { id: number; content: string; type: string }[]
): TopicDependency[] {
  const dependencies: TopicDependency[] = [];
  
  for (const topic of topics) {
    const deps: number[] = [];
    
    // 检查是否引用了其他议题
    for (const other of topics) {
      if (other.id !== topic.id) {
        // 检查是否引用了议题编号
        if (topic.content.includes(`议题${other.id}`) || 
            topic.content.includes(`第${other.id}个`) ||
            topic.content.includes(`议题${other.id}的结果`) ||
            topic.content.includes(`对比`)) {
          deps.push(other.id);
        }
      }
    }
    
    dependencies.push({
      topicId: topic.id,
      dependsOn: deps,
      dependencyType: deps.length > 0 ? 'result' : 'none' as any,
    });
  }
  
  return dependencies;
}

// 生成执行顺序（考虑依赖）
export function generateExecutionOrderWithDependencies(
  dependencies: TopicDependency[]
): number[][] {
  const order: number[][] = [];
  const completed = new Set<number>();
  const remaining = new Set(dependencies.map(d => d.topicId));
  
  while (remaining.size > 0) {
    const batch: number[] = [];
    
    for (const topicId of remaining) {
      const dep = dependencies.find(d => d.topicId === topicId);
      if (dep && dep.dependsOn.every(d => completed.has(d))) {
        batch.push(topicId);
      }
    }
    
    if (batch.length > 0) {
      order.push(batch);
      batch.forEach(id => {
        completed.add(id);
        remaining.delete(id);
      });
    } else {
      // 避免死锁，强制添加一个
      const first = remaining.values().next().value;
      if (first !== undefined) {
        order.push([first]);
        completed.add(first);
        remaining.delete(first);
      }
    }
  }
  
  return order;
}

// ==================== 6. 议题交叉验证深度优化 ====================

export interface DeepCrossValidation {
  topic1Id: number;
  topic2Id: number;
  
  dataConsistency: {
    consistent: { item: string; value1: string; value2: string }[];
    inconsistent: { item: string; value1: string; value2: string; difference: string }[];
  };
  
  conclusionConsistency: {
    consistent: boolean;
    topic1Conclusion: string;
    topic2Conclusion: string;
    analysis: string;
  };
  
  recommendationConsistency: {
    consistent: boolean;
    topic1Recommendation: string;
    topic2Recommendation: string;
    conflict: string;
  };
  
  overallConsistency: number;
  resolution: string;
}

// 执行深度交叉验证
export function executeDeepCrossValidation(
  results1: Record<string, string>,
  results2: Record<string, string>,
  topic1Id: number,
  topic2Id: number
): DeepCrossValidation {
  // 1. 数据一致性检查
  const dataConsistency: DeepCrossValidation['dataConsistency'] = {
    consistent: [],
    inconsistent: [],
  };
  
  const allContent1 = Object.values(results1).join('\n');
  const allContent2 = Object.values(results2).join('\n');
  
  // 提取数字进行对比
  const numbers1 = allContent1.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨|%)/g);
  const numbers2 = allContent2.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨|%)/g);
  
  const numMap1 = new Map<string, number>();
  const numMap2 = new Map<string, number>();
  
  for (const match of numbers1) {
    numMap1.set(match[2], parseFloat(match[1]));
  }
  for (const match of numbers2) {
    numMap2.set(match[2], parseFloat(match[1]));
  }
  
  for (const [unit, value1] of numMap1) {
    const value2 = numMap2.get(unit);
    if (value2 !== undefined) {
      const diff = Math.abs(value1 - value2);
      const tolerance = Math.max(value1, value2) * 0.2;
      
      if (diff <= tolerance) {
        dataConsistency.consistent.push({
          item: unit,
          value1: `${value1}${unit}`,
          value2: `${value2}${unit}`,
        });
      } else {
        dataConsistency.inconsistent.push({
          item: unit,
          value1: `${value1}${unit}`,
          value2: `${value2}${unit}`,
          difference: `${diff}${unit} (${(diff / Math.max(value1, value2) * 100).toFixed(0)}%)`,
        });
      }
    }
  }
  
  // 2. 结论一致性检查
  const conclusion1 = extractConclusion(allContent1);
  const conclusion2 = extractConclusion(allContent2);
  
  const conclusionConsistency: DeepCrossValidation['conclusionConsistency'] = {
    consistent: checkConclusionConsistency(conclusion1, conclusion2),
    topic1Conclusion: conclusion1,
    topic2Conclusion: conclusion2,
    analysis: analyzeConclusionDifference(conclusion1, conclusion2),
  };
  
  // 3. 建议一致性检查
  const rec1 = extractRecommendation(allContent1);
  const rec2 = extractRecommendation(allContent2);
  
  const recommendationConsistency: DeepCrossValidation['recommendationConsistency'] = {
    consistent: checkRecommendationConsistency(rec1, rec2),
    topic1Recommendation: rec1,
    topic2Recommendation: rec2,
    conflict: identifyConflict(rec1, rec2),
  };
  
  // 4. 计算整体一致性
  let score = 100;
  
  // 数据不一致扣分
  const dataInconsistencyRatio = dataConsistency.inconsistent.length / 
    (dataConsistency.consistent.length + dataConsistency.inconsistent.length || 1);
  score -= dataInconsistencyRatio * 30;
  
  // 结论不一致扣分
  if (!conclusionConsistency.consistent) {
    score -= 25;
  }
  
  // 建议不一致扣分
  if (!recommendationConsistency.consistent) {
    score -= 20;
  }
  
  score = Math.max(0, Math.min(100, score));
  
  // 5. 生成解决方案
  let resolution = '';
  
  if (score >= 80) {
    resolution = '两个议题分析结果高度一致，结论可信';
  } else if (score >= 50) {
    resolution = '两个议题分析结果存在部分差异，建议核实关键数据';
  } else {
    resolution = '两个议题分析结果存在重大冲突，需要重新分析或人工裁决';
  }
  
  return {
    topic1Id,
    topic2Id,
    dataConsistency,
    conclusionConsistency,
    recommendationConsistency,
    overallConsistency: score,
    resolution,
  };
}

// 辅助函数
function extractConclusion(content: string): string {
  const match = content.match(/结论[：:]\s*([^。\n]+)/);
  return match ? match[1] : '';
}

function extractRecommendation(content: string): string {
  const match = content.match(/建议[：:]\s*([^。\n]+)/);
  return match ? match[1] : '';
}

function checkConclusionConsistency(c1: string, c2: string): boolean {
  if (!c1 || !c2) return true;
  
  const positive = ['可行', '可以', '推荐', '建议'];
  const negative = ['不可行', '不可以', '不推荐', '不建议'];
  
  const c1Positive = positive.some(p => c1.includes(p));
  const c1Negative = negative.some(n => c1.includes(n));
  const c2Positive = positive.some(p => c2.includes(p));
  const c2Negative = negative.some(n => c2.includes(n));
  
  // 如果一个正面一个负面，则不一致
  if ((c1Positive && c2Negative) || (c1Negative && c2Positive)) {
    return false;
  }
  
  return true;
}

function analyzeConclusionDifference(c1: string, c2: string): string {
  if (!c1 || !c2) return '无法比较';
  if (c1 === c2) return '结论完全一致';
  
  return `议题1结论: "${c1}" vs 议题2结论: "${c2}"`;
}

function checkRecommendationConsistency(r1: string, r2: string): boolean {
  if (!r1 || !r2) return true;
  return r1 === r2 || r1.includes(r2) || r2.includes(r1);
}

function identifyConflict(r1: string, r2: string): string {
  if (!r1 || !r2) return '';
  if (r1 === r2) return '';
  
  return `建议冲突: "${r1}" vs "${r2}"`;
}

// ==================== 7. 对比模式加权评分和敏感性分析 ====================

export interface WeightedComparison {
  baseline: { name: string; scores: Record<string, number>; weightedScore: number };
  comparison: { name: string; scores: Record<string, number>; weightedScore: number };
  
  weights: Record<string, number>;
  
  sensitivityAnalysis: {
    dimension: string;
    weightChange: number;
    resultChange: 'baseline_wins' | 'comparison_wins' | 'tie';
  }[];
  
  robustness: number;
  finalRecommendation: string;
}

// 执行加权对比
export function executeWeightedComparison(
  baselineName: string,
  baselineScores: Record<string, number>,
  comparisonName: string,
  comparisonScores: Record<string, number>,
  customWeights?: Record<string, number>
): WeightedComparison {
  // 默认权重
  const defaultWeights: Record<string, number> = {
    startupCost: 0.2,
    riskLevel: 0.2,
    profitPotential: 0.25,
    resourceMatch: 0.2,
    timeToProfit: 0.15,
  };
  
  const weights = customWeights || defaultWeights;
  
  // 计算加权分数
  let baselineWeighted = 0;
  let comparisonWeighted = 0;
  
  for (const [dim, weight] of Object.entries(weights)) {
    baselineWeighted += (baselineScores[dim] || 0) * weight;
    comparisonWeighted += (comparisonScores[dim] || 0) * weight;
  }
  
  // 敏感性分析
  const sensitivityAnalysis: WeightedComparison['sensitivityAnalysis'] = [];
  
  for (const [dim, currentWeight] of Object.entries(weights)) {
    // 测试权重变化±10%
    for (const change of [-0.1, 0.1]) {
      const newWeights = { ...weights };
      newWeights[dim] = Math.max(0, currentWeight + change);
      
      // 重新归一化
      const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
      for (const key in newWeights) {
        newWeights[key] /= total;
      }
      
      // 重新计算
      let newBaseline = 0;
      let newComparison = 0;
      
      for (const [d, w] of Object.entries(newWeights)) {
        newBaseline += (baselineScores[d] || 0) * w;
        newComparison += (comparisonScores[d] || 0) * w;
      }
      
      const diff = newBaseline - newComparison;
      let resultChange: 'baseline_wins' | 'comparison_wins' | 'tie';
      
      if (Math.abs(diff) < 5) {
        resultChange = 'tie';
      } else if (diff > 0) {
        resultChange = 'baseline_wins';
      } else {
        resultChange = 'comparison_wins';
      }
      
      sensitivityAnalysis.push({
        dimension: dim,
        weightChange: change * 100,
        resultChange,
      });
    }
  }
  
  // 计算稳健性（结果对权重变化的敏感程度）
  const changes = sensitivityAnalysis.map(s => s.resultChange);
  const baselineWins = changes.filter(c => c === 'baseline_wins').length;
  const comparisonWins = changes.filter(c => c === 'comparison_wins').length;
  
  let robustness = 0;
  if (baselineWeighted > comparisonWeighted) {
    robustness = baselineWins / changes.length * 100;
  } else {
    robustness = comparisonWins / changes.length * 100;
  }
  
  // 最终建议
  let finalRecommendation = '';
  
  if (robustness >= 80) {
    if (baselineWeighted > comparisonWeighted) {
      finalRecommendation = `${baselineName}在大多数权重配置下都优于${comparisonName}，建议选择`;
    } else {
      finalRecommendation = `${comparisonName}在大多数权重配置下都优于${baselineName}，建议选择`;
    }
  } else if (robustness >= 50) {
    finalRecommendation = '结果对权重配置较为敏感，建议根据个人偏好调整权重后重新评估';
  } else {
    finalRecommendation = '两个选项各有优势，建议根据具体需求选择';
  }
  
  return {
    baseline: { name: baselineName, scores: baselineScores, weightedScore: baselineWeighted },
    comparison: { name: comparisonName, scores: comparisonScores, weightedScore: comparisonWeighted },
    weights,
    sensitivityAnalysis,
    robustness,
    finalRecommendation,
  };
}

// ==================== 8. 约束强制验证 ====================

export interface ConstraintEnforcement {
  passed: boolean;
  violations: {
    constraint: string;
    value: any;
    limit: any;
    severity: 'critical' | 'warning';
    action: 'block' | 'warn' | 'auto_correct';
    correctedValue?: any;
  }[];
  enforcedContent: string;
}

// 在每个角色输出后强制验证约束
export function enforceConstraints(
  content: string,
  role: string,
  userProfile: typeof USER_PROFILE
): ConstraintEnforcement {
  const violations: ConstraintEnforcement['violations'] = [];
  
  // 1. 资金约束
  const investmentMatch = content.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
  if (investmentMatch) {
    const investment = parseFloat(investmentMatch[1]) * 10000;
    if (investment > userProfile.funds.total) {
      violations.push({
        constraint: '资金上限',
        value: `${investmentMatch[1]}万`,
        limit: `${userProfile.funds.total / 10000}万`,
        severity: 'critical',
        action: 'warn',
      });
    }
  }
  
  // 2. ROI约束
  const roiMatch = content.match(/(\d+)\s*个?月.*回本/);
  if (roiMatch) {
    const roi = parseInt(roiMatch[1]);
    if (roi > userProfile.constraints.roiMonths) {
      violations.push({
        constraint: '回本周期',
        value: `${roi}个月`,
        limit: `${userProfile.constraints.roiMonths}个月`,
        severity: 'critical',
        action: 'warn',
      });
    }
  }
  
  // 3. 合规约束
  const illegalKeywords = ['灰色', '违规', '逃税', '无证经营'];
  for (const keyword of illegalKeywords) {
    if (content.includes(keyword)) {
      violations.push({
        constraint: '合规要求',
        value: keyword,
        limit: '100%合规',
        severity: 'critical',
        action: 'block',
      });
    }
  }
  
  // 4. 月固定支出预留
  const monthlyCostMatch = content.match(/月支出[^\d]*(\d+\.?\d*)\s*元/);
  if (monthlyCostMatch) {
    const monthlyCost = parseFloat(monthlyCostMatch[1]);
    const availableMonthly = userProfile.funds.total / 12 - userProfile.funds.monthlyReserve;
    if (monthlyCost > availableMonthly) {
      violations.push({
        constraint: '月固定支出预留',
        value: `${monthlyCost}元`,
        limit: `≤${availableMonthly.toFixed(0)}元（需预留${userProfile.funds.monthlyReserve}元）`,
        severity: 'warning',
        action: 'warn',
      });
    }
  }
  
  // 生成强制执行后的内容
  let enforcedContent = content;
  
  for (const violation of violations) {
    if (violation.action === 'block') {
      enforcedContent = `【⚠️ 内容被阻止】\n原因：违反${violation.constraint}约束\n违规内容：${violation.value}\n\n` + enforcedContent;
    } else if (violation.action === 'warn') {
      enforcedContent += `\n\n【⚠️ 约束警告】\n${violation.constraint}: 当前${violation.value}，限制${violation.limit}`;
    }
  }
  
  const passed = violations.filter(v => v.severity === 'critical').length === 0;
  
  return {
    passed,
    violations,
    enforcedContent,
  };
}

// ==================== 9. 搜索验证穿插 ====================

export interface SearchVerificationPoint {
  role: string;
  trigger: string;
  searchQuery: string;
  result: {
    verified: boolean;
    sources: string[];
    confidence: number;
  };
}

// 在关键节点后进行搜索验证
export async function performSearchVerificationAtPoints(
  roleResults: Record<string, string>,
  originalQuery: string
): Promise<SearchVerificationPoint[]> {
  const points: SearchVerificationPoint[] = [];
  
  // 定义需要搜索验证的关键点
  const verificationTriggers = [
    { role: 'market_analyst', trigger: '市场规模', queryTemplate: '{query} 市场规模 2024 2025' },
    { role: 'financial_analyst', trigger: '投资', queryTemplate: '{query} 投资成本 价格' },
    { role: 'risk_assessor', trigger: '风险', queryTemplate: '{query} 风险 合规 政策' },
  ];
  
  for (const trigger of verificationTriggers) {
    const roleContent = roleResults[trigger.role];
    if (!roleContent) continue;
    
    // 检查是否包含触发词
    if (roleContent.includes(trigger.trigger)) {
      const searchQuery = trigger.queryTemplate.replace('{query}', originalQuery);
      const searchResult = await searchWithVerification(searchQuery);
      
      points.push({
        role: trigger.role,
        trigger: trigger.trigger,
        searchQuery,
        result: {
          verified: searchResult.combined.length >= 2,
          sources: searchResult.combined.slice(0, 3).map(r => r.url || r.link || ''),
          confidence: Math.min(100, searchResult.combined.length * 25),
        },
      });
    }
  }
  
  return points;
}

// ==================== 10. 关键数据真正标红 ====================

// 生成HTML格式的标红内容
export function highlightKeyDataHTML(content: string): string {
  // 关键数字标红
  let result = content.replace(
    /(\d+\.?\d*\s*(万|亿|元|吨|公斤|平方米|㎡|%))/g,
    '<span style="color: red; font-weight: bold;">$1</span>'
  );
  
  // 警告关键词标橙
  const warningKeywords = ['风险', '注意', '警告', '可能', '不确定', '缺口'];
  for (const keyword of warningKeywords) {
    const regex = new RegExp(`(${keyword})`, 'g');
    result = result.replace(regex, '<span style="color: orange; font-weight: bold;">$1</span>');
  }
  
  // 估算值标蓝
  const estimateKeywords = ['约', '预计', '估算', '预估', '大概', '左右'];
  for (const keyword of estimateKeywords) {
    const regex = new RegExp(`(${keyword})`, 'g');
    result = result.replace(regex, '<span style="color: blue;">$1</span>');
  }
  
  // 来源标注标绿
  result = result.replace(
    /(来源[：:]\s*[^\n]+)/g,
    '<span style="color: green; font-size: 0.9em;">$1</span>'
  );
  
  return result;
}

// ==================== 11. 会话历史保存 ====================

export interface SessionHistory {
  sessionId: string;
  createdAt: Date;
  lastActiveAt: Date;
  
  conversations: {
    id: string;
    timestamp: Date;
    userInput: string;
    mode: string;
    result: string;
    feedback?: {
      rating: number;
      comment: string;
    };
  }[];
  
  userProfile: typeof USER_PROFILE;
  learnedPreferences: Record<string, any>;
}

// 保存会话历史
export function saveSessionHistory(history: SessionHistory): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('session_history', JSON.stringify(history));
}

// 加载会话历史
export function loadSessionHistory(): SessionHistory | null {
  if (typeof window === 'undefined') return null;
  
  const data = localStorage.getItem('session_history');
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// 创建新会话
export function createNewSession(): SessionHistory {
  return {
    sessionId: `session_${Date.now()}`,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    conversations: [],
    userProfile: USER_PROFILE,
    learnedPreferences: {},
  };
}

// 添加对话到会话历史
export function addConversationToHistory(
  history: SessionHistory,
  userInput: string,
  mode: string,
  result: string
): SessionHistory {
  history.conversations.push({
    id: `conv_${Date.now()}`,
    timestamp: new Date(),
    userInput,
    mode,
    result,
  });
  
  history.lastActiveAt = new Date();
  
  saveSessionHistory(history);
  
  return history;
}
