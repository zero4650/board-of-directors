// 工作流引擎 - 整合所有能力层
import { ROLES, USER_PROFILE, RoleConfig } from './config';
import { callWithFallback, searchWithVerification, CallResult } from '../providers/api';
import {
  executeFullVerification,
  FullVerificationResult,
} from './verification';
import {
  analyzeGeoResources,
  anchorFinancialTarget,
  analyzeMultipleTopics,
  GeoAnalysisResult,
  FinancialAnchor,
  TopicAnalysisResult,
} from './intelligence';
import {
  loadUserMemory,
  saveUserMemory,
  loadSuccessCases,
  findSimilarCases,
  optimizePrompt,
  learnFromDecision,
  UserMemory,
  SuccessCase,
} from './learning';
import {
  executeFullValidation,
  FullValidationResult as ConstraintValidationResult,
} from './constraints';

// ==================== 增强的工作流状态 ====================

export interface EnhancedWorkflowState {
  id: string;
  userInput: string;
  mode: 'forward' | 'reverse' | 'mixed';
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentRole?: string;
  
  // 基础结果
  results: Record<string, RoleResult>;
  searchResults?: any;
  finalDecision?: string;
  report?: string;
  
  // 第2层：五重防火墙
  verification?: FullVerificationResult;
  
  // 第3层：智能分析
  geoAnalysis?: GeoAnalysisResult;
  financialAnchor?: FinancialAnchor;
  topicAnalysis?: TopicAnalysisResult;
  
  // 第4层：学习系统
  userMemory?: UserMemory;
  similarCases?: SuccessCase[];
  learningResult?: any;
  
  // 第5层：约束验证
  constraintValidation?: ConstraintValidationResult;
  
  // 元数据
  metadata: {
    totalLatency: number;
    modelCalls: number;
    fallbackCount: number;
    dataPointsVerified: number;
  };
}

export interface RoleResult {
  roleId: string;
  roleName: string;
  content: string;
  model: string;
  provider: string;
  latency: number;
  fallback: boolean;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export type ProgressCallback = (status: WorkflowStatus) => void;

export interface WorkflowStatus {
  state: EnhancedWorkflowState;
  currentRole?: string;
  currentStatus?: string;
  progress: number;
  layer?: string;
}

// ==================== 创建工作流 ====================

export function createEnhancedWorkflow(userInput: string): EnhancedWorkflowState {
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
    },
  };
}

// ==================== 执行单个角色 ====================

async function executeRole(
  role: RoleConfig,
  userMessage: string,
  context: Record<string, string>,
  memory: UserMemory,
  onProgress?: (status: string) => void
): Promise<RoleResult> {
  // 使用学习系统优化的Prompt
  const optimizedPrompt = optimizePrompt(role.id, role.systemPrompt, memory);
  
  // 构建完整消息
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
  
  return {
    roleId: role.id,
    roleName: role.name,
    content: result.content,
    model: result.model,
    provider: result.provider,
    latency: result.latency,
    fallback: result.fallback || false,
    success: result.success,
    error: result.error,
    timestamp: new Date(),
  };
}

// ==================== 获取角色配置 ====================

function getRole(roleId: string): RoleConfig | undefined {
  return ROLES.find(r => r.id === roleId);
}

// ==================== 第1步：加载学习系统 ====================

async function loadLearningSystem(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在加载用户记忆和案例库...',
    progress: 2,
    layer: '第4层：学习系统',
  });
  
  // 加载用户记忆
  state.userMemory = loadUserMemory();
  
  // 查找相似案例
  state.similarCases = findSimilarCases(state.userInput, 3);
  
  onProgress?.({
    state,
    currentStatus: `已加载用户记忆，找到${state.similarCases.length}个相似案例`,
    progress: 5,
    layer: '第4层：学习系统',
  });
}

// ==================== 第2步：多议题分析 ====================

async function analyzeTopics(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在分析输入议题...',
    progress: 8,
    layer: '第3层：智能分析',
  });
  
  state.topicAnalysis = analyzeMultipleTopics(state.userInput);
  
  if (state.topicAnalysis.hasMultipleTopics) {
    onProgress?.({
      state,
      currentStatus: `识别到${state.topicAnalysis.topics.length}个议题，将并行处理`,
      progress: 10,
      layer: '第3层：智能分析',
    });
  }
  
  // 设置模式
  if (state.topicAnalysis.hasMultipleTopics) {
    state.mode = 'mixed';
  } else {
    state.mode = state.topicAnalysis.topics[0]?.type || 'forward';
    if (state.mode === 'unknown') state.mode = 'forward';
  }
}

// ==================== 第3步：地理智能分析 ====================

async function analyzeGeo(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在进行地理智能分析...',
    progress: 12,
    layer: '第3层：智能分析',
  });
  
  state.geoAnalysis = analyzeGeoResources(state.userInput);
  
  onProgress?.({
    state,
    currentStatus: `地理分析完成：主基地${state.geoAnalysis.mainLocation.location}，协同可能${state.geoAnalysis.synergyAnalysis.possible ? '有' : '无'}`,
    progress: 15,
    layer: '第3层：智能分析',
  });
}

// ==================== 第4步：搜索验证 ====================

async function executeSearch(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在进行搜索验证...',
    progress: 18,
    layer: '第2层：五重防火墙',
  });
  
  state.searchResults = await searchWithVerification(state.userInput);
  
  onProgress?.({
    state,
    currentStatus: `搜索完成：Tavily ${state.searchResults.tavilyResults.length}条，Serper ${state.searchResults.serperResults.length}条`,
    progress: 20,
    layer: '第2层：五重防火墙',
  });
}

// ==================== 第5步：意图识别 ====================

async function executeIntentAnalysis(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const role = getRole('intent_analyst');
  if (!role) return;
  
  state.status = 'running';
  state.currentRole = 'intent_analyst';
  
  onProgress?.({
    state,
    currentRole: '战略入口分析师',
    currentStatus: '正在分析用户意图...',
    progress: 22,
    layer: '第1层：核心流程',
  });
  
  const context: Record<string, string> = {
    '用户档案': JSON.stringify(USER_PROFILE, null, 2),
    '相似案例': state.similarCases?.map(c => c.query).join('\n') || '',
  };
  
  const result = await executeRole(role, state.userInput, context, state.userMemory!);
  state.results['intent_analyst'] = result;
  state.metadata.modelCalls++;
  if (result.fallback) state.metadata.fallbackCount++;
  state.metadata.totalLatency += result.latency;
  
  onProgress?.({
    state,
    currentRole: '战略入口分析师',
    currentStatus: `意图识别完成：${state.mode === 'forward' ? '正推模式' : state.mode === 'reverse' ? '倒推模式' : '混合模式'}`,
    progress: 25,
    layer: '第1层：核心流程',
  });
}

// ==================== 第6步：执行角色分析 ====================

async function executeRoleAnalysis(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const context: Record<string, string> = {
    '用户档案': JSON.stringify(USER_PROFILE, null, 2),
    '搜索结果': state.searchResults ? JSON.stringify(state.searchResults.combined.slice(0, 3), null, 2) : '',
    '地理分析': JSON.stringify(state.geoAnalysis, null, 2),
    '相似案例': state.similarCases?.map(c => `问题：${c.query}\n决策：${c.analysis.decision}`).join('\n\n') || '',
  };
  
  // 根据模式选择角色顺序
  let roles: { id: string; name: string; progress: number }[];
  
  if (state.mode === 'forward') {
    roles = [
      { id: 'chief_researcher', name: '首席研究员', progress: 30 },
      { id: 'market_analyst', name: '宏观市场分析师', progress: 38 },
      { id: 'industry_analyst', name: '行业分析师', progress: 46 },
      { id: 'financial_analyst', name: '财务建模师', progress: 54 },
      { id: 'risk_assessor', name: '风险评估师', progress: 62 },
      { id: 'innovation_advisor', name: '创新顾问', progress: 68 },
      { id: 'execution_planner', name: '执行路径规划师', progress: 74 },
    ];
  } else {
    roles = [
      { id: 'market_analyst', name: '宏观市场分析师', progress: 30 },
      { id: 'industry_analyst', name: '行业分析师', progress: 38 },
      { id: 'chief_researcher', name: '首席研究员', progress: 46 },
      { id: 'financial_analyst', name: '财务建模师', progress: 54 },
      { id: 'risk_assessor', name: '风险评估师', progress: 62 },
      { id: 'innovation_advisor', name: '创新顾问', progress: 68 },
      { id: 'execution_planner', name: '执行路径规划师', progress: 74 },
    ];
  }
  
  for (const roleInfo of roles) {
    const role = getRole(roleInfo.id);
    if (!role) continue;
    
    state.currentRole = roleInfo.id;
    onProgress?.({
      state,
      currentRole: roleInfo.name,
      currentStatus: `正在执行 ${roleInfo.name}...`,
      progress: roleInfo.progress,
      layer: '第1层：核心流程',
    });
    
    // 添加前面角色的结果到上下文
    for (const [key, value] of Object.entries(state.results)) {
      if (value.success && key !== 'intent_analyst') {
        context[value.roleName] = value.content;
      }
    }
    
    const result = await executeRole(role, state.userInput, context, state.userMemory!);
    state.results[roleInfo.id] = result;
    state.metadata.modelCalls++;
    if (result.fallback) state.metadata.fallbackCount++;
    state.metadata.totalLatency += result.latency;
  }
}

// ==================== 第7步：五重防火墙验证 ====================

async function executeVerification(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在执行五重防火墙验证...',
    progress: 78,
    layer: '第2层：五重防火墙',
  });
  
  // 收集所有结果
  const allContent = Object.values(state.results)
    .filter(r => r.success)
    .map(r => r.content)
    .join('\n\n');
  
  const modelConfigs = ROLES.find(r => r.id === 'quality_verifier')?.models || [];
  
  state.verification = await executeFullVerification(
    allContent,
    {
      query: state.userInput,
      previousResults: Object.fromEntries(
        Object.entries(state.results).map(([k, v]) => [k, v.content])
      ),
      searchResults: state.searchResults,
    },
    modelConfigs
  );
  
  state.metadata.dataPointsVerified = state.verification.layer2.data.length;
  
  onProgress?.({
    state,
    currentStatus: `验证完成：${state.verification.overallStatus}，置信度${state.verification.overallConfidence}级`,
    progress: 82,
    layer: '第2层：五重防火墙',
  });
}

// ==================== 第8步：约束验证 ====================

async function executeConstraintValidation(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在执行约束验证...',
    progress: 85,
    layer: '第5层：约束保障',
  });
  
  // 从财务建模师结果中提取财务数据
  const financialContent = state.results['financial_analyst']?.content || '';
  
  // 简单提取数字（实际应用中需要更精确的解析）
  const investmentMatch = financialContent.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
  const roiMatch = financialContent.match(/(\d+)\s*个?月.*回本/);
  
  state.constraintValidation = executeFullValidation(
    state.userInput,
    {
      totalInvestment: (investmentMatch ? parseFloat(investmentMatch[1]) : 10) * 10000,
      monthlyReserve: 5000,
      roiMonths: roiMatch ? parseInt(roiMatch[1]) : 12,
      equipmentRatio: 0.5,
    },
    {
      canDo: state.results['decision_advisor']?.content || '',
      worthIt: '',
      howToDo: state.results['execution_planner']?.content || '',
    }
  );
  
  onProgress?.({
    state,
    currentStatus: `约束验证完成：${state.constraintValidation.summary}`,
    progress: 88,
    layer: '第5层：约束保障',
  });
}

// ==================== 第9步：质量验证和Copilot ====================

async function executeQualityAndCopilot(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  // 质量验证员
  const qualityRole = getRole('quality_verifier');
  if (qualityRole) {
    onProgress?.({
      state,
      currentRole: '质量验证员',
      currentStatus: '正在验证数据真实性...',
      progress: 90,
      layer: '第2层：五重防火墙',
    });
    
    const context: Record<string, string> = {
      '验证结果': JSON.stringify(state.verification, null, 2),
    };
    for (const [key, value] of Object.entries(state.results)) {
      if (value.success) {
        context[value.roleName] = value.content;
      }
    }
    
    const result = await executeRole(qualityRole, '请验证以上分析结果的数据真实性', context, state.userMemory!);
    state.results['quality_verifier'] = result;
    state.metadata.modelCalls++;
    state.metadata.totalLatency += result.latency;
  }
  
  // Copilot
  const copilotRole = getRole('copilot');
  if (copilotRole) {
    onProgress?.({
      state,
      currentRole: 'Copilot',
      currentStatus: '正在进行流程检查...',
      progress: 92,
      layer: '第1层：核心流程',
    });
    
    const context: Record<string, string> = {};
    for (const [key, value] of Object.entries(state.results)) {
      if (value.success) {
        context[value.roleName] = value.content;
      }
    }
    
    const result = await executeRole(copilotRole, '请检查以上分析流程的完整性和一致性', context, state.userMemory!);
    state.results['copilot'] = result;
    state.metadata.modelCalls++;
    state.metadata.totalLatency += result.latency;
  }
}

// ==================== 第10步：最终决策 ====================

async function executeFinalDecision(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const role = getRole('decision_advisor');
  if (!role) return;
  
  state.currentRole = 'decision_advisor';
  onProgress?.({
    state,
    currentRole: '决策顾问',
    currentStatus: '正在生成最终决策...',
    progress: 95,
    layer: '第1层：核心流程',
  });
  
  const context: Record<string, string> = {
    '用户档案': JSON.stringify(USER_PROFILE, null, 2),
    '验证结果': JSON.stringify(state.verification, null, 2),
    '约束验证': JSON.stringify(state.constraintValidation, null, 2),
    '地理分析': JSON.stringify(state.geoAnalysis, null, 2),
  };
  
  for (const [key, value] of Object.entries(state.results)) {
    if (value.success) {
      context[value.roleName] = value.content;
    }
  }
  
  const result = await executeRole(role, '请基于以上所有分析，给出最终的三维度决策结论', context, state.userMemory!);
  state.results['decision_advisor'] = result;
  state.metadata.modelCalls++;
  state.metadata.totalLatency += result.latency;
  
  if (result.success) {
    state.finalDecision = result.content;
  }
}

// ==================== 第11步：学习更新 ====================

async function updateLearning(
  state: EnhancedWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在更新学习系统...',
    progress: 98,
    layer: '第4层：学习系统',
  });
  
  // 记录本次决策
  state.learningResult = learnFromDecision(
    state.userInput,
    state.mode,
    Object.fromEntries(
      Object.entries(state.results).map(([k, v]) => [k, v.content])
    )
  );
}

// ==================== 生成报告 ====================

function generateEnhancedReport(state: EnhancedWorkflowState): string {
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
  report += `- 整体置信度：${state.verification?.overallConfidence || 'N/A'}级\n\n`;
  
  // 验证结果摘要
  if (state.verification) {
    report += `---\n\n`;
    report += `## 五重防火墙验证结果\n\n`;
    report += `- 第1层（预填充搜索）：${state.verification.layer1.status ? '✅ 通过' : '❌ 失败'}\n`;
    report += `- 第2层（三角验证）：${state.verification.layer2.status ? '✅ 通过' : '⚠️ 部分通过'}\n`;
    report += `- 第3层（双模型背对背）：${state.verification.layer3.status ? '✅ 通过' : '⚠️ 存在差异'}\n`;
    report += `- 第4层（实时纠偏）：${state.verification.layer4.status ? '✅ 通过' : '⚠️ 已修正'}\n`;
    report += `- 第5层（后验审计）：${state.verification.layer5.status ? '✅ 通过' : '❌ 失败'}\n`;
    report += `- **整体状态**：${state.verification.overallStatus}\n\n`;
  }
  
  // 约束验证结果
  if (state.constraintValidation) {
    report += `---\n\n`;
    report += `## 约束验证结果\n\n`;
    report += `${state.constraintValidation.summary}\n\n`;
    if (state.constraintValidation.violations.length > 0) {
      report += `### 违规项\n\n`;
      for (const v of state.constraintValidation.violations) {
        report += `- ${v.constraintName}：${v.message}\n`;
      }
      report += `\n`;
    }
  }
  
  report += `---\n\n`;
  
  // 各角色分析结果
  const roleOrder = [
    'intent_analyst',
    'market_analyst',
    'chief_researcher',
    'industry_analyst',
    'financial_analyst',
    'risk_assessor',
    'innovation_advisor',
    'execution_planner',
    'quality_verifier',
    'copilot',
    'decision_advisor',
  ];
  
  for (const roleId of roleOrder) {
    const result = state.results[roleId];
    if (result && result.success) {
      report += `## ${result.roleName}\n\n`;
      report += `> 模型：${result.model} | 平台：${result.provider} | 耗时：${result.latency}ms`;
      if (result.fallback) {
        report += ` | ⚠️ 使用备用平台`;
      }
      report += `\n\n`;
      report += `${result.content}\n\n`;
      report += `---\n\n`;
    }
  }
  
  return report;
}

// ==================== 执行完整工作流 ====================

export async function executeEnhancedWorkflow(
  userInput: string,
  onProgress?: ProgressCallback
): Promise<EnhancedWorkflowState> {
  const state = createEnhancedWorkflow(userInput);
  
  try {
    // 第1步：加载学习系统
    await loadLearningSystem(state, onProgress);
    
    // 第2步：多议题分析
    await analyzeTopics(state, onProgress);
    
    // 第3步：地理智能分析
    await analyzeGeo(state, onProgress);
    
    // 第4步：搜索验证
    await executeSearch(state, onProgress);
    
    // 第5步：意图识别
    await executeIntentAnalysis(state, onProgress);
    
    // 第6步：执行角色分析
    await executeRoleAnalysis(state, onProgress);
    
    // 第7步：五重防火墙验证
    await executeVerification(state, onProgress);
    
    // 第8步：约束验证
    await executeConstraintValidation(state, onProgress);
    
    // 第9步：质量验证和Copilot
    await executeQualityAndCopilot(state, onProgress);
    
    // 第10步：最终决策
    await executeFinalDecision(state, onProgress);
    
    // 第11步：学习更新
    await updateLearning(state, onProgress);
    
    // 生成报告
    state.report = generateEnhancedReport(state);
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
