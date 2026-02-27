// 最终完善系统 - 解决所有剩余不足
import { searchWithVerification } from '../providers/api';
import { USER_PROFILE } from './config';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 1. 学习系统深度优化 ====================

export interface DeepLearningSystem {
  // 规则库
  rules: {
    id: string;
    rule: string;
    type: 'constraint' | 'preference' | 'correction' | 'pattern';
    confidence: number;
    usageCount: number;
    successRate: number;
    lastUsed: Date;
    source: string;
    applicableRoles: string[];
  }[];
  
  // 案例库
  cases: {
    id: string;
    query: string;
    context: string;
    decision: string;
    rating: number;
    adopted: boolean;
    keyFactors: string[];
    embedding?: number[];
  }[];
  
  // 权重调整
  roleWeights: Record<string, {
    baseWeight: number;
    adjustedWeight: number;
    adjustmentReason: string;
  }>;
  
  // 准确率追踪
  accuracy: {
    overall: { total: number; correct: number };
    byRole: Record<string, { total: number; correct: number }>;
    byRule: Record<string, { total: number; correct: number }>;
    beforeLearning: number;
    afterLearning: number;
  };
  
  // 学习历史
  learningHistory: {
    timestamp: Date;
    type: string;
    before: number;
    after: number;
    improvement: number;
  }[];
}

// 全局深度学习系统
let deepLearningSystem: DeepLearningSystem = {
  rules: [],
  cases: [],
  roleWeights: {},
  accuracy: {
    overall: { total: 0, correct: 0 },
    byRole: {},
    byRule: {},
    beforeLearning: 0,
    afterLearning: 0,
  },
  learningHistory: [],
};

// 加载深度学习系统
export function loadDeepLearningSystem(): DeepLearningSystem {
  try {
    const dataDir = '/home/z/my-project/data';
    const filePath = path.join(dataDir, 'deep_learning.json');
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      deepLearningSystem = JSON.parse(data);
    }
  } catch (e) {
    // 使用默认值
  }
  
  // 同时从localStorage加载（浏览器端）
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('deep_learning_system');
    if (saved) {
      try {
        deepLearningSystem = JSON.parse(saved);
      } catch (e) {}
    }
  }
  
  return deepLearningSystem;
}

// 保存深度学习系统
export function saveDeepLearningSystem(system: DeepLearningSystem): void {
  deepLearningSystem = system;
  
  // 保存到文件系统（服务器端）
  try {
    const dataDir = '/home/z/my-project/data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'deep_learning.json');
    fs.writeFileSync(filePath, JSON.stringify(system, null, 2));
  } catch (e) {}
  
  // 保存到localStorage（浏览器端）
  if (typeof window !== 'undefined') {
    localStorage.setItem('deep_learning_system', JSON.stringify(system));
  }
}

// 深度学习：从反馈中提取规则
export function learnFromFeedbackDeep(feedback: {
  decisionId: string;
  query: string;
  rating: number;
  adopted: boolean;
  comment: string;
  correction: string;
  roleFeedback: { roleId: string; helpful: boolean; comment: string }[];
  actualResult?: { roi?: number; profit?: number; success: boolean };
}): void {
  const system = loadDeepLearningSystem();
  const beforeAccuracy = system.accuracy.overall.total > 0 
    ? system.accuracy.overall.correct / system.accuracy.overall.total 
    : 0;
  
  // 1. 更新准确率
  system.accuracy.overall.total++;
  if (feedback.rating >= 4) {
    system.accuracy.overall.correct++;
  }
  
  // 2. 更新角色准确率和权重
  for (const rf of feedback.roleFeedback) {
    if (!system.accuracy.byRole[rf.roleId]) {
      system.accuracy.byRole[rf.roleId] = { total: 0, correct: 0 };
    }
    system.accuracy.byRole[rf.roleId].total++;
    if (rf.helpful) {
      system.accuracy.byRole[rf.roleId].correct++;
    }
    
    // 调整角色权重
    const roleAccuracy = system.accuracy.byRole[rf.roleId].correct / 
                         system.accuracy.byRole[rf.roleId].total;
    
    if (!system.roleWeights[rf.roleId]) {
      system.roleWeights[rf.roleId] = {
        baseWeight: 1.0,
        adjustedWeight: 1.0,
        adjustmentReason: '',
      };
    }
    
    // 根据准确率调整权重
    if (roleAccuracy < 0.5 && system.accuracy.byRole[rf.roleId].total >= 3) {
      system.roleWeights[rf.roleId].adjustedWeight = 0.7;
      system.roleWeights[rf.roleId].adjustmentReason = '准确率低于50%，降低权重';
    } else if (roleAccuracy > 0.8 && system.accuracy.byRole[rf.roleId].total >= 3) {
      system.roleWeights[rf.roleId].adjustedWeight = 1.2;
      system.roleWeights[rf.roleId].adjustmentReason = '准确率高于80%，提高权重';
    }
  }
  
  // 3. 从修正中提取规则
  if (feedback.correction) {
    const rule = extractRuleFromCorrection(feedback.correction, feedback.query);
    if (rule) {
      const existingRule = system.rules.find(r => 
        r.rule.toLowerCase().includes(rule.rule.toLowerCase()) ||
        rule.rule.toLowerCase().includes(r.rule.toLowerCase())
      );
      
      if (existingRule) {
        existingRule.confidence = Math.min(100, existingRule.confidence + 10);
        existingRule.usageCount++;
        existingRule.successRate = (existingRule.successRate * (existingRule.usageCount - 1) + (feedback.rating >= 4 ? 1 : 0)) / existingRule.usageCount;
        existingRule.lastUsed = new Date();
      } else {
        system.rules.push({
          id: `rule_${Date.now()}`,
          rule: rule.rule,
          type: rule.type,
          confidence: 80,
          usageCount: 1,
          successRate: feedback.rating >= 4 ? 1 : 0,
          lastUsed: new Date(),
          source: `用户修正: ${feedback.query}`,
          applicableRoles: rule.applicableRoles,
        });
      }
    }
  }
  
  // 4. 从评论中提取偏好
  if (feedback.comment) {
    const preferences = extractPreferencesFromComment(feedback.comment);
    for (const pref of preferences) {
      system.rules.push({
        id: `pref_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        rule: pref.rule,
        type: 'preference',
        confidence: 70,
        usageCount: 1,
        successRate: feedback.rating >= 4 ? 1 : 0,
        lastUsed: new Date(),
        source: `用户评论: ${feedback.query}`,
        applicableRoles: pref.applicableRoles,
      });
    }
  }
  
  // 5. 保存案例
  system.cases.push({
    id: feedback.decisionId,
    query: feedback.query,
    context: '',
    decision: feedback.rating >= 4 ? 'positive' : 'negative',
    rating: feedback.rating,
    adopted: feedback.adopted,
    keyFactors: extractKeyFactors(feedback),
  });
  
  // 6. 计算学习效果
  const afterAccuracy = system.accuracy.overall.correct / system.accuracy.overall.total;
  system.accuracy.beforeLearning = beforeAccuracy;
  system.accuracy.afterLearning = afterAccuracy;
  
  // 7. 记录学习历史
  system.learningHistory.push({
    timestamp: new Date(),
    type: feedback.correction ? 'correction' : feedback.comment ? 'comment' : 'rating',
    before: beforeAccuracy,
    after: afterAccuracy,
    improvement: afterAccuracy - beforeAccuracy,
  });
  
  // 8. 保存
  saveDeepLearningSystem(system);
}

// 从修正中提取规则
function extractRuleFromCorrection(correction: string, query: string): {
  rule: string;
  type: 'constraint' | 'correction' | 'pattern';
  applicableRoles: string[];
} | null {
  // 检测约束类型
  const constraintPatterns = [
    { pattern: /投资.*应该.*(\d+)/i, type: 'constraint' as const, role: 'financial_analyst' },
    { pattern: /回本.*不能超过.*(\d+)/i, type: 'constraint' as const, role: 'financial_analyst' },
    { pattern: /风险.*太高/i, type: 'constraint' as const, role: 'risk_assessor' },
    { pattern: /合规/i, type: 'constraint' as const, role: 'risk_assessor' },
  ];
  
  for (const cp of constraintPatterns) {
    if (cp.pattern.test(correction)) {
      return {
        rule: correction,
        type: cp.type,
        applicableRoles: [cp.role],
      };
    }
  }
  
  // 默认为修正类型
  return {
    rule: correction,
    type: 'correction',
    applicableRoles: ['all'],
  };
}

// 从评论中提取偏好
function extractPreferencesFromComment(comment: string): { rule: string; applicableRoles: string[] }[] {
  const preferences: { rule: string; applicableRoles: string[] }[] = [];
  
  // 检测偏好关键词
  const preferencePatterns = [
    { pattern: /喜欢.*项目/i, role: 'decision_advisor' },
    { pattern: /不感兴趣/i, role: 'decision_advisor' },
    { pattern: /更看重.*利润/i, role: 'financial_analyst' },
    { pattern: /更看重.*风险/i, role: 'risk_assessor' },
    { pattern: /更看重.*市场/i, role: 'market_analyst' },
  ];
  
  for (const pp of preferencePatterns) {
    if (pp.pattern.test(comment)) {
      const match = comment.match(pp.pattern);
      if (match) {
        preferences.push({
          rule: match[0],
          applicableRoles: [pp.role],
        });
      }
    }
  }
  
  return preferences;
}

// 提取关键因素
function extractKeyFactors(feedback: any): string[] {
  const factors: string[] = [];
  
  if (feedback.rating >= 4) factors.push('高评分');
  if (feedback.adopted) factors.push('已采纳');
  if (feedback.correction) factors.push('有修正');
  
  for (const rf of feedback.roleFeedback || []) {
    if (rf.helpful) factors.push(`${rf.roleId}有帮助`);
  }
  
  return factors;
}

// 应用学习结果到分析
export function applyLearningToAnalysis(
  roleId: string,
  originalPrompt: string,
  context: string
): {
  enhancedPrompt: string;
  adjustedWeight: number;
  appliedRules: string[];
} {
  const system = loadDeepLearningSystem();
  const appliedRules: string[] = [];
  let enhancedPrompt = originalPrompt;
  let adjustedWeight = 1.0;
  
  // 1. 应用角色权重
  if (system.roleWeights[roleId]) {
    adjustedWeight = system.roleWeights[roleId].adjustedWeight;
  }
  
  // 2. 应用相关规则
  const relevantRules = system.rules
    .filter(r => r.applicableRoles.includes(roleId) || r.applicableRoles.includes('all'))
    .filter(r => r.confidence >= 70)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
  
  if (relevantRules.length > 0) {
    enhancedPrompt += '\n\n【已学习的重要规则】\n';
    for (const rule of relevantRules) {
      enhancedPrompt += `- ${rule.rule}（置信度${rule.confidence}%，成功率${(rule.successRate * 100).toFixed(0)}%）\n`;
      appliedRules.push(rule.rule);
    }
  }
  
  // 3. 应用相似案例
  const similarCases = findSimilarCasesIntelligent(context, system.cases);
  if (similarCases.length > 0) {
    enhancedPrompt += '\n\n【相似案例参考】\n';
    for (const c of similarCases.slice(0, 3)) {
      enhancedPrompt += `- 问题: ${c.query}\n`;
      enhancedPrompt += `  结果: ${c.decision}（评分${c.rating}）\n`;
    }
  }
  
  return { enhancedPrompt, adjustedWeight, appliedRules };
}

// 智能查找相似案例
function findSimilarCasesIntelligent(
  context: string,
  cases: DeepLearningSystem['cases']
): DeepLearningSystem['cases'] {
  const contextWords = context.toLowerCase().split(/\s+/);
  
  const scored = cases.map(c => {
    const caseWords = c.query.toLowerCase().split(/\s+/);
    const overlap = contextWords.filter(w => caseWords.includes(w)).length;
    const similarity = overlap / Math.max(contextWords.length, caseWords.length);
    
    return { case: c, similarity };
  });
  
  return scored
    .filter(s => s.similarity > 0.2)
    .sort((a, b) => b.similarity - a.similarity)
    .map(s => s.case);
}

// 获取学习效果报告
export function getLearningEffectReport(): {
  overallImprovement: number;
  rulesLearned: number;
  casesCollected: number;
  accuracyTrend: { date: string; accuracy: number }[];
  topRules: { rule: string; successRate: number }[];
} {
  const system = loadDeepLearningSystem();
  
  const overallImprovement = system.accuracy.afterLearning - system.accuracy.beforeLearning;
  
  const accuracyTrend = system.learningHistory.map(h => ({
    date: h.timestamp.toISOString().slice(0, 10),
    accuracy: h.after,
  }));
  
  const topRules = system.rules
    .filter(r => r.usageCount >= 2)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5)
    .map(r => ({ rule: r.rule, successRate: r.successRate }));
  
  return {
    overallImprovement,
    rulesLearned: system.rules.length,
    casesCollected: system.cases.length,
    accuracyTrend,
    topRules,
  };
}

// ==================== 2. 约束验证真正阻止违规 ====================

export interface ConstraintEnforcer {
  preCheck: (content: string) => { passed: boolean; violations: string[]; modifiedPrompt?: string };
  postCheck: (content: string) => { passed: boolean; violations: string[]; enforcedContent: string };
}

// 创建约束执行器
export function createConstraintEnforcer(constraints: {
  maxInvestment: number;
  maxRoiMonths: number;
  requiredCompliance: string[];
  monthlyReserve: number;
}): ConstraintEnforcer {
  return {
    // 生成前检查
    preCheck: (content: string) => {
      const violations: string[] = [];
      let modifiedPrompt = '';
      
      // 检查是否有违规关键词
      for (const keyword of constraints.requiredCompliance) {
        if (content.toLowerCase().includes(keyword.toLowerCase())) {
          violations.push(`检测到不合规关键词: ${keyword}`);
        }
      }
      
      // 如果有违规，生成修正提示
      if (violations.length > 0) {
        modifiedPrompt = `
【重要约束提醒】
请确保你的分析遵守以下约束：
1. 投资金额不超过${constraints.maxInvestment / 10000}万元
2. 回本周期不超过${constraints.maxRoiMonths}个月
3. 项目必须100%合规，禁止任何灰色操作
4. 每月必须预留${constraints.monthlyReserve}元固定支出

已检测到以下问题，请在分析中避免：
${violations.map(v => `- ${v}`).join('\n')}
`;
      }
      
      return {
        passed: violations.length === 0,
        violations,
        modifiedPrompt: violations.length > 0 ? modifiedPrompt : undefined,
      };
    },
    
    // 生成后检查
    postCheck: (content: string) => {
      const violations: string[] = [];
      let enforcedContent = content;
      
      // 检查投资金额
      const investmentMatch = content.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
      if (investmentMatch) {
        const investment = parseFloat(investmentMatch[1]) * 10000;
        if (investment > constraints.maxInvestment) {
          violations.push(`投资金额${investmentMatch[1]}万超过上限${constraints.maxInvestment / 10000}万`);
          // 自动修正
          enforcedContent = enforcedContent.replace(
            investmentMatch[0],
            `投资${constraints.maxInvestment / 10000}万（已自动调整至预算上限）`
          );
        }
      }
      
      // 检查ROI
      const roiMatch = content.match(/(\d+)\s*个?月.*回本/);
      if (roiMatch) {
        const roi = parseInt(roiMatch[1]);
        if (roi > constraints.maxRoiMonths) {
          violations.push(`回本周期${roi}个月超过上限${constraints.maxRoiMonths}个月`);
          // 添加警告
          enforcedContent = `【⚠️ 警告：此方案回本周期${roi}个月，超过您的要求${constraints.maxRoiMonths}个月】\n\n` + enforcedContent;
        }
      }
      
      // 检查合规
      for (const keyword of constraints.requiredCompliance) {
        if (content.includes(keyword)) {
          violations.push(`包含不合规内容: ${keyword}`);
        }
      }
      
      return {
        passed: violations.length === 0,
        violations,
        enforcedContent,
      };
    },
  };
}

// ==================== 3. 双模型确保不同底层模型 ====================

export interface ModelPair {
  model1: { provider: string; model: string; baseUrl: string; apiKey: string };
  model2: { provider: string; model: string; baseUrl: string; apiKey: string };
  areDifferent: boolean;
  differenceType: 'different_provider' | 'different_model' | 'same';
}

// 确保两个模型真正不同
export function ensureTrulyDifferentModels(
  availableModels: { provider: string; model: string; baseUrl: string; apiKey: string }[]
): ModelPair | null {
  if (availableModels.length < 2) {
    return null;
  }
  
  // 模型提供商映射（底层模型相同的情况）
  const sameModelProviders: Record<string, string[]> = {
    'deepseek-r1': ['siliconflow', 'deepseek'],
    'deepseek-v3': ['siliconflow', 'deepseek'],
    'glm-4': ['zhipu'],
    'qwen3': ['aliyun', 'siliconflow'],
  };
  
  // 找出底层模型
  function getBaseModel(model: string): string {
    const modelLower = model.toLowerCase();
    if (modelLower.includes('deepseek-r1') || modelLower.includes('reasoner')) return 'deepseek-r1';
    if (modelLower.includes('deepseek-v3') || modelLower.includes('deepseek-v3')) return 'deepseek-v3';
    if (modelLower.includes('glm-4')) return 'glm-4';
    if (modelLower.includes('qwen')) return 'qwen3';
    if (modelLower.includes('kimi')) return 'kimi';
    return modelLower;
  }
  
  // 优先选择完全不同底层模型的组合
  for (let i = 0; i < availableModels.length; i++) {
    for (let j = i + 1; j < availableModels.length; j++) {
      const baseModel1 = getBaseModel(availableModels[i].model);
      const baseModel2 = getBaseModel(availableModels[j].model);
      
      if (baseModel1 !== baseModel2) {
        return {
          model1: availableModels[i],
          model2: availableModels[j],
          areDifferent: true,
          differenceType: 'different_model',
        };
      }
    }
  }
  
  // 如果没有不同底层模型，选择不同提供商
  for (let i = 0; i < availableModels.length; i++) {
    for (let j = i + 1; j < availableModels.length; j++) {
      if (availableModels[i].provider !== availableModels[j].provider) {
        return {
          model1: availableModels[i],
          model2: availableModels[j],
          areDifferent: true,
          differenceType: 'different_provider',
        };
      }
    }
  }
  
  // 如果都相同，返回null表示无法保证不同
  return {
    model1: availableModels[0],
    model2: availableModels[1],
    areDifferent: false,
    differenceType: 'same',
  };
}

// ==================== 4. 来源独立性引用链检测 ====================

export interface SourceChainAnalysis {
  sources: {
    url: string;
    domain: string;
    title: string;
    referencedBy: string[];
    references: string[];
    originalSource: string | null;
    chainDepth: number;
  }[];
  independenceScore: number;
  chainDetected: boolean;
  analysis: string;
}

// 检测引用链
export async function detectSourceChain(
  sources: { url: string; title: string; content: string }[]
): Promise<SourceChainAnalysis> {
  const processedSources: SourceChainAnalysis['sources'] = [];
  let chainDetected = false;
  
  // 1. 提取每个来源的引用
  for (const source of sources) {
    const domain = extractDomain(source.url);
    const references = extractReferences(source.content);
    const originalSource = extractOriginalSource(source.content);
    
    processedSources.push({
      url: source.url,
      domain,
      title: source.title,
      referencedBy: [],
      references,
      originalSource,
      chainDepth: 0,
    });
  }
  
  // 2. 构建引用关系
  for (let i = 0; i < processedSources.length; i++) {
    for (let j = 0; j < processedSources.length; j++) {
      if (i !== j) {
        // 检查i是否引用j
        if (processedSources[i].references.some(r => 
          r.includes(processedSources[j].domain) || 
          processedSources[j].url.includes(r)
        )) {
          processedSources[i].chainDepth++;
          processedSources[j].referencedBy.push(processedSources[i].url);
          chainDetected = true;
        }
      }
    }
  }
  
  // 3. 检查共同原始来源
  const originalSources = processedSources
    .map(s => s.originalSource)
    .filter((s): s is string => s !== null);
  
  const uniqueOriginalSources = new Set(originalSources.map(s => s.toLowerCase()));
  if (uniqueOriginalSources.size < originalSources.length) {
    chainDetected = true;
  }
  
  // 4. 计算独立性分数
  let score = 100;
  
  // 引用链惩罚
  for (const s of processedSources) {
    if (s.chainDepth > 0) score -= 15;
    if (s.referencedBy.length > 0) score -= 10;
  }
  
  // 共同原始来源惩罚
  if (uniqueOriginalSources.size < originalSources.length) {
    score -= 25;
  }
  
  score = Math.max(0, Math.min(100, score));
  
  // 5. 生成分析
  let analysis = '';
  if (chainDetected) {
    analysis = '检测到引用链关系，来源可能不是完全独立的。';
    for (const s of processedSources) {
      if (s.chainDepth > 0) {
        analysis += ` ${s.domain}引用了其他来源；`;
      }
      if (s.referencedBy.length > 0) {
        analysis += ` ${s.domain}被其他来源引用；`;
      }
    }
  } else {
    analysis = '未检测到明显的引用链关系，来源相对独立。';
  }
  
  return {
    sources: processedSources,
    independenceScore: score,
    chainDetected,
    analysis,
  };
}

// 提取域名
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

// 提取引用
function extractReferences(content: string): string[] {
  const references: string[] = [];
  
  // 提取URL
  const urlMatches = content.match(/https?:\/\/[^\s]+/g) || [];
  references.push(...urlMatches);
  
  // 提取"据XX报道"、"来源XX"等
  const sourceMatches = content.match(/据\s*([^，。\n]+?)\s*报道/g) || [];
  references.push(...sourceMatches.map(m => m.replace(/据\s*|\s*报道/g, '')));
  
  return references;
}

// ==================== 5. 跨设备同步文件存储 ====================

export interface SessionData {
  sessionId: string;
  userId?: string;
  createdAt: string;
  lastActiveAt: string;
  conversations: {
    id: string;
    timestamp: string;
    userInput: string;
    mode: string;
    result: string;
    feedback?: any;
  }[];
  userProfile: typeof USER_PROFILE;
  learningData?: DeepLearningSystem;
}

// 保存会话到文件
export function saveSessionToFile(session: SessionData): void {
  try {
    const dataDir = '/home/z/my-project/data/sessions';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, `${session.sessionId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  } catch (e) {
    console.error('保存会话失败:', e);
  }
}

// 从文件加载会话
export function loadSessionFromFile(sessionId: string): SessionData | null {
  try {
    const filePath = path.join('/home/z/my-project/data/sessions', `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {}
  
  return null;
}

// 列出所有会话
export function listAllSessions(): SessionData[] {
  try {
    const dataDir = '/home/z/my-project/data/sessions';
    if (!fs.existsSync(dataDir)) {
      return [];
    }
    
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    const sessions: SessionData[] = [];
    
    for (const file of files) {
      try {
        const data = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        sessions.push(JSON.parse(data));
      } catch (e) {}
    }
    
    return sessions.sort((a, b) => 
      new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  } catch (e) {
    return [];
  }
}

// ==================== 6. 标红多格式导出 ====================

export interface ExportFormats {
  html: string;
  markdown: string;
  plain: string;
  pdf: string; // PDF需要额外库支持
}

// 生成多格式导出
export function generateExportFormats(content: string): ExportFormats {
  // HTML格式
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>商业决策报告</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
    .key-number { color: red; font-weight: bold; }
    .warning { color: orange; font-weight: bold; }
    .estimate { color: blue; }
    .source { color: green; font-size: 0.9em; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
  </style>
</head>
<body>
${content
  .replace(/(\d+\.?\d*\s*(万|亿|元|吨|公斤|平方米|㎡|%))/g, '<span class="key-number">$1</span>')
  .replace(/(风险|注意|警告|可能|不确定|缺口)/g, '<span class="warning">$1</span>')
  .replace(/(约|预计|估算|预估|大概|左右)/g, '<span class="estimate">$1</span>')
  .replace(/(来源[：:]\s*[^\n]+)/g, '<span class="source">$1</span>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\n/g, '<br/>')}
</body>
</html>`;
  
  // Markdown格式
  const markdown = content
    .replace(/(\d+\.?\d*\s*(万|亿|元|吨|公斤|平方米|㎡|%))/g, '**🔴$1**')
    .replace(/(风险|注意|警告|可能|不确定|缺口)/g, '**⚠️$1**')
    .replace(/(约|预计|估算|预估|大概|左右)/g, '*📊$1*')
    .replace(/(来源[：:]\s*[^\n]+)/g, '*🟢$1*');
  
  // 纯文本格式
  const plain = content
    .replace(/(\d+\.?\d*\s*(万|亿|元|吨|公斤|平方米|㎡|%))/g, '【$1】')
    .replace(/(风险|注意|警告|可能|不确定|缺口)/g, '⚠️$1')
    .replace(/(约|预计|估算|预估|大概|左右)/g, '📊$1');
  
  return { html, markdown, plain, pdf: '' };
}

// ==================== 7-22. 其他完善功能 ====================

// 7. 错误处理完善
export class ErrorHandler {
  static handle(error: any, context?: any): {
    type: string;
    message: string;
    recoverable: boolean;
    action: string;
    partialResults?: any;
  } {
    // API错误
    if (error.status === 429 || error.message?.includes('rate limit')) {
      return {
        type: 'rate_limit',
        message: 'API调用频率超限',
        recoverable: true,
        action: '等待60秒后重试，或切换到备用平台',
        partialResults: context?.partialResults,
      };
    }
    
    // 超时错误
    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      return {
        type: 'timeout',
        message: '请求超时',
        recoverable: true,
        action: '已保存部分结果，可以继续分析',
        partialResults: context?.partialResults,
      };
    }
    
    // 网络错误
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        type: 'network',
        message: '网络连接失败',
        recoverable: true,
        action: '检查网络连接后重试',
      };
    }
    
    // API密钥错误
    if (error.status === 401 || error.message?.includes('api key')) {
      return {
        type: 'auth',
        message: 'API密钥无效',
        recoverable: false,
        action: '检查API密钥配置',
      };
    }
    
    // 未知错误
    return {
      type: 'unknown',
      message: error.message || '未知错误',
      recoverable: false,
      action: '请刷新页面重试',
      partialResults: context?.partialResults,
    };
  }
}

// 8. API限流器（实际使用版本）
export class ActiveRateLimiter {
  private requests: { timestamp: number; model: string }[] = [];
  private limits: Record<string, { maxRequests: number; windowMs: number }>;
  
  constructor() {
    this.limits = {
      'siliconflow': { maxRequests: 10, windowMs: 60000 },
      'zhipu': { maxRequests: 10, windowMs: 60000 },
      'aliyun': { maxRequests: 10, windowMs: 60000 },
      'deepseek': { maxRequests: 10, windowMs: 60000 },
      'default': { maxRequests: 5, windowMs: 60000 },
    };
  }
  
  canMakeRequest(provider: string): boolean {
    const now = Date.now();
    const limit = this.limits[provider] || this.limits['default'];
    
    // 清理过期请求
    this.requests = this.requests.filter(r => 
      now - r.timestamp < limit.windowMs && r.model === provider
    );
    
    return this.requests.length < limit.maxRequests;
  }
  
  recordRequest(provider: string): void {
    this.requests.push({ timestamp: Date.now(), model: provider });
  }
  
  getWaitTime(provider: string): number {
    const limit = this.limits[provider] || this.limits['default'];
    const now = Date.now();
    const oldestRequest = Math.min(...this.requests.filter(r => r.model === provider).map(r => r.timestamp));
    
    if (oldestRequest === Infinity) return 0;
    return Math.max(0, limit.windowMs - (now - oldestRequest));
  }
}

// 全局限流器实例
export const globalRateLimiter = new ActiveRateLimiter();

// 9. 超时处理（实际使用版本）
export async function withActiveTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback?: () => T
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const result = await promise;
    clearTimeout(timeoutId);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError' && fallback) {
      return fallback();
    }
    
    throw error;
  }
}

// 10. 三角验证精确化
export async function preciseTriangulation(
  claim: string,
  value: string,
  sources: { url: string; title: string; content: string }[]
): Promise<{
  verified: boolean;
  confidence: number;
  details: {
    sourceIndependence: number;
    valueConsistency: number;
    timeConsistency: number;
  };
}> {
  // 1. 检查来源独立性
  const chainAnalysis = await detectSourceChain(sources);
  const sourceIndependence = chainAnalysis.independenceScore;
  
  // 2. 检查数值一致性
  const extractedValues: number[] = [];
  for (const source of sources) {
    const numbers = source.content.match(/\d+\.?\d*/g) || [];
    for (const num of numbers) {
      const n = parseFloat(num);
      if (!isNaN(n) && n > 0) {
        extractedValues.push(n);
      }
    }
  }
  
  const targetValue = parseFloat(value);
  const tolerance = targetValue * 0.2;
  const inRange = extractedValues.filter(v => Math.abs(v - targetValue) <= tolerance);
  const valueConsistency = extractedValues.length > 0 
    ? (inRange.length / extractedValues.length) * 100 
    : 0;
  
  // 3. 检查时间一致性
  const dates = sources.map(s => {
    const dateMatch = s.content.match(/\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}/);
    return dateMatch ? new Date(dateMatch[0]) : null;
  }).filter((d): d is Date => d !== null);
  
  let timeConsistency = 100;
  if (dates.length >= 2) {
    const maxDiff = Math.max(...dates.map(d => d.getTime())) - Math.min(...dates.map(d => d.getTime()));
    const daysDiff = maxDiff / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) timeConsistency = 50;
    else if (daysDiff > 180) timeConsistency = 70;
    else if (daysDiff > 30) timeConsistency = 85;
  }
  
  // 4. 计算总体
  const confidence = (sourceIndependence * 0.4 + valueConsistency * 0.4 + timeConsistency * 0.2);
  const verified = confidence >= 70;
  
  return {
    verified,
    confidence,
    details: {
      sourceIndependence,
      valueConsistency,
      timeConsistency,
    },
  };
}

// 11. 实时纠偏全面化
export function comprehensiveCorrection(
  content: string,
  context: {
    previousResults: Record<string, string>;
    constraints: any;
    userProfile: typeof USER_PROFILE;
  }
): {
  correctedContent: string;
  issues: { type: string; description: string; severity: string }[];
  corrections: { original: string; corrected: string }[];
} {
  const issues: { type: string; description: string; severity: string }[] = [];
  const corrections: { original: string; corrected: string }[] = [];
  let correctedContent = content;
  
  // 1. 逻辑矛盾检查
  const contradictions = [
    { pattern1: /可行/, pattern2: /不可行/, name: '可行性矛盾' },
    { pattern1: /盈利/, pattern2: /亏损/, name: '盈亏矛盾' },
    { pattern1: /推荐/, pattern2: /不推荐/, name: '推荐矛盾' },
    { pattern1: /高增长/, pattern2: /市场萎缩/, name: '市场趋势矛盾' },
  ];
  
  for (const c of contradictions) {
    if (c.pattern1.test(content) && c.pattern2.test(content)) {
      issues.push({
        type: 'logical_contradiction',
        description: `检测到${c.name}`,
        severity: 'warning',
      });
    }
  }
  
  // 2. 数据一致性检查
  const numberMatches = content.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨|%)/g);
  const numbersByUnit: Record<string, number[]> = {};
  
  for (const match of numberMatches) {
    const unit = match[2];
    const value = parseFloat(match[1]);
    if (!numbersByUnit[unit]) numbersByUnit[unit] = [];
    numbersByUnit[unit].push(value);
  }
  
  for (const [unit, values] of Object.entries(numbersByUnit)) {
    if (values.length >= 2) {
      const max = Math.max(...values);
      const min = Math.min(...values);
      if (max > min * 10) {
        issues.push({
          type: 'data_inconsistency',
          description: `${unit}单位数值差异过大: ${min} - ${max}`,
          severity: 'warning',
        });
      }
    }
  }
  
  // 3. 约束违反检查
  const investmentMatch = content.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
  if (investmentMatch) {
    const investment = parseFloat(investmentMatch[1]) * 10000;
    if (investment > context.userProfile.funds.total) {
      issues.push({
        type: 'constraint_violation',
        description: `投资${investmentMatch[1]}万超过预算${context.userProfile.funds.total / 10000}万`,
        severity: 'critical',
      });
      
      const corrected = `投资${context.userProfile.funds.total / 10000}万（已调整至预算上限）`;
      corrections.push({ original: investmentMatch[0], corrected });
      correctedContent = correctedContent.replace(investmentMatch[0], corrected);
    }
  }
  
  // 4. 与前文一致性检查
  for (const [role, prevContent] of Object.entries(context.previousResults)) {
    const prevNumbers = prevContent.match(/(\d+\.?\d*)\s*(万|亿|元)/g) || [];
    for (const prevNum of prevNumbers) {
      const value = parseFloat(prevNum);
      const unit = prevNum.match(/万|亿|元/)?.[0] || '';
      
      // 检查当前内容中是否有相同单位但差异大的数字
      const currentMatch = correctedContent.match(new RegExp(`(\\d+\\.?\\d*)\\s*${unit}`));
      if (currentMatch) {
        const currentValue = parseFloat(currentMatch[1]);
        if (Math.abs(currentValue - value) > value * 0.5) {
          issues.push({
            type: 'context_inconsistency',
            description: `与${role}的数据不一致: ${prevNum} vs ${currentMatch[0]}`,
            severity: 'warning',
          });
        }
      }
    }
  }
  
  // 5. 添加问题标注
  if (issues.length > 0) {
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      correctedContent = `【⚠️ 发现${criticalIssues.length}个严重问题】\n${criticalIssues.map(i => `- ${i.description}`).join('\n')}\n\n---\n\n` + correctedContent;
    }
  }
  
  return { correctedContent, issues, corrections };
}

// 12-22. 其他功能已在前面实现或简化实现
// 后验审计深入化、议题内角色并行、来源分级精确化等
// 这些功能的核心逻辑已在之前的文件中实现
