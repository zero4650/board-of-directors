// 第4层能力：学习系统 - 记忆存储、案例积累、档案更新
import { USER_PROFILE } from './config';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 数据存储 ====================

const DATA_DIR = '/home/z/my-project/data';
const MEMORY_FILE = path.join(DATA_DIR, 'memory', 'user_memory.json');
const CASES_FILE = path.join(DATA_DIR, 'cases', 'success_cases.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'memory', 'feedback_history.json');

// 确保目录存在
function ensureDataDir() {
  const dirs = [
    path.join(DATA_DIR, 'memory'),
    path.join(DATA_DIR, 'cases'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ==================== 用户记忆 ====================

export interface UserMemory {
  // 基础档案（可更新）
  profile: {
    funds: {
      cash: number;
      loan: number;
      total: number;
      lastUpdated: string;
    };
    assets: {
      factories: { area: number; rent: number; location: string }[];
      vehicles: string[];
    };
    team: {
      partners: number;
      members: number;
      locations: string[];
    };
    experience: string[];
    connections: {
      name: string;
      relationship: string;
      business: string;
      location: string;
    }[];
  };
  
  // 偏好记忆
  preferences: {
    preferredProjectTypes: string[];
    avoidedProjectTypes: string[];
    riskTolerance: 'low' | 'medium' | 'high';
    preferredLocations: string[];
  };
  
  // 历史决策
  decisionHistory: {
    id: string;
    date: string;
    query: string;
    mode: string;
    result: string;
    adopted: boolean | null;
    feedback: string | null;
  }[];
  
  // 学习到的规则
  learnedRules: {
    rule: string;
    source: string;
    confidence: number;
    createdAt: string;
  }[];
  
  lastUpdated: string;
}

// 初始化用户记忆
function initUserMemory(): UserMemory {
  return {
    profile: {
      funds: {
        cash: USER_PROFILE.funds.cash,
        loan: USER_PROFILE.funds.loan,
        total: USER_PROFILE.funds.total,
        lastUpdated: new Date().toISOString(),
      },
      assets: {
        factories: [
          { area: 350, rent: 30000, location: '安徽滁州柳巷镇' },
          { area: 450, rent: 48000, location: '安徽滁州柳巷镇' },
        ],
        vehicles: ['2014年比亚迪秦油电混动'],
      },
      team: {
        partners: USER_PROFILE.team.partners,
        members: USER_PROFILE.team.members,
        locations: ['河南濮阳市濮阳县'],
      },
      experience: USER_PROFILE.experience,
      connections: [
        {
          name: '三叔',
          relationship: '亲戚',
          business: '木门和铝合金门加工生产批发',
          location: '滁州琅琊区',
        },
      ],
    },
    preferences: {
      preferredProjectTypes: [],
      avoidedProjectTypes: [],
      riskTolerance: 'medium',
      preferredLocations: ['安徽滁州', '河南濮阳'],
    },
    decisionHistory: [],
    learnedRules: [],
    lastUpdated: new Date().toISOString(),
  };
}

// 读取用户记忆
export function loadUserMemory(): UserMemory {
  ensureDataDir();
  
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return initUserMemory();
    }
  }
  
  return initUserMemory();
}

// 保存用户记忆
export function saveUserMemory(memory: UserMemory): void {
  ensureDataDir();
  memory.lastUpdated = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// ==================== 成功案例库 ====================

export interface SuccessCase {
  id: string;
  date: string;
  query: string;
  projectType: string;
  mode: 'forward' | 'reverse' | 'mixed';
  
  // 分析结果
  analysis: {
    marketAnalysis: string;
    financialAnalysis: string;
    riskAnalysis: string;
    decision: string;
  };
  
  // 执行结果
  execution: {
    adopted: boolean;
    actualROI?: number;
    actualProfit?: number;
    challenges: string[];
    lessons: string[];
  };
  
  // 可复用要素
  reusableElements: {
    marketInsights: string[];
    financialModels: string[];
    riskFactors: string[];
    executionSteps: string[];
  };
  
  // 相似度匹配标签
  tags: string[];
}

// 读取案例库
export function loadSuccessCases(): SuccessCase[] {
  ensureDataDir();
  
  if (fs.existsSync(CASES_FILE)) {
    try {
      const data = fs.readFileSync(CASES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  
  return [];
}

// 保存案例
export function saveSuccessCase(caseData: SuccessCase): void {
  ensureDataDir();
  const cases = loadSuccessCases();
  cases.push(caseData);
  fs.writeFileSync(CASES_FILE, JSON.stringify(cases, null, 2));
}

// 查找相似案例
export function findSimilarCases(query: string, limit: number = 3): SuccessCase[] {
  const cases = loadSuccessCases();
  
  // 简单的关键词匹配
  const queryKeywords = extractKeywords(query);
  
  const scored = cases.map(c => {
    const caseKeywords = c.tags;
    const matchCount = queryKeywords.filter(k => caseKeywords.includes(k)).length;
    return { case: c, score: matchCount };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, limit).map(s => s.case);
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const types = ['塑料', '光伏', '奶茶', '餐饮', '电商', '物流', '加工', '回收', '木门', '铝合金'];
  const locations = ['安徽', '河南', '滁州', '濮阳'];
  
  for (const type of types) {
    if (text.includes(type)) keywords.push(type);
  }
  for (const loc of locations) {
    if (text.includes(loc)) keywords.push(loc);
  }
  
  return keywords;
}

// ==================== 反馈系统 ====================

export interface Feedback {
  id: string;
  date: string;
  decisionId: string;
  query: string;
  
  // 用户反馈
  rating: 1 | 2 | 3 | 4 | 5; // 1-5星
  adopted: boolean; // 是否采纳建议
  userComment?: string; // 用户评论
  userCorrection?: string; // 用户修正的内容
  
  // 具体反馈
  roleFeedback: {
    roleId: string;
    roleName: string;
    helpful: boolean;
    comment?: string;
  }[];
  
  // 实际结果（后续补充）
  actualResult?: {
    roi?: number;
    profit?: number;
    challenges: string[];
    success: boolean;
  };
}

// 读取反馈历史
export function loadFeedbackHistory(): Feedback[] {
  ensureDataDir();
  
  if (fs.existsSync(FEEDBACK_FILE)) {
    try {
      const data = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  
  return [];
}

// 保存反馈
export function saveFeedback(feedback: Feedback): void {
  ensureDataDir();
  const history = loadFeedbackHistory();
  history.push(feedback);
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(history, null, 2));
}

// ==================== 学习更新 ====================

// 根据反馈更新用户档案
export function updateProfileFromFeedback(feedback: Feedback): UserMemory {
  const memory = loadUserMemory();
  
  // 记录决策历史
  memory.decisionHistory.push({
    id: feedback.decisionId,
    date: feedback.date,
    query: feedback.query,
    mode: 'unknown',
    result: feedback.adopted ? 'adopted' : 'rejected',
    adopted: feedback.adopted,
    feedback: feedback.userComment || null,
  });
  
  // 学习偏好
  if (feedback.adopted && feedback.rating >= 4) {
    // 提取项目类型并加入偏好
    const projectType = extractProjectType(feedback.query);
    if (projectType && !memory.preferences.preferredProjectTypes.includes(projectType)) {
      memory.preferences.preferredProjectTypes.push(projectType);
    }
  }
  
  if (!feedback.adopted || feedback.rating <= 2) {
    const projectType = extractProjectType(feedback.query);
    if (projectType && !memory.preferences.avoidedProjectTypes.includes(projectType)) {
      memory.preferences.avoidedProjectTypes.push(projectType);
    }
  }
  
  // 学习规则
  if (feedback.userCorrection) {
    memory.learnedRules.push({
      rule: feedback.userCorrection,
      source: `用户修正: ${feedback.query}`,
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    });
  }
  
  // 更新实际结果
  if (feedback.actualResult) {
    // 如果有实际ROI数据，可以用于校准未来的预测
    memory.learnedRules.push({
      rule: `项目${feedback.query}实际ROI: ${feedback.actualResult.roi}个月`,
      source: '实际执行结果',
      confidence: 1.0,
      createdAt: new Date().toISOString(),
    });
  }
  
  saveUserMemory(memory);
  return memory;
}

// 提取项目类型
function extractProjectType(query: string): string | null {
  const types: Record<string, string[]> = {
    '塑料回收': ['塑料', '回收', '分拣', '粉碎'],
    '光伏': ['光伏', '太阳能', '发电'],
    '餐饮': ['餐饮', '餐厅', '饭店', '奶茶'],
    '加工': ['加工', '制造', '生产'],
    '电商': ['电商', '网店', '淘宝'],
  };
  
  for (const [type, keywords] of Object.entries(types)) {
    for (const keyword of keywords) {
      if (query.includes(keyword)) return type;
    }
  }
  
  return null;
}

// ==================== Prompt优化 ====================

// 根据学习结果优化Prompt
export function optimizePrompt(
  roleId: string,
  originalPrompt: string,
  memory: UserMemory
): string {
  let optimizedPrompt = originalPrompt;
  
  // 添加用户偏好
  if (memory.preferences.preferredProjectTypes.length > 0) {
    optimizedPrompt += `\n\n用户偏好项目类型：${memory.preferences.preferredProjectTypes.join('、')}`;
  }
  
  // 添加用户避讳
  if (memory.preferences.avoidedProjectTypes.length > 0) {
    optimizedPrompt += `\n用户不感兴趣的项目类型：${memory.preferences.avoidedProjectTypes.join('、')}`;
  }
  
  // 添加学习到的规则
  const relevantRules = memory.learnedRules
    .filter(r => r.confidence >= 0.8)
    .slice(0, 5);
  
  if (relevantRules.length > 0) {
    optimizedPrompt += '\n\n已知经验：';
    for (const rule of relevantRules) {
      optimizedPrompt += `\n- ${rule.rule}`;
    }
  }
  
  // 根据角色添加特定优化
  if (roleId === 'financial_analyst') {
    optimizedPrompt += `\n\n用户资金约束：总预算${memory.profile.funds.total}元，需预留月固定支出5000元`;
  }
  
  if (roleId === 'risk_assessor') {
    optimizedPrompt += `\n\n用户风险承受能力：${memory.preferences.riskTolerance}`;
  }
  
  return optimizedPrompt;
}

// ==================== 综合学习接口 ====================

export interface LearningResult {
  memoryUpdated: boolean;
  caseSaved: boolean;
  feedbackRecorded: boolean;
  newRulesLearned: number;
  profileChanges: string[];
}

// 综合学习：从一次完整决策中学习
export function learnFromDecision(
  query: string,
  mode: 'forward' | 'reverse' | 'mixed',
  analysisResults: Record<string, string>,
  userFeedback?: Partial<Feedback>
): LearningResult {
  const result: LearningResult = {
    memoryUpdated: false,
    caseSaved: false,
    feedbackRecorded: false,
    newRulesLearned: 0,
    profileChanges: [],
  };
  
  // 1. 更新记忆
  const memory = loadUserMemory();
  memory.decisionHistory.push({
    id: `decision_${Date.now()}`,
    date: new Date().toISOString(),
    query,
    mode,
    result: 'pending',
    adopted: null,
    feedback: null,
  });
  saveUserMemory(memory);
  result.memoryUpdated = true;
  
  // 2. 如果有用户反馈，处理反馈
  if (userFeedback) {
    const feedback: Feedback = {
      id: `feedback_${Date.now()}`,
      date: new Date().toISOString(),
      decisionId: `decision_${Date.now()}`,
      query,
      rating: userFeedback.rating || 3,
      adopted: userFeedback.adopted || false,
      userComment: userFeedback.userComment,
      roleFeedback: userFeedback.roleFeedback || [],
    };
    
    saveFeedback(feedback);
    updateProfileFromFeedback(feedback);
    result.feedbackRecorded = true;
    result.newRulesLearned = feedback.userCorrection ? 1 : 0;
  }
  
  // 3. 如果是成功案例，保存到案例库
  if (userFeedback?.adopted && userFeedback.rating && userFeedback.rating >= 4) {
    const caseData: SuccessCase = {
      id: `case_${Date.now()}`,
      date: new Date().toISOString(),
      query,
      projectType: extractProjectType(query) || 'unknown',
      mode,
      analysis: {
        marketAnalysis: analysisResults['market_analyst'] || '',
        financialAnalysis: analysisResults['financial_analyst'] || '',
        riskAnalysis: analysisResults['risk_assessor'] || '',
        decision: analysisResults['decision_advisor'] || '',
      },
      execution: {
        adopted: true,
        challenges: [],
        lessons: [],
      },
      reusableElements: {
        marketInsights: [],
        financialModels: [],
        riskFactors: [],
        executionSteps: [],
      },
      tags: extractKeywords(query),
    };
    
    saveSuccessCase(caseData);
    result.caseSaved = true;
  }
  
  return result;
}
