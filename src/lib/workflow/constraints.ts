// 第5层能力：约束强制验证系统
import { USER_PROFILE } from './config';

// ==================== 约束定义 ====================

export interface Constraint {
  id: string;
  name: string;
  description: string;
  type: 'hard' | 'soft'; // 硬约束必须满足，软约束尽量满足
  validate: (value: any, context?: any) => boolean;
  errorMessage: string;
  autoCorrect?: (value: any, context?: any) => any;
}

// 用户约束列表
export const USER_CONSTRAINTS: Constraint[] = [
  // 硬约束1：资金上限
  {
    id: 'max_investment',
    name: '资金上限',
    description: '个人投入不超过13万',
    type: 'hard',
    validate: (value: number) => value <= USER_PROFILE.funds.total,
    errorMessage: `投资金额超过预算上限${USER_PROFILE.funds.total}元`,
    autoCorrect: (value: number) => Math.min(value, USER_PROFILE.funds.total),
  },
  
  // 硬约束2：月固定支出预留
  {
    id: 'monthly_reserve',
    name: '月固定支出预留',
    description: '每月必须预留5000元固定支出',
    type: 'hard',
    validate: (value: number) => value >= USER_PROFILE.funds.monthlyReserve,
    errorMessage: '未预留足够的月固定支出（需5000元/月）',
    autoCorrect: (value: number) => Math.max(value, USER_PROFILE.funds.monthlyReserve),
  },
  
  // 硬约束3：ROI期限
  {
    id: 'roi_period',
    name: '回本周期',
    description: 'ROI必须小于12个月',
    type: 'hard',
    validate: (value: number) => value <= 12,
    errorMessage: '回本周期超过12个月，不符合要求',
    autoCorrect: (value: number) => Math.min(value, 12),
  },
  
  // 硬约束4：合规要求
  {
    id: 'compliance',
    name: '合规要求',
    description: '项目必须100%合规',
    type: 'hard',
    validate: (value: string) => {
      const illegalKeywords = ['灰色', '违规', '逃税', '无证', '黑市'];
      return !illegalKeywords.some(k => value.includes(k));
    },
    errorMessage: '项目存在合规风险',
  },
  
  // 软约束1：优先轻资产
  {
    id: 'light_asset',
    name: '轻资产优先',
    description: '优先选择轻资产项目',
    type: 'soft',
    validate: (value: { equipment: number; total: number }) => value.equipment / value.total < 0.5,
    errorMessage: '设备投入占比过高，建议选择轻资产项目',
  },
  
  // 软约束2：地域匹配
  {
    id: 'location_match',
    name: '地域匹配',
    description: '项目应能在安徽滁州或河南濮阳开展',
    type: 'soft',
    validate: (value: string) => {
      const validLocations = ['滁州', '濮阳', '安徽', '河南', '本地', '不限'];
      return validLocations.some(l => value.includes(l));
    },
    errorMessage: '项目地域与用户资源不匹配',
  },
  
  // 软约束3：经验复用
  {
    id: 'experience_reuse',
    name: '经验复用',
    description: '优先选择能复用光伏经验的项目',
    type: 'soft',
    validate: (value: string) => {
      const relatedKeywords = ['光伏', '能源', '安装', '工程', '施工'];
      return relatedKeywords.some(k => value.includes(k));
    },
    errorMessage: '项目与用户经验关联度较低',
  },
];

// ==================== 验证结果 ====================

export interface ValidationResult {
  passed: boolean;
  hardConstraintsPassed: boolean;
  softConstraintsScore: number; // 0-100
  violations: {
    constraintId: string;
    constraintName: string;
    type: 'hard' | 'soft';
    value: any;
    message: string;
    autoCorrected?: boolean;
    correctedValue?: any;
  }[];
  warnings: string[];
  recommendations: string[];
}

// ==================== 验证函数 ====================

// 验证单个约束
export function validateConstraint(
  constraintId: string,
  value: any,
  context?: any
): { passed: boolean; violation?: ValidationResult['violations'][0] } {
  const constraint = USER_CONSTRAINTS.find(c => c.id === constraintId);
  
  if (!constraint) {
    return { passed: true };
  }
  
  const passed = constraint.validate(value, context);
  
  if (passed) {
    return { passed: true };
  }
  
  const violation: ValidationResult['violations'][0] = {
    constraintId: constraint.id,
    constraintName: constraint.name,
    type: constraint.type,
    value,
    message: constraint.errorMessage,
  };
  
  // 尝试自动修正
  if (constraint.autoCorrect) {
    violation.correctedValue = constraint.autoCorrect(value, context);
    violation.autoCorrected = true;
  }
  
  return { passed: false, violation };
}

// 验证财务方案
export function validateFinancialPlan(plan: {
  totalInvestment: number;
  monthlyReserve: number;
  roiMonths: number;
  equipmentRatio: number;
}): ValidationResult {
  const violations: ValidationResult['violations'] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // 验证资金上限
  const investmentResult = validateConstraint('max_investment', plan.totalInvestment);
  if (!investmentResult.passed && investmentResult.violation) {
    violations.push(investmentResult.violation);
  }
  
  // 验证月固定支出预留
  const reserveResult = validateConstraint('monthly_reserve', plan.monthlyReserve);
  if (!reserveResult.passed && reserveResult.violation) {
    violations.push(reserveResult.violation);
  }
  
  // 验证ROI
  const roiResult = validateConstraint('roi_period', plan.roiMonths);
  if (!roiResult.passed && roiResult.violation) {
    violations.push(roiResult.violation);
  }
  
  // 验证轻资产（软约束）
  const assetResult = validateConstraint('light_asset', {
    equipment: plan.totalInvestment * plan.equipmentRatio,
    total: plan.totalInvestment,
  });
  if (!assetResult.passed && assetResult.violation) {
    violations.push(assetResult.violation);
    recommendations.push('考虑租赁设备或外包生产环节，降低设备投入');
  }
  
  // 计算软约束得分
  const softViolations = violations.filter(v => v.type === 'soft');
  const softConstraintsScore = Math.max(0, 100 - softViolations.length * 20);
  
  // 硬约束是否全部通过
  const hardConstraintsPassed = !violations.some(v => v.type === 'hard');
  
  // 生成警告
  if (plan.totalInvestment > USER_PROFILE.funds.total * 0.9) {
    warnings.push('投资金额接近预算上限，建议预留应急资金');
  }
  
  if (plan.roiMonths > 9) {
    warnings.push('回本周期较长，建议关注现金流风险');
  }
  
  return {
    passed: hardConstraintsPassed && softConstraintsScore >= 60,
    hardConstraintsPassed,
    softConstraintsScore,
    violations,
    warnings,
    recommendations,
  };
}

// 验证项目描述
export function validateProjectDescription(description: string): ValidationResult {
  const violations: ValidationResult['violations'] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // 验证合规性
  const complianceResult = validateConstraint('compliance', description);
  if (!complianceResult.passed && complianceResult.violation) {
    violations.push(complianceResult.violation);
  }
  
  // 验证地域匹配（软约束）
  const locationResult = validateConstraint('location_match', description);
  if (!locationResult.passed && locationResult.violation) {
    violations.push(locationResult.violation);
    recommendations.push('考虑在安徽滁州或河南濮阳开展业务');
  }
  
  // 验证经验复用（软约束）
  const experienceResult = validateConstraint('experience_reuse', description);
  if (!experienceResult.passed && experienceResult.violation) {
    violations.push(experienceResult.violation);
    recommendations.push('考虑与光伏相关的项目，可复用现有经验');
  }
  
  const hardConstraintsPassed = !violations.some(v => v.type === 'hard');
  const softViolations = violations.filter(v => v.type === 'soft');
  const softConstraintsScore = Math.max(0, 100 - softViolations.length * 20);
  
  return {
    passed: hardConstraintsPassed,
    hardConstraintsPassed,
    softConstraintsScore,
    violations,
    warnings,
    recommendations,
  };
}

// 验证决策输出
export function validateDecisionOutput(output: {
  canDo: string;
  worthIt: string;
  howToDo: string;
  financialPlan?: any;
}): ValidationResult {
  const violations: ValidationResult['violations'] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // 检查三维度输出是否完整
  if (!output.canDo || output.canDo.trim().length < 10) {
    warnings.push('"能不能做"结论不够详细');
  }
  
  if (!output.worthIt || output.worthIt.trim().length < 10) {
    warnings.push('"值不值得做"分析不够详细');
  }
  
  if (!output.howToDo || output.howToDo.trim().length < 20) {
    warnings.push('"怎么才能做"方案不够详细');
  }
  
  // 如果有财务方案，验证财务约束
  if (output.financialPlan) {
    const financialResult = validateFinancialPlan(output.financialPlan);
    violations.push(...financialResult.violations);
    warnings.push(...financialResult.warnings);
    recommendations.push(...financialResult.recommendations);
  }
  
  const hardConstraintsPassed = !violations.some(v => v.type === 'hard');
  const softViolations = violations.filter(v => v.type === 'soft');
  const softConstraintsScore = Math.max(0, 100 - softViolations.length * 20);
  
  return {
    passed: hardConstraintsPassed && warnings.length === 0,
    hardConstraintsPassed,
    softConstraintsScore,
    violations,
    warnings,
    recommendations,
  };
}

// ==================== 综合验证 ====================

export interface FullValidationResult {
  projectValidation: ValidationResult;
  financialValidation: ValidationResult;
  decisionValidation: ValidationResult;
  overallPassed: boolean;
  overallScore: number;
  summary: string;
}

// 执行完整验证
export function executeFullValidation(
  projectDescription: string,
  financialPlan: {
    totalInvestment: number;
    monthlyReserve: number;
    roiMonths: number;
    equipmentRatio: number;
  },
  decisionOutput: {
    canDo: string;
    worthIt: string;
    howToDo: string;
  }
): FullValidationResult {
  // 验证项目描述
  const projectValidation = validateProjectDescription(projectDescription);
  
  // 验证财务方案
  const financialValidation = validateFinancialPlan(financialPlan);
  
  // 验证决策输出
  const decisionValidation = validateDecisionOutput({
    ...decisionOutput,
    financialPlan,
  });
  
  // 综合判断
  const overallPassed = 
    projectValidation.hardConstraintsPassed &&
    financialValidation.hardConstraintsPassed &&
    decisionValidation.hardConstraintsPassed;
  
  const overallScore = (
    projectValidation.softConstraintsScore +
    financialValidation.softConstraintsScore +
    decisionValidation.softConstraintsScore
  ) / 3;
  
  // 生成摘要
  let summary = '';
  if (overallPassed && overallScore >= 80) {
    summary = '✅ 验证通过：项目符合所有硬约束，软约束评分优秀';
  } else if (overallPassed && overallScore >= 60) {
    summary = '⚠️ 验证通过但有警告：项目符合硬约束，但部分软约束未满足';
  } else if (!overallPassed) {
    summary = '❌ 验证失败：项目违反硬约束，需要调整';
  } else {
    summary = '⚠️ 验证通过但评分较低：建议优化项目方案';
  }
  
  return {
    projectValidation,
    financialValidation,
    decisionValidation,
    overallPassed,
    overallScore,
    summary,
  };
}
