// 商业决策助手 - 工作流核心逻辑
import { ROLES, USER_PROFILE, RoleConfig } from './config';
import { callWithFallback, searchWithVerification, CallResult } from '../providers/api';

// 工作流状态
export interface WorkflowState {
  id: string;
  userInput: string;
  mode: 'forward' | 'reverse' | 'mixed';
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentRole?: string;
  results: Record<string, RoleResult>;
  searchResults?: any;
  finalDecision?: string;
  report?: string;
}

// 角色执行结果
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

// 进度回调
export type ProgressCallback = (status: WorkflowStatus) => void;

export interface WorkflowStatus {
  state: WorkflowState;
  currentRole?: string;
  currentStatus?: string;
  progress: number;
}

// 创建工作流
export function createWorkflow(userInput: string): WorkflowState {
  return {
    id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userInput,
    mode: 'forward',
    startTime: new Date(),
    status: 'pending',
    results: {},
  };
}

// 执行单个角色
async function executeRole(
  role: RoleConfig,
  userMessage: string,
  context: Record<string, string>,
  onProgress?: (status: string) => void
): Promise<RoleResult> {
  // 构建完整的用户消息（包含上下文）
  let fullMessage = userMessage;
  
  // 添加相关上下文
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
    role.systemPrompt,
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

// 获取角色配置
function getRole(roleId: string): RoleConfig | undefined {
  return ROLES.find(r => r.id === roleId);
}

// 执行意图识别
async function executeIntentAnalysis(
  state: WorkflowState,
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
    progress: 5,
  });
  
  const result = await executeRole(role, state.userInput, {});
  state.results['intent_analyst'] = result;
  
  // 解析意图
  if (result.success) {
    try {
      // 尝试从结果中提取JSON
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const intent = JSON.parse(jsonMatch[0]);
        state.mode = intent.mode || 'forward';
      }
    } catch (e) {
      // 解析失败，默认正推模式
      state.mode = 'forward';
    }
  }
  
  onProgress?.({
    state,
    currentRole: '战略入口分析师',
    currentStatus: `意图识别完成：${state.mode === 'forward' ? '正推模式' : state.mode === 'reverse' ? '倒推模式' : '混合模式'}`,
    progress: 10,
  });
}

// 执行搜索验证
async function executeSearchVerification(
  state: WorkflowState,
  query: string,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    state,
    currentStatus: '正在搜索验证数据...',
    progress: 15,
  });
  
  const searchResult = await searchWithVerification(query);
  state.searchResults = searchResult;
  
  onProgress?.({
    state,
    currentStatus: '搜索验证完成',
    progress: 20,
  });
}

// 正推模式执行
async function executeForwardMode(
  state: WorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const context: Record<string, string> = {
    '用户档案': JSON.stringify(USER_PROFILE, null, 2),
    '搜索结果': state.searchResults ? JSON.stringify(state.searchResults.combined.slice(0, 3), null, 2) : '',
  };
  
  // 正推模式角色顺序
  const roles = [
    { id: 'chief_researcher', name: '首席研究员', progress: 25 },
    { id: 'market_analyst', name: '宏观市场分析师', progress: 35 },
    { id: 'industry_analyst', name: '行业分析师', progress: 45 },
    { id: 'financial_analyst', name: '财务建模师', progress: 55 },
    { id: 'risk_assessor', name: '风险评估师', progress: 65 },
    { id: 'innovation_advisor', name: '创新顾问', progress: 72 },
    { id: 'execution_planner', name: '执行路径规划师', progress: 78 },
  ];
  
  for (const roleInfo of roles) {
    const role = getRole(roleInfo.id);
    if (!role) continue;
    
    state.currentRole = roleInfo.id;
    onProgress?.({
      state,
      currentRole: roleInfo.name,
      currentStatus: `正在执行 ${roleInfo.name}...`,
      progress: roleInfo.progress,
    });
    
    // 添加前面角色的结果到上下文
    for (const [key, value] of Object.entries(state.results)) {
      if (value.success && key !== 'intent_analyst') {
        context[value.roleName] = value.content;
      }
    }
    
    const result = await executeRole(role, state.userInput, context);
    state.results[roleInfo.id] = result;
  }
}

// 倒推模式执行
async function executeReverseMode(
  state: WorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const context: Record<string, string> = {
    '用户档案': JSON.stringify(USER_PROFILE, null, 2),
    '搜索结果': state.searchResults ? JSON.stringify(state.searchResults.combined.slice(0, 3), null, 2) : '',
  };
  
  // 倒推模式角色顺序
  const roles = [
    { id: 'market_analyst', name: '宏观市场分析师', progress: 25 },
    { id: 'industry_analyst', name: '行业分析师', progress: 35 },
    { id: 'chief_researcher', name: '首席研究员（项目解剖）', progress: 45 },
    { id: 'financial_analyst', name: '财务建模师', progress: 55 },
    { id: 'risk_assessor', name: '风险评估师', progress: 65 },
    { id: 'innovation_advisor', name: '创新顾问', progress: 72 },
    { id: 'execution_planner', name: '执行路径规划师', progress: 78 },
  ];
  
  for (const roleInfo of roles) {
    const role = getRole(roleInfo.id);
    if (!role) continue;
    
    state.currentRole = roleInfo.id;
    onProgress?.({
      state,
      currentRole: roleInfo.name,
      currentStatus: `正在执行 ${roleInfo.name}...`,
      progress: roleInfo.progress,
    });
    
    // 添加前面角色的结果到上下文
    for (const [key, value] of Object.entries(state.results)) {
      if (value.success && key !== 'intent_analyst') {
        context[value.roleName] = value.content;
      }
    }
    
    const result = await executeRole(role, state.userInput, context);
    state.results[roleInfo.id] = result;
  }
}

// 执行质量验证
async function executeQualityVerification(
  state: WorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const role = getRole('quality_verifier');
  if (!role) return;
  
  state.currentRole = 'quality_verifier';
  onProgress?.({
    state,
    currentRole: '质量验证员',
    currentStatus: '正在验证数据真实性...',
    progress: 82,
  });
  
  // 收集所有结果作为上下文
  const context: Record<string, string> = {};
  for (const [key, value] of Object.entries(state.results)) {
    if (value.success) {
      context[value.roleName] = value.content;
    }
  }
  
  const result = await executeRole(role, '请验证以上分析结果的数据真实性', context);
  state.results['quality_verifier'] = result;
}

// 执行Copilot检查
async function executeCopilotCheck(
  state: WorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const role = getRole('copilot');
  if (!role) return;
  
  state.currentRole = 'copilot';
  onProgress?.({
    state,
    currentRole: 'Copilot',
    currentStatus: '正在进行流程检查...',
    progress: 88,
  });
  
  // 收集所有结果作为上下文
  const context: Record<string, string> = {};
  for (const [key, value] of Object.entries(state.results)) {
    if (value.success) {
      context[value.roleName] = value.content;
    }
  }
  
  const result = await executeRole(role, '请检查以上分析流程的完整性和一致性', context);
  state.results['copilot'] = result;
}

// 执行最终决策
async function executeFinalDecision(
  state: WorkflowState,
  onProgress?: ProgressCallback
): Promise<void> {
  const role = getRole('decision_advisor');
  if (!role) return;
  
  state.currentRole = 'decision_advisor';
  onProgress?.({
    state,
    currentRole: '决策顾问',
    currentStatus: '正在生成最终决策...',
    progress: 92,
  });
  
  // 收集所有结果作为上下文
  const context: Record<string, string> = {
    '用户档案': JSON.stringify(USER_PROFILE, null, 2),
  };
  for (const [key, value] of Object.entries(state.results)) {
    if (value.success) {
      context[value.roleName] = value.content;
    }
  }
  
  const result = await executeRole(role, '请基于以上所有分析，给出最终的三维度决策结论', context);
  state.results['decision_advisor'] = result;
  
  if (result.success) {
    state.finalDecision = result.content;
  }
}

// 生成完整报告
function generateReport(state: WorkflowState): string {
  let report = `# 商业决策分析报告\n\n`;
  report += `**生成时间**：${state.endTime?.toLocaleString() || new Date().toLocaleString()}\n\n`;
  report += `**分析模式**：${state.mode === 'forward' ? '正推模式' : state.mode === 'reverse' ? '倒推模式' : '混合模式'}\n\n`;
  report += `**用户输入**：${state.userInput}\n\n`;
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
      report += `> 模型：${result.model} | 平台：${result.provider} | 耗时：${result.latency}ms\n\n`;
      report += `${result.content}\n\n`;
      report += `---\n\n`;
    }
  }
  
  return report;
}

// 执行完整工作流
export async function executeWorkflow(
  userInput: string,
  onProgress?: ProgressCallback
): Promise<WorkflowState> {
  const state = createWorkflow(userInput);
  
  try {
    // 1. 意图识别
    await executeIntentAnalysis(state, onProgress);
    
    // 2. 搜索验证
    await executeSearchVerification(state, userInput, onProgress);
    
    // 3. 根据模式执行不同路径
    if (state.mode === 'forward') {
      await executeForwardMode(state, onProgress);
    } else if (state.mode === 'reverse') {
      await executeReverseMode(state, onProgress);
    } else {
      // 混合模式：先执行正推，再执行倒推
      await executeForwardMode(state, onProgress);
      await executeReverseMode(state, onProgress);
    }
    
    // 4. 质量验证
    await executeQualityVerification(state, onProgress);
    
    // 5. Copilot检查
    await executeCopilotCheck(state, onProgress);
    
    // 6. 最终决策
    await executeFinalDecision(state, onProgress);
    
    // 7. 生成报告
    state.report = generateReport(state);
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
