// 最终完善系统 - 解决所有剩余不足
import { searchWithVerification } from '../providers/api';
import { USER_PROFILE } from './config';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 1. 约束验证改为事前阻止 ====================

export interface PreConstraintValidator {
  validate: (userInput: string, context?: string) => {
    passed: boolean;
    violations: string[];
    constraintPrompt: string;
    shouldRegenerate: boolean;
  };
}

// 创建事前约束验证器
export function createPreConstraintValidator(): PreConstraintValidator {
  return {
    validate: (userInput: string, context?: string) => {
      const violations: string[] = [];
      let constraintPrompt = '';
      let shouldRegenerate = false;
      
      // 检查用户输入中的违规意图
      const illegalKeywords = ['灰色', '违规', '逃税', '无证经营', '黑市', '非法'];
      for (const keyword of illegalKeywords) {
        if (userInput.includes(keyword)) {
          violations.push(`检测到不合规关键词: ${keyword}`);
          shouldRegenerate = true;
        }
      }
      
      // 检查是否超出预算
      const budgetMatch = userInput.match(/(\d+\.?\d*)\s*万/);
      if (budgetMatch) {
        const budget = parseFloat(budgetMatch[1]) * 10000;
        if (budget > USER_PROFILE.funds.total) {
          violations.push(`预算${budgetMatch[1]}万超过可用资金${USER_PROFILE.funds.total / 10000}万`);
        }
      }
      
      // 检查是否要求过长回本周期
      const roiMatch = userInput.match(/(\d+)\s*个?月.*回本/);
      if (roiMatch) {
        const roi = parseInt(roiMatch[1]);
        if (roi > USER_PROFILE.constraints.roiMonths) {
          violations.push(`要求回本周期${roi}个月超过限制${USER_PROFILE.constraints.roiMonths}个月`);
        }
      }
      
      // 生成约束提示词
      if (violations.length > 0) {
        constraintPrompt = `
【⚠️ 重要约束提醒 - 必须遵守】

你正在为一个有严格约束的用户提供建议。请确保你的分析遵守以下约束：

1. 资金约束：
   - 用户总资金：${USER_PROFILE.funds.total}元（${USER_PROFILE.funds.total / 10000}万元）
   - 现金：${USER_PROFILE.funds.cash}元
   - 贷款额度：${USER_PROFILE.funds.loan}元
   - 月固定支出预留：${USER_PROFILE.funds.monthlyReserve}元
   - 任何投资建议不得超过${USER_PROFILE.funds.total / 10000}万元

2. 时间约束：
   - 回本周期不得超过${USER_PROFILE.constraints.roiMonths}个月
   - 如果项目回本周期超过此限制，必须明确标注"不推荐"

3. 合规约束：
   - 所有建议必须100%合法合规
   - 禁止任何灰色、违规、逃税等不合规建议
   - 如果项目存在合规风险，必须明确警告

4. 地域约束：
   - 用户资源位于：安徽滁州（厂房）、河南濮阳（团队）
   - 项目应能在这些地区开展

已检测到以下问题：
${violations.map(v => `- ${v}`).join('\n')}

请在分析中：
- 如果问题严重，明确告知用户不可行
- 如果可以调整，提供符合约束的替代方案
- 始终在结论中说明是否满足约束条件
`;
      }
      
      return {
        passed: violations.length === 0,
        violations,
        constraintPrompt,
        shouldRegenerate,
      };
    },
  };
}

// 在每个角色调用前注入约束
export function injectConstraintsIntoPrompt(
  originalPrompt: string,
  role: string,
  constraints: {
    maxInvestment: number;
    maxRoiMonths: number;
    monthlyReserve: number;
  }
): string {
  const constraintSection = `

【系统约束 - 必须遵守】
- 投资金额上限：${constraints.maxInvestment / 10000}万元
- 回本周期上限：${constraints.maxRoiMonths}个月
- 月固定支出预留：${constraints.monthlyReserve}元
- 所有建议必须100%合法合规

如果分析结果违反以上约束，必须：
1. 明确标注违反了哪个约束
2. 提供符合约束的替代方案
3. 在结论中说明约束满足情况
`;
  
  return originalPrompt + constraintSection;
}

// ==================== 2. 议题内角色完全并行 ====================

export interface FullParallelExecutor {
  execute: <T>(
    tasks: { id: string; execute: () => Promise<T> }[],
    onProgress?: (id: string, status: 'running' | 'completed' | 'failed') => void
  ) => Promise<Record<string, { result?: T; error?: string }>>;
}

// 创建完全并行执行器
export function createFullParallelExecutor(): FullParallelExecutor {
  return {
    execute: async <T>(
      tasks: { id: string; execute: () => Promise<T> }[],
      onProgress?: (id: string, status: 'running' | 'completed' | 'failed') => void
    ) => {
      const results: Record<string, { result?: T; error?: string }> = {};
      
      // 真正的并行执行
      const promises = tasks.map(async (task) => {
        onProgress?.(task.id, 'running');
        
        try {
          const result = await task.execute();
          onProgress?.(task.id, 'completed');
          return { id: task.id, result };
        } catch (error: any) {
          onProgress?.(task.id, 'failed');
          return { id: task.id, error: error.message };
        }
      });
      
      // 等待所有任务完成
      const allResults = await Promise.all(promises);
      
      // 整理结果
      for (const r of allResults) {
        if (r.result !== undefined) {
          results[r.id] = { result: r.result };
        } else {
          results[r.id] = { error: r.error };
        }
      }
      
      return results;
    },
  };
}

// 完全并行执行多个角色
export async function executeRolesFullyParallel(
  roles: { id: string; name: string; execute: () => Promise<string> }[],
  onProgress?: (roleId: string, status: string) => void
): Promise<Record<string, { content?: string; error?: string }>> {
  const executor = createFullParallelExecutor();
  
  const tasks = roles.map(role => ({
    id: role.id,
    execute: role.execute,
  }));
  
  return executor.execute(tasks, onProgress);
}

// ==================== 3. 实时纠偏增加更多矛盾模式 ====================

export interface ComprehensiveCorrection {
  issues: {
    type: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    location: string;
    suggestion: string;
  }[];
  correctedContent: string;
  corrections: { original: string; corrected: string; reason: string }[];
}

// 全面的矛盾检测
export function detectAllContradictions(content: string): ComprehensiveCorrection['issues'] {
  const issues: ComprehensiveCorrection['issues'] = [];
  
  // 1. 基础矛盾检测
  const basicContradictions = [
    { pattern1: /可行/, pattern2: /不可行/, name: '可行性矛盾' },
    { pattern1: /盈利/, pattern2: /亏损/, name: '盈亏矛盾' },
    { pattern1: /推荐/, pattern2: /不推荐/, name: '推荐矛盾' },
    { pattern1: /高增长/, pattern2: /市场萎缩/, name: '市场趋势矛盾' },
    { pattern1: /供不应求/, pattern2: /供过于求/, name: '供需矛盾' },
    { pattern1: /利润高/, pattern2: /利润低/, name: '利润矛盾' },
    { pattern1: /风险低/, pattern2: /风险高/, name: '风险矛盾' },
    { pattern1: /竞争小/, pattern2: /竞争激烈/, name: '竞争矛盾' },
  ];
  
  for (const c of basicContradictions) {
    if (c.pattern1.test(content) && c.pattern2.test(content)) {
      issues.push({
        type: 'logical_contradiction',
        description: `检测到${c.name}`,
        severity: 'warning',
        location: '全文',
        suggestion: '请明确结论，避免矛盾表述',
      });
    }
  }
  
  // 2. 数值矛盾检测
  const numberMatches = content.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨|公斤|%|个月)/g);
  const numbersByContext: Record<string, { value: number; context: string }[]> = {};
  
  for (const match of numberMatches) {
    const context = content.substring(Math.max(0, (match.index || 0) - 20), (match.index || 0) + match[0].length + 20);
    const key = context.includes('投资') ? '投资' :
                context.includes('利润') ? '利润' :
                context.includes('成本') ? '成本' :
                context.includes('回本') ? '回本' : '其他';
    
    if (!numbersByContext[key]) numbersByContext[key] = [];
    numbersByContext[key].push({ value: parseFloat(match[1]), context: match[0] });
  }
  
  for (const [key, nums] of Object.entries(numbersByContext)) {
    if (nums.length >= 2) {
      const values = nums.map(n => n.value);
      const max = Math.max(...values);
      const min = Math.min(...values);
      
      if (max > min * 3 && key !== '其他') {
        issues.push({
          type: 'numerical_contradiction',
          description: `${key}数值差异过大: ${min} - ${max}`,
          severity: 'warning',
          location: key,
          suggestion: '请核实数据一致性',
        });
      }
    }
  }
  
  // 3. 时间矛盾检测
  const timeMatches = content.matchAll(/(\d+)\s*(个?月|年)/g);
  const times: { value: number; unit: string; context: string }[] = [];
  
  for (const match of timeMatches) {
    const context = content.substring(Math.max(0, (match.index || 0) - 30), (match.index || 0) + match[0].length + 30);
    times.push({
      value: parseInt(match[1]),
      unit: match[2],
      context,
    });
  }
  
  // 检查回本周期矛盾
  const roiTimes = times.filter(t => t.context.includes('回本') || t.context.includes('ROI'));
  if (roiTimes.length >= 2) {
    const values = roiTimes.map(t => t.unit.includes('年') ? t.value * 12 : t.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    
    if (max - min > 6) {
      issues.push({
        type: 'time_contradiction',
        description: `回本周期预测不一致: ${min}个月 vs ${max}个月`,
        severity: 'warning',
        location: 'ROI分析',
        suggestion: '请统一回本周期预测或说明不同情景',
      });
    }
  }
  
  // 4. 结论与数据矛盾检测
  const hasPositiveConclusion = /推荐|可行|值得|建议/.test(content);
  const hasNegativeData = /风险高|亏损|竞争激烈|市场萎缩/.test(content);
  
  if (hasPositiveConclusion && hasNegativeData) {
    issues.push({
      type: 'conclusion_data_contradiction',
      description: '结论为正面，但数据存在负面因素',
      severity: 'warning',
      location: '结论部分',
      suggestion: '请在结论中说明风险因素',
    });
  }
  
  // 5. 约束违反检测
  const investmentMatch = content.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
  if (investmentMatch) {
    const investment = parseFloat(investmentMatch[1]) * 10000;
    if (investment > USER_PROFILE.funds.total) {
      issues.push({
        type: 'constraint_violation',
        description: `投资${investmentMatch[1]}万超过预算${USER_PROFILE.funds.total / 10000}万`,
        severity: 'critical',
        location: '投资分析',
        suggestion: '请调整投资金额或说明资金缺口解决方案',
      });
    }
  }
  
  const roiMatch = content.match(/(\d+)\s*个?月.*回本/);
  if (roiMatch) {
    const roi = parseInt(roiMatch[1]);
    if (roi > USER_PROFILE.constraints.roiMonths) {
      issues.push({
        type: 'constraint_violation',
        description: `回本周期${roi}个月超过限制${USER_PROFILE.constraints.roiMonths}个月`,
        severity: 'critical',
        location: 'ROI分析',
        suggestion: '请说明如何缩短回本周期或标注为不推荐',
      });
    }
  }
  
  return issues;
}

// 执行全面纠偏
export function executeComprehensiveCorrection(content: string): ComprehensiveCorrection {
  const issues = detectAllContradictions(content);
  const corrections: { original: string; corrected: string; reason: string }[] = [];
  let correctedContent = content;
  
  // 处理关键问题
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  
  for (const issue of criticalIssues) {
    if (issue.type === 'constraint_violation' && issue.location === '投资分析') {
      // 自动修正投资金额
      const investmentMatch = correctedContent.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
      if (investmentMatch) {
        const corrected = `投资${USER_PROFILE.funds.total / 10000}万（已自动调整至预算上限）`;
        corrections.push({
          original: investmentMatch[0],
          corrected,
          reason: issue.description,
        });
        correctedContent = correctedContent.replace(investmentMatch[0], corrected);
      }
    }
  }
  
  // 添加问题摘要
  if (criticalIssues.length > 0) {
    const summary = `
【⚠️ 发现${criticalIssues.length}个严重问题】
${criticalIssues.map(i => `- ${i.description}`).join('\n')}
${corrections.length > 0 ? '\n已自动修正的问题：\n' + corrections.map(c => `- ${c.reason}`).join('\n') : ''}

`;
    correctedContent = summary + correctedContent;
  }
  
  return { issues, correctedContent, corrections };
}

// ==================== 4. 后验审计增加更多验证维度 ====================

export interface ComprehensiveAudit {
  dimensions: {
    name: string;
    score: number;
    issues: string[];
    verified: boolean;
  }[];
  overallScore: number;
  overallGrade: 'A' | 'B' | 'C' | 'D';
  summary: string;
  recommendations: string[];
}

// 执行全面后验审计
export async function executeComprehensiveAudit(
  report: string,
  originalQuery: string
): Promise<ComprehensiveAudit> {
  const dimensions: ComprehensiveAudit['dimensions'] = [];
  
  // 1. 事实核查维度
  const factCheck = await auditFacts(report, originalQuery);
  dimensions.push(factCheck);
  
  // 2. 数据一致性维度
  const dataConsistency = auditDataConsistency(report);
  dimensions.push(dataConsistency);
  
  // 3. 逻辑一致性维度
  const logicConsistency = auditLogicConsistency(report);
  dimensions.push(logicConsistency);
  
  // 4. 约束满足维度
  const constraintSatisfaction = auditConstraintSatisfaction(report);
  dimensions.push(constraintSatisfaction);
  
  // 5. 来源可靠性维度
  const sourceReliability = auditSourceReliability(report);
  dimensions.push(sourceReliability);
  
  // 6. 时效性维度
  const timeliness = auditTimeliness(report);
  dimensions.push(timeliness);
  
  // 计算总分
  const overallScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
  
  // 确定等级
  const overallGrade: 'A' | 'B' | 'C' | 'D' = 
    overallScore >= 80 ? 'A' : 
    overallScore >= 60 ? 'B' : 
    overallScore >= 40 ? 'C' : 'D';
  
  // 生成摘要
  const summary = generateAuditSummary(dimensions, overallGrade);
  
  // 生成建议
  const recommendations = generateAuditRecommendations(dimensions);
  
  return {
    dimensions,
    overallScore,
    overallGrade,
    summary,
    recommendations,
  };
}

// 事实核查
async function auditFacts(report: string, query: string): Promise<ComprehensiveAudit['dimensions'][0]> {
  const issues: string[] = [];
  let score = 100;
  
  // 提取关键声明
  const claims = extractKeyClaims(report);
  
  // 验证每个声明
  for (const claim of claims.slice(0, 5)) {
    const searchResult = await searchWithVerification(`${query} ${claim}`);
    
    if (searchResult.combined.length < 2) {
      issues.push(`声明"${claim.slice(0, 30)}..."缺乏足够来源支持`);
      score -= 10;
    }
  }
  
  return {
    name: '事实核查',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
  };
}

// 数据一致性审计
function auditDataConsistency(report: string): ComprehensiveAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  
  // 检查数值一致性
  const numbers = report.matchAll(/(\d+\.?\d*)\s*(万|亿|元|吨|%)/g);
  const numArray = Array.from(numbers).map(m => ({ value: parseFloat(m[1]), unit: m[2] }));
  
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
      if (max > min * 10) {
        issues.push(`${unit}单位数值差异过大: ${min} - ${max}`);
        score -= 10;
      }
    }
  }
  
  return {
    name: '数据一致性',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
  };
}

// 逻辑一致性审计
function auditLogicConsistency(report: string): ComprehensiveAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  
  // 检查矛盾
  const contradictions = [
    [/可行/, /不可行/],
    [/推荐/, /不推荐/],
    [/盈利/, /亏损/],
  ];
  
  for (const [p1, p2] of contradictions) {
    if (p1.test(report) && p2.test(report)) {
      issues.push(`存在矛盾表述: ${p1} vs ${p2}`);
      score -= 15;
    }
  }
  
  return {
    name: '逻辑一致性',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
  };
}

// 约束满足审计
function auditConstraintSatisfaction(report: string): ComprehensiveAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  
  // 检查投资约束
  const investmentMatch = report.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
  if (investmentMatch) {
    const investment = parseFloat(investmentMatch[1]) * 10000;
    if (investment > USER_PROFILE.funds.total) {
      issues.push(`投资金额超过预算`);
      score -= 20;
    }
  }
  
  // 检查ROI约束
  const roiMatch = report.match(/(\d+)\s*个?月.*回本/);
  if (roiMatch) {
    const roi = parseInt(roiMatch[1]);
    if (roi > USER_PROFILE.constraints.roiMonths) {
      issues.push(`回本周期超过限制`);
      score -= 20;
    }
  }
  
  return {
    name: '约束满足',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
  };
}

// 来源可靠性审计
function auditSourceReliability(report: string): ComprehensiveAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 80; // 默认分数，因为没有来源标注
  
  // 检查是否有来源标注
  if (report.includes('来源:') || report.includes('来源：')) {
    score = 90;
  }
  
  // 检查是否有数据来源说明
  if (report.includes('数据来源') || report.includes('参考')) {
    score = 95;
  }
  
  if (score < 90) {
    issues.push('缺少数据来源标注');
  }
  
  return {
    name: '来源可靠性',
    score,
    issues,
    verified: score >= 90,
  };
}

// 时效性审计
function auditTimeliness(report: string): ComprehensiveAudit['dimensions'][0] {
  const issues: string[] = [];
  let score = 100;
  
  // 检查日期
  const dates = report.matchAll(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/g);
  const dateArray = Array.from(dates);
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  for (const d of dateArray) {
    const year = parseInt(d[1]);
    if (year < currentYear - 1) {
      issues.push(`数据可能过期: ${d[0]}`);
      score -= 10;
    }
  }
  
  return {
    name: '时效性',
    score: Math.max(0, score),
    issues,
    verified: issues.length === 0,
  };
}

// 提取关键声明
function extractKeyClaims(report: string): string[] {
  const claims: string[] = [];
  
  // 提取包含数字的声明
  const numberClaims = report.match(/[^。！？]*\d+\.?\d*\s*(万|亿|元|吨|%)[^。！？]*/g) || [];
  claims.push(...numberClaims);
  
  // 提取结论性声明
  const conclusionClaims = report.match(/(结论|建议|推荐|判断)[：:]\s*[^。\n]+/g) || [];
  claims.push(...conclusionClaims);
  
  return claims;
}

// 生成审计摘要
function generateAuditSummary(
  dimensions: ComprehensiveAudit['dimensions'],
  grade: string
): string {
  const passed = dimensions.filter(d => d.verified).length;
  const total = dimensions.length;
  
  if (grade === 'A') {
    return `报告通过全面审计，${passed}/${total}维度验证通过，数据可信度高`;
  } else if (grade === 'B') {
    return `报告基本通过审计，${passed}/${total}维度验证通过，部分问题需关注`;
  } else if (grade === 'C') {
    return `报告存在较多问题，${total - passed}个维度未通过，建议核实`;
  } else {
    return `报告未通过审计，存在严重问题，建议重新分析`;
  }
}

// 生成审计建议
function generateAuditRecommendations(dimensions: ComprehensiveAudit['dimensions']): string[] {
  const recommendations: string[] = [];
  
  for (const d of dimensions) {
    if (!d.verified) {
      recommendations.push(`【${d.name}】${d.issues.join('；')}`);
    }
  }
  
  return recommendations;
}

// ==================== 5. 跨设备同步云端方案 ====================

export interface CloudStorageSync {
  save: (key: string, data: any) => Promise<boolean>;
  load: (key: string) => Promise<any | null>;
  list: () => Promise<string[]>;
  delete: (key: string) => Promise<boolean>;
}

// 创建云端存储（使用文件系统模拟，可替换为真实云服务）
export function createCloudStorageSync(): CloudStorageSync {
  const dataDir = '/home/z/my-project/data/cloud';
  
  // 确保目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return {
    save: async (key: string, data: any) => {
      try {
        const filePath = path.join(dataDir, `${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
      } catch {
        return false;
      }
    },
    
    load: async (key: string) => {
      try {
        const filePath = path.join(dataDir, `${key}.json`);
        if (fs.existsSync(filePath)) {
          const data = fs.readFileSync(filePath, 'utf-8');
          return JSON.parse(data);
        }
        return null;
      } catch {
        return null;
      }
    },
    
    list: async () => {
      try {
        return fs.readdirSync(dataDir)
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''));
      } catch {
        return [];
      }
    },
    
    delete: async (key: string) => {
      try {
        const filePath = path.join(dataDir, `${key}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return true;
      } catch {
        return false;
      }
    },
  };
}

// 云端存储API接口（供外部云服务接入）
export interface CloudStorageAPI {
  endpoint: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

// 创建可配置的云端存储
export function createConfigurableCloudStorage(config: CloudStorageAPI): CloudStorageSync {
  return {
    save: async (key: string, data: any) => {
      try {
        const response = await fetch(`${config.endpoint}/${key}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...config.headers,
            ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
          },
          body: JSON.stringify(data),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    
    load: async (key: string) => {
      try {
        const response = await fetch(`${config.endpoint}/${key}`, {
          headers: {
            ...config.headers,
            ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
          },
        });
        if (response.ok) {
          return await response.json();
        }
        return null;
      } catch {
        return null;
      }
    },
    
    list: async () => {
      try {
        const response = await fetch(config.endpoint, {
          headers: {
            ...config.headers,
            ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
          },
        });
        if (response.ok) {
          return await response.json();
        }
        return [];
      } catch {
        return [];
      }
    },
    
    delete: async (key: string) => {
      try {
        const response = await fetch(`${config.endpoint}/${key}`, {
          method: 'DELETE',
          headers: {
            ...config.headers,
            ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
          },
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

// ==================== 6. 专利验证改进搜索策略 ====================

export interface ImprovedPatentVerification {
  query: string;
  patents: {
    title: string;
    patentNumber: string;
    filingDate: string;
    assignee: string;
    abstract: string;
    similarity: number;
    url: string;
    source: 'google_patents' | 'cnipa' | 'uspto' | 'other';
  }[];
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  recommendation: string;
  searchStrategy: string[];
}

// 改进的专利验证
export async function verifyPatentImproved(
  innovationTitle: string,
  innovationDescription: string
): Promise<ImprovedPatentVerification> {
  const patents: ImprovedPatentVerification['patents'] = [];
  const searchStrategy: string[] = [];
  
  // 策略1: Google Patents搜索
  searchStrategy.push('Google Patents搜索');
  const googleResults = await searchWithVerification(
    `${innovationTitle} patent site:patents.google.com`
  );
  
  for (const result of googleResults.combined.slice(0, 5)) {
    const patent = parsePatentResult(result, 'google_patents');
    if (patent) {
      patent.similarity = calculateSimilarity(innovationTitle, patent.title);
      patents.push(patent);
    }
  }
  
  // 策略2: 中国专利搜索
  searchStrategy.push('中国专利搜索');
  const cnResults = await searchWithVerification(
    `${innovationTitle} 专利 site:cnipa.gov.cn OR site:pss-system.cponline.cnipa.gov.cn`
  );
  
  for (const result of cnResults.combined.slice(0, 3)) {
    const patent = parsePatentResult(result, 'cnipa');
    if (patent) {
      patent.similarity = calculateSimilarity(innovationTitle, patent.title);
      patents.push(patent);
    }
  }
  
  // 策略3: 技术关键词搜索
  searchStrategy.push('技术关键词搜索');
  const keywords = extractKeywords(innovationDescription);
  const keywordResults = await searchWithVerification(
    `${keywords.join(' ')} patent 专利`
  );
  
  for (const result of keywordResults.combined.slice(0, 3)) {
    const patent = parsePatentResult(result, 'other');
    if (patent) {
      patent.similarity = calculateSimilarity(innovationTitle, patent.title);
      patents.push(patent);
    }
  }
  
  // 去重
  const uniquePatents = removeDuplicatePatents(patents);
  
  // 计算风险
  const { riskLevel, riskScore } = calculatePatentRisk(uniquePatents);
  
  // 生成建议
  const recommendation = generatePatentRecommendation(riskLevel, uniquePatents);
  
  return {
    query: innovationTitle,
    patents: uniquePatents,
    riskLevel,
    riskScore,
    recommendation,
    searchStrategy,
  };
}

// 解析专利搜索结果
function parsePatentResult(
  result: any,
  source: 'google_patents' | 'cnipa' | 'uspto' | 'other'
): ImprovedPatentVerification['patents'][0] | null {
  const title = result.title || '';
  const url = result.url || result.link || '';
  const content = result.snippet || result.content || '';
  
  // 提取专利号
  const patentMatch = title.match(/([A-Z]{2}\d+[A-Z]?\d*)/i) || 
                      url.match(/patent\/([A-Z]{2}\d+[A-Z]?\d*)/i) ||
                      content.match(/专利号[：:]\s*([A-Z]{2}\d+[A-Z]?\d*)/i);
  
  if (!patentMatch && !url.includes('patent')) {
    return null;
  }
  
  return {
    title: title.replace(/ - Google Patents$/, '').replace(/ - 专利$/, ''),
    patentNumber: patentMatch ? patentMatch[1] : 'Unknown',
    filingDate: extractDate(content) || 'Unknown',
    assignee: extractAssignee(content) || 'Unknown',
    abstract: content.slice(0, 200),
    similarity: 0,
    url,
    source,
  };
}

// 计算相似度
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

// 提取关键词
function extractKeywords(text: string): string[] {
  // 简单的关键词提取
  const words = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  const stopWords = ['方法', '装置', '系统', '设备', '一种'];
  
  return words
    .filter(w => !stopWords.includes(w))
    .slice(0, 5);
}

// 去重专利
function removeDuplicatePatents(patents: ImprovedPatentVerification['patents']): ImprovedPatentVerification['patents'] {
  const seen = new Set<string>();
  return patents.filter(p => {
    const key = p.patentNumber || p.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 计算专利风险
function calculatePatentRisk(patents: ImprovedPatentVerification['patents']): {
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
} {
  if (patents.length === 0) {
    return { riskLevel: 'low', riskScore: 10 };
  }
  
  const highSimilarity = patents.filter(p => p.similarity > 0.5);
  const mediumSimilarity = patents.filter(p => p.similarity > 0.3 && p.similarity <= 0.5);
  
  let riskScore = 0;
  riskScore += highSimilarity.length * 30;
  riskScore += mediumSimilarity.length * 15;
  riskScore += patents.length * 5;
  
  const riskLevel: 'low' | 'medium' | 'high' = 
    riskScore >= 50 ? 'high' : 
    riskScore >= 25 ? 'medium' : 'low';
  
  return { riskLevel, riskScore };
}

// 生成专利建议
function generatePatentRecommendation(
  riskLevel: 'low' | 'medium' | 'high',
  patents: ImprovedPatentVerification['patents']
): string {
  if (riskLevel === 'high') {
    return `存在${patents.filter(p => p.similarity > 0.5).length}个高度相似专利，建议：
1. 详细研究相关专利的权利要求范围
2. 考虑授权合作或规避设计
3. 咨询专业专利律师进行侵权分析`;
  } else if (riskLevel === 'medium') {
    return `存在部分相似专利，建议：
1. 研究相似专利的技术方案
2. 明确差异化创新点
3. 考虑申请自己的专利保护`;
  } else {
    return `未发现高度相似专利，但仍建议：
1. 在产品开发前进行专业专利检索
2. 考虑申请专利保护创新点`;
  }
}

// 提取日期
function extractDate(text: string): string | null {
  const match = text.match(/(\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2})/);
  return match ? match[1] : null;
}

// 提取专利权人
function extractAssignee(text: string): string | null {
  const match = text.match(/(申请人|专利权人|Assignee)[：:]\s*([^，。\n]+)/);
  return match ? match[2].trim() : null;
}

// ==================== 7. 学习系统模拟微调效果 ====================

export interface SimulatedFineTuning {
  // 规则权重
  ruleWeights: Record<string, number>;
  
  // 角色权重
  roleWeights: Record<string, number>;
  
  // 领域知识
  domainKnowledge: {
    domain: string;
    facts: string[];
    rules: string[];
    lastUpdated: Date;
  }[];
  
  // 用户偏好模型
  userPreferenceModel: {
    riskTolerance: number;
    profitFocus: number;
    timePreference: number;
    industryPreference: string[];
  };
}

// 模拟微调效果
export function simulateFineTuning(
  feedbackHistory: {
    rating: number;
    adopted: boolean;
    comment: string;
    correction: string;
    roleFeedback: { roleId: string; helpful: boolean }[];
  }[]
): SimulatedFineTuning {
  const ruleWeights: Record<string, number> = {};
  const roleWeights: Record<string, number> = {};
  const domainKnowledge: SimulatedFineTuning['domainKnowledge'] = [];
  const userPreferenceModel: SimulatedFineTuning['userPreferenceModel'] = {
    riskTolerance: 0.5,
    profitFocus: 0.5,
    timePreference: 0.5,
    industryPreference: [],
  };
  
  // 从反馈中学习
  for (const feedback of feedbackHistory) {
    // 更新角色权重
    for (const rf of feedback.roleFeedback) {
      if (!roleWeights[rf.roleId]) {
        roleWeights[rf.roleId] = 1.0;
      }
      
      if (rf.helpful) {
        roleWeights[rf.roleId] = Math.min(2.0, roleWeights[rf.roleId] + 0.1);
      } else {
        roleWeights[rf.roleId] = Math.max(0.5, roleWeights[rf.roleId] - 0.1);
      }
    }
    
    // 从评论中学习偏好
    if (feedback.comment) {
      if (feedback.comment.includes('风险')) {
        userPreferenceModel.riskTolerance = feedback.comment.includes('高风险') ? 0.8 : 0.3;
      }
      if (feedback.comment.includes('利润')) {
        userPreferenceModel.profitFocus = 0.8;
      }
      if (feedback.comment.includes('快速')) {
        userPreferenceModel.timePreference = 0.8;
      }
    }
    
    // 从修正中学习规则
    if (feedback.correction) {
      const ruleKey = feedback.correction.slice(0, 50);
      if (!ruleWeights[ruleKey]) {
        ruleWeights[ruleKey] = 0.5;
      }
      ruleWeights[ruleKey] = Math.min(1.0, ruleWeights[ruleKey] + 0.2);
    }
  }
  
  return {
    ruleWeights,
    roleWeights,
    domainKnowledge,
    userPreferenceModel,
  };
}

// 应用模拟微调效果到Prompt
export function applySimulatedFineTuning(
  prompt: string,
  fineTuning: SimulatedFineTuning,
  role: string
): string {
  let enhancedPrompt = prompt;
  
  // 应用用户偏好
  const { userPreferenceModel } = fineTuning;
  
  if (userPreferenceModel.riskTolerance < 0.4) {
    enhancedPrompt += '\n\n【用户偏好】用户风险承受能力较低，请重点分析风险因素。';
  } else if (userPreferenceModel.riskTolerance > 0.6) {
    enhancedPrompt += '\n\n【用户偏好】用户风险承受能力较高，可以推荐高回报项目。';
  }
  
  if (userPreferenceModel.profitFocus > 0.6) {
    enhancedPrompt += '\n\n【用户偏好】用户更关注利润，请重点分析盈利能力。';
  }
  
  if (userPreferenceModel.timePreference > 0.6) {
    enhancedPrompt += '\n\n【用户偏好】用户偏好快速见效的项目，请重点分析短期收益。';
  }
  
  // 应用角色权重
  const roleWeight = fineTuning.roleWeights[role] || 1.0;
  if (roleWeight < 0.7) {
    enhancedPrompt += '\n\n【注意】此角色历史准确率较低，请特别注意数据准确性。';
  } else if (roleWeight > 1.3) {
    enhancedPrompt += '\n\n【注意】此角色历史表现优秀，继续保持。';
  }
  
  // 应用高权重规则
  const topRules = Object.entries(fineTuning.ruleWeights)
    .filter(([_, weight]) => weight > 0.7)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  if (topRules.length > 0) {
    enhancedPrompt += '\n\n【已学习的重要规则】\n';
    for (const [rule, weight] of topRules) {
      enhancedPrompt += `- ${rule}（权重${(weight * 100).toFixed(0)}%）\n`;
    }
  }
  
  return enhancedPrompt;
}

// ==================== 8. 来源独立性增加更多检测维度 ====================

export interface EnhancedSourceIndependence {
  sources: {
    url: string;
    domain: string;
    title: string;
    independenceScore: number;
    factors: {
      domain: string;
      originalSource: string | null;
      references: string[];
      referencedBy: string[];
      contentSimilarity: number;
      publishDate: Date | null;
    };
  }[];
  overallIndependence: number;
  isIndependent: boolean;
  analysis: string;
  recommendations: string[];
}

// 增强的来源独立性检测
export async function detectSourceIndependenceEnhanced(
  sources: { url: string; title: string; content: string }[]
): Promise<EnhancedSourceIndependence> {
  const processedSources: EnhancedSourceIndependence['sources'] = [];
  
  // 1. 处理每个来源
  for (const source of sources) {
    const domain = extractDomain(source.url);
    const originalSource = extractOriginalSource(source.content);
    const references = extractReferences(source.content);
    const publishDate = extractPublishDate(source.content);
    
    processedSources.push({
      url: source.url,
      domain,
      title: source.title,
      independenceScore: 100,
      factors: {
        domain,
        originalSource,
        references,
        referencedBy: [],
        contentSimilarity: 0,
        publishDate,
      },
    });
  }
  
  // 2. 检测引用关系
  for (let i = 0; i < processedSources.length; i++) {
    for (let j = 0; j < processedSources.length; j++) {
      if (i !== j) {
        // 检查i是否引用j
        if (processedSources[i].factors.references.some(r => 
          r.includes(processedSources[j].domain) ||
          processedSources[j].url.includes(r)
        )) {
          processedSources[i].independenceScore -= 15;
          processedSources[j].factors.referencedBy.push(processedSources[i].url);
        }
      }
    }
  }
  
  // 3. 检测内容相似度
  for (let i = 0; i < processedSources.length; i++) {
    for (let j = i + 1; j < processedSources.length; j++) {
      const similarity = calculateContentSimilarity(
        sources[i].content,
        sources[j].content
      );
      
      processedSources[i].factors.contentSimilarity = Math.max(
        processedSources[i].factors.contentSimilarity,
        similarity
      );
      processedSources[j].factors.contentSimilarity = Math.max(
        processedSources[j].factors.contentSimilarity,
        similarity
      );
      
      if (similarity > 0.5) {
        processedSources[i].independenceScore -= 10;
        processedSources[j].independenceScore -= 10;
      }
    }
  }
  
  // 4. 检测共同原始来源
  const originalSources = processedSources
    .map(s => s.factors.originalSource)
    .filter((s): s is string => s !== null);
  
  const uniqueOriginalSources = new Set(originalSources.map(s => s.toLowerCase()));
  
  if (uniqueOriginalSources.size < originalSources.length) {
    for (const s of processedSources) {
      if (s.factors.originalSource) {
        s.independenceScore -= 20;
      }
    }
  }
  
  // 5. 检测同域名
  const domainCounts: Record<string, number> = {};
  for (const s of processedSources) {
    domainCounts[s.factors.domain] = (domainCounts[s.factors.domain] || 0) + 1;
  }
  
  for (const s of processedSources) {
    if (domainCounts[s.factors.domain] > 1) {
      s.independenceScore -= 15;
    }
  }
  
  // 6. 计算总体独立性
  const overallIndependence = processedSources.reduce((sum, s) => sum + s.independenceScore, 0) / processedSources.length;
  
  // 7. 生成分析
  const isIndependent = overallIndependence >= 60;
  const analysis = generateIndependenceAnalysis(processedSources, isIndependent);
  const recommendations = generateIndependenceRecommendations(processedSources);
  
  return {
    sources: processedSources,
    overallIndependence,
    isIndependent,
    analysis,
    recommendations,
  };
}

// 计算内容相似度
function calculateContentSimilarity(content1: string, content2: string): number {
  const words1 = content1.toLowerCase().split(/\s+/);
  const words2 = content2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

// 提取发布日期
function extractPublishDate(content: string): Date | null {
  const patterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
  }
  
  return null;
}

// 生成独立性分析
function generateIndependenceAnalysis(
  sources: EnhancedSourceIndependence['sources'],
  isIndependent: boolean
): string {
  if (isIndependent) {
    return '来源独立性良好，数据可信度较高';
  }
  
  const issues: string[] = [];
  
  for (const s of sources) {
    if (s.factors.references.length > 0) {
      issues.push(`${s.domain}引用了其他来源`);
    }
    if (s.factors.referencedBy.length > 0) {
      issues.push(`${s.domain}被其他来源引用`);
    }
    if (s.factors.contentSimilarity > 0.5) {
      issues.push(`${s.domain}与其他来源内容相似度高`);
    }
    if (s.factors.originalSource) {
      issues.push(`${s.domain}引用了原始来源${s.factors.originalSource}`);
    }
  }
  
  return `来源独立性不足：${issues.join('；')}`;
}

// 生成独立性建议
function generateIndependenceRecommendations(
  sources: EnhancedSourceIndependence['sources']
): string[] {
  const recommendations: string[] = [];
  
  const lowScoreSources = sources.filter(s => s.independenceScore < 60);
  
  if (lowScoreSources.length > 0) {
    recommendations.push(`建议寻找更多独立来源替代：${lowScoreSources.map(s => s.domain).join('、')}`);
  }
  
  const referencedSources = sources.filter(s => s.factors.referencedBy.length > 0);
  if (referencedSources.length > 0) {
    recommendations.push('存在交叉引用，建议寻找原始数据源');
  }
  
  return recommendations;
}

// ==================== 9. 数据溯源时间戳多来源提取 ====================

export interface EnhancedTimestamp {
  url: string;
  timestamps: {
    source: 'url' | 'meta' | 'content' | 'header';
    value: Date;
    confidence: number;
  }[];
  bestEstimate: Date | null;
  confidence: number;
}

// 多来源提取时间戳
export async function extractTimestampEnhanced(
  url: string,
  content: string
): Promise<EnhancedTimestamp> {
  const timestamps: EnhancedTimestamp['timestamps'] = [];
  
  // 1. 从URL提取
  const urlDate = extractDateFromUrl(url);
  if (urlDate) {
    timestamps.push({
      source: 'url',
      value: urlDate,
      confidence: 70,
    });
  }
  
  // 2. 从内容提取
  const contentDates = extractDatesFromContent(content);
  for (const date of contentDates) {
    timestamps.push({
      source: 'content',
      value: date,
      confidence: 60,
    });
  }
  
  // 3. 从标题提取
  const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const titleDate = extractDateFromText(titleMatch[1]);
    if (titleDate) {
      timestamps.push({
        source: 'content',
        value: titleDate,
        confidence: 50,
      });
    }
  }
  
  // 4. 选择最佳估计
  let bestEstimate: Date | null = null;
  let bestConfidence = 0;
  
  for (const ts of timestamps) {
    // 优先选择最近的日期（假设是发布日期）
    if (ts.confidence > bestConfidence) {
      bestEstimate = ts.value;
      bestConfidence = ts.confidence;
    }
  }
  
  // 如果有多个时间戳，选择置信度最高的
  if (timestamps.length > 1) {
    // 按置信度排序
    timestamps.sort((a, b) => b.confidence - a.confidence);
    bestEstimate = timestamps[0].value;
    bestConfidence = timestamps[0].confidence;
  }
  
  return {
    url,
    timestamps,
    bestEstimate,
    confidence: bestConfidence,
  };
}

// 从URL提取日期
function extractDateFromUrl(url: string): Date | null {
  const patterns = [
    /(\d{4})\/(\d{2})\/(\d{2})/,
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{4})(\d{2})(\d{2})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
  }
  
  return null;
}

// 从内容提取多个日期
function extractDatesFromContent(content: string): Date[] {
  const dates: Date[] = [];
  
  const patterns = [
    /(\d{4})-(\d{2})-(\d{2})/g,
    /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
  ];
  
  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      try {
        const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        // 验证日期有效性
        if (date.getFullYear() >= 2000 && date.getFullYear() <= 2030) {
          dates.push(date);
        }
      } catch {}
    }
  }
  
  return dates;
}

// 从文本提取日期
function extractDateFromText(text: string): Date | null {
  const patterns = [
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
  }
  
  return null;
}
