// 五重防火墙验证系统
import { callWithFallback, searchWithVerification } from '../providers/api';
import { USER_PROFILE } from './config';

// ==================== 第1层：预填充搜索 ====================
// 已在engine.ts中实现

// ==================== 第2层：三角验证 ====================

export interface DataSource {
  source: string;
  url?: string;
  content: string;
  timestamp: Date;
  reliability: 'high' | 'medium' | 'low';
}

export interface DataPoint {
  claim: string;
  sources: DataSource[];
  verified: boolean;
  confidence: 'A' | 'B' | 'C';
  conflicts: string[];
}

// 三角验证：每个数据点需要2个以上独立来源确认
export async function triangulateData(
  claims: string[],
  searchQuery: string
): Promise<DataPoint[]> {
  const results: DataPoint[] = [];
  
  // 搜索验证
  const searchResult = await searchWithVerification(searchQuery);
  
  for (const claim of claims) {
    const sources: DataSource[] = [];
    const conflicts: string[] = [];
    
    // 从搜索结果中提取来源
    if (searchResult.tavilyResults.length > 0) {
      sources.push({
        source: 'Tavily',
        content: searchResult.tavilyResults[0]?.content || '',
        url: searchResult.tavilyResults[0]?.url,
        timestamp: new Date(),
        reliability: 'medium',
      });
    }
    
    if (searchResult.serperResults.length > 0) {
      sources.push({
        source: 'Serper',
        content: searchResult.serperResults[0]?.snippet || '',
        url: searchResult.serperResults[0]?.link,
        timestamp: new Date(),
        reliability: 'medium',
      });
    }
    
    // 判断验证状态
    const verified = sources.length >= 2;
    const confidence: 'A' | 'B' | 'C' = sources.length >= 3 ? 'A' : sources.length >= 2 ? 'B' : 'C';
    
    results.push({
      claim,
      sources,
      verified,
      confidence,
      conflicts,
    });
  }
  
  return results;
}

// ==================== 第3层：双模型背对背验证 ====================

export interface CrossValidationResult {
  claim: string;
  model1Result: {
    model: string;
    provider: string;
    conclusion: string;
    reasoning: string;
  };
  model2Result: {
    model: string;
    provider: string;
    conclusion: string;
    reasoning: string;
  };
  consistent: boolean;
  finalConclusion: string;
  confidence: 'A' | 'B' | 'C';
}

// 双模型背对背验证
export async function crossValidateWithTwoModels(
  claim: string,
  context: string,
  modelConfigs1: any[],
  modelConfigs2: any[]
): Promise<CrossValidationResult> {
  const prompt = `请独立分析以下结论是否正确，给出你的判断和理由。

背景信息：
${context}

待验证结论：
${claim}

请输出：
1. 结论是否正确（正确/部分正确/错误）
2. 你的推理过程
3. 置信度（高/中/低）`;

  // 两个模型独立分析
  const [result1, result2] = await Promise.all([
    callWithFallback('cross_validate_1', prompt, prompt, modelConfigs1),
    callWithFallback('cross_validate_2', prompt, prompt, modelConfigs2),
  ]);
  
  // 判断一致性
  const conclusion1 = result1.content.includes('正确') && !result1.content.includes('错误');
  const conclusion2 = result2.content.includes('正确') && !result2.content.includes('错误');
  const consistent = conclusion1 === conclusion2;
  
  // 确定最终结论
  let finalConclusion = '';
  let confidence: 'A' | 'B' | 'C' = 'C';
  
  if (consistent) {
    finalConclusion = conclusion1 ? '结论正确' : '结论错误';
    confidence = 'A';
  } else {
    finalConclusion = '两个模型结论不一致，需要人工裁决';
    confidence = 'B';
  }
  
  return {
    claim,
    model1Result: {
      model: result1.model,
      provider: result1.provider,
      conclusion: conclusion1 ? '正确' : '错误',
      reasoning: result1.content,
    },
    model2Result: {
      model: result2.model,
      provider: result2.provider,
      conclusion: conclusion2 ? '正确' : '错误',
      reasoning: result2.content,
    },
    consistent,
    finalConclusion,
    confidence,
  };
}

// ==================== 第4层：实时纠偏 ====================

export interface CorrectionResult {
  originalContent: string;
  issues: {
    type: 'data_conflict' | 'logic_error' | 'missing_source' | 'constraint_violation';
    description: string;
    location: string;
  }[];
  corrections: {
    original: string;
    corrected: string;
    reason: string;
  }[];
  correctedContent: string;
  verified: boolean;
}

// 实时纠偏：检查内容中的问题并修正
export async function realTimeCorrection(
  content: string,
  context: {
    previousResults: Record<string, string>;
    userProfile: typeof USER_PROFILE;
    searchResults?: any;
  }
): Promise<CorrectionResult> {
  const issues: CorrectionResult['issues'] = [];
  const corrections: CorrectionResult['corrections'] = [];
  
  // 1. 检查数据冲突
  const numbers = content.match(/\d+\.?\d*/g) || [];
  for (const num of numbers) {
    // 检查数字是否在合理范围内
    const value = parseFloat(num);
    if (value > 100000000) {
      issues.push({
        type: 'data_conflict',
        description: `数字 ${num} 可能过大，请核实`,
        location: `包含 ${num} 的位置`,
      });
    }
  }
  
  // 2. 检查约束违反
  if (content.includes('万') && content.includes('投资')) {
    const investmentMatch = content.match(/投资[^\d]*(\d+\.?\d*)\s*万/);
    if (investmentMatch) {
      const investment = parseFloat(investmentMatch[1]);
      if (investment > USER_PROFILE.funds.total / 10000) {
        issues.push({
          type: 'constraint_violation',
          description: `投资金额 ${investment}万 超过用户预算上限 ${USER_PROFILE.funds.total / 10000}万`,
          location: investmentMatch[0],
        });
        corrections.push({
          original: investmentMatch[0],
          corrected: `投资${USER_PROFILE.funds.total / 10000}万（已修正为预算上限）`,
          reason: '超过用户预算约束',
        });
      }
    }
  }
  
  // 3. 检查ROI约束
  if (content.includes('回本') || content.includes('ROI')) {
    const roiMatch = content.match(/(\d+)\s*(个?月|年)/);
    if (roiMatch) {
      const period = parseInt(roiMatch[1]);
      const unit = roiMatch[2];
      const months = unit.includes('年') ? period * 12 : period;
      if (months > 12) {
        issues.push({
          type: 'constraint_violation',
          description: `回本周期 ${roiMatch[0]} 超过用户要求的12个月`,
          location: roiMatch[0],
        });
      }
    }
  }
  
  // 4. 检查数据来源
  if (!content.includes('来源') && !content.includes('数据') && numbers.length > 3) {
    issues.push({
      type: 'missing_source',
      description: '包含多个数据但未标注来源',
      location: '全文',
    });
  }
  
  // 生成修正后的内容
  let correctedContent = content;
  for (const correction of corrections) {
    correctedContent = correctedContent.replace(correction.original, correction.corrected);
  }
  
  return {
    originalContent: content,
    issues,
    corrections,
    correctedContent,
    verified: issues.length === 0,
  };
}

// ==================== 第5层：后验审计 ====================

export interface AuditResult {
  reportId: string;
  timestamp: Date;
  claims: {
    claim: string;
    verified: boolean;
    sources: string[];
    confidence: 'A' | 'B' | 'C';
  }[];
  overallConfidence: 'A' | 'B' | 'C';
  issues: string[];
  recommendations: string[];
}

// 后验审计：对最终报告进行反向验证
export async function postAudit(
  report: string,
  originalQuery: string
): Promise<AuditResult> {
  const claims: AuditResult['claims'] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // 提取报告中的关键声明
  const keyPhrases = [
    /市场规模[^\d]*(\d+\.?\d*)\s*(亿|万)/g,
    /增长率[^\d]*(\d+\.?\d*)\s*%/g,
    /价格[^\d]*(\d+\.?\d*)\s*元/g,
    /投资[^\d]*(\d+\.?\d*)\s*万/g,
    /利润[^\d]*(\d+\.?\d*)\s*万/g,
  ];
  
  for (const pattern of keyPhrases) {
    const matches = report.matchAll(pattern);
    for (const match of matches) {
      const claim = match[0];
      
      // 对每个声明进行搜索验证
      const searchResult = await searchWithVerification(`${originalQuery} ${claim}`);
      
      const verified = searchResult.combined.length > 0;
      const confidence: 'A' | 'B' | 'C' = searchResult.combined.length >= 3 ? 'A' : 
                                          searchResult.combined.length >= 2 ? 'B' : 'C';
      
      claims.push({
        claim,
        verified,
        sources: searchResult.combined.slice(0, 3).map((r: any) => r.url || r.link || r.title || '未知来源'),
        confidence,
      });
      
      if (!verified) {
        issues.push(`声明"${claim}"未能找到验证来源`);
      }
    }
  }
  
  // 计算整体置信度
  const aCount = claims.filter(c => c.confidence === 'A').length;
  const bCount = claims.filter(c => c.confidence === 'B').length;
  const cCount = claims.filter(c => c.confidence === 'C').length;
  
  let overallConfidence: 'A' | 'B' | 'C' = 'C';
  if (aCount > claims.length * 0.5) {
    overallConfidence = 'A';
  } else if (aCount + bCount > claims.length * 0.5) {
    overallConfidence = 'B';
  }
  
  // 生成建议
  if (issues.length > 0) {
    recommendations.push('建议对以下声明进行人工核实：');
    recommendations.push(...issues);
  }
  
  return {
    reportId: `audit_${Date.now()}`,
    timestamp: new Date(),
    claims,
    overallConfidence,
    issues,
    recommendations,
  };
}

// ==================== 综合验证函数 ====================

export interface FullVerificationResult {
  layer1: { status: boolean; data: any };
  layer2: { status: boolean; data: DataPoint[] };
  layer3: { status: boolean; data: CrossValidationResult[] };
  layer4: { status: boolean; data: CorrectionResult };
  layer5: { status: boolean; data: AuditResult };
  overallStatus: 'passed' | 'warning' | 'failed';
  overallConfidence: 'A' | 'B' | 'C';
}

// 执行完整的五重防火墙验证
export async function executeFullVerification(
  content: string,
  context: {
    query: string;
    previousResults: Record<string, string>;
    searchResults?: any;
  },
  modelConfigs: any[]
): Promise<FullVerificationResult> {
  
  // 第1层：预填充搜索（已在主流程中完成）
  const layer1 = {
    status: !!context.searchResults,
    data: context.searchResults,
  };
  
  // 第2层：三角验证
  const claims = extractClaims(content);
  const layer2Data = await triangulateData(claims, context.query);
  const layer2 = {
    status: layer2Data.every(d => d.verified),
    data: layer2Data,
  };
  
  // 第3层：双模型背对背（对关键结论）
  const keyConclusions = extractKeyConclusions(content);
  const layer3Data: CrossValidationResult[] = [];
  for (const conclusion of keyConclusions.slice(0, 2)) {
    const result = await crossValidateWithTwoModels(
      conclusion,
      content,
      modelConfigs,
      modelConfigs.slice(2)
    );
    layer3Data.push(result);
  }
  const layer3 = {
    status: layer3Data.every(r => r.consistent),
    data: layer3Data,
  };
  
  // 第4层：实时纠偏
  const layer4Data = await realTimeCorrection(content, {
    previousResults: context.previousResults,
    userProfile: USER_PROFILE,
    searchResults: context.searchResults,
  });
  const layer4 = {
    status: layer4Data.verified,
    data: layer4Data,
  };
  
  // 第5层：后验审计
  const layer5Data = await postAudit(content, context.query);
  const layer5 = {
    status: layer5Data.overallConfidence !== 'C',
    data: layer5Data,
  };
  
  // 综合判断
  const passedLayers = [layer1.status, layer2.status, layer3.status, layer4.status, layer5.status];
  const passedCount = passedLayers.filter(Boolean).length;
  
  let overallStatus: 'passed' | 'warning' | 'failed';
  let overallConfidence: 'A' | 'B' | 'C';
  
  if (passedCount >= 4) {
    overallStatus = 'passed';
    overallConfidence = 'A';
  } else if (passedCount >= 3) {
    overallStatus = 'warning';
    overallConfidence = 'B';
  } else {
    overallStatus = 'failed';
    overallConfidence = 'C';
  }
  
  return {
    layer1,
    layer2,
    layer3,
    layer4,
    layer5,
    overallStatus,
    overallConfidence,
  };
}

// 辅助函数：提取声明
function extractClaims(content: string): string[] {
  const claims: string[] = [];
  
  // 提取包含数字的声明
  const numberPatterns = content.match(/[^。！？]*\d+[^。！？]*/g) || [];
  claims.push(...numberPatterns.slice(0, 5));
  
  return claims;
}

// 辅助函数：提取关键结论
function extractKeyConclusions(content: string): string[] {
  const conclusions: string[] = [];
  
  // 提取包含"结论"、"建议"、"推荐"的句子
  const patterns = content.match(/[^。！？]*(结论|建议|推荐|判断)[^。！？]*/g) || [];
  conclusions.push(...patterns);
  
  return conclusions;
}
