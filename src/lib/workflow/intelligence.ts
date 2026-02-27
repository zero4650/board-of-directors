// 第3层能力：智能分析模块
import { USER_PROFILE } from './config';

// ==================== 地理智能分析 ====================

export interface LocationResource {
  location: string;
  type: 'main' | 'secondary' | 'partner';
  resources: {
    type: string;
    description: string;
    usability: 'high' | 'medium' | 'low';
  }[];
  advantages: string[];
  limitations: string[];
}

export interface GeoAnalysisResult {
  mainLocation: LocationResource;
  secondaryLocations: LocationResource[];
  synergyAnalysis: {
    possible: boolean;
    synergies: string[];
    conflicts: string[];
  };
  recommendations: string[];
}

// 地理智能分析
export function analyzeGeoResources(projectType?: string): GeoAnalysisResult {
  // 主基地：安徽滁州
  const mainLocation: LocationResource = {
    location: '安徽滁州明光市柳巷镇',
    type: 'main',
    resources: [
      {
        type: '厂房',
        description: '350㎡小厂房 + 450㎡大厂房',
        usability: 'high',
      },
      {
        type: '交通',
        description: '长三角区位，临近南京、合肥',
        usability: 'high',
      },
      {
        type: '供应链',
        description: '三叔木门/铝合金加工厂（琅琊区）',
        usability: 'medium',
      },
    ],
    advantages: [
      '长三角区位优势，交通便利',
      '自有厂房，节省租金成本',
      '临近南京、合肥等大城市，市场广阔',
      '三叔工厂可提供供应链支持',
    ],
    limitations: [
      '乡镇位置，招工可能受限',
      '远离港口，大宗物流成本较高',
    ],
  };
  
  // 次要基地：河南濮阳
  const secondaryLocations: LocationResource[] = [
    {
      location: '河南濮阳市濮阳县',
      type: 'secondary',
      resources: [
        {
          type: '团队',
          description: '3合伙人 + 10人团队',
          usability: 'high',
        },
        {
          type: '人力',
          description: '豫北人力资源丰富',
          usability: 'high',
        },
      ],
      advantages: [
        '有现成团队，执行力强',
        '人力成本相对较低',
        '农业/工业基础好',
      ],
      limitations: [
        '距离主基地较远（约500公里）',
        '需要协调两地管理',
      ],
    },
    {
      location: '滁州琅琊区',
      type: 'partner',
      resources: [
        {
          type: '供应链',
          description: '三叔木门/铝合金加工厂',
          usability: 'high',
        },
      ],
      advantages: [
        '成熟供应链资源',
        '行业经验可借鉴',
        '可能的业务协同',
      ],
      limitations: [
        '非自有资源，需协调',
      ],
    },
  ];
  
  // 协同分析
  const synergyAnalysis = {
    possible: true,
    synergies: [
      '滁州厂房 + 河南团队：滁州做生产加工，河南做销售/物流',
      '三叔工厂 + 新项目：可回收工厂边角料，形成产业链协同',
      '光伏经验 + 厂房屋顶：可考虑屋顶光伏降低电费',
    ],
    conflicts: [
      '两地管理需要协调成本',
      '团队可能需要两地调配',
    ],
  };
  
  // 根据项目类型生成建议
  const recommendations: string[] = [];
  
  if (projectType?.includes('塑料') || projectType?.includes('回收')) {
    recommendations.push('建议在滁州厂房开展，利用现有场地');
    recommendations.push('可回收三叔工厂的边角料作为原料来源');
    recommendations.push('河南团队可负责下游销售渠道拓展');
  } else if (projectType?.includes('光伏')) {
    recommendations.push('利用厂房屋顶安装光伏，降低电费');
    recommendations.push('可结合光伏经验开展分布式光伏业务');
  } else {
    recommendations.push('优先利用滁州厂房，节省租金成本');
    recommendations.push('河南团队可作为销售/执行力量');
  }
  
  return {
    mainLocation,
    secondaryLocations,
    synergyAnalysis,
    recommendations,
  };
}

// ==================== 财务目标锚定 ====================

export interface FinancialAnchor {
  targetProfit: number;
  requiredRevenue: number;
  requiredGrossMargin: number;
  requiredCustomerCount: number;
  requiredMonthlySales: number;
  gapAnalysis: {
    item: string;
    required: number;
    available: number;
    gap: number;
    solution: string;
  }[];
  feasibilityScore: number;
  recommendations: string[];
}

// 财务目标锚定：以目标净利润倒推所需条件
export function anchorFinancialTarget(
  targetAnnualProfit: number,
  estimatedGrossMargin: number = 0.3,
  estimatedFixedCost: number = 240000 // 年固定成本（月2万）
): FinancialAnchor {
  // 倒推计算
  const requiredGrossProfit = targetAnnualProfit + estimatedFixedCost;
  const requiredRevenue = requiredGrossProfit / estimatedGrossMargin;
  const requiredMonthlyRevenue = requiredRevenue / 12;
  
  // 假设客单价
  const averageOrderValue = 5000; // 假设平均订单5000元
  const requiredCustomerCount = Math.ceil(requiredRevenue / averageOrderValue);
  const requiredMonthlySales = Math.ceil(requiredMonthlyRevenue / averageOrderValue);
  
  // 差距分析
  const gapAnalysis: FinancialAnchor['gapAnalysis'] = [];
  
  // 资金差距
  const requiredWorkingCapital = requiredMonthlyRevenue * 2; // 2个月流动资金
  gapAnalysis.push({
    item: '流动资金',
    required: requiredWorkingCapital,
    available: USER_PROFILE.funds.total - 80000, // 扣除设备等固定投入
    gap: Math.max(0, requiredWorkingCapital - (USER_PROFILE.funds.total - 80000)),
    solution: '可通过预收款或供应链账期缓解',
  });
  
  // 团队差距
  const requiredTeamSize = Math.ceil(requiredMonthlySales / 50); // 假设每人每月50单
  gapAnalysis.push({
    item: '团队人数',
    required: requiredTeamSize,
    available: USER_PROFILE.team.members,
    gap: Math.max(0, requiredTeamSize - USER_PROFILE.team.members),
    solution: '可逐步扩张，初期精简团队',
  });
  
  // 计算可行性评分
  const totalGap = gapAnalysis.reduce((sum, g) => sum + g.gap, 0);
  const feasibilityScore = Math.max(0, 100 - totalGap / 10000);
  
  // 生成建议
  const recommendations: string[] = [];
  
  if (feasibilityScore >= 80) {
    recommendations.push(`目标年净利润${targetAnnualProfit/10000}万在现有条件下可行`);
    recommendations.push(`需要年营收约${Math.round(requiredRevenue/10000)}万`);
    recommendations.push(`月均需要约${requiredMonthlySales}个订单`);
  } else if (feasibilityScore >= 50) {
    recommendations.push(`目标年净利润${targetAnnualProfit/10000}万需要补足部分条件`);
    for (const gap of gapAnalysis) {
      if (gap.gap > 0) {
        recommendations.push(`${gap.item}缺口：${gap.gap}，${gap.solution}`);
      }
    }
  } else {
    recommendations.push(`目标年净利润${targetAnnualProfit/10000}万在现有条件下较难实现`);
    recommendations.push(`建议调整目标至${Math.round(targetAnnualProfit * 0.6 / 10000)}万`);
  }
  
  return {
    targetProfit: targetAnnualProfit,
    requiredRevenue,
    requiredGrossMargin: estimatedGrossMargin,
    requiredCustomerCount,
    requiredMonthlySales,
    gapAnalysis,
    feasibilityScore,
    recommendations,
  };
}

// ==================== 多议题识别与路由 ====================

export interface Topic {
  id: number;
  content: string;
  type: 'forward' | 'reverse' | 'compare' | 'unknown';
  keywords: string[];
  priority: number;
}

export interface TopicAnalysisResult {
  hasMultipleTopics: boolean;
  topics: Topic[];
  routingPlan: {
    topicId: number;
    route: 'forward' | 'reverse' | 'mixed';
    roles: string[];
    dependencies: number[];
  }[];
  executionOrder: number[][];
}

// 多议题识别
export function analyzeMultipleTopics(userInput: string): TopicAnalysisResult {
  const topics: Topic[] = [];
  
  // 尝试识别编号议题（如 1. 2. 3. 或 一、二、三、）
  const numberedPatterns = [
    /(\d+)[\.、．]\s*([^0-9]+?)(?=\d+[\.、．]|$)/g,
    /([一二三四五六七八九十])[、\.]\s*([^一二三四五六七八九十]+?)(?=[一二三四五六七八九十][、\.]|$)/g,
  ];
  
  for (const pattern of numberedPatterns) {
    const matches = userInput.matchAll(pattern);
    for (const match of matches) {
      const content = match[2].trim();
      const type = detectTopicType(content);
      
      topics.push({
        id: topics.length + 1,
        content,
        type,
        keywords: extractKeywords(content),
        priority: topics.length + 1,
      });
    }
  }
  
  // 如果没有识别到编号议题，尝试按句号分割
  if (topics.length === 0) {
    const sentences = userInput.split(/[。！？]/).filter(s => s.trim().length > 10);
    for (const sentence of sentences) {
      const type = detectTopicType(sentence);
      topics.push({
        id: topics.length + 1,
        content: sentence.trim(),
        type,
        keywords: extractKeywords(sentence),
        priority: topics.length + 1,
      });
    }
  }
  
  // 如果仍然没有多个议题，返回单议题
  if (topics.length <= 1) {
    return {
      hasMultipleTopics: false,
      topics: topics.length > 0 ? topics : [{
        id: 1,
        content: userInput,
        type: detectTopicType(userInput),
        keywords: extractKeywords(userInput),
        priority: 1,
      }],
      routingPlan: [{
        topicId: 1,
        route: detectTopicType(userInput),
        roles: ['all'],
        dependencies: [],
      }],
      executionOrder: [[1]],
    };
  }
  
  // 生成路由计划
  const routingPlan: TopicAnalysisResult['routingPlan'] = topics.map(topic => ({
    topicId: topic.id,
    route: topic.type === 'unknown' ? 'forward' : topic.type,
    roles: getRolesForTopicType(topic.type),
    dependencies: getDependencies(topic, topics),
  }));
  
  // 生成执行顺序（并行执行无依赖的议题）
  const executionOrder = generateExecutionOrder(topics, routingPlan);
  
  return {
    hasMultipleTopics: true,
    topics,
    routingPlan,
    executionOrder,
  };
}

// 检测议题类型
function detectTopicType(content: string): 'forward' | 'reverse' | 'compare' | 'unknown' {
  const forwardKeywords = ['能做什么', '推荐', '有什么机会', '适合做什么', '项目推荐'];
  const reverseKeywords = ['我想做', '分析', '行不行', '能不能做', '可行性', '项目'];
  const compareKeywords = ['对比', '比较', '哪个好', '区别', 'vs'];
  
  for (const keyword of compareKeywords) {
    if (content.includes(keyword)) return 'compare';
  }
  
  for (const keyword of forwardKeywords) {
    if (content.includes(keyword)) return 'forward';
  }
  
  for (const keyword of reverseKeywords) {
    if (content.includes(keyword)) return 'reverse';
  }
  
  return 'unknown';
}

// 提取关键词
function extractKeywords(content: string): string[] {
  const keywords: string[] = [];
  
  // 提取项目类型
  const projectTypes = ['塑料', '光伏', '奶茶', '餐饮', '电商', '物流', '加工', '回收'];
  for (const type of projectTypes) {
    if (content.includes(type)) keywords.push(type);
  }
  
  // 提取地点
  const locations = ['安徽', '河南', '滁州', '濮阳', '本地', '家'];
  for (const loc of locations) {
    if (content.includes(loc)) keywords.push(loc);
  }
  
  // 提取金额
  const amountMatch = content.match(/(\d+)\s*万/);
  if (amountMatch) keywords.push(`${amountMatch[1]}万`);
  
  return keywords;
}

// 获取议题类型对应的角色
function getRolesForTopicType(type: 'forward' | 'reverse' | 'compare' | 'unknown'): string[] {
  switch (type) {
    case 'forward':
      return ['chief_researcher', 'market_analyst', 'financial_analyst', 'decision_advisor'];
    case 'reverse':
      return ['market_analyst', 'industry_analyst', 'financial_analyst', 'risk_assessor', 'decision_advisor'];
    case 'compare':
      return ['chief_researcher', 'financial_analyst', 'decision_advisor'];
    default:
      return ['all'];
  }
}

// 获取议题依赖
function getDependencies(topic: Topic, allTopics: Topic[]): number[] {
  const deps: number[] = [];
  
  // 对比类议题依赖前面的议题
  if (topic.type === 'compare') {
    for (const t of allTopics) {
      if (t.id < topic.id && t.type !== 'compare') {
        deps.push(t.id);
      }
    }
  }
  
  return deps;
}

// 生成执行顺序
function generateExecutionOrder(
  topics: Topic[],
  routingPlan: TopicAnalysisResult['routingPlan']
): number[][] {
  const order: number[][] = [];
  const completed = new Set<number>();
  
  while (completed.size < topics.length) {
    const batch: number[] = [];
    
    for (const plan of routingPlan) {
      if (completed.has(plan.topicId)) continue;
      
      // 检查依赖是否都已完成
      const depsMet = plan.dependencies.every(d => completed.has(d));
      if (depsMet) {
        batch.push(plan.topicId);
      }
    }
    
    if (batch.length > 0) {
      order.push(batch);
      batch.forEach(id => completed.add(id));
    } else {
      // 避免死循环，强制添加未完成的
      for (const topic of topics) {
        if (!completed.has(topic.id)) {
          order.push([topic.id]);
          completed.add(topic.id);
          break;
        }
      }
    }
  }
  
  return order;
}
