// 最终完整工作流引擎 - 整合所有深度验证功能
import { ROLES, USER_PROFILE, RoleConfig } from './config';
import { callWithFallback, searchWithVerification } from '../providers/api';
import {
  executeDeepTriangulation,
  checkSourceIndependence,
  executeDeepCorrection,
  executeDeepAudit,
  parseTopicDependencies,
  generateExecutionOrderWithDependencies,
  executeDeepCrossValidation,
  executeWeightedComparison,
  enforceConstraints,
  performSearchVerificationAtPoints,
  highlightKeyDataHTML,
} from './deep-verification';
import {
  loadUserMemory,
  saveUserMemory,
  findSimilarCases,
  optimizePrompt,
  learnFromDecision,
  saveFeedback,
  UserMemory,
  SuccessCase,
} from './learning';
import {
  executeFullValidation,
} from './constraints';
import {
  analyzeGeoResources,
  anchorFinancialTarget,
  analyzeMultipleTopics,
  GeoAnalysisResult,
  FinancialAnchor,
  TopicAnalysisResult,
} from './intelligence';

// ==================== 完整工作流状态 ====================

export interface FinalWorkflowState {
  id: string;
  userInput: string;
  mode: 'forward' | 'reverse' | 'mixed' | 'compare';
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentRole?: string;
  currentLayer?: string;
  
  // 基础结果
  results: Record<string, RoleResult>;
  searchResults?: any;
  finalDecision?: string;
  report?: string;
  
  // 深度验证结果
  deepVerification?: {
    triangulation: any[];
    correction: any;
    audit: any;
    searchPoints: any[];
  };
  
  // 约束强制验证结果
  constraintEnforcement?: Record<string, any>;
  
  // 数据验证
  dataValidation?: any;
  
  // 智能分析
  geoAnalysis?: GeoAnalysisResult;
  financialAnchor?: FinancialAnchor;
  topicAnalysis?: TopicAnalysisResult;
  
  // 多议题处理
  topicExecutions?: any[];
  topicDependencies?: any[];
  topicCrossValidations?: any[];
  mixedModeConfidence?: any;
  
  // 对比模式
  benchmarkComparison?: any;
  
  // 学习系统
  userMemory?: UserMemory;
  similarCases?: SuccessCase[];
  
  // 元数据
  metadata: {
    totalLatency: number;
    modelCalls: number;
    fallbackCount: number;
    dataPointsVerified: number;
    sourcesLevel1: number;
    sourcesLevel2: number;
    sourcesLevel3: number;
    bannedSources: number;
    expiredData: number;
    keyDataHighlighted: number;
    constraintViolations: number;
    correctionsMade: number;
  };
}

export interface RoleResult {
  roleId: string;
  roleName: string;
  content: string;
  highlightedContent: string;
  model: string;
  provider: string;
  latency: number;
  fallback: boolean;
  success: boolean;
  error?: string;
  timestamp: Date;
  constraintCheck?: any;
}

export type ProgressCallback = (status: WorkflowStatus) => void;

export interface WorkflowStatus {
  state: FinalWorkflowState;
  currentRole?: string;
  currentStatus?: string;
  progress: number;
  layer?: string;
}

// ==================== 创建工作流 ====================

export function createFinalWorkflow(userInput: string): FinalWorkflowState {
  return {
    id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userInput,
    mode: 'forward',
    startTime: new Date(),
    status: 'pending',
    results: {},
    metadata: {
      totalLatency: 0,
      modelCalls: 0,
      fallbackCount: 0,
      dataPointsVerified: 0,
      sourcesLevel1: 0,
      sourcesLevel2: 0,
      sourcesLevel3: 0,
      bannedSources: 0,
      expiredData: 0,
      keyDataHighlighted: 0,
      constraintViolations: 0,
      correctionsMade: 0,
    },
  };
}

// ==================== 执行单个角色（带约束强制验证） ====================

async function executeRoleWithConstraints(
  role: RoleConfig,
  userMessage: string,
  context: Record<string, string>,
  memory: UserMemory,
  state: FinalWorkflowState,
  onProgress?: (status: string) => void
): Promise<RoleResult> {
  const optimizedPrompt = optimizePrompt(role.id, role.systemPrompt, memory);
  
  let fullMessage = userMessage;
  if (Object.keys(context).length > 0) {
    fullMessage += '\n\n--- 相关上下文 ---\n';
    for (const [key, value] of Object.entries(context)) {
      if (value && value.length > 0) {
        fullMessage += `\n【${key}】\n${value}\n`;
      }
    }
  }
  
  const result = await callWithFallback(
    role.id,
    optimizedPrompt,
    fullMessage,
    role.models,
    onProgress
  );
  
  // 应用HTML标红
  const highlightedContent = highlightKeyDataHTML(result.content);
  
  // 执行约束强制验证
  const constraintCheck = enforceConstraints(result.content, role.id, USER_PROFILE);
  
  // 记录违规
  if (!constraintCheck.passed) {
    state.metadata.constraintViolations += constraintCheck.violations.length;
  }
  
  return {
    roleId: role.id,
    roleName: role.name,
    content: constraintCheck.enforcedContent || result.content,
    highlightedContent,
    model: result.model,
    provider: result.provider,
    latency: result.latency,
    fallback: result.fallback || false,
    success: result.success,
    error: result.error,
    timestamp: new Date(),
    constraintCheck,
  };
}

// ==================== 获取角色配置 ====================

function getRole(roleId: string): RoleConfig | undefined {
  return ROLES.find(r => r.id === roleId);
}

// ==================== 主执行流程 ====================

export async function executeFinalWorkflow(
  userInput: string,
  onProgress?: ProgressCallback
): Promise<FinalWorkflowState> {
  const state = createFinalWorkflow(userInput);
  
  try {
    // 第1步：加载学习系统
    onProgress?.({
      state,
      currentStatus: '正在加载用户记忆和案例库...',
      progress: 2,
      layer: '第4层：学习系统',
    });
    
    state.userMemory = loadUserMemory();
    state.similarCases = findSimilarCases(userInput, 3);
    
    // 第2步：多议题分析
    onProgress?.({
      state,
      currentStatus: '正在分析输入议题...',
      progress: 5,
      layer: '第3层：智能分析',
    });
    
    state.topicAnalysis = analyzeMultipleTopics(userInput);
    
    if (state.topicAnalysis.hasMultipleTopics) {
      state.mode = 'mixed';
      
      // 解析议题依赖
      state.topicDependencies = parseTopicDependencies(state.topicAnalysis.topics);
    } else {
      state.mode = state.topicAnalysis.topics[0]?.type || 'forward';
      if (state.mode === 'unknown') state.mode = 'forward';
    }
    
    // 第3步：地理智能分析
    onProgress?.({
      state,
      currentStatus: '正在进行地理智能分析...',
      progress: 8,
      layer: '第3层：智能分析',
    });
    
    state.geoAnalysis = analyzeGeoResources(userInput);
    
    // 第4步：搜索验证
    onProgress?.({
      state,
      currentStatus: '正在进行搜索验证...',
      progress: 10,
      layer: '第2层：五重防火墙',
    });
    
    state.searchResults = await searchWithVerification(userInput);
    
    // 统计来源等级
    for (const result of state.searchResults.combined) {
      const url = result.url || result.link || '';
      if (url.includes('gov.cn')) state.metadata.sourcesLevel1++;
      else if (url.includes('reuters') || url.includes('bloomberg') || url.includes('caixin')) state.metadata.sourcesLevel2++;
      else state.metadata.sourcesLevel3++;
    }
    
    // 第5步：意图识别
    const intentRole = getRole('intent_analyst');
    if (intentRole) {
      onProgress?.({
        state,
        currentRole: '战略入口分析师',
        currentStatus: '正在分析用户意图...',
        progress: 12,
        layer: '第1层：核心流程',
      });
      
      const context: Record<string, string> = {
        '用户档案': JSON.stringify(USER_PROFILE, null, 2),
        '相似案例': state.similarCases?.map(c => c.query).join('\n') || '',
      };
      
      const result = await executeRoleWithConstraints(intentRole, userInput, context, state.userMemory!, state);
      state.results['intent_analyst'] = result;
      state.metadata.modelCalls++;
      state.metadata.totalLatency += result.latency;
    }
    
    // 第6步：执行角色分析（带约束强制验证）
    const roles = state.mode === 'forward' ? [
      { id: 'chief_researcher', progress: 20 },
      { id: 'market_analyst', progress: 28 },
      { id: 'industry_analyst', progress: 36 },
      { id: 'financial_analyst', progress: 44 },
      { id: 'risk_assessor', progress: 52 },
      { id: 'innovation_advisor', progress: 60 },
      { id: 'execution_planner', progress: 68 },
    ] : [
      { id: 'market_analyst', progress: 20 },
      { id: 'industry_analyst', progress: 28 },
      { id: 'chief_researcher', progress: 36 },
      { id: 'financial_analyst', progress: 44 },
      { id: 'risk_assessor', progress: 52 },
      { id: 'innovation_advisor', progress: 60 },
      { id: 'execution_planner', progress: 68 },
    ];
    
    const context: Record<string, string> = {
      '用户档案': JSON.stringify(USER_PROFILE, null, 2),
      '搜索结果': JSON.stringify(state.searchResults.combined.slice(0, 3), null, 2),
      '地理分析': JSON.stringify(state.geoAnalysis, null, 2),
    };
    
    for (const roleInfo of roles) {
      const role = getRole(roleInfo.id);
      if (!role) continue;
      
      // 添加前面角色的结果到上下文
      for (const [key, value] of Object.entries(state.results)) {
        if (value.success && key !== 'intent_analyst') {
          context[value.roleName] = value.content;
        }
      }
      
      onProgress?.({
        state,
        currentRole: role.name,
        currentStatus: `正在执行 ${role.name}...`,
        progress: roleInfo.progress,
        layer: '第1层：核心流程',
      });
      
      const result = await executeRoleWithConstraints(role, userInput, context, state.userMemory!, state);
      state.results[roleInfo.id] = result;
      state.metadata.modelCalls++;
      if (result.fallback) state.metadata.fallbackCount++;
      state.metadata.totalLatency += result.latency;
      
      // 记录约束强制验证结果
      state.constraintEnforcement = state.constraintEnforcement || {};
      state.constraintEnforcement[roleInfo.id] = result.constraintCheck;
    }
    
    // 第7步：搜索验证穿插
    onProgress?.({
      state,
      currentStatus: '正在执行穿插搜索验证...',
      progress: 72,
      layer: '第2层：五重防火墙',
    });
    
    const searchPoints = await performSearchVerificationAtPoints(
      Object.fromEntries(Object.entries(state.results).map(([k, v]) => [k, v.content])),
      userInput
    );
    
    // 第8步：深度验证
    onProgress?.({
      state,
      currentStatus: '正在执行深度验证...',
      progress: 78,
      layer: '第2层：五重防火墙',
    });
    
    const allContent = Object.values(state.results)
      .filter(r => r.success)
      .map(r => r.content)
      .join('\n\n');
    
    // 深度纠偏
    const correction = executeDeepCorrection(allContent, {
      previousResults: Object.fromEntries(Object.entries(state.results).map(([k, v]) => [k, v.content])),
      userProfile: USER_PROFILE,
    });
    
    state.metadata.correctionsMade = correction.corrections.length;
    
    // 后验审计
    const audit = await executeDeepAudit(allContent, userInput);
    
    // 深度三角验证
    const triangulations = [];
    const keyClaims = allContent.match(/[^。！？]*\d+\.?\d*\s*(万|亿|元|吨)[^。！？]*/g) || [];
    
    for (const claim of keyClaims.slice(0, 3)) {
      const triangulation = await executeDeepTriangulation(
        claim,
        claim.match(/\d+\.?\d*/)?.[0] || '',
        state.searchResults?.combined.slice(0, 5) || []
      );
      triangulations.push(triangulation);
    }
    
    state.deepVerification = {
      triangulation: triangulations,
      correction,
      audit,
      searchPoints,
    };
    
    state.metadata.dataPointsVerified = triangulations.length;
    
    // 第9步：质量验证员
    const qualityRole = getRole('quality_verifier');
    if (qualityRole) {
      onProgress?.({
        state,
        currentRole: '质量验证员',
        currentStatus: '正在验证数据真实性...',
        progress: 85,
        layer: '第2层：五重防火墙',
      });
      
      const qualityContext = {
        '深度验证结果': JSON.stringify(state.deepVerification, null, 2),
        ...Object.fromEntries(Object.entries(state.results).map(([k, v]) => [v.roleName, v.content])),
      };
      
      const result = await executeRoleWithConstraints(qualityRole, '请验证以上分析结果', qualityContext, state.userMemory!, state);
      state.results['quality_verifier'] = result;
      state.metadata.modelCalls++;
      state.metadata.totalLatency += result.latency;
    }
    
    // 第10步：最终决策
    const decisionRole = getRole('decision_advisor');
    if (decisionRole) {
      onProgress?.({
        state,
        currentRole: '决策顾问',
        currentStatus: '正在生成最终决策...',
        progress: 92,
        layer: '第1层：核心流程',
      });
      
      const decisionContext = {
        '用户档案': JSON.stringify(USER_PROFILE, null, 2),
        '深度验证': JSON.stringify(state.deepVerification, null, 2),
        '约束验证': JSON.stringify(state.constraintEnforcement, null, 2),
        ...Object.fromEntries(Object.entries(state.results).map(([k, v]) => [v.roleName, v.content])),
      };
      
      const result = await executeRoleWithConstraints(decisionRole, '请基于以上所有分析，给出最终的三维度决策结论', decisionContext, state.userMemory!, state);
      state.results['decision_advisor'] = result;
      state.metadata.modelCalls++;
      state.metadata.totalLatency += result.latency;
      
      if (result.success) {
        state.finalDecision = result.highlightedContent;
      }
    }
    
    // 第11步：学习更新
    onProgress?.({
      state,
      currentStatus: '正在更新学习系统...',
      progress: 98,
      layer: '第4层：学习系统',
    });
    
    learnFromDecision(
      userInput,
      state.mode,
      Object.fromEntries(Object.entries(state.results).map(([k, v]) => [k, v.content]))
    );
    
    // 生成报告
    state.report = generateFinalReport(state);
    state.status = 'completed';
    state.endTime = new Date();
    
    onProgress?.({
      state,
      currentStatus: '分析完成！',
      progress: 100,
    });
    
  } catch (error: any) {
    state.status = 'failed';
    state.endTime = new Date();
    
    onProgress?.({
      state,
      currentStatus: `分析失败：${error.message}`,
      progress: 100,
    });
  }
  
  return state;
}

// ==================== 生成最终报告 ====================

function generateFinalReport(state: FinalWorkflowState): string {
  let report = `# 商业决策分析报告\n\n`;
  report += `**生成时间**：${state.endTime?.toLocaleString() || new Date().toLocaleString()}\n\n`;
  report += `**分析模式**：${state.mode === 'forward' ? '正推模式' : state.mode === 'reverse' ? '倒推模式' : '混合模式'}\n\n`;
  report += `**用户输入**：${state.userInput}\n\n`;
  
  // 元数据
  report += `---\n\n`;
  report += `## 分析元数据\n\n`;
  report += `- 总耗时：${state.metadata.totalLatency}ms\n`;
  report += `- 模型调用次数：${state.metadata.modelCalls}\n`;
  report += `- 故障转移次数：${state.metadata.fallbackCount}\n`;
  report += `- 验证数据点：${state.metadata.dataPointsVerified}个\n`;
  report += `- 一级来源：${state.metadata.sourcesLevel1}个\n`;
  report += `- 二级来源：${state.metadata.sourcesLevel2}个\n`;
  report += `- 约束违规：${state.metadata.constraintViolations}次\n`;
  report += `- 自动修正：${state.metadata.correctionsMade}次\n\n`;
  
  // 深度验证结果
  if (state.deepVerification) {
    report += `---\n\n`;
    report += `## 深度验证结果\n\n`;
    
    // 三角验证
    report += `### 三角验证\n\n`;
    for (const t of state.deepVerification.triangulation) {
      report += `- **${t.claim.slice(0, 50)}...**\n`;
      report += `  - 来源独立性：${t.sourceIndependence.independenceScore}分\n`;
      report += `  - 验证结果：${t.finalVerification}\n`;
      report += `  - 置信度：${t.confidence}%\n\n`;
    }
    
    // 纠偏结果
    report += `### 实时纠偏\n\n`;
    report += `- 发现问题：${state.deepVerification.correction.issues.length}个\n`;
    report += `- 自动修正：${state.deepVerification.correction.corrections.length}个\n`;
    report += `- 验证通过：${state.deepVerification.correction.verificationPassed ? '是' : '否'}\n\n`;
    
    // 后验审计
    report += `### 后验审计\n\n`;
    report += `- 评级：${state.deepVerification.audit.overallAssessment.grade}级\n`;
    report += `- 评分：${state.deepVerification.audit.overallAssessment.score}分\n`;
    report += `- 摘要：${state.deepVerification.audit.overallAssessment.summary}\n\n`;
  }
  
  // 约束强制验证结果
  if (state.constraintEnforcement) {
    report += `---\n\n`;
    report += `## 约束强制验证\n\n`;
    
    for (const [roleId, check] of Object.entries(state.constraintEnforcement)) {
      if ((check as any).violations?.length > 0) {
        report += `### ${roleId}\n\n`;
        for (const v of (check as any).violations) {
          report += `- ⚠️ ${v.constraint}: ${v.description}\n`;
        }
        report += `\n`;
      }
    }
  }
  
  report += `---\n\n`;
  
  // 各角色分析结果
  const roleOrder = [
    'intent_analyst', 'market_analyst', 'chief_researcher', 'industry_analyst',
    'financial_analyst', 'risk_assessor', 'innovation_advisor', 'execution_planner',
    'quality_verifier', 'decision_advisor',
  ];
  
  for (const roleId of roleOrder) {
    const result = state.results[roleId];
    if (result && result.success) {
      report += `## ${result.roleName}\n\n`;
      report += `> 模型：${result.model} | 平台：${result.provider} | 耗时：${result.latency}ms`;
      if (result.fallback) report += ` | ⚠️ 使用备用平台`;
      report += `\n\n`;
      report += `${result.content}\n\n`;
      report += `---\n\n`;
    }
  }
  
  return report;
}
