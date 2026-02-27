// 完整完善系统 - 解决所有不足
import { searchWithVerification } from '../providers/api';
import { USER_PROFILE } from './config';

// ==================== 1. 学习系统真正工作 ====================

export interface LearningSystem {
  // 反馈数据
  feedbackHistory: {
    id: string;
    timestamp: Date;
    decisionId: string;
    query: string;
    rating: number;
    adopted: boolean;
    comment: string;
    correction: string;
    roleFeedback: { roleId: string; helpful: boolean }[];
  }[];
  
  // 准确率追踪
  accuracyTracking: {
    total: number;
    correct: number;
    byRole: Record<string, { total: number; correct: number }>;
    byType: Record<string, { total: number; correct: number }>;
  };
  
  // 学习到的规则
  learnedRules: {
    rule: string;
    source: string;
    confidence: number;
    usageCount: number;
    lastUsed: Date;
  }[];
  
  // 优化的Prompt
  optimizedPrompts: Record<string, string>;
}

// 全局学习系统
let globalLearningSystem: LearningSystem = {
  feedbackHistory: [],
  accuracyTracking: { total: 0, correct: 0, byRole: {}, byType: {} },
  learnedRules: [],
  optimizedPrompts: {},
};

// 加载学习系统
export function loadLearningSystem(): LearningSystem {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('learning_system');
    if (saved) {
      try {
        globalLearningSystem = JSON.parse(saved);
      } catch (e) {}
    }
  }
  return globalLearningSystem;
}

// 保存学习系统
export function saveLearningSystem(system: LearningSystem): void {
  globalLearningSystem = system;
  if (typeof window !== 'undefined') {
    localStorage.setItem('learning_system', JSON.stringify(system));
  }
}

// 处理反馈并学习
export function processFeedbackAndLearn(feedback: {
  decisionId: string;
  query: string;
  rating: number;
  adopted: boolean;
  comment: string;
  correction: string;
  roleFeedback: { roleId: string; helpful: boolean }[];
}): void {
  const system = loadLearningSystem();
  
  // 1. 保存反馈
  system.feedbackHistory.push({
    id: `fb_${Date.now()}`,
    timestamp: new Date(),
    ...feedback,
  });
  
  // 2. 更新准确率追踪
  system.accuracyTracking.total++;
  if (feedback.rating >= 4) {
    system.accuracyTracking.correct++;
  }
  
  // 3. 更新角色准确率
  for (const rf of feedback.roleFeedback) {
    if (!system.accuracyTracking.byRole[rf.roleId]) {
      system.accuracyTracking.byRole[rf.roleId] = { total: 0, correct: 0 };
    }
    system.accuracyTracking.byRole[rf.roleId].total++;
    if (rf.helpful) {
      system.accuracyTracking.byRole[rf.roleId].correct++;
    }
  }
  
  // 4. 从修正中学习规则
  if (feedback.correction) {
    const existingRule = system.learnedRules.find(r => 
      r.rule.includes(feedback.correction) || feedback.correction.includes(r.rule)
    );
    
    if (existingRule) {
      existingRule.confidence = Math.min(100, existingRule.confidence + 10);
      existingRule.usageCount++;
      existingRule.lastUsed = new Date();
    } else {
      system.learnedRules.push({
        rule: feedback.correction,
        source: `用户修正: ${feedback.query}`,
        confidence: 80,
        usageCount: 1,
        lastUsed: new Date(),
      });
    }
  }
  
  // 5. 从评论中提取规则
  if (feedback.comment && feedback.comment.length > 10) {
    // 简单的关键词提取
    const keywords = feedback.comment.match(/[^，。！？,.\s]{4,}/g) || [];
    for (const keyword of keywords.slice(0, 3)) {
      const existingRule = system.learnedRules.find(r => r.rule.includes(keyword));
      if (!existingRule && keyword.length >= 4) {
        system.learnedRules.push({
          rule: keyword,
          source: `用户评论: ${feedback.query}`,
          confidence: 60,
          usageCount: 1,
          lastUsed: new Date(),
        });
      }
    }
  }
  
  // 6. 优化Prompt
  optimizePromptsFromLearning(system);
  
  // 7. 保存
  saveLearningSystem(system);
}

// 从学习中优化Prompt
function optimizePromptsFromLearning(system: LearningSystem): void {
  // 根据角色准确率调整Prompt
  for (const [roleId, stats] of Object.entries(system.accuracyTracking.byRole)) {
    const accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
    
    if (accuracy < 0.5 && stats.total >= 3) {
      // 准确率低于50%，添加警告
      system.optimizedPrompts[roleId] = `
【重要提示】
根据历史反馈，此角色的分析准确率较低（${(accuracy * 100).toFixed(0)}%）。
请特别注意：
- 数据来源必须可靠
- 结论必须有充分依据
- 避免过度推测
`;
    } else if (accuracy > 0.8 && stats.total >= 3) {
      // 准确率高于80%，保持当前策略
      system.optimizedPrompts[roleId] = `
【历史表现优秀】
此角色历史准确率${(accuracy * 100).toFixed(0)}%，继续保持当前分析策略。
`;
    }
  }
  
  // 添加学习到的规则
  const highConfidenceRules = system.learnedRules
    .filter(r => r.confidence >= 70)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
  
  if (highConfidenceRules.length > 0) {
    system.optimizedPrompts['global'] = `
【已学习的重要规则】
${highConfidenceRules.map(r => `- ${r.rule}（置信度${r.confidence}%）`).join('\n')}
`;
  }
}

// 获取优化的Prompt
export function getOptimizedPrompt(roleId: string, originalPrompt: string): string {
  const system = loadLearningSystem();
  
  let optimized = originalPrompt;
  
  // 添加角色特定的优化
  if (system.optimizedPrompts[roleId]) {
    optimized += '\n\n' + system.optimizedPrompts[roleId];
  }
  
  // 添加全局规则
  if (system.optimizedPrompts['global']) {
    optimized += '\n\n' + system.optimizedPrompts['global'];
  }
  
  return optimized;
}

// 获取准确率报告
export function getAccuracyReport(): {
  overall: number;
  byRole: Record<string, number>;
  recentTrend: { date: string; accuracy: number }[];
} {
  const system = loadLearningSystem();
  
  const overall = system.accuracyTracking.total > 0 
    ? system.accuracyTracking.correct / system.accuracyTracking.total 
    : 0;
  
  const byRole: Record<string, number> = {};
  for (const [roleId, stats] of Object.entries(system.accuracyTracking.byRole)) {
    byRole[roleId] = stats.total > 0 ? stats.correct / stats.total : 0;
  }
  
  // 计算近期趋势（最近7天）
  const recentTrend: { date: string; accuracy: number }[] = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    
    const dayFeedback = system.feedbackHistory.filter(f => 
      f.timestamp.toISOString().slice(0, 10) === dateStr
    );
    
    const correct = dayFeedback.filter(f => f.rating >= 4).length;
    const accuracy = dayFeedback.length > 0 ? correct / dayFeedback.length : 0;
    
    recentTrend.push({ date: dateStr, accuracy });
  }
  
  return { overall, byRole, recentTrend };
}

// ==================== 2. 多议题真正并行处理 ====================

export interface ParallelTopicExecution {
  topics: {
    id: number;
    content: string;
    type: 'forward' | 'reverse' | 'compare';
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
  }[];
  
  executionPlan: {
    batch: number;
    topicIds: number[];
    parallel: boolean;
  }[];
  
  dependencies: {
    topicId: number;
    dependsOn: number[];
  }[];
  
  results: Record<number, any>;
}

// 解析依赖关系（智能）
export function parseDependenciesIntelligent(
  topics: { id: number; content: string; type: string }[]
): { topicId: number; dependsOn: number[] }[] {
  const dependencies: { topicId: number; dependsOn: number[] }[] = [];
  
  for (const topic of topics) {
    const deps: number[] = [];
    const content = topic.content.toLowerCase();
    
    // 显式引用
    for (const other of topics) {
      if (other.id !== topic.id) {
        // 检查显式引用
        if (content.includes(`议题${other.id}`) ||
            content.includes(`第${other.id}个`) ||
            content.includes(`问题${other.id}`) ||
            content.includes(`选项${other.id}`)) {
          deps.push(other.id);
        }
      }
    }
    
    // 隐式依赖（对比类依赖前面的议题）
    if (topic.type === 'compare' || content.includes('对比') || content.includes('比较')) {
      for (const other of topics) {
        if (other.id !== topic.id && other.type !== 'compare') {
          if (!deps.includes(other.id)) {
            deps.push(other.id);
          }
        }
      }
    }
    
    // "基于"、"根据"等隐式依赖
    if (content.includes('基于') || content.includes('根据') || content.includes('结合')) {
      // 依赖前一个议题
      const prevTopic = topics.find(t => t.id === topic.id - 1);
      if (prevTopic && !deps.includes(prevTopic.id)) {
        deps.push(prevTopic.id);
      }
    }
    
    dependencies.push({ topicId: topic.id, dependsOn: deps });
  }
  
  return dependencies;
}

// 生成并行执行计划
export function generateParallelExecutionPlan(
  dependencies: { topicId: number; dependsOn: number[] }[]
): { batch: number; topicIds: number[]; parallel: boolean }[] {
  const plan: { batch: number; topicIds: number[]; parallel: boolean }[] = [];
  const completed = new Set<number>();
  const remaining = new Set(dependencies.map(d => d.topicId));
  
  let batch = 0;
  
  while (remaining.size > 0) {
    const readyTopics: number[] = [];
    
    for (const topicId of remaining) {
      const dep = dependencies.find(d => d.topicId === topicId);
      if (dep && dep.dependsOn.every(d => completed.has(d))) {
        readyTopics.push(topicId);
      }
    }
    
    if (readyTopics.length > 0) {
      plan.push({
        batch,
        topicIds: readyTopics,
        parallel: readyTopics.length > 1,
      });
      
      readyTopics.forEach(id => {
        completed.add(id);
        remaining.delete(id);
      });
      
      batch++;
    } else {
      // 避免死锁
      const first = remaining.values().next().value;
      if (first !== undefined) {
        plan.push({
          batch,
          topicIds: [first],
          parallel: false,
        });
        completed.add(first);
        remaining.delete(first);
        batch++;
      }
    }
  }
  
  return plan;
}

// 真正并行执行议题
export async function executeTopicsParallel(
  topics: { id: number; content: string; type: string }[],
  executeTopic: (topic: { id: number; content: string; type: string }) => Promise<any>,
  onProgress?: (batch: number, topicId: number, status: string) => void
): Promise<Record<number, any>> {
  const dependencies = parseDependenciesIntelligent(topics);
  const plan = generateParallelExecutionPlan(dependencies);
  const results: Record<number, any> = {};
  
  for (const batch of plan) {
    // 真正并行执行
    const promises = batch.topicIds.map(async (topicId) => {
      const topic = topics.find(t => t.id === topicId);
      if (!topic) return null;
      
      onProgress?.(batch.batch, topicId, 'running');
      
      try {
        const result = await executeTopic(topic);
        onProgress?.(batch.batch, topicId, 'completed');
        return { topicId, result };
      } catch (error: any) {
        onProgress?.(batch.batch, topicId, 'failed');
        return { topicId, error: error.message };
      }
    });
    
    // 等待当前批次完成
    const batchResults = await Promise.all(promises);
    
    for (const br of batchResults) {
      if (br) {
        if (br.result) {
          results[br.topicId] = br.result;
        } else if (br.error) {
          results[br.topicId] = { error: br.error };
        }
      }
    }
  }
  
  return results;
}

// ==================== 3. 专利验证专业化 ====================

export interface PatentVerification {
  query: string;
  patents: {
    title: string;
    patentNumber: string;
    filingDate: string;
    assignee: string;
    similarity: number;
    url: string;
  }[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
}

// 专利验证（使用Google Patents）
export async function verifyPatent(innovationTitle: string): Promise<PatentVerification> {
  const patents: PatentVerification['patents'] = [];
  
  // 搜索Google Patents
  const searchQuery = `${innovationTitle} patent site:patents.google.com`;
  const searchResult = await searchWithVerification(searchQuery);
  
  for (const result of searchResult.combined.slice(0, 5)) {
    const title = result.title || '';
    const url = result.url || result.link || '';
    
    // 提取专利号
    const patentMatch = title.match(/([A-Z]{2}\d+[A-Z]?\d*)/i) || 
                        url.match(/patent\/([A-Z]{2}\d+[A-Z]?\d*)/i);
    
    if (patentMatch || url.includes('patents.google.com')) {
      // 计算相似度
      const similarity = calculateTextSimilarity(innovationTitle, title);
      
      patents.push({
        title: title.replace(/ - Google Patents$/, ''),
        patentNumber: patentMatch ? patentMatch[1] : 'Unknown',
        filingDate: extractDateFromText(title) || 'Unknown',
        assignee: extractAssignee(title) || 'Unknown',
        similarity,
        url,
      });
    }
  }
  
  // 评估风险
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  
  if (patents.length >= 3) {
    const highSimilarity = patents.filter(p => p.similarity > 0.5);
    if (highSimilarity.length >= 2) {
      riskLevel = 'high';
    } else if (highSimilarity.length >= 1) {
      riskLevel = 'medium';
    }
  } else if (patents.length >= 1) {
    if (patents[0].similarity > 0.7) {
      riskLevel = 'high';
    } else if (patents[0].similarity > 0.4) {
      riskLevel = 'medium';
    }
  }
  
  // 生成建议
  let recommendation = '';
  if (riskLevel === 'high') {
    recommendation = '存在高度相似的专利，建议：1) 详细研究相关专利 2) 考虑授权或规避设计 3) 咨询专利律师';
  } else if (riskLevel === 'medium') {
    recommendation = '存在部分相似的专利，建议进一步研究专利范围，考虑差异化设计';
  } else {
    recommendation = '未发现高度相似的专利，但仍建议在产品开发前进行专业专利检索';
  }
  
  return {
    query: innovationTitle,
    patents,
    riskLevel,
    recommendation,
  };
}

// 计算文本相似度
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

// 从文本提取日期
function extractDateFromText(text: string): string | null {
  const patterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{4}年\d{1,2}月\d{1,2}日)/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// 提取专利权人
function extractAssignee(text: string): string | null {
  const match = text.match(/-\s*([^-\s][^-]*?)\s*-\s*Google Patents/);
  return match ? match[1] : null;
}

// ==================== 4. 来源独立性深度检查 ====================

export interface SourceIndependenceCheck {
  sources: {
    url: string;
    domain: string;
    title: string;
    publishDate?: Date;
    originalSource?: string;
  }[];
  independenceScore: number;
  isIndependent: boolean;
  analysis: {
    sameDomain: string[];
    sameOriginalSource: string[];
    crossReferences: string[];
  };
  recommendation: string;
}

// 深度检查来源独立性
export async function checkSourceIndependenceDeep(
  sources: { url: string; title: string; content: string }[]
): Promise<SourceIndependenceCheck> {
  const processedSources: SourceIndependenceCheck['sources'] = [];
  const analysis: SourceIndependenceCheck['analysis'] = {
    sameDomain: [],
    sameOriginalSource: [],
    crossReferences: [],
  };
  
  // 1. 处理每个来源
  for (const source of sources) {
    const url = source.url;
    let domain = '';
    
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch {
      domain = 'unknown';
    }
    
    // 尝试提取原始来源
    const originalSource = extractOriginalSource(source.content);
    
    processedSources.push({
      url,
      domain,
      title: source.title,
      originalSource,
    });
  }
  
  // 2. 检查相同域名
  const domainCounts: Record<string, number> = {};
  for (const s of processedSources) {
    domainCounts[s.domain] = (domainCounts[s.domain] || 0) + 1;
  }
  
  for (const [domain, count] of Object.entries(domainCounts)) {
    if (count > 1) {
      analysis.sameDomain.push(`${domain}: ${count}个来源`);
    }
  }
  
  // 3. 检查相同原始来源
  const originalSourceCounts: Record<string, number> = {};
  for (const s of processedSources) {
    if (s.originalSource) {
      originalSourceCounts[s.originalSource] = (originalSourceCounts[s.originalSource] || 0) + 1;
    }
  }
  
  for (const [orig, count] of Object.entries(originalSourceCounts)) {
    if (count > 1) {
      analysis.sameOriginalSource.push(`${orig}: ${count}个来源引用`);
    }
  }
  
  // 4. 检查交叉引用
  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      if (sources[i].content.includes(sources[j].url) || 
          sources[j].content.includes(sources[i].url)) {
        analysis.crossReferences.push(`来源${i + 1}和来源${j + 1}相互引用`);
      }
    }
  }
  
  // 5. 计算独立性分数
  let score = 100;
  
  // 相同域名惩罚
  score -= analysis.sameDomain.length * 15;
  
  // 相同原始来源惩罚（更严重）
  score -= analysis.sameOriginalSource.length * 25;
  
  // 交叉引用惩罚
  score -= analysis.crossReferences.length * 20;
  
  score = Math.max(0, Math.min(100, score));
  
  const isIndependent = score >= 60;
  
  // 6. 生成建议
  let recommendation = '';
  if (!isIndependent) {
    recommendation = '来源独立性不足。建议：';
    if (analysis.sameOriginalSource.length > 0) {
      recommendation += ' 多个来源引用同一原始数据，需寻找独立数据源；';
    }
    if (analysis.sameDomain.length > 0) {
      recommendation += ' 存在同域名来源，需寻找不同网站；';
    }
    if (analysis.crossReferences.length > 0) {
      recommendation += ' 存在交叉引用，需寻找独立报道；';
    }
  } else {
    recommendation = '来源独立性良好，数据可信度较高';
  }
  
  return {
    sources: processedSources,
    independenceScore: score,
    isIndependent,
    analysis,
    recommendation,
  };
}

// 提取原始来源
function extractOriginalSource(content: string): string | null {
  const patterns = [
    /来源[：:]\s*([^，。\n]+)/,
    /据\s*([^，。\n]+?)\s*报道/,
    /引用\s*([^，。\n]+)/,
    /数据来源[：:]\s*([^，。\n]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1].trim();
  }
  
  return null;
}

// ==================== 5. 约束验证阻止违规 ====================

export interface ConstraintValidationResult {
  passed: boolean;
  violations: {
    constraint: string;
    value: any;
    limit: any;
    severity: 'critical' | 'warning';
    blocked: boolean;
    suggestedFix: string;
  }[];
  enforcedContent: string;
  needsRegeneration: boolean;
}

// 在生成前验证约束
export function validateConstraintsBeforeGeneration(
  content: string,
  constraints: {
    maxInvestment: number;
    maxRoiMonths: number;
    requiredCompliance: string[];
    monthlyReserve: number;
  }
): ConstraintValidationResult {
  const violations: ConstraintValidationResult['violations'] = [];
  let enforcedContent = content;
  let needsRegeneration = false;
  
  // 1. 检查投资金额
  const investmentMatch = content.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
  if (investmentMatch) {
    const investment = parseFloat(investmentMatch[1]) * 10000;
    if (investment > constraints.maxInvestment) {
      const blocked = investment > constraints.maxInvestment * 1.5;
      violations.push({
        constraint: '资金上限',
        value: `${investmentMatch[1]}万`,
        limit: `${constraints.maxInvestment / 10000}万`,
        severity: 'critical',
        blocked,
        suggestedFix: `建议投资金额调整为${constraints.maxInvestment / 10000}万以内`,
      });
      
      if (blocked) {
        needsRegeneration = true;
      } else {
        // 自动修正
        enforcedContent = enforcedContent.replace(
          investmentMatch[0],
          `投资${constraints.maxInvestment / 10000}万（已自动调整至预算上限）`
        );
      }
    }
  }
  
  // 2. 检查ROI
  const roiMatch = content.match(/(\d+)\s*个?月.*回本/);
  if (roiMatch) {
    const roi = parseInt(roiMatch[1]);
    if (roi > constraints.maxRoiMonths) {
      const blocked = roi > constraints.maxRoiMonths * 1.5;
      violations.push({
        constraint: '回本周期',
        value: `${roi}个月`,
        limit: `${constraints.maxRoiMonths}个月`,
        severity: 'critical',
        blocked,
        suggestedFix: `建议说明如何缩短回本周期至${constraints.maxRoiMonths}个月以内`,
      });
      
      if (blocked) {
        needsRegeneration = true;
        enforcedContent = `【⚠️ 此方案回本周期${roi}个月，超过您的要求${constraints.maxRoiMonths}个月，不推荐】\n\n` + enforcedContent;
      }
    }
  }
  
  // 3. 检查合规
  for (const keyword of constraints.requiredCompliance) {
    if (content.includes(keyword)) {
      violations.push({
        constraint: '合规要求',
        value: keyword,
        limit: '100%合规',
        severity: 'critical',
        blocked: true,
        suggestedFix: '删除不合规内容，或明确标注为禁止事项',
      });
      needsRegeneration = true;
    }
  }
  
  // 4. 添加约束警告
  if (violations.length > 0 && !needsRegeneration) {
    enforcedContent += '\n\n---\n【约束验证警告】\n';
    for (const v of violations) {
      enforcedContent += `- ${v.constraint}: 当前${v.value}，限制${v.limit}\n`;
    }
  }
  
  return {
    passed: violations.filter(v => v.severity === 'critical').length === 0,
    violations,
    enforcedContent,
    needsRegeneration,
  };
}

// ==================== 6. 会话历史跨设备 ====================

export interface SessionStorage {
  sessionId: string;
  userId?: string;
  createdAt: Date;
  lastActiveAt: Date;
  conversations: {
    id: string;
    timestamp: Date;
    userInput: string;
    mode: string;
    result: string;
    feedback?: any;
  }[];
  userProfile: typeof USER_PROFILE;
  preferences: Record<string, any>;
}

// 服务器端存储（模拟）
const serverStorage: Map<string, SessionStorage> = new Map();

// 保存会话到服务器
export async function saveSessionToServer(session: SessionStorage): Promise<void> {
  serverStorage.set(session.sessionId, session);
  
  // 实际应用中，这里应该调用API保存到数据库
  // await fetch('/api/session', { method: 'POST', body: JSON.stringify(session) });
}

// 从服务器加载会话
export async function loadSessionFromServer(sessionId: string): Promise<SessionStorage | null> {
  const session = serverStorage.get(sessionId);
  
  // 实际应用中，这里应该调用API从数据库加载
  // const response = await fetch(`/api/session/${sessionId}`);
  // return response.json();
  
  return session || null;
}

// 同步本地和服务器会话
export async function syncSession(sessionId: string): Promise<SessionStorage | null> {
  // 从服务器加载
  const serverSession = await loadSessionFromServer(sessionId);
  
  // 从本地加载
  let localSession: SessionStorage | null = null;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(`session_${sessionId}`);
    if (saved) {
      try {
        localSession = JSON.parse(saved);
      } catch (e) {}
    }
  }
  
  // 合并（以较新的为准）
  if (serverSession && localSession) {
    if (new Date(serverSession.lastActiveAt) > new Date(localSession.lastActiveAt)) {
      return serverSession;
    } else {
      await saveSessionToServer(localSession);
      return localSession;
    }
  }
  
  return serverSession || localSession;
}

// ==================== 7-21. 其他完善功能 ====================

// 7. 来源分级精确化
export function classifySourcePrecise(url: string, content: string): {
  level: 'level1' | 'level2' | 'level3' | 'banned';
  score: number;
  reasoning: string;
} {
  const urlLower = url.toLowerCase();
  
  // 一级来源：政府、官方统计
  const level1Patterns = [
    /\.gov\.cn/i, /stats\.gov/i, /mofcom\.gov\.cn/i,
    /pbc\.gov\.cn/i, /ndrc\.gov\.cn/i, /cninfo\.com\.cn/i,
    /sse\.com\.cn/i, /szse\.cn/i, /csrc\.gov\.cn/i,
  ];
  
  for (const pattern of level1Patterns) {
    if (pattern.test(urlLower)) {
      return { level: 'level1', score: 95, reasoning: '政府或官方机构来源' };
    }
  }
  
  // 二级来源：权威媒体、研究机构
  const level2Patterns = [
    /reuters\.com/i, /bloomberg\.com/i, /ft\.com/i, /wsj\.com/i,
    /mckinsey\.com/i, /bcg\.com/i, /bain\.com/i,
    /caixin\.com/i, /yicai\.com/i, /jiemian\.com/i,
    /thepaper\.cn/i, /21jingji\.com/i,
  ];
  
  for (const pattern of level2Patterns) {
    if (pattern.test(urlLower)) {
      return { level: 'level2', score: 85, reasoning: '权威媒体或研究机构' };
    }
  }
  
  // 三级来源：行业媒体
  const level3Patterns = [
    /36kr\.com/i, /huxiu\.com/i, /虎嗅/i, /钛媒体/i,
    /sohu\.com/i, /sina\.com\.cn/i, /qq\.com/i,
    /ifeng\.com/i, /eastmoney\.com/i,
  ];
  
  for (const pattern of level3Patterns) {
    if (pattern.test(urlLower)) {
      return { level: 'level3', score: 70, reasoning: '行业媒体，需进一步核实' };
    }
  }
  
  // 禁用来源：自媒体
  const bannedPatterns = [
    /weixin\.qq\.com/i, /mp\.weixin/i, /公众号/i,
    /toutiao\.com/i, /baijiahao/i, /知乎/i, /zhihu\.com/i,
    /xiaohongshu\.com/i, /抖音/i, /douyin\.com/i,
  ];
  
  for (const pattern of bannedPatterns) {
    if (pattern.test(urlLower) || pattern.test(content)) {
      return { level: 'banned', score: 0, reasoning: '自媒体或用户生成内容，禁止使用' };
    }
  }
  
  // 默认三级
  return { level: 'level3', score: 60, reasoning: '未识别的来源，谨慎使用' };
}

// 8. 日期提取精确化
export function extractDatePrecise(text: string): Date | null {
  // 多种日期格式
  const patterns = [
    // ISO格式
    /(\d{4})-(\d{2})-(\d{2})/,
    // 中文格式
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    // 斜杠格式
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
    // 点格式
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/,
    // 英文格式
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        let year: number, month: number, day: number;
        
        if (pattern === patterns[4]) {
          // 英文格式
          const months: Record<string, number> = {
            jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
            jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
          };
          year = parseInt(match[3]);
          month = months[match[1].toLowerCase()];
          day = parseInt(match[2]);
        } else {
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        }
        
        // 验证日期有效性
        if (year >= 2000 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return new Date(year, month - 1, day);
        }
      } catch (e) {}
    }
  }
  
  return null;
}

// 9. 标红多格式支持
export function highlightKeyDataMultiFormat(content: string): {
  html: string;
  markdown: string;
  plain: string;
} {
  // HTML格式
  let html = content
    .replace(/(\d+\.?\d*\s*(万|亿|元|吨|公斤|平方米|㎡|%))/g, 
      '<span style="color: red; font-weight: bold;">$1</span>')
    .replace(/(风险|注意|警告|可能|不确定|缺口)/g, 
      '<span style="color: orange; font-weight: bold;">$1</span>')
    .replace(/(约|预计|估算|预估|大概|左右)/g, 
      '<span style="color: blue;">$1</span>');
  
  // Markdown格式
  let markdown = content
    .replace(/(\d+\.?\d*\s*(万|亿|元|吨|公斤|平方米|㎡|%))/g, 
      '**🔴$1**')
    .replace(/(风险|注意|警告|可能|不确定|缺口)/g, 
      '**⚠️$1**')
    .replace(/(约|预计|估算|预估|大概|左右)/g, 
      '*📊$1*');
  
  // 纯文本格式（用符号标注）
  let plain = content
    .replace(/(\d+\.?\d*\s*(万|亿|元|吨|公斤|平方米|㎡|%))/g, 
      '【$1】')
    .replace(/(风险|注意|警告|可能|不确定|缺口)/g, 
      '⚠️$1')
    .replace(/(约|预计|估算|预估|大概|左右)/g, 
      '📊$1');
  
  return { html, markdown, plain };
}

// 10. 竞品分析深入化
export async function analyzeCompetitorsDeep(
  productName: string,
  productDescription: string
): Promise<{
  competitors: {
    name: string;
    features: string[];
    pricing?: string;
    marketShare?: string;
    differentiation: string;
  }[];
  analysis: string;
  recommendation: string;
}> {
  const competitors: any[] = [];
  
  // 搜索竞品
  const searchResult = await searchWithVerification(`${productName} 竞品 对比 替代品`);
  
  for (const result of searchResult.combined.slice(0, 5)) {
    const title = result.title || '';
    const content = result.snippet || result.content || '';
    
    // 提取竞品名称
    const competitorMatch = title.match(/vs\s*([^vs]+)/i) || 
                            content.match(/竞品[：:]\s*([^，。\n]+)/);
    
    if (competitorMatch) {
      competitors.push({
        name: competitorMatch[1].trim(),
        features: extractFeatures(content),
        differentiation: '需要进一步分析',
      });
    }
  }
  
  // 生成分析
  let analysis = `发现${competitors.length}个主要竞品。\n`;
  analysis += `市场已有类似产品，需要明确差异化定位。\n`;
  
  // 生成建议
  let recommendation = '';
  if (competitors.length >= 3) {
    recommendation = '市场竞争激烈，建议：1) 找到细分市场 2) 突出差异化优势 3) 考虑价格策略';
  } else if (competitors.length >= 1) {
    recommendation = '存在少量竞品，有机会通过差异化获得市场份额';
  } else {
    recommendation = '市场空白，具有先发优势，但需验证市场需求';
  }
  
  return { competitors, analysis, recommendation };
}

// 提取功能特性
function extractFeatures(content: string): string[] {
  const features: string[] = [];
  const keywords = ['功能', '特点', '优势', '支持', '提供'];
  
  for (const keyword of keywords) {
    const regex = new RegExp(`${keyword}[：:：]?\\s*([^，。\\n]+)`, 'g');
    const matches = content.matchAll(regex);
    for (const match of matches) {
      if (match[1] && match[1].length > 2 && match[1].length < 50) {
        features.push(match[1].trim());
      }
    }
  }
  
  return [...new Set(features)].slice(0, 5);
}

// 12. 准确率追踪系统（已在学习系统中实现）

// 13. 案例匹配向量化
export function matchSimilarCasesVector(
  query: string,
  cases: { id: string; query: string; result: string; tags: string[] }[]
): { case: any; similarity: number }[] {
  // 简单的向量相似度（实际应用中应使用embedding）
  const queryWords = query.toLowerCase().split(/\s+/);
  
  const scored = cases.map(c => {
    const caseWords = c.query.toLowerCase().split(/\s+/);
    const tagWords = c.tags.flatMap(t => t.toLowerCase().split(/\s+/));
    const allWords = [...caseWords, ...tagWords];
    
    // 计算词重叠
    const overlap = queryWords.filter(w => allWords.includes(w)).length;
    const similarity = overlap / Math.max(queryWords.length, allWords.length);
    
    return { case: c, similarity };
  });
  
  return scored.sort((a, b) => b.similarity - a.similarity);
}

// 14. 对比维度扩展
export const COMPARISON_DIMENSIONS = {
  startupCost: { name: '启动成本', weight: 0.15, description: '初期投资金额' },
  riskLevel: { name: '风险等级', weight: 0.15, description: '经营风险程度' },
  profitPotential: { name: '利润潜力', weight: 0.15, description: '预期盈利能力' },
  resourceMatch: { name: '资源匹配', weight: 0.15, description: '与现有资源的匹配度' },
  timeToProfit: { name: '回本周期', weight: 0.10, description: '投资回收时间' },
  marketGrowth: { name: '市场增长', weight: 0.10, description: '市场增长潜力' },
  competitionLevel: { name: '竞争程度', weight: 0.10, description: '市场竞争激烈程度' },
  entryBarrier: { name: '进入门槛', weight: 0.05, description: '行业进入难度' },
  scalability: { name: '可扩展性', weight: 0.05, description: '业务扩展潜力' },
};

// 15. 敏感性分析深入
export function sensitivityAnalysisDeep(
  baseline: Record<string, number>,
  comparison: Record<string, number>,
  weights: Record<string, number>
): {
  weightSensitivity: { dimension: string; change: number; impact: number }[];
  dataSensitivity: { dimension: string; change: number; impact: number }[];
  robustness: number;
} {
  const weightSensitivity: { dimension: string; change: number; impact: number }[] = [];
  const dataSensitivity: { dimension: string; change: number; impact: number }[] = [];
  
  // 权重敏感性
  for (const [dim, weight] of Object.entries(weights)) {
    const change = 0.1; // 10%变化
    const newWeights = { ...weights };
    newWeights[dim] = Math.max(0, weight + change);
    
    // 重新归一化
    const total = Object.values(newWeights).reduce((a, b) => a + b, 0);
    for (const key in newWeights) {
      newWeights[key] /= total;
    }
    
    // 计算影响
    let newBaselineScore = 0;
    let newComparisonScore = 0;
    
    for (const [d, w] of Object.entries(newWeights)) {
      newBaselineScore += (baseline[d] || 0) * w;
      newComparisonScore += (comparison[d] || 0) * w;
    }
    
    const originalDiff = calculateWeightedScore(baseline, weights) - 
                         calculateWeightedScore(comparison, weights);
    const newDiff = newBaselineScore - newComparisonScore;
    
    weightSensitivity.push({
      dimension: dim,
      change: change * 100,
      impact: Math.abs(newDiff - originalDiff),
    });
  }
  
  // 数据敏感性
  for (const dim of Object.keys(baseline)) {
    const change = 0.2; // 20%变化
    const newBaseline = { ...baseline };
    newBaseline[dim] = Math.max(0, Math.min(100, (baseline[dim] || 0) * (1 + change)));
    
    const originalDiff = calculateWeightedScore(baseline, weights) - 
                         calculateWeightedScore(comparison, weights);
    const newDiff = calculateWeightedScore(newBaseline, weights) - 
                    calculateWeightedScore(comparison, weights);
    
    dataSensitivity.push({
      dimension: dim,
      change: change * 100,
      impact: Math.abs(newDiff - originalDiff),
    });
  }
  
  // 计算稳健性
  const avgWeightImpact = weightSensitivity.reduce((a, b) => a + b.impact, 0) / weightSensitivity.length;
  const avgDataImpact = dataSensitivity.reduce((a, b) => a + b.impact, 0) / dataSensitivity.length;
  
  const robustness = Math.max(0, 100 - (avgWeightImpact + avgDataImpact) * 10);
  
  return { weightSensitivity, dataSensitivity, robustness };
}

function calculateWeightedScore(scores: Record<string, number>, weights: Record<string, number>): number {
  let total = 0;
  for (const [dim, weight] of Object.entries(weights)) {
    total += (scores[dim] || 0) * weight;
  }
  return total;
}

// 16. 错误处理完善
export interface ErrorHandler {
  type: 'api_error' | 'timeout' | 'rate_limit' | 'validation_error' | 'unknown';
  message: string;
  recoverable: boolean;
  recoveryAction: string;
  partialResults?: any;
}

export function handleError(error: any, partialResults?: any): ErrorHandler {
  if (error.message?.includes('timeout')) {
    return {
      type: 'timeout',
      message: '请求超时',
      recoverable: true,
      recoveryAction: '已保存部分结果，可以继续分析',
      partialResults,
    };
  }
  
  if (error.message?.includes('rate limit') || error.status === 429) {
    return {
      type: 'rate_limit',
      message: 'API调用频率超限',
      recoverable: true,
      recoveryAction: '请等待1分钟后重试',
      partialResults,
    };
  }
  
  if (error.message?.includes('validation')) {
    return {
      type: 'validation_error',
      message: '输入验证失败',
      recoverable: true,
      recoveryAction: '请检查输入内容',
    };
  }
  
  if (error.message?.includes('API') || error.status >= 500) {
    return {
      type: 'api_error',
      message: 'API服务错误',
      recoverable: true,
      recoveryAction: '正在尝试备用服务...',
      partialResults,
    };
  }
  
  return {
    type: 'unknown',
    message: error.message || '未知错误',
    recoverable: false,
    recoveryAction: '请刷新页面重试',
    partialResults,
  };
}

// 17. API限流处理
export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;
  
  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }
  
  getTimeUntilNextRequest(): number {
    const now = Date.now();
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.windowMs - (now - oldestRequest));
  }
}

// 18. 超时处理完善
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => T
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      if (onTimeout) {
        resolve(onTimeout());
      } else {
        reject(new Error(`操作超时（${timeoutMs}ms）`));
      }
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

// 19. 搜索验证全面化
export const SEARCH_VERIFICATION_POINTS = [
  { role: 'market_analyst', triggers: ['市场规模', '增长率', '份额'] },
  { role: 'industry_analyst', triggers: ['竞争', '政策', '法规'] },
  { role: 'financial_analyst', triggers: ['投资', '成本', '利润'] },
  { role: 'risk_assessor', triggers: ['风险', '合规', '法律'] },
  { role: 'innovation_advisor', triggers: ['创新', '专利', '技术'] },
];

// 20. Copilot深度检查
export function copilotDeepCheck(
  results: Record<string, { content: string; success: boolean }>,
  constraints: any
): {
  passed: boolean;
  issues: { type: string; description: string; severity: string }[];
  recommendations: string[];
} {
  const issues: { type: string; description: string; severity: string }[] = [];
  const recommendations: string[] = [];
  
  // 1. 检查完整性
  const requiredRoles = ['market_analyst', 'financial_analyst', 'risk_assessor', 'decision_advisor'];
  for (const role of requiredRoles) {
    if (!results[role] || !results[role].success) {
      issues.push({
        type: 'incomplete',
        description: `缺少${role}的分析`,
        severity: 'warning',
      });
    }
  }
  
  // 2. 检查一致性
  const allContent = Object.values(results).map(r => r.content).join('\n');
  
  // 检查数字一致性
  const numbers = allContent.match(/\d+\.?\d*\s*(万|亿|元)/g) || [];
  const numberValues = numbers.map(n => parseFloat(n));
  
  // 检查是否有极端差异
  if (numberValues.length >= 2) {
    const max = Math.max(...numberValues);
    const min = Math.min(...numberValues);
    if (max > min * 100) {
      issues.push({
        type: 'inconsistency',
        description: '存在数量级差异的数据，请核实',
        severity: 'warning',
      });
    }
  }
  
  // 3. 检查约束遵守
  if (allContent.includes('投资')) {
    const investmentMatch = allContent.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
    if (investmentMatch) {
      const investment = parseFloat(investmentMatch[1]);
      if (investment > constraints.maxInvestment / 10000) {
        issues.push({
          type: 'constraint_violation',
          description: `投资金额${investment}万超过预算`,
          severity: 'critical',
        });
      }
    }
  }
  
  // 4. 生成建议
  if (issues.length > 0) {
    recommendations.push('建议核实以上问题后再做决策');
  }
  
  const passed = issues.filter(i => i.severity === 'critical').length === 0;
  
  return { passed, issues, recommendations };
}

// 21. 数据溯源时间戳精确
export async function extractPublishTimestamp(url: string): Promise<Date | null> {
  // 尝试从URL提取
  const urlDateMatch = url.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (urlDateMatch) {
    return new Date(parseInt(urlDateMatch[1]), parseInt(urlDateMatch[2]) - 1, parseInt(urlDateMatch[3]));
  }
  
  // 尝试从页面提取（需要实际请求页面）
  // 实际应用中应该请求页面并解析meta标签
  // <meta property="article:published_time" content="2024-01-15">
  
  return null;
}
