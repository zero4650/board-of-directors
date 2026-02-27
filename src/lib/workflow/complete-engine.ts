// 完整工作流引擎 - 整合所有能力
import { ROLES, USER_PROFILE, RoleConfig } from './config';
import { callWithFallback, searchWithVerification, CallResult } from '../providers/api';
import {
  executeFullDataValidation,
  FullDataValidationResult,
  applyHighlighting,
  createDataTrace,
  createInnovationProposal,
  InnovationProposal,
} from './data-validation';
import {
  executeTopicsInParallel,
  crossValidateAllTopics,
  calculateMixedModeConfidence,
  executeBenchmarkComparison,
  executeDeepTriangulation,
  executeDualModelValidation,
  MixedModeConfidence,
  BenchmarkComparison,
  DeepTriangulation,
  DualModelValidation,
  TopicExecutionContext,
  CrossValidationBetweenTopics,
} from './advanced-features';
import {
  loadUserMemory,
  saveUserMemory,
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
import {
  analyzeGeoResources,
  anchorFinancialTarget,
  analyzeMultipleTopics,
  GeoAnalysisResult,
  FinancialAnchor,
  TopicAnalysisResult,
} from './intelligence';

// ==================== 完整工作流状态 ====================

export interface CompleteWorkflowState {
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
  
  // 第2层：五重防火墙（增强版）
  verification?: {
    layer1: { status: boolean };
    layer2: DeepTriangulation[];
    layer3: DualModelValidation[];
    layer4: { status: boolean; corrections: string[] };
    layer5: { status: boolean; auditResults: string[] };
    overallStatus: 'passed' | 'warning' | 'failed';
    overallConfidence: 'A' | 'B' | 'C';
  };
  
  // 数据验证（新增）
  dataValidation?: FullDataValidationResult;
  
  // 第3层：智能分析
  geoAnalysis?: GeoAnalysisResult;
  financialAnchor?: FinancialAnchor;
  topicAnalysis?: TopicAnalysisResult;
  
  // 多议题处理（新增）
  topicExecutions?: TopicExecutionContext[];
  topicCrossValidations?: CrossValidationBetweenTopics[];
  mixedModeConfidence?: MixedModeConfidence;
  
  // 对比模式（新增）
  benchmarkComparison?: BenchmarkComparison;
  
  // 创新提案（新增）
  innovationProposals?: InnovationProposal[];
  
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
    sourcesLevel1: number;
    sourcesLevel2: number;
    sourcesLevel3: number;
    bannedSources: number;
    expiredData: number;
    keyDataHighlighted: number;
  };
}

export interface RoleResult {
  roleId: string;
  roleName: string;
  content: string;
  highlightedContent?: string; // 标红后的内容
  model: string;
  provider: string;
  latency: number;
  fallback: boolean;
  success: boolean;
  error?: string;
  timestamp: Date;
  dataTraces?: any[]; // 数据溯源
}

export type ProgressCallback = (status: WorkflowStatus) => void;

export interface WorkflowStatus {
  state: CompleteWorkflowState;
  currentRole?: string;
  currentStatus?: string;
  progress: number;
  layer?: string;
}

// ==================== 创建工作流 ====================

export function createCompleteWorkflow(userInput: string): CompleteWorkflowState {
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
  
  // 应用标红
  const highlightedContent = applyHighlighting(result.content);
  
  return {
    roleId: role.id,
    roleName: role.name,
    content: result.content,
    highlightedContent,
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
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在加载用户记忆和案例库...',
    progress: 2,
    layer: '第4层：学习系统',
  });
  
  state.userMemory = loadUserMemory();
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
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在分析输入议题...',
    progress: 7,
    layer: '第3层：智能分析',
  });
  
  state.topicAnalysis = analyzeMultipleTopics(state.userInput);
  
  if (state.topicAnalysis.hasMultipleTopics) {
    state.mode = 'mixed';
    onProgress?.({
      state,
      currentStatus: `识别到${state.topicAnalysis.topics.length}个议题，将并行处理`,
      progress: 10,
      layer: '第3层：智能分析',
    });
  } else {
    state.mode = state.topicAnalysis.topics[0]?.type || 'forward';
    if (state.mode === 'unknown') state.mode = 'forward';
    if (state.mode === 'compare') state.mode = 'compare';
  }
}

// ==================== 第3步：地理智能分析 ====================

async function analyzeGeo(
  state: CompleteWorkflowState,
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
    currentStatus: `地理分析完成：主基地${state.geoAnalysis.mainLocation.location}`,
    progress: 15,
    layer: '第3层：智能分析',
  });
}

// ==================== 第4步：搜索验证（带来源分级） ====================

async function executeSearch(
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在进行搜索验证...',
    progress: 17,
    layer: '第2层：五重防火墙',
  });
  
  state.searchResults = await searchWithVerification(state.userInput);
  
  // 统计来源等级
  for (const result of state.searchResults.combined) {
    const url = result.url || result.link || '';
    if (url.includes('gov.cn')) {
      state.metadata.sourcesLevel1++;
    } else if (url.includes('reuters') || url.includes('bloomberg') || url.includes('caixin')) {
      state.metadata.sourcesLevel2++;
    } else {
      state.metadata.sourcesLevel3++;
    }
  }
  
  onProgress?.({
    state,
    currentStatus: `搜索完成：一级${state.metadata.sourcesLevel1}个，二级${state.metadata.sourcesLevel2}个`,
    progress: 20,
    layer: '第2层：五重防火墙',
  });
}

// ==================== 第5步：意图识别 ====================

async function executeIntentAnalysis(
  state: CompleteWorkflowState,
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
    currentStatus: `意图识别完成：${state.mode === 'forward' ? '正推模式' : state.mode === 'reverse' ? '倒推模式' : state.mode === 'mixed' ? '混合模式' : '对比模式'}`,
    progress: 25,
    layer: '第1层：核心流程',
  });
}

// ==================== 第6步：多议题并行处理（如果是混合模式） ====================

async function executeParallelTopics(
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  if (state.mode !== 'mixed' || !state.topicAnalysis?.hasMultipleTopics) return;
  
  onProgress?.({
    state,
    currentStatus: '正在并行处理多个议题...',
    progress: 28,
    layer: '第3层：智能分析',
  });
  
  const topics = state.topicAnalysis.topics.map(t => ({
    id: t.id,
    content: t.content,
    type: t.type === 'unknown' ? 'forward' as const : t.type,
  }));
  
  state.topicExecutions = await executeTopicsInParallel(topics, (topicId, status) => {
    onProgress?.({
      state,
      currentStatus: `议题${topicId}: ${status}`,
      progress: 28 + topicId * 5,
      layer: '第3层：智能分析',
    });
  });
  
  // 交叉验证
  state.topicCrossValidations = await crossValidateAllTopics(state.topicExecutions);
  
  // 计算混合模式置信度
  const forwardResults = state.topicExecutions.find(t => t.topicType === 'forward')?.results || {};
  const reverseResults = state.topicExecutions.find(t => t.topicType === 'reverse')?.results || {};
  
  state.mixedModeConfidence = calculateMixedModeConfidence(
    forwardResults,
    reverseResults,
    state.topicCrossValidations
  );
  
  onProgress?.({
    state,
    currentStatus: `多议题处理完成，置信度${state.mixedModeConfidence.overallScore.toFixed(0)}%`,
    progress: 45,
    layer: '第3层：智能分析',
  });
}

// ==================== 第7步：执行角色分析 ====================

async function executeRoleAnalysis(
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  // 如果已经并行处理了议题，跳过
  if (state.mode === 'mixed' && state.topicExecutions) return;
  
  const context: Record<string, string> = {
    '用户档案': JSON.stringify(USER_PROFILE, null, 2),
    '搜索结果': state.searchResults ? JSON.stringify(state.searchResults.combined.slice(0, 3), null, 2) : '',
    '地理分析': JSON.stringify(state.geoAnalysis, null, 2),
    '相似案例': state.similarCases?.map(c => `问题：${c.query}\n决策：${c.analysis.decision}`).join('\n\n') || '',
  };
  
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
  } else if (state.mode === 'reverse') {
    roles = [
      { id: 'market_analyst', name: '宏观市场分析师', progress: 30 },
      { id: 'industry_analyst', name: '行业分析师', progress: 38 },
      { id: 'chief_researcher', name: '首席研究员', progress: 46 },
      { id: 'financial_analyst', name: '财务建模师', progress: 54 },
      { id: 'risk_assessor', name: '风险评估师', progress: 62 },
      { id: 'innovation_advisor', name: '创新顾问', progress: 68 },
      { id: 'execution_planner', name: '执行路径规划师', progress: 74 },
    ];
  } else {
    // 对比模式
    roles = [
      { id: 'chief_researcher', name: '首席研究员', progress: 30 },
      { id: 'financial_analyst', name: '财务建模师', progress: 50 },
      { id: 'risk_assessor', name: '风险评估师', progress: 65 },
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

// ==================== 第8步：深度验证 ====================

async function executeDeepVerification(
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
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
  
  // 执行完整数据验证
  state.dataValidation = await executeFullDataValidation(
    allContent,
    state.searchResults?.combined || []
  );
  
  // 更新元数据
  state.metadata.bannedSources = state.dataValidation.sourceAnalysis.banned;
  state.metadata.expiredData = state.dataValidation.timeValidity.expired;
  state.metadata.keyDataHighlighted = state.dataValidation.keyDataCount;
  
  // 深度三角验证
  const deepTriangulations: DeepTriangulation[] = [];
  for (const trace of state.dataValidation.dataTraces.slice(0, 5)) {
    const triangulation = await executeDeepTriangulation(
      trace.claim,
      state.searchResults?.combined.slice(0, 3) || []
    );
    deepTriangulations.push(triangulation);
  }
  
  // 双模型背对背验证（对关键结论）
  const dualValidations: DualModelValidation[] = [];
  const keyConclusions = extractKeyConclusions(allContent);
  
  for (const conclusion of keyConclusions.slice(0, 2)) {
    // 使用两个不同的模型配置
    const model1 = ROLES.find(r => r.id === 'quality_verifier')?.models[0];
    const model2 = ROLES.find(r => r.id === 'quality_verifier')?.models[1];
    
    if (model1 && model2) {
      const validation = await executeDualModelValidation(
        conclusion,
        allContent,
        { provider: model1.provider, model: model1.model, apiKey: process.env[`${model1.provider.toUpperCase()}_API_KEY`] || '', baseUrl: model1.baseUrl },
        { provider: model2.provider, model: model2.model, apiKey: process.env[`${model2.provider.toUpperCase()}_API_KEY`] || '', baseUrl: model2.baseUrl }
      );
      dualValidations.push(validation);
    }
  }
  
  // 构建验证结果
  state.verification = {
    layer1: { status: !!state.searchResults },
    layer2: deepTriangulations,
    layer3: dualValidations,
    layer4: { 
      status: state.dataValidation.warnings.length === 0,
      corrections: state.dataValidation.warnings,
    },
    layer5: {
      status: state.dataValidation.overallGrade !== 'C',
      auditResults: state.dataValidation.dataTraces.map(t => t.claim),
    },
    overallStatus: state.dataValidation.overallScore >= 80 ? 'passed' : 
                   state.dataValidation.overallScore >= 60 ? 'warning' : 'failed',
    overallConfidence: state.dataValidation.overallGrade,
  };
  
  state.metadata.dataPointsVerified = state.dataValidation.dataTraces.length;
  
  onProgress?.({
    state,
    currentStatus: `深度验证完成：${state.verification.overallStatus}，置信度${state.verification.overallConfidence}级`,
    progress: 85,
    layer: '第2层：五重防火墙',
  });
}

// 提取关键结论
function extractKeyConclusions(content: string): string[] {
  const conclusions: string[] = [];
  const patterns = content.matchAll(/(结论|建议|推荐|判断)[：:]\s*([^。\n]+)/g);
  for (const match of patterns) {
    conclusions.push(match[0]);
  }
  return conclusions;
}

// ==================== 第9步：创新提案验证 ====================

async function executeInnovationValidation(
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const innovationContent = state.results['innovation_advisor']?.content || '';
  if (!innovationContent) return;
  
  onProgress?.({
    state,
    currentStatus: '正在验证创新提案...',
    progress: 88,
    layer: '第5层：约束保障',
  });
  
  // 提取创新提案
  const proposals: InnovationProposal[] = [];
  const innovationMatches = innovationContent.matchAll(/\[创新等级:\s*(渐进|突破|颠覆)\][^\n]*/g);
  
  for (const match of innovationMatches) {
    const level = match[1] as '渐进' | '突破' | '颠覆';
    const title = match[0];
    
    const proposal = await createInnovationProposal(title, innovationContent, level);
    proposals.push(proposal);
  }
  
  state.innovationProposals = proposals;
  
  onProgress?.({
    state,
    currentStatus: `创新提案验证完成：${proposals.length}个`,
    progress: 90,
    layer: '第5层：约束保障',
  });
}

// ==================== 第10步：约束验证 ====================

async function executeConstraintValidation(
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在执行约束验证...',
    progress: 92,
    layer: '第5层：约束保障',
  });
  
  const financialContent = state.results['financial_analyst']?.content || '';
  
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
    progress: 94,
    layer: '第5层：约束保障',
  });
}

// ==================== 第11步：最终决策 ====================

async function executeFinalDecision(
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const role = getRole('decision_advisor');
  if (!role) return;
  
  state.currentRole = 'decision_advisor';
  onProgress?.({
    state,
    currentRole: '决策顾问',
    currentStatus: '正在生成最终决策...',
    progress: 96,
    layer: '第1层：核心流程',
  });
  
  const context: Record<string, string> = {
    '用户档案': JSON.stringify(USER_PROFILE, null, 2),
    '验证结果': JSON.stringify(state.verification, null, 2),
    '约束验证': JSON.stringify(state.constraintValidation, null, 2),
    '地理分析': JSON.stringify(state.geoAnalysis, null, 2),
    '数据验证': JSON.stringify(state.dataValidation, null, 2),
  };
  
  // 添加混合模式置信度
  if (state.mixedModeConfidence) {
    context['混合模式置信度'] = JSON.stringify(state.mixedModeConfidence, null, 2);
  }
  
  // 添加议题交叉验证
  if (state.topicCrossValidations && state.topicCrossValidations.length > 0) {
    context['议题交叉验证'] = JSON.stringify(state.topicCrossValidations, null, 2);
  }
  
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
    state.finalDecision = result.highlightedContent || result.content;
  }
}

// ==================== 第12步：学习更新 ====================

async function updateLearning(
  state: CompleteWorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在更新学习系统...',
    progress: 98,
    layer: '第4层：学习系统',
  });
  
  state.learningResult = learnFromDecision(
    state.userInput,
    state.mode,
    Object.fromEntries(
      Object.entries(state.results).map(([k, v]) => [k, v.content])
    )
  );
}

// ==================== 生成完整报告 ====================

function generateCompleteReport(state: CompleteWorkflowState): string {
  let report = `# 商业决策分析报告\n\n`;
  report += `**生成时间**：${state.endTime?.toLocaleString() || new Date().toLocaleString()}\n\n`;
  report += `**分析模式**：${state.mode === 'forward' ? '正推模式' : state.mode === 'reverse' ? '倒推模式' : state.mode === 'mixed' ? '混合模式' : '对比模式'}\n\n`;
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
  report += `- 过期数据：${state.metadata.expiredData}个\n`;
  report += `- 关键数据标红：${state.metadata.keyDataHighlighted}处\n\n`;
  
  // 五重防火墙验证结果
  if (state.verification) {
    report += `---\n\n`;
    report += `## 五重防火墙验证结果\n\n`;
    report += `- 第1层（预填充搜索）：${state.verification.layer1.status ? '✅ 通过' : '❌ 失败'}\n`;
    report += `- 第2层（三角验证）：${state.verification.layer2.filter(t => t.finalVerification === 'verified').length}/${state.verification.layer2.length} 通过\n`;
    report += `- 第3层（双模型背对背）：${state.verification.layer3.filter(v => v.agreement).length}/${state.verification.layer3.length} 一致\n`;
    report += `- 第4层（实时纠偏）：${state.verification.layer4.status ? '✅ 通过' : '⚠️ 已修正'}\n`;
    report += `- 第5层（后验审计）：${state.verification.layer5.status ? '✅ 通过' : '❌ 失败'}\n`;
    report += `- **整体状态**：${state.verification.overallStatus}\n`;
    report += `- **置信度**：${state.verification.overallConfidence}级\n\n`;
  }
  
  // 数据验证结果
  if (state.dataValidation) {
    report += `---\n\n`;
    report += `## 数据验证结果\n\n`;
    report += `- 整体评分：${state.dataValidation.overallScore}分\n`;
    report += `- 整体等级：${state.dataValidation.overallGrade}级\n`;
    report += `- 来源分析：一级${state.dataValidation.sourceAnalysis.level1}个，二级${state.dataValidation.sourceAnalysis.level2}个\n`;
    report += `- 时效检查：有效${state.dataValidation.timeValidity.valid}个，过期${state.dataValidation.timeValidity.expired}个\n`;
    
    if (state.dataValidation.warnings.length > 0) {
      report += `\n### 警告\n\n`;
      for (const w of state.dataValidation.warnings) {
        report += `- ⚠️ ${w}\n`;
      }
    }
    report += `\n`;
  }
  
  // 混合模式置信度
  if (state.mixedModeConfidence) {
    report += `---\n\n`;
    report += `## 混合模式置信度\n\n`;
    report += `- 整体置信度：${state.mixedModeConfidence.overallConfidence}级（${state.mixedModeConfidence.overallScore}分）\n`;
    report += `- 正推路径：${state.mixedModeConfidence.forwardPath.confidence}级\n`;
    report += `- 倒推路径：${state.mixedModeConfidence.reversePath.confidence}级\n`;
    report += `- 最终建议：${state.mixedModeConfidence.finalRecommendation}\n\n`;
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
  
  // 创新提案
  if (state.innovationProposals && state.innovationProposals.length > 0) {
    report += `---\n\n`;
    report += `## 创新提案验证\n\n`;
    for (const p of state.innovationProposals) {
      report += `### ${p.title}\n\n`;
      report += `- 创新等级：${p.level}\n`;
      report += `- 可行性：${p.feasibility}%\n`;
      if (p.patentCheck) {
        report += `- 专利风险：${p.patentCheck.risk}（相似专利${p.patentCheck.similarPatents.length}个）\n`;
      }
      report += `- 建议：${p.recommendation}\n\n`;
    }
  }
  
  report += `---\n\n`;
  
  // 各角色分析结果（带标红）
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
      // 使用标红后的内容
      report += `${result.highlightedContent || result.content}\n\n`;
      report += `---\n\n`;
    }
  }
  
  return report;
}

// ==================== 执行完整工作流 ====================

export async function executeCompleteWorkflow(
  userInput: string,
  onProgress?: ProgressCallback
): Promise<CompleteWorkflowState> {
  const state = createCompleteWorkflow(userInput);
  
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
    
    // 第6步：多议题并行处理（如果是混合模式）
    await executeParallelTopics(state, onProgress);
    
    // 第7步：执行角色分析
    await executeRoleAnalysis(state, onProgress);
    
    // 第8步：深度验证
    await executeDeepVerification(state, onProgress);
    
    // 第9步：创新提案验证
    await executeInnovationValidation(state, onProgress);
    
    // 第10步：约束验证
    await executeConstraintValidation(state, onProgress);
    
    // 第11步：最终决策
    await executeFinalDecision(state, onProgress);
    
    // 第12步：学习更新
    await updateLearning(state, onProgress);
    
    // 生成报告
    state.report = generateCompleteReport(state);
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
