// 最终完善系统 - 解决所有可解决的不足
import { searchWithVerification } from '../providers/api';
import { USER_PROFILE } from './config';

// ==================== 1. 混合模式真正并行执行 ====================

export interface TrueMixedModeExecution {
  forwardResults: Record<string, string>;
  reverseResults: Record<string, string>;
  crossValidation: {
    dataConsistency: number;
    conclusionConsistency: number;
    recommendationConsistency: number;
  };
  finalSynthesis: string;
  confidence: number;
}

// 真正的混合模式并行执行
export async function executeTrueMixedMode(
  userInput: string,
  executeRole: (roleId: string, prompt: string, input: string) => Promise<string>
): Promise<TrueMixedModeExecution> {
  // 正推角色
  const forwardRoles = [
    'chief_researcher',
    'market_analyst',
    'industry_analyst',
    'financial_analyst',
  ];
  
  // 倒推角色
  const reverseRoles = [
    'market_analyst',
    'industry_analyst',
    'risk_assessor',
    'financial_analyst',
  ];
  
  // 正推提示词
  const forwardPrompt = `【正推分析】
从用户现有条件出发，分析可行的商业方案。

用户条件：
${userInput}

请分析：
1. 基于现有条件，有哪些可行的商业方向？
2. 每个方向的启动成本、预期收益、风险如何？
3. 推荐哪个方向？为什么？`;

  // 倒推提示词
  const reversePrompt = `【倒推分析】
假设用户要实现商业成功，倒推需要满足的条件。

用户条件：
${userInput}

请分析：
1. 要实现年净利润20万以上，需要什么条件？
2. 当前条件与目标条件的差距是什么？
3. 如何弥补这些差距？
4. 如果无法弥补，应该调整什么目标？`;

  // 真正并行执行正推和倒推
  const [forwardResults, reverseResults] = await Promise.all([
    // 正推路径
    (async () => {
      const results: Record<string, string> = {};
      for (const roleId of forwardRoles) {
        results[roleId] = await executeRole(roleId, forwardPrompt, userInput);
      }
      return results;
    })(),
    // 倒推路径
    (async () => {
      const results: Record<string, string> = {};
      for (const roleId of reverseRoles) {
        results[roleId] = await executeRole(roleId, reversePrompt, userInput);
      }
      return results;
    })(),
  ]);
  
  // 交叉验证
  const crossValidation = crossValidateForwardReverse(forwardResults, reverseResults);
  
  // 综合裁决
  const finalSynthesis = synthesizeResults(forwardResults, reverseResults, crossValidation);
  
  // 计算置信度
  const confidence = calculateMixedModeConfidence(crossValidation);
  
  return {
    forwardResults,
    reverseResults,
    crossValidation,
    finalSynthesis,
    confidence,
  };
}

// 正推倒推交叉验证
function crossValidateForwardReverse(
  forward: Record<string, string>,
  reverse: Record<string, string>
): TrueMixedModeExecution['crossValidation'] {
  const forwardContent = Object.values(forward).join('\n');
  const reverseContent = Object.values(reverse).join('\n');
  
  // 数据一致性
  const forwardNumbers = extractNumbers(forwardContent);
  const reverseNumbers = extractNumbers(reverseContent);
  const dataConsistency = calculateNumberConsistency(forwardNumbers, reverseNumbers);
  
  // 结论一致性
  const forwardConclusion = extractConclusion(forwardContent);
  const reverseConclusion = extractConclusion(reverseContent);
  const conclusionConsistency = compareConclusions(forwardConclusion, reverseConclusion);
  
  // 建议一致性
  const forwardRecommendation = extractRecommendation(forwardContent);
  const reverseRecommendation = extractRecommendation(reverseContent);
  const recommendationConsistency = compareRecommendations(forwardRecommendation, reverseRecommendation);
  
  return {
    dataConsistency,
    conclusionConsistency,
    recommendationConsistency,
  };
}

// 提取数字
function extractNumbers(content: string): { value: number; unit: string }[] {
  const matches = content.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨|%|个月)/g);
  return Array.from(matches).map(m => ({
    value: parseFloat(m[1]),
    unit: m[2],
  }));
}

// 计算数字一致性
function calculateNumberConsistency(
  nums1: { value: number; unit: string }[],
  nums2: { value: number; unit: string }[]
): number {
  const byUnit1 = groupByUnit(nums1);
  const byUnit2 = groupByUnit(nums2);
  
  let totalConsistency = 0;
  let count = 0;
  
  for (const unit of Object.keys(byUnit1)) {
    if (byUnit2[unit]) {
      const avg1 = average(byUnit1[unit]);
      const avg2 = average(byUnit2[unit]);
      const diff = Math.abs(avg1 - avg2);
      const max = Math.max(avg1, avg2);
      const consistency = max > 0 ? Math.max(0, 100 - (diff / max) * 100) : 100;
      totalConsistency += consistency;
      count++;
    }
  }
  
  return count > 0 ? totalConsistency / count : 100;
}

// 按单位分组
function groupByUnit(nums: { value: number; unit: string }[]): Record<string, number[]> {
  const grouped: Record<string, number[]> = {};
  for (const n of nums) {
    if (!grouped[n.unit]) grouped[n.unit] = [];
    grouped[n.unit].push(n.value);
  }
  return grouped;
}

// 计算平均值
function average(nums: number[]): number {
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

// 提取结论
function extractConclusion(content: string): string {
  const match = content.match(/(结论|判断)[：:]\s*([^。\n]+)/);
  return match ? match[2] : '';
}

// 比较结论
function compareConclusions(c1: string, c2: string): number {
  if (!c1 || !c2) return 100;
  
  const positive = ['可行', '可以', '推荐', '建议'];
  const negative = ['不可行', '不可以', '不推荐', '不建议'];
  
  const c1Positive = positive.some(p => c1.includes(p));
  const c1Negative = negative.some(n => c1.includes(n));
  const c2Positive = positive.some(p => c2.includes(p));
  const c2Negative = negative.some(n => c2.includes(n));
  
  if ((c1Positive && c2Negative) || (c1Negative && c2Positive)) {
    return 30; // 矛盾
  }
  
  return 90; // 一致
}

// 提取建议
function extractRecommendation(content: string): string {
  const match = content.match(/(建议|推荐)[：:]\s*([^。\n]+)/);
  return match ? match[2] : '';
}

// 比较建议
function compareRecommendations(r1: string, r2: string): number {
  if (!r1 || !r2) return 100;
  
  // 计算文本相似度
  const words1 = r1.split(/\s+/);
  const words2 = r2.split(/\s+/);
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? (intersection.size / union.size) * 100 : 100;
}

// 综合裁决
function synthesizeResults(
  forward: Record<string, string>,
  reverse: Record<string, string>,
  crossValidation: TrueMixedModeExecution['crossValidation']
): string {
  const forwardContent = Object.values(forward).join('\n');
  const reverseContent = Object.values(reverse).join('\n');
  
  let synthesis = `# 正推与倒推综合分析\n\n`;
  
  synthesis += `## 正推分析结论\n\n`;
  synthesis += extractKeyPoints(forwardContent);
  
  synthesis += `\n## 倒推分析结论\n\n`;
  synthesis += extractKeyPoints(reverseContent);
  
  synthesis += `\n## 交叉验证结果\n\n`;
  synthesis += `- 数据一致性：${crossValidation.dataConsistency.toFixed(0)}%\n`;
  synthesis += `- 结论一致性：${crossValidation.conclusionConsistency.toFixed(0)}%\n`;
  synthesis += `- 建议一致性：${crossValidation.recommendationConsistency.toFixed(0)}%\n`;
  
  const avgConsistency = (
    crossValidation.dataConsistency +
    crossValidation.conclusionConsistency +
    crossValidation.recommendationConsistency
  ) / 3;
  
  synthesis += `\n## 综合结论\n\n`;
  
  if (avgConsistency >= 80) {
    synthesis += `正推与倒推分析结果高度一致，结论可信度高。`;
  } else if (avgConsistency >= 50) {
    synthesis += `正推与倒推分析结果存在部分差异，建议关注差异点。`;
  } else {
    synthesis += `正推与倒推分析结果存在较大冲突，需要进一步核实。`;
  }
  
  return synthesis;
}

// 提取关键点
function extractKeyPoints(content: string): string {
  const points: string[] = [];
  
  // 提取结论
  const conclusionMatch = content.match(/(结论|判断)[：:]\s*([^。\n]+)/);
  if (conclusionMatch) points.push(`结论：${conclusionMatch[2]}`);
  
  // 提取建议
  const recommendationMatch = content.match(/(建议|推荐)[：:]\s*([^。\n]+)/);
  if (recommendationMatch) points.push(`建议：${recommendationMatch[2]}`);
  
  // 提取关键数字
  const numberMatches = content.match(/(\d+\.?\d*\s*(万|亿|元))[^。\n]{0,20}/g);
  if (numberMatches) {
    points.push(`关键数据：${numberMatches.slice(0, 3).join('、')}`);
  }
  
  return points.join('\n');
}

// 计算混合模式置信度
function calculateMixedModeConfidence(
  crossValidation: TrueMixedModeExecution['crossValidation']
): number {
  return (
    crossValidation.dataConsistency * 0.4 +
    crossValidation.conclusionConsistency * 0.35 +
    crossValidation.recommendationConsistency * 0.25
  );
}

// ==================== 2. 实时纠偏增加更多矛盾模式 ====================

export interface ExtendedContradictionDetection {
  contradictions: {
    type: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    evidence: string[];
    suggestion: string;
  }[];
  overallScore: number;
  correctedContent: string;
}

// 扩展的矛盾检测
export function detectExtendedContradictions(content: string): ExtendedContradictionDetection {
  const contradictions: ExtendedContradictionDetection['contradictions'] = [];
  
  // 1. 基础逻辑矛盾
  const basicContradictions = [
    { p1: /可行/, p2: /不可行/, name: '可行性矛盾' },
    { p1: /盈利/, p2: /亏损/, name: '盈亏矛盾' },
    { p1: /推荐/, p2: /不推荐/, name: '推荐矛盾' },
    { p1: /高增长/, p2: /市场萎缩/, name: '市场趋势矛盾' },
    { p1: /供不应求/, p2: /供过于求/, name: '供需矛盾' },
    { p1: /利润高/, p2: /利润低/, name: '利润矛盾' },
    { p1: /风险低/, p2: /风险高/, name: '风险矛盾' },
    { p1: /竞争小/, p2: /竞争激烈/, name: '竞争矛盾' },
    { p1: /需求大/, p2: /需求小/, name: '需求矛盾' },
    { p1: /门槛低/, p2: /门槛高/, name: '门槛矛盾' },
  ];
  
  for (const c of basicContradictions) {
    if (c.p1.test(content) && c.p2.test(content)) {
      const evidence = [
        ...content.match(new RegExp(`[^。！？]*${c.p1.source}[^。！？]*`, 'g')) || [],
        ...content.match(new RegExp(`[^。！？]*${c.p2.source}[^。！？]*`, 'g')) || [],
      ].slice(0, 4);
      
      contradictions.push({
        type: 'logical_contradiction',
        description: c.name,
        severity: 'warning',
        evidence,
        suggestion: '请明确结论，避免矛盾表述',
      });
    }
  }
  
  // 2. 数值矛盾
  const numberContradictions = detectNumberContradictions(content);
  contradictions.push(...numberContradictions);
  
  // 3. 时间矛盾
  const timeContradictions = detectTimeContradictions(content);
  contradictions.push(...timeContradictions);
  
  // 4. 结论与数据矛盾
  const conclusionDataContradictions = detectConclusionDataContradictions(content);
  contradictions.push(...conclusionDataContradictions);
  
  // 5. 约束违反
  const constraintViolations = detectConstraintViolations(content);
  contradictions.push(...constraintViolations);
  
  // 6. 因果矛盾
  const causalContradictions = detectCausalContradictions(content);
  contradictions.push(...causalContradictions);
  
  // 7. 比较矛盾
  const comparisonContradictions = detectComparisonContradictions(content);
  contradictions.push(...comparisonContradictions);
  
  // 计算总分
  const criticalCount = contradictions.filter(c => c.severity === 'critical').length;
  const warningCount = contradictions.filter(c => c.severity === 'warning').length;
  
  let overallScore = 100;
  overallScore -= criticalCount * 20;
  overallScore -= warningCount * 5;
  overallScore = Math.max(0, overallScore);
  
  // 生成修正内容
  let correctedContent = content;
  
  if (criticalCount > 0) {
    const summary = `
【⚠️ 发现${criticalCount}个严重问题】
${contradictions.filter(c => c.severity === 'critical').map(c => `- ${c.description}`).join('\n')}

`;
    correctedContent = summary + correctedContent;
  }
  
  return {
    contradictions,
    overallScore,
    correctedContent,
  };
}

// 检测数值矛盾
function detectNumberContradictions(content: string): ExtendedContradictionDetection['contradictions'] {
  const contradictions: ExtendedContradictionDetection['contradictions'] = [];
  
  // 提取投资相关数字
  const investmentMatches = content.matchAll(/投资[^\d]*(\d+\.?\d*)\s*(万|元)/g);
  const investments = Array.from(investmentMatches).map(m => ({
    value: parseFloat(m[1]) * (m[2] === '万' ? 10000 : 1),
    context: m[0],
  }));
  
  if (investments.length >= 2) {
    const values = investments.map(i => i.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    if (max > min * 3) {
      contradictions.push({
        type: 'numerical_contradiction',
        description: `投资金额差异过大: ${min / 10000}万 - ${max / 10000}万`,
        severity: 'warning',
        evidence: investments.map(i => i.context).slice(0, 4),
        suggestion: '请核实投资金额，确保数据一致',
      });
    }
  }
  
  // 提取利润相关数字
  const profitMatches = content.matchAll(/(利润|收益|盈利)[^\d]*(\d+\.?\d*)\s*(万|元)/g);
  const profits = Array.from(profitMatches).map(m => ({
    value: parseFloat(m[2]) * (m[3] === '万' ? 10000 : 1),
    context: m[0],
  }));
  
  if (profits.length >= 2) {
    const values = profits.map(p => p.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    if (max > min * 5) {
      contradictions.push({
        type: 'numerical_contradiction',
        description: `利润预测差异过大`,
        severity: 'warning',
        evidence: profits.map(p => p.context).slice(0, 4),
        suggestion: '请说明不同情景下的利润预测',
      });
    }
  }
  
  return contradictions;
}

// 检测时间矛盾
function detectTimeContradictions(content: string): ExtendedContradictionDetection['contradictions'] {
  const contradictions: ExtendedContradictionDetection['contradictions'] = [];
  
  // 提取回本周期
  const roiMatches = content.matchAll(/(\d+)\s*个?月.*回本/g);
  const rois = Array.from(roiMatches).map(m => ({
    value: parseInt(m[1]),
    context: m[0],
  }));
  
  if (rois.length >= 2) {
    const values = rois.map(r => r.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    if (max - min > 6) {
      contradictions.push({
        type: 'time_contradiction',
        description: `回本周期预测不一致: ${min}个月 vs ${max}个月`,
        severity: 'warning',
        evidence: rois.map(r => r.context),
        suggestion: '请统一回本周期预测或说明不同情景',
      });
    }
  }
  
  return contradictions;
}

// 检测结论与数据矛盾
function detectConclusionDataContradictions(content: string): ExtendedContradictionDetection['contradictions'] {
  const contradictions: ExtendedContradictionDetection['contradictions'] = [];
  
  const hasPositiveConclusion = /推荐|可行|值得|建议/.test(content);
  const hasNegativeData = /风险高|亏损|竞争激烈|市场萎缩|需求下降/.test(content);
  
  if (hasPositiveConclusion && hasNegativeData) {
    contradictions.push({
      type: 'conclusion_data_contradiction',
      description: '结论为正面，但数据存在负面因素',
      severity: 'warning',
      evidence: [
        ...(content.match(/推荐|可行|值得/g) || []).slice(0, 2),
        ...(content.match(/风险高|亏损|竞争激烈/g) || []).slice(0, 2),
      ],
      suggestion: '请在结论中说明风险因素',
    });
  }
  
  const hasNegativeConclusion = /不推荐|不可行|不值得/.test(content);
  const hasPositiveData = /利润高|增长|需求大|竞争小/.test(content);
  
  if (hasNegativeConclusion && hasPositiveData) {
    contradictions.push({
      type: 'conclusion_data_contradiction',
      description: '结论为负面，但数据存在正面因素',
      severity: 'warning',
      evidence: [
        ...(content.match(/不推荐|不可行/g) || []).slice(0, 2),
        ...(content.match(/利润高|增长|需求大/g) || []).slice(0, 2),
      ],
      suggestion: '请解释为何正面数据不支持正面结论',
    });
  }
  
  return contradictions;
}

// 检测约束违反
function detectConstraintViolations(content: string): ExtendedContradictionDetection['contradictions'] {
  const contradictions: ExtendedContradictionDetection['contradictions'] = [];
  
  // 投资约束
  const investmentMatch = content.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
  if (investmentMatch) {
    const investment = parseFloat(investmentMatch[1]) * 10000;
    if (investment > USER_PROFILE.funds.total) {
      contradictions.push({
        type: 'constraint_violation',
        description: `投资${investmentMatch[1]}万超过预算${USER_PROFILE.funds.total / 10000}万`,
        severity: 'critical',
        evidence: [investmentMatch[0]],
        suggestion: '请调整投资金额或说明资金缺口解决方案',
      });
    }
  }
  
  // ROI约束
  const roiMatch = content.match(/(\d+)\s*个?月.*回本/);
  if (roiMatch) {
    const roi = parseInt(roiMatch[1]);
    if (roi > USER_PROFILE.constraints.roiMonths) {
      contradictions.push({
        type: 'constraint_violation',
        description: `回本周期${roi}个月超过限制${USER_PROFILE.constraints.roiMonths}个月`,
        severity: 'critical',
        evidence: [roiMatch[0]],
        suggestion: '请说明如何缩短回本周期或标注为不推荐',
      });
    }
  }
  
  // 合规约束
  const illegalKeywords = ['灰色', '违规', '逃税', '无证经营', '黑市'];
  for (const keyword of illegalKeywords) {
    if (content.includes(keyword)) {
      contradictions.push({
        type: 'constraint_violation',
        description: `包含不合规内容: ${keyword}`,
        severity: 'critical',
        evidence: [keyword],
        suggestion: '删除不合规内容',
      });
    }
  }
  
  return contradictions;
}

// 检测因果矛盾
function detectCausalContradictions(content: string): ExtendedContradictionDetection['contradictions'] {
  const contradictions: ExtendedContradictionDetection['contradictions'] = [];
  
  // 检测"因为A所以B"但后面又说"非B"
  const causalPatterns = [
    { pattern: /因为.*所以.*成功.*失败/, name: '因果矛盾：成功vs失败' },
    { pattern: /由于.*导致.*盈利.*亏损/, name: '因果矛盾：盈利vs亏损' },
    { pattern: /因为.*所以.*可行.*不可行/, name: '因果矛盾：可行vs不可行' },
  ];
  
  for (const cp of causalPatterns) {
    if (cp.pattern.test(content)) {
      contradictions.push({
        type: 'causal_contradiction',
        description: cp.name,
        severity: 'warning',
        evidence: [content.match(cp.pattern)?.[0] || ''],
        suggestion: '请检查因果逻辑是否正确',
      });
    }
  }
  
  return contradictions;
}

// 检测比较矛盾
function detectComparisonContradictions(content: string): ExtendedContradictionDetection['contradictions'] {
  const contradictions: ExtendedContradictionDetection['contradictions'] = [];
  
  // 检测"A比B好"但后面又说"B比A好"
  const comparisonPatterns = [
    { pattern: /A.*优于.*B.*B.*优于.*A/, name: '比较矛盾：A>B且B>A' },
    { pattern: /方案一.*好于.*方案二.*方案二.*好于.*方案一/, name: '比较矛盾：方案比较' },
  ];
  
  for (const cp of comparisonPatterns) {
    if (cp.pattern.test(content)) {
      contradictions.push({
        type: 'comparison_contradiction',
        description: cp.name,
        severity: 'warning',
        evidence: [content.match(cp.pattern)?.[0] || ''],
        suggestion: '请明确比较结论',
      });
    }
  }
  
  return contradictions;
}

// ==================== 3. 后验审计增加更多验证维度 ====================

export interface ExtendedAudit {
  dimensions: {
    name: string;
    score: number;
    issues: string[];
    verified: boolean;
    details: string;
  }[];
  overallScore: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  recommendations: string[];
}

// 扩展的后验审计（10维度）
export async function executeExtendedAudit(
  report: string,
  originalQuery: string
): Promise<ExtendedAudit> {
  const dimensions: ExtendedAudit['dimensions'] = [];
  
  // 1. 事实核查
  dimensions.push(await auditFactsExtended(report, originalQuery));
  
  // 2. 数据一致性
  dimensions.push(auditDataConsistencyExtended(report));
  
  // 3. 逻辑一致性
  dimensions.push(auditLogicConsistencyExtended(report));
  
  // 4. 约束满足
  dimensions.push(auditConstraintSatisfactionExtended(report));
  
  // 5. 来源可靠性
  dimensions.push(auditSourceReliabilityExtended(report));
  
  // 6. 时效性
  dimensions.push(auditTimelinessExtended(report));
  
  // 7. 完整性
  dimensions.push(auditCompleteness(report));
  
  // 8. 可操作性
  dimensions.push(auditActionability(report));
  
  // 9. 风险披露
  dimensions.push(auditRiskDisclosure(report));
  
  // 10. 结论一致性
  dimensions.push(auditConclusionConsistency(report));
  
  // 计算总分
  const overallScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
  
  // 确定等级
  const overallGrade: 'A' | 'B' | 'C' | 'D' | 'F' = 
    overallScore >= 90 ? 'A' : 
    overallScore >= 80 ? 'B' : 
    overallScore >= 70 ? 'C' : 
    overallScore >= 60 ? 'D' : 'F';
  
  // 生成摘要
  const summary = generateExtendedAuditSummary(dimensions, overallGrade);
  
  // 生成建议
  const recommendations = generateExtendedAuditRecommendations(dimensions);
  
  return {
    dimensions,
    overallScore,
    overallGrade,
    summary,
    recommendations,
  };
}

// 事实核查（扩展）
async function auditFactsExtended(report: string, query: string): Promise<ExtendedAudit['dimensions'][0]> {
  const issues: string[] = [];
  let score = 100;
  const details: string[] = [];
  
  // 提取关键声明
  const claims = extractKeyClaimsExtended(report);
  details.push(`提取了${claims.length}个关键声明`);
  
  // 验证每个声明
  let verifiedCount = 0;
  for (const claim of claims.slice(0, 5)) {
    try {
      const searchResult = await searchWithVerification(`${query} ${claim.slice(0, 50)}`);
      
      if (searchResult.combined.length >= 2) {
        verifiedCount++;
        details.push(`"${claim.slice(0, 30)}..." - 已验证`);
      } else {
        issues.push(`声明"${claim.slice(0, 30)}..."缺乏足够来源支持`);
        score -= 10;
        details.push(`"${claim.slice(0, 30)}..." - 缺乏来源`);
      }
    } catch {
      details.push(`"${claim.slice(0, 30)}..." - 验证失败`);
    }
  }
  
  details.push(`验证通过: ${verifiedCount}/${Math.min(claims.length, 5)}`);
  
  return {
    name: '事实核查',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 提取关键声明（扩展）
function extractKeyClaimsExtended(report: string): string[] {
  const claims: string[] = [];
  
  // 提取包含数字的声明
  const numberClaims = report.match(/[^。！？]*\d+\.?\d*\s*(万|亿|元|吨|%|个月)[^。！？]*/g) || [];
  claims.push(...numberClaims);
  
  // 提取结论性声明
  const conclusionClaims = report.match(/(结论|建议|推荐|判断|观点)[：:]\s*[^。\n]+/g) || [];
  claims.push(...conclusionClaims);
  
  // 提取预测性声明
  const predictionClaims = report.match(/(预计|预测|估计|预期)[^。\n]+/g) || [];
  claims.push(...predictionClaims);
  
  return [...new Set(claims)];
}

// 数据一致性审计（扩展）
function auditDataConsistencyExtended(report: string): ExtendedAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  const details: string[] = [];
  
  // 检查数值一致性
  const numbers = report.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨|%)/g);
  const numArray = Array.from(numbers).map(m => ({ value: parseFloat(m[1]), unit: m[2], context: m[0] }));
  
  details.push(`发现${numArray.length}个数值`);
  
  // 按单位分组检查
  const byUnit: Record<string, number[]> = {};
  for (const n of numArray) {
    if (!byUnit[n.unit]) byUnit[n.unit] = [];
    byUnit[n.unit].push(n.value);
  }
  
  for (const [unit, values] of Object.entries(byUnit)) {
    if (values.length >= 2) {
      const max = Math.max(...values);
      const min = Math.min(...values);
      const ratio = max / min;
      
      if (ratio > 10) {
        issues.push(`${unit}单位数值差异过大: ${min} - ${max}（比值${ratio.toFixed(1)}）`);
        score -= 15;
      } else if (ratio > 5) {
        issues.push(`${unit}单位数值差异较大: ${min} - ${max}`);
        score -= 8;
      }
      
      details.push(`${unit}: ${values.length}个数值, 范围${min}-${max}`);
    }
  }
  
  return {
    name: '数据一致性',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 逻辑一致性审计（扩展）
function auditLogicConsistencyExtended(report: string): ExtendedAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  const details: string[] = [];
  
  // 检查矛盾
  const contradictions = [
    [/可行/, /不可行/, '可行性矛盾'],
    [/推荐/, /不推荐/, '推荐矛盾'],
    [/盈利/, /亏损/, '盈亏矛盾'],
    [/风险低/, /风险高/, '风险矛盾'],
    [/竞争小/, /竞争激烈/, '竞争矛盾'],
  ];
  
  for (const [p1, p2, name] of contradictions) {
    if (p1.test(report) && p2.test(report)) {
      issues.push(`存在${name}`);
      score -= 15;
      details.push(`发现${name}`);
    }
  }
  
  if (issues.length === 0) {
    details.push('未发现明显逻辑矛盾');
  }
  
  return {
    name: '逻辑一致性',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 约束满足审计（扩展）
function auditConstraintSatisfactionExtended(report: string): ExtendedAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  const details: string[] = [];
  
  // 检查投资约束
  const investmentMatch = report.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
  if (investmentMatch) {
    const investment = parseFloat(investmentMatch[1]) * 10000;
    if (investment > USER_PROFILE.funds.total) {
      issues.push(`投资金额超过预算`);
      score -= 25;
      details.push(`投资${investmentMatch[1]}万 > 预算${USER_PROFILE.funds.total / 10000}万`);
    } else {
      details.push(`投资${investmentMatch[1]}万 <= 预算${USER_PROFILE.funds.total / 10000}万 ✓`);
    }
  }
  
  // 检查ROI约束
  const roiMatch = report.match(/(\d+)\s*个?月.*回本/);
  if (roiMatch) {
    const roi = parseInt(roiMatch[1]);
    if (roi > USER_PROFILE.constraints.roiMonths) {
      issues.push(`回本周期超过限制`);
      score -= 25;
      details.push(`回本${roi}个月 > 限制${USER_PROFILE.constraints.roiMonths}个月`);
    } else {
      details.push(`回本${roi}个月 <= 限制${USER_PROFILE.constraints.roiMonths}个月 ✓`);
    }
  }
  
  // 检查合规
  const illegalKeywords = ['灰色', '违规', '逃税'];
  for (const keyword of illegalKeywords) {
    if (report.includes(keyword)) {
      issues.push(`包含不合规内容: ${keyword}`);
      score -= 30;
      details.push(`发现不合规关键词: ${keyword}`);
    }
  }
  
  return {
    name: '约束满足',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 来源可靠性审计（扩展）
function auditSourceReliabilityExtended(report: string): ExtendedAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 70;
  const details: string[] = [];
  
  // 检查是否有来源标注
  const sourceCount = (report.match(/来源[：:]/g) || []).length;
  const refCount = (report.match(/参考/g) || []).length;
  
  details.push(`来源标注: ${sourceCount}处`);
  details.push(`参考引用: ${refCount}处`);
  
  if (sourceCount >= 3) {
    score = 95;
    details.push('来源标注充分 ✓');
  } else if (sourceCount >= 1) {
    score = 85;
    details.push('有来源标注');
  } else if (refCount >= 1) {
    score = 80;
    details.push('有参考引用');
  } else {
    issues.push('缺少数据来源标注');
    details.push('缺少来源标注');
  }
  
  return {
    name: '来源可靠性',
    score,
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 时效性审计（扩展）
function auditTimelinessExtended(report: string): ExtendedAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  const details: string[] = [];
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // 检查日期
  const yearMatches = report.matchAll(/(\d{4})[-\/年]/g);
  const years = Array.from(yearMatches).map(m => parseInt(m[1]));
  
  details.push(`发现${years.length}个年份引用`);
  
  for (const year of years) {
    if (year < currentYear - 2) {
      issues.push(`数据可能过期: ${year}年`);
      score -= 10;
      details.push(`${year}年 - 可能过期`);
    } else if (year < currentYear - 1) {
      details.push(`${year}年 - 较旧`);
    } else {
      details.push(`${year}年 - 较新 ✓`);
    }
  }
  
  return {
    name: '时效性',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 完整性审计
function auditCompleteness(report: string): ExtendedAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  const details: string[] = [];
  
  // 检查必要部分
  const requiredSections = [
    { name: '市场分析', patterns: [/市场/, /规模/, /需求/] },
    { name: '财务分析', patterns: [/投资/, /成本/, /利润/] },
    { name: '风险分析', patterns: [/风险/, /注意/] },
    { name: '执行建议', patterns: [/建议/, /步骤/, /方案/] },
    { name: '结论', patterns: [/结论/, /判断/] },
  ];
  
  for (const section of requiredSections) {
    const hasSection = section.patterns.some(p => p.test(report));
    if (hasSection) {
      details.push(`${section.name} ✓`);
    } else {
      issues.push(`缺少${section.name}`);
      score -= 15;
      details.push(`${section.name} ✗`);
    }
  }
  
  return {
    name: '完整性',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 可操作性审计
function auditActionability(report: string): ExtendedAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  const details: string[] = [];
  
  // 检查是否有具体步骤
  const hasSteps = /步骤|第一|第二|第三|首先|然后|最后/.test(report);
  const hasTimeline = /\d+天|\d+周|\d+月/.test(report);
  const hasResources = /资金|人员|设备|场地/.test(report);
  
  if (hasSteps) {
    details.push('有具体步骤 ✓');
  } else {
    issues.push('缺少具体执行步骤');
    score -= 20;
    details.push('缺少具体步骤');
  }
  
  if (hasTimeline) {
    details.push('有时间规划 ✓');
  } else {
    issues.push('缺少时间规划');
    score -= 15;
    details.push('缺少时间规划');
  }
  
  if (hasResources) {
    details.push('有资源说明 ✓');
  } else {
    details.push('缺少资源说明');
    score -= 10;
  }
  
  return {
    name: '可操作性',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 风险披露审计
function auditRiskDisclosure(report: string): ExtendedAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  const details: string[] = [];
  
  // 检查风险披露
  const riskKeywords = ['风险', '注意', '警告', '可能', '不确定'];
  const foundRisks: string[] = [];
  
  for (const keyword of riskKeywords) {
    if (report.includes(keyword)) {
      foundRisks.push(keyword);
    }
  }
  
  if (foundRisks.length >= 3) {
    details.push(`风险披露充分: ${foundRisks.join('、')} ✓`);
  } else if (foundRisks.length >= 1) {
    details.push(`有风险提示: ${foundRisks.join('、')}`);
    score -= 10;
  } else {
    issues.push('缺少风险披露');
    score -= 30;
    details.push('缺少风险披露');
  }
  
  return {
    name: '风险披露',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 结论一致性审计
function auditConclusionConsistency(report: string): ExtendedAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  const details: string[] = [];
  
  // 提取所有结论性语句
  const conclusions = report.match(/(结论|判断|建议|推荐)[：:]\s*[^。\n]+/g) || [];
  
  details.push(`发现${conclusions.length}个结论性语句`);
  
  if (conclusions.length >= 2) {
    // 检查结论是否一致
    const positiveCount = conclusions.filter(c => /可行|推荐|值得/.test(c)).length;
    const negativeCount = conclusions.filter(c => /不可行|不推荐|不值得/.test(c)).length;
    
    if (positiveCount > 0 && negativeCount > 0) {
      issues.push('结论存在矛盾');
      score -= 25;
      details.push('存在矛盾结论');
    } else {
      details.push('结论一致 ✓');
    }
  }
  
  return {
    name: '结论一致性',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
    details: details.join('\n'),
  };
}

// 生成扩展审计摘要
function generateExtendedAuditSummary(
  dimensions: ExtendedAudit['dimensions'],
  grade: string
): string {
  const passed = dimensions.filter(d => d.verified).length;
  const total = dimensions.length;
  
  const gradeMessages: Record<string, string> = {
    'A': `报告通过全面审计，${passed}/${total}维度验证通过，数据可信度高`,
    'B': `报告基本通过审计，${passed}/${total}维度验证通过，部分问题需关注`,
    'C': `报告存在较多问题，${total - passed}个维度未通过，建议核实`,
    'D': `报告存在严重问题，建议重新分析`,
    'F': `报告未通过审计，需要重新生成`,
  };
  
  return gradeMessages[grade] || '';
}

// 生成扩展审计建议
function generateExtendedAuditRecommendations(dimensions: ExtendedAudit['dimensions']): string[] {
  const recommendations: string[] = [];
  
  for (const d of dimensions) {
    if (!d.verified && d.issues.length > 0) {
      recommendations.push(`【${d.name}】${d.issues.join('；')}`);
    }
  }
  
  return recommendations;
}

// ==================== 4. 竞品分析更深入 ====================

export interface DeepCompetitorAnalysis {
  competitors: {
    name: string;
    description: string;
    features: string[];
    pricing: { min: number; max: number; currency: string };
    marketShare: string;
    strengths: string[];
    weaknesses: string[];
    differentiation: string;
  }[];
  marketOverview: {
    totalSize: string;
    growthRate: string;
    keyPlayers: string[];
  };
  differentiationOpportunities: string[];
  recommendation: string;
}

// 深入竞品分析
export async function analyzeCompetitorsDeeply(
  productName: string,
  productDescription: string
): Promise<DeepCompetitorAnalysis> {
  const competitors: DeepCompetitorAnalysis['competitors'] = [];
  
  // 1. 搜索竞品
  const searchResult = await searchWithVerification(
    `${productName} 竞品 对比 替代品 市场`
  );
  
  // 2. 解析竞品信息
  for (const result of searchResult.combined.slice(0, 5)) {
    const title = result.title || '';
    const content = result.snippet || result.content || '';
    
    // 提取竞品名称
    const competitorNames = extractCompetitorNames(title, content);
    
    for (const name of competitorNames) {
      // 搜索该竞品的详细信息
      const detailResult = await searchWithVerification(`${name} ${productName} 功能 价格 优缺点`);
      
      competitors.push({
        name,
        description: extractDescription(detailResult.combined),
        features: extractFeatures(detailResult.combined),
        pricing: extractPricing(detailResult.combined),
        marketShare: extractMarketShare(detailResult.combined),
        strengths: extractStrengths(detailResult.combined),
        weaknesses: extractWeaknesses(detailResult.combined),
        differentiation: '',
      });
    }
  }
  
  // 去重
  const uniqueCompetitors = removeDuplicateCompetitors(competitors);
  
  // 3. 分析差异化机会
  const differentiationOpportunities = analyzeDifferentiationOpportunities(
    productDescription,
    uniqueCompetitors
  );
  
  // 4. 为每个竞品生成差异化分析
  for (const competitor of uniqueCompetitors) {
    competitor.differentiation = generateDifferentiation(productDescription, competitor);
  }
  
  // 5. 市场概览
  const marketOverview = await analyzeMarketOverview(productName);
  
  // 6. 生成建议
  const recommendation = generateCompetitorRecommendation(uniqueCompetitors, differentiationOpportunities);
  
  return {
    competitors: uniqueCompetitors,
    marketOverview,
    differentiationOpportunities,
    recommendation,
  };
}

// 提取竞品名称
function extractCompetitorNames(title: string, content: string): string[] {
  const names: string[] = [];
  
  // 从标题提取
  const vsMatch = title.match(/vs\s*([^vs]+)/i);
  if (vsMatch) {
    names.push(vsMatch[1].trim());
  }
  
  // 从内容提取
  const competitorMatch = content.match(/竞品[：:]\s*([^，。\n]+)/);
  if (competitorMatch) {
    names.push(competitorMatch[1].trim());
  }
  
  // 从对比列表提取
  const listMatch = content.match(/([^，、]+)[，、][^，、]+[，、]/g);
  if (listMatch) {
    for (const item of listMatch) {
      const name = item.replace(/[，、]/g, '').trim();
      if (name.length >= 2 && name.length <= 10) {
        names.push(name);
      }
    }
  }
  
  return [...new Set(names)].slice(0, 3);
}

// 提取描述
function extractDescription(results: any[]): string {
  for (const result of results) {
    const content = result.snippet || result.content || '';
    if (content.length > 50) {
      return content.slice(0, 200);
    }
  }
  return '';
}

// 提取功能
function extractFeatures(results: any[]): string[] {
  const features: string[] = [];
  
  for (const result of results) {
    const content = result.snippet || result.content || '';
    
    // 提取功能列表
    const featureMatches = content.matchAll(/(功能|特点|支持|提供)[：:]\s*([^，。\n]+)/g);
    for (const match of featureMatches) {
      if (match[2] && match[2].length >= 2 && match[2].length <= 30) {
        features.push(match[2].trim());
      }
    }
  }
  
  return [...new Set(features)].slice(0, 10);
}

// 提取价格
function extractPricing(results: any[]): { min: number; max: number; currency: string } {
  let min = 0;
  let max = 0;
  
  for (const result of results) {
    const content = result.snippet || result.content || '';
    
    const priceMatch = content.match(/(\d+\.?\d*)\s*(元|万|美元)/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      const unit = priceMatch[2];
      
      const actualPrice = unit === '万' ? price * 10000 : price;
      
      if (min === 0 || actualPrice < min) min = actualPrice;
      if (actualPrice > max) max = actualPrice;
    }
  }
  
  return { min, max, currency: 'CNY' };
}

// 提取市场份额
function extractMarketShare(results: any[]): string {
  for (const result of results) {
    const content = result.snippet || result.content || '';
    
    const shareMatch = content.match(/市场份额[^\d]*(\d+\.?\d*)\s*%/);
    if (shareMatch) {
      return `${shareMatch[1]}%`;
    }
  }
  
  return '未知';
}

// 提取优势
function extractStrengths(results: any[]): string[] {
  const strengths: string[] = [];
  
  for (const result of results) {
    const content = result.snippet || result.content || '';
    
    const strengthMatches = content.matchAll(/(优势|优点|长处)[：:]\s*([^，。\n]+)/g);
    for (const match of strengthMatches) {
      if (match[2]) {
        strengths.push(match[2].trim());
      }
    }
  }
  
  return [...new Set(strengths)].slice(0, 5);
}

// 提取劣势
function extractWeaknesses(results: any[]): string[] {
  const weaknesses: string[] = [];
  
  for (const result of results) {
    const content = result.snippet || result.content || '';
    
    const weaknessMatches = content.matchAll(/(劣势|缺点|不足)[：:]\s*([^，。\n]+)/g);
    for (const match of weaknessMatches) {
      if (match[2]) {
        weaknesses.push(match[2].trim());
      }
    }
  }
  
  return [...new Set(weaknesses)].slice(0, 5);
}

// 去重竞品
function removeDuplicateCompetitors(competitors: DeepCompetitorAnalysis['competitors']): DeepCompetitorAnalysis['competitors'] {
  const seen = new Set<string>();
  return competitors.filter(c => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

// 分析差异化机会
function analyzeDifferentiationOpportunities(
  productDescription: string,
  competitors: DeepCompetitorAnalysis['competitors']
): string[] {
  const opportunities: string[] = [];
  
  // 收集竞品的共同弱点
  const allWeaknesses = competitors.flatMap(c => c.weaknesses);
  const weaknessCounts: Record<string, number> = {};
  
  for (const w of allWeaknesses) {
    weaknessCounts[w] = (weaknessCounts[w] || 0) + 1;
  }
  
  // 找出竞品共同的弱点
  for (const [weakness, count] of Object.entries(weaknessCounts)) {
    if (count >= 2) {
      opportunities.push(`针对竞品共同弱点"${weakness}"进行差异化`);
    }
  }
  
  // 分析产品描述中的独特点
  const uniqueKeywords = ['创新', '独特', '专利', '独家', '首创'];
  for (const keyword of uniqueKeywords) {
    if (productDescription.includes(keyword)) {
      opportunities.push(`强调${keyword}优势`);
    }
  }
  
  // 如果竞品价格较高
  const avgPrice = competitors.reduce((sum, c) => sum + c.pricing.min, 0) / competitors.length;
  if (avgPrice > 10000) {
    opportunities.push('提供更具性价比的方案');
  }
  
  return opportunities;
}

// 生成差异化分析
function generateDifferentiation(
  productDescription: string,
  competitor: DeepCompetitorAnalysis['competitors'][0]
): string {
  const differentiations: string[] = [];
  
  // 对比优势
  if (competitor.weaknesses.length > 0) {
    differentiations.push(`竞品${competitor.name}的${competitor.weaknesses[0]}是我们的机会`);
  }
  
  // 价格对比
  if (competitor.pricing.min > 0) {
    differentiations.push(`可考虑定价低于${competitor.pricing.min}元以获取价格优势`);
  }
  
  return differentiations.join('；') || '需要进一步分析差异化点';
}

// 分析市场概览
async function analyzeMarketOverview(productName: string): Promise<DeepCompetitorAnalysis['marketOverview']> {
  const searchResult = await searchWithVerification(`${productName} 市场规模 增长率 主要企业`);
  
  let totalSize = '未知';
  let growthRate = '未知';
  const keyPlayers: string[] = [];
  
  for (const result of searchResult.combined) {
    const content = result.snippet || result.content || '';
    
    // 提取市场规模
    const sizeMatch = content.match(/市场规模[^\d]*(\d+\.?\d*)\s*(亿|万)/);
    if (sizeMatch) {
      totalSize = `${sizeMatch[1]}${sizeMatch[2]}`;
    }
    
    // 提取增长率
    const growthMatch = content.match(/增长率[^\d]*(\d+\.?\d*)\s*%/);
    if (growthMatch) {
      growthRate = `${growthMatch[1]}%`;
    }
    
    // 提取主要企业
    const playerMatch = content.match(/主要企业[：:]\s*([^，。\n]+)/);
    if (playerMatch) {
      keyPlayers.push(playerMatch[1].trim());
    }
  }
  
  return { totalSize, growthRate, keyPlayers: keyPlayers.slice(0, 5) };
}

// 生成竞品分析建议
function generateCompetitorRecommendation(
  competitors: DeepCompetitorAnalysis['competitors'],
  opportunities: string[]
): string {
  if (competitors.length === 0) {
    return '市场空白，具有先发优势，但需验证市场需求';
  }
  
  if (competitors.length >= 3) {
    return `市场竞争激烈，存在${competitors.length}个主要竞品。建议：${opportunities.slice(0, 3).join('；')}`;
  }
  
  return `市场存在${competitors.length}个竞品，有机会通过差异化获得市场份额。建议：${opportunities.slice(0, 2).join('；')}`;
}

// ==================== 5. 时效检查改进 ====================

export interface ImprovedTimeValidityCheck {
  dataPoints: {
    claim: string;
    value: string;
    detectedDate: Date | null;
    dateSource: 'url' | 'content' | 'meta' | 'inferred';
    dataType: 'price' | 'industry' | 'policy';
    maxAge: number;
    actualAge: number;
    valid: boolean;
    warning: string | null;
  }[];
  overallValidity: number;
  expiredCount: number;
  warningCount: number;
}

// 改进的时效检查
export function checkTimeValidityImproved(content: string): ImprovedTimeValidityCheck {
  const dataPoints: ImprovedTimeValidityCheck['dataPoints'] = [];
  const now = new Date();
  
  // 1. 提取价格数据
  const priceMatches = content.matchAll(/(价格|报价|成本)[^\d]*(\d+\.?\d*)\s*(元|万)/g);
  for (const match of priceMatches) {
    const date = extractNearbyDate(content, match.index || 0);
    const actualAge = date ? Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    dataPoints.push({
      claim: match[0],
      value: `${match[2]}${match[3]}`,
      detectedDate: date,
      dateSource: date ? 'content' : 'inferred',
      dataType: 'price',
      maxAge: 7,
      actualAge,
      valid: actualAge <= 7,
      warning: actualAge > 7 ? `价格数据已过期${actualAge}天` : null,
    });
  }
  
  // 2. 提取行业数据
  const industryMatches = content.matchAll(/(市场规模|增长率|份额)[^\d]*(\d+\.?\d*)\s*(亿|万|%)/g);
  for (const match of industryMatches) {
    const date = extractNearbyDate(content, match.index || 0);
    const actualAge = date ? Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    dataPoints.push({
      claim: match[0],
      value: `${match[2]}${match[3]}`,
      detectedDate: date,
      dateSource: date ? 'content' : 'inferred',
      dataType: 'industry',
      maxAge: 90,
      actualAge,
      valid: actualAge <= 90,
      warning: actualAge > 90 ? `行业数据已过期${actualAge}天` : null,
    });
  }
  
  // 3. 提取政策数据
  const policyMatches = content.matchAll(/(政策|法规|规定|办法)[^。]*\d/g);
  for (const match of policyMatches) {
    const date = extractNearbyDate(content, match.index || 0);
    const actualAge = date ? Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    dataPoints.push({
      claim: match[0].slice(0, 50),
      value: '',
      detectedDate: date,
      dateSource: date ? 'content' : 'inferred',
      dataType: 'policy',
      maxAge: 180,
      actualAge,
      valid: actualAge <= 180,
      warning: actualAge > 180 ? `政策数据已过期${actualAge}天` : null,
    });
  }
  
  // 计算总体有效性
  const validCount = dataPoints.filter(d => d.valid).length;
  const overallValidity = dataPoints.length > 0 ? (validCount / dataPoints.length) * 100 : 100;
  
  const expiredCount = dataPoints.filter(d => !d.valid && d.actualAge > d.maxAge * 2).length;
  const warningCount = dataPoints.filter(d => !d.valid && d.actualAge <= d.maxAge * 2).length;
  
  return {
    dataPoints,
    overallValidity,
    expiredCount,
    warningCount,
  };
}

// 提取附近的日期
function extractNearbyDate(content: string, position: number): Date | null {
  // 在前后200字符范围内搜索日期
  const start = Math.max(0, position - 200);
  const end = Math.min(content.length, position + 200);
  const nearbyContent = content.substring(start, end);
  
  // 多种日期格式
  const patterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/,
  ];
  
  for (const pattern of patterns) {
    const match = nearbyContent.match(pattern);
    if (match) {
      try {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } catch {}
    }
  }
  
  // 如果没有找到日期，尝试从上下文推断
  const yearMatch = nearbyContent.match(/(\d{4})年/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 2020 && year <= 2030) {
      return new Date(year, 0, 1);
    }
  }
  
  return null;
}
