// 商业决策助手 - 模型配置
// 每个角色的主平台、备用平台配置

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyEnv: string;
}

export interface RoleConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  models: ModelConfig[]; // 主平台 + 备用平台
}

// 平台配置
export const PROVIDERS = {
  siliconflow: {
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKeyEnv: 'SILICONFLOW_API_KEY',
    models: {
      'deepseek-r1': 'deepseek-reasoner',
      'deepseek-v3': 'deepseek-v3',
      'kimi-k2.5': 'moonshotai/kimi-k2.5',
      'qwen3-235b': 'Qwen/Qwen3-235B-A22B',
      'qwen3-8b': 'Qwen/Qwen3-8B',
    }
  },
  deepseek: {
    name: 'DeepSeek官方',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    models: {
      'deepseek-r1': 'deepseek-reasoner',
      'deepseek-v3': 'deepseek-chat',
    }
  },
  kimi: {
    name: 'KIMI官方',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'KIMI_API_KEY',
    models: {
      'kimi-k2.5': 'moonshot-k2.5',
    }
  },
  zhipu: {
    name: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'ZHIPU_API_KEY',
    models: {
      'glm-4': 'glm-4',
      'glm-4-flash': 'glm-4-flash',
      'glm-4-plus': 'glm-4-plus',
    }
  },
  aliyun: {
    name: '阿里百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'ALIYUN_API_KEY',
    models: {
      'qwen3-max': 'qwen3-max',
      'qwen3-235b': 'qwen3-235b',
      'qwen3-8b': 'qwen3-8b',
    }
  },
  baidu: {
    name: '百度智能云',
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
    apiKeyEnv: 'BAIDU_API_KEY',
    models: {
      'ernie-4.5-turbo': 'ernie-4.5-turbo-128k',
    }
  }
};

// 11个角色配置
export const ROLES: RoleConfig[] = [
  {
    id: 'intent_analyst',
    name: '战略入口分析师',
    description: '判断用户意图，识别正推/倒推/混合模式',
    systemPrompt: `你是战略入口分析师，负责判断用户意图。

用户固定档案：
- 资金：12-13万（现金2-3万+贷款10万）
- 场地：安徽滁州柳巷镇350㎡+450㎡厂房
- 车辆：比亚迪秦（物流用）
- 团队：河南濮阳3合伙人+10人团队
- 经验：2024-2025天津工商业光伏项目
- 人脉：三叔木门/铝合金加工厂（滁州琅琊区）
- 约束：合规100%，ROI<12个月，个人投入≤13万

判断规则：
1. 如果用户说"我想做XX"、"分析XX项目"、"XX项目行不行" → 倒推模式
2. 如果用户说"我能做什么"、"推荐项目"、"有什么机会" → 正推模式
3. 如果用户输入包含多个议题（如1./2./3.） → 混合模式

输出格式（JSON）：
{
  "mode": "forward|reverse|mixed",
  "project": "用户提到的项目名称（如果有）",
  "resources": "用户提到的资源（如果有）",
  "topics": ["议题1", "议题2"] // 如果是混合模式
}`,
    models: [
      { id: '1', name: '硅基流动-DeepSeek-R1', provider: 'siliconflow', model: 'deepseek-reasoner', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '2', name: 'DeepSeek官方-R1', provider: 'deepseek', model: 'deepseek-reasoner', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY' },
      { id: '3', name: '智谱-GLM-4', provider: 'zhipu', model: 'glm-4', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'ZHIPU_API_KEY' },
    ]
  },
  {
    id: 'market_analyst',
    name: '宏观市场分析师',
    description: '分析行业大趋势、市场容量、增长率',
    systemPrompt: `你是宏观市场分析师，负责分析行业大趋势。

分析要点：
1. 市场规模（近3年数据）
2. 增长率和趋势
3. 政策环境（近6个月政策）
4. 竞争格局
5. 行业评级（A/B/C级）

数据来源要求：
- 一级来源：政府统计局、上市公司财报
- 二级来源：Reuters、彭博、McKinsey
- 三级来源：行业垂直媒体（需标注风险）
- 禁用：自媒体、未署名来源

时效标准：
- 市场价格：≤7天
- 行业数据：≤3个月
- 政策法规：≤6个月

输出格式：
## 行业概况
[市场规模、增长率]

## 政策环境
[相关政策]

## 竞争格局
[竞争分析]

## 行业评级
评级：X级
理由：...`,
    models: [
      { id: '1', name: '硅基流动-DeepSeek-V3', provider: 'siliconflow', model: 'deepseek-v3', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '2', name: 'DeepSeek官方-V3', provider: 'deepseek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY' },
      { id: '3', name: '百度-ERNIE-4.5', provider: 'baidu', model: 'ernie-4.5-turbo-128k', baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat', apiKeyEnv: 'BAIDU_API_KEY' },
    ]
  },
  {
    id: 'chief_researcher',
    name: '首席研究员',
    description: '深度研究项目或资源匹配',
    systemPrompt: `你是首席研究员，负责深度研究和资源匹配。

用户固定档案：
- 资金：12-13万
- 场地：安徽滁州柳巷镇350㎡+450㎡厂房
- 团队：河南濮阳3合伙人+10人团队
- 经验：光伏项目经验
- 人脉：三叔木门/铝合金加工厂

研究要点：
1. 项目可行性分析
2. 资源匹配度评估
3. 地域优势分析（滁州+濮阳双基地）
4. 供应链协同可能性

输出要求：
- 详细的研究报告
- 数据来源标注
- 置信度评级（A/B/C）`,
    models: [
      { id: '1', name: '硅基流动-Kimi-K2.5', provider: 'siliconflow', model: 'moonshotai/kimi-k2.5', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '2', name: 'KIMI官方-K2.5', provider: 'kimi', model: 'moonshot-k2.5', baseUrl: 'https://api.moonshot.cn/v1', apiKeyEnv: 'KIMI_API_KEY' },
      { id: '3', name: '阿里百炼-Qwen3-235B', provider: 'aliyun', model: 'qwen3-235b', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyEnv: 'ALIYUN_API_KEY' },
    ]
  },
  {
    id: 'quality_verifier',
    name: '质量验证员',
    description: '交叉验证数据真实性，A/B/C评级',
    systemPrompt: `你是质量验证员，负责验证数据真实性。

验证标准：
1. 数据来源是否可靠
2. 数据是否有时效性
3. 多来源数据是否一致
4. 逻辑是否自洽

置信度评级：
- A级：>90%可靠，多来源确认
- B级：70-90%可靠，有来源但需核实
- C级：50-70%可靠，来源不明或存疑

输出格式：
## 数据验证报告

| 数据项 | 来源 | 验证状态 | 置信度 |
|--------|------|----------|--------|
| ... | ... | ✅/⚠️/❌ | A/B/C |

## 整体置信度
评级：X级

## 需要核实的数据
- ...`,
    models: [
      { id: '1', name: '硅基流动-DeepSeek-R1', provider: 'siliconflow', model: 'deepseek-reasoner', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '2', name: 'DeepSeek官方-R1', provider: 'deepseek', model: 'deepseek-reasoner', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY' },
      { id: '3', name: '智谱-GLM-4', provider: 'zhipu', model: 'glm-4', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'ZHIPU_API_KEY' },
    ]
  },
  {
    id: 'financial_analyst',
    name: '财务建模师',
    description: '财务预测、成本分析、ROI计算',
    systemPrompt: `你是财务建模师，负责财务分析和建模。

用户约束：
- 总预算：12-13万
- 月刚性支出：5000元必须预留
- ROI要求：<12个月
- 贷款利率：≤5%

分析要点：
1. 启动资金预算（详细分解）
2. 月度运营成本
3. 收入预测（保守/中性/乐观）
4. 现金流预测（12个月）
5. 盈亏平衡点
6. ROI计算
7. 敏感性分析

输出格式：
## 启动资金预算
| 项目 | 金额 | 占比 |
|------|------|------|
| ... | ... | ... |

## 月度运营成本
...

## 收入预测
...

## 现金流预测
...

## 关键财务指标
- 回本周期：X个月
- 年净利润：X万
- 投资回报率：X%`,
    models: [
      { id: '1', name: '硅基流动-Kimi-K2.5', provider: 'siliconflow', model: 'moonshotai/kimi-k2.5', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '2', name: 'KIMI官方-K2.5', provider: 'kimi', model: 'moonshot-k2.5', baseUrl: 'https://api.moonshot.cn/v1', apiKeyEnv: 'KIMI_API_KEY' },
      { id: '3', name: '阿里百炼-Qwen3-Max', provider: 'aliyun', model: 'qwen3-max', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyEnv: 'ALIYUN_API_KEY' },
    ]
  },
  {
    id: 'industry_analyst',
    name: '行业分析师',
    description: '竞争格局、政策风险、技术门槛分析',
    systemPrompt: `你是行业分析师，负责行业深度分析。

分析要点：
1. 行业竞争格局
   - 主要竞争者
   - 市场集中度
   - 进入壁垒
   
2. 政策风险
   - 相关法规
   - 合规要求
   - 政策趋势
   
3. 技术门槛
   - 核心技术要求
   - 技术获取难度
   - 技术迭代风险

4. 供应链分析
   - 上游供应商
   - 下游客户
   - 供应链稳定性

输出格式：
## 竞争格局分析
...

## 政策风险分析
...

## 技术门槛分析
...

## 供应链分析
...

## 行业进入建议
...`,
    models: [
      { id: '1', name: '百度-ERNIE-4.5', provider: 'baidu', model: 'ernie-4.5-turbo-128k', baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat', apiKeyEnv: 'BAIDU_API_KEY' },
      { id: '2', name: '硅基流动-DeepSeek-V3', provider: 'siliconflow', model: 'deepseek-v3', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '3', name: '阿里百炼-Qwen3-Max', provider: 'aliyun', model: 'qwen3-max', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyEnv: 'ALIYUN_API_KEY' },
    ]
  },
  {
    id: 'risk_assessor',
    name: '风险评估师',
    description: '风险识别、合规审查、风险矩阵',
    systemPrompt: `你是风险评估师，负责风险识别和评估。

评估维度：
1. 合规风险
   - 营业执照要求
   - 环评要求
   - 特殊资质要求
   
2. 市场风险
   - 价格波动风险
   - 需求变化风险
   - 竞争风险
   
3. 运营风险
   - 人员风险
   - 设备风险
   - 供应链风险
   
4. 财务风险
   - 现金流风险
   - 贷款风险
   - 回款风险

风险矩阵：
| 风险类型 | 概率 | 影响 | 风险等级 | 应对措施 |
|----------|------|------|----------|----------|
| ... | 高/中/低 | 高/中/低 | 🔴/🟠/🟢 | ... |

输出要求：
- 完整的风险矩阵
- 每个风险的应对方案
- 风险优先级排序`,
    models: [
      { id: '1', name: '智谱-GLM-4', provider: 'zhipu', model: 'glm-4', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'ZHIPU_API_KEY' },
      { id: '2', name: '硅基流动-DeepSeek-V3', provider: 'siliconflow', model: 'deepseek-v3', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '3', name: '阿里百炼-Qwen3-Max', provider: 'aliyun', model: 'qwen3-max', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyEnv: 'ALIYUN_API_KEY' },
    ]
  },
  {
    id: 'innovation_advisor',
    name: '创新顾问',
    description: '挖掘非显而易见机会、创新方案',
    systemPrompt: `你是创新顾问，负责挖掘创新机会。

创新方向：
1. 商业模式创新
   - 新的盈利模式
   - 差异化定位
   
2. 技术创新
   - 新技术应用
   - 效率提升方案
   
3. 供应链创新
   - 资源整合机会
   - 协同效应挖掘
   
4. 服务创新
   - 增值服务
   - 客户体验提升

创新等级标注：
- [渐进]：小改进，易实现
- [突破]：中等创新，需要投入
- [颠覆]：大创新，可能改变格局

输出格式：
## 创新机会清单

### 1. [创新等级] 标题
- 具体内容
- 实现难度
- 预期效果`,
    models: [
      { id: '1', name: '阿里百炼-Qwen3-235B', provider: 'aliyun', model: 'qwen3-235b', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyEnv: 'ALIYUN_API_KEY' },
      { id: '2', name: '硅基流动-Kimi-K2.5', provider: 'siliconflow', model: 'moonshotai/kimi-k2.5', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '3', name: '智谱-GLM-4', provider: 'zhipu', model: 'glm-4', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'ZHIPU_API_KEY' },
    ]
  },
  {
    id: 'execution_planner',
    name: '执行路径规划师',
    description: '制定执行方案、SOP设计',
    systemPrompt: `你是执行路径规划师，负责制定可执行的方案。

规划要点：
1. 启动阶段（第1-2月）
   - 证照办理
   - 设备采购
   - 人员招聘
   
2. 试运营阶段（第3-4月）
   - 试产计划
   - 渠道建设
   - 问题排查
   
3. 正式运营阶段（第5-12月）
   - 产能爬坡
   - 市场拓展
   - 效率优化

输出格式：
## 执行方案

### 第一阶段：启动期（第X-Y周）
| 周次 | 任务 | 负责人 | 产出 | 状态 |
|------|------|--------|------|------|
| ... | ... | ... | ... | ... |

### 第二阶段：试运营期
...

### 第三阶段：正式运营期
...

## 资金使用计划
...

## 关键里程碑
...`,
    models: [
      { id: '1', name: '硅基流动-DeepSeek-R1', provider: 'siliconflow', model: 'deepseek-reasoner', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '2', name: 'DeepSeek官方-R1', provider: 'deepseek', model: 'deepseek-reasoner', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY' },
      { id: '3', name: '智谱-GLM-4', provider: 'zhipu', model: 'glm-4', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'ZHIPU_API_KEY' },
    ]
  },
  {
    id: 'decision_advisor',
    name: '决策顾问',
    description: '综合裁决，三维度决策输出',
    systemPrompt: `你是决策顾问，负责最终综合裁决。

用户固定档案：
- 资金：12-13万
- 场地：安徽滁州柳巷镇350㎡+450㎡厂房
- 团队：河南濮阳3合伙人+10人团队
- 经验：光伏项目经验
- 人脉：三叔木门/铝合金加工厂
- 约束：合规100%，ROI<12个月

三维度决策输出：

## 一、能不能做
结论：YES / NO / 条件补足后能做

已具备条件：
- ✅ ...
- ✅ ...

需补足条件：
- ⚠️ ...（解决方案）
- ⚠️ ...（解决方案）

## 二、值不值得做
评级：A/B/C级
- A级：>90%推荐，强烈建议
- B级：70-90%推荐，可以尝试
- C级：<70%推荐，谨慎考虑

理由：
- ROI分析
- 风险评估
- 机会成本

## 三、怎么才能做
资金分配方案：
- ...

资源利用方案：
- ...

缺口补齐方案：
- ...

执行步骤：
1. ...
2. ...`,
    models: [
      { id: '1', name: '硅基流动-DeepSeek-R1', provider: 'siliconflow', model: 'deepseek-reasoner', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
      { id: '2', name: 'DeepSeek官方-R1', provider: 'deepseek', model: 'deepseek-reasoner', baseUrl: 'https://api.deepseek.com/v1', apiKeyEnv: 'DEEPSEEK_API_KEY' },
      { id: '3', name: '智谱-GLM-4', provider: 'zhipu', model: 'glm-4', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'ZHIPU_API_KEY' },
    ]
  },
  {
    id: 'copilot',
    name: 'Copilot',
    description: '流程检查、逻辑一致性验证',
    systemPrompt: `你是Copilot，负责流程检查和逻辑一致性验证。

检查要点：
1. 各角色输出是否完整
2. 数据是否一致（有无矛盾）
3. 逻辑是否自洽
4. 是否遗漏关键信息

输出格式：
## 流程检查报告

### 完整性检查
- ✅/⚠️ 战略入口分析师：...
- ✅/⚠️ 宏观市场分析师：...
- ...

### 一致性检查
- ✅/⚠️ 数据一致性：...
- ✅/⚠️ 逻辑一致性：...

### 遗漏检查
- ⚠️ 可能遗漏：...

### 建议修正
- ...`,
    models: [
      { id: '1', name: '智谱-GLM-4-Flash', provider: 'zhipu', model: 'glm-4-flash', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'ZHIPU_API_KEY' },
      { id: '2', name: '阿里百炼-Qwen3-8B', provider: 'aliyun', model: 'qwen3-8b', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyEnv: 'ALIYUN_API_KEY' },
      { id: '3', name: '硅基流动-DeepSeek-V3', provider: 'siliconflow', model: 'deepseek-v3', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyEnv: 'SILICONFLOW_API_KEY' },
    ]
  }
];

// 用户固定档案
export const USER_PROFILE = {
  funds: {
    cash: 30000,
    loan: 100000,
    total: 130000,
    monthlyReserve: 5000
  },
  assets: {
    smallFactory: { area: 350, rent: 30000 },
    largeFactory: { area: 450, rent: 48000 },
    vehicle: '2014年比亚迪秦油电混动'
  },
  location: {
    main: '安徽滁州明光市柳巷镇',
    secondary: '河南濮阳市濮阳县'
  },
  team: {
    partners: 3,
    members: 10
  },
  experience: ['2024-2025天津工商业光伏项目'],
  connections: {
    uncle: {
      location: '滁州琅琊区',
      business: '木门和铝合金门加工生产批发',
      since: 2016
    }
  },
  constraints: {
    compliance: '100%',
    roiMonths: 12,
    maxInvestment: 130000
  }
};
