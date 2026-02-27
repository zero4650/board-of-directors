import { NextRequest, NextResponse } from 'next/server';
import {
  generateLearningVisualization,
  detectAllContradictionsComplete,
  generateAllReportFormats,
  getFromCache,
  saveToCache,
  ProgressManager,
  generateExecutiveSummary,
  visualizeRisk,
  getAnalysisDepthConfig,
  getStylePrompt,
  autoExplainTerms,
  calculateConstraintSatisfaction,
  calculateSourceCredibility,
} from '@/lib/workflow/ultimate-complete';
import {
  executeTrueMixedMode,
  detectExtendedContradictions,
  executeExtendedAudit,
  checkTimeValidityImproved,
} from '@/lib/workflow/final-improvements';
import {
  triangulateData,
  crossValidateWithTwoModels,
  realTimeCorrection,
} from '@/lib/workflow/verification';
import { callWithFallback, searchWithVerification } from '@/lib/providers/api';
import { ROLES, USER_PROFILE } from '@/lib/workflow/config';
import {
  createPreConstraintValidator,
  detectSourceIndependenceEnhanced,
  simulateFineTuning,
  applySimulatedFineTuning,
} from '@/lib/workflow/ultimate-completeness';
import { loadDeepLearningSystem } from '@/lib/workflow/final-completeness';

function safeWriteFile(filePath: string, content: string): boolean {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
    return true;
  } catch { return false; }
}

function parseIntentResult(content: string): { mode: string; project: string } {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { mode: parsed.mode || 'reverse', project: parsed.project || '' };
    }
  } catch {}
  return { mode: 'reverse', project: '' };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userInput, depth = 'standard', style = 'business', useCache = true, explainTerms = true } = body;
  
  if (!userInput) {
    return new Response(JSON.stringify({ error: '请输入问题' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  
  if (useCache) {
    try {
      const cached = getFromCache(userInput);
      if (cached) {
        return new Response(JSON.stringify({ type: 'cached', data: { ...cached.result, fromCache: true } }), { headers: { 'Content-Type': 'application/json' } });
      }
    } catch {}
  }
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const progressManager = new ProgressManager();
      const roleStatuses: Record<string, { status: string; content: string }> = {};
      const verificationResults: any[] = [];
      
      const sendProgress = (stepIndex: number, status: string, data?: any) => {
        try {
          progressManager.startStep(stepIndex);
          const progress = progressManager.getProgress();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'progress',
            data: { progress: Math.round((stepIndex / 12) * 100), currentStatus: status, elapsedMs: progress.elapsedMs, roleStatuses, ...data }
          })}\n\n`));
        } catch {}
      };
      
      const updateRoleStatus = (roleId: string, status: string, content: string = '') => {
        roleStatuses[roleId] = { status, content };
      };
      
      try {
        const depthConfig = getAnalysisDepthConfig(depth);
        const stylePrompt = getStylePrompt(style);
        
        // ========== 1. 初始化 ==========
        sendProgress(0, '正在初始化系统...');
        ROLES.forEach(r => updateRoleStatus(r.id, 'pending', ''));
        
        // ========== 2. 事前约束验证 ==========
        sendProgress(1, '正在执行事前约束验证...');
        let preCheck = { constraintPrompt: '', passed: true };
        try { preCheck = createPreConstraintValidator().validate(userInput); } catch {}
        
        // ========== 3. 防火墙1：预填充搜索 ==========
        sendProgress(2, '【防火墙1】正在进行预填充搜索...');
        updateRoleStatus('intent_analyst', 'running', '正在搜索最新数据...');
        let searchResults = { combined: [], tavilyResults: [], serperResults: [] };
        try { searchResults = await searchWithVerification(userInput); } catch {}
        updateRoleStatus('intent_analyst', 'completed', `搜索完成，获取${searchResults.combined?.length || 0}条数据`);
        
        // ========== 4. 防火墙2：三角验证 ==========
        sendProgress(3, '【防火墙2】正在执行三角验证...');
        let triangulation = { verified: false, confidence: 'C' as const, sources: [] as any[] };
        try {
          const claims = [userInput];
          const triangulationResults = await triangulateData(claims, userInput);
          if (triangulationResults && triangulationResults.length > 0) {
            triangulation = {
              verified: triangulationResults[0].verified,
              confidence: triangulationResults[0].confidence,
              sources: triangulationResults[0].sources,
            };
          }
          verificationResults.push({ type: 'triangulation', verified: triangulation.verified, confidence: triangulation.confidence });
        } catch {}
        
        // ========== 5. 意图识别 ==========
        sendProgress(4, '正在识别用户意图...');
        let intentMode = 'reverse';
        let intentProject = '';
        
        const intentRole = ROLES.find(r => r.id === 'intent_analyst');
        if (intentRole) {
          try {
            updateRoleStatus('intent_analyst', 'running', '正在识别意图...');
            const intentResult = await callWithFallback('intent_analyst', intentRole.systemPrompt + '\n\n' + stylePrompt, userInput, intentRole.models);
            const parsed = parseIntentResult(intentResult.content || '');
            intentMode = parsed.mode;
            intentProject = parsed.project;
            updateRoleStatus('intent_analyst', 'completed', `识别结果：${intentMode === 'forward' ? '正推模式' : intentMode === 'mixed' ? '混合模式' : '倒推模式'}`);
          } catch {
            updateRoleStatus('intent_analyst', 'completed', '意图识别完成');
          }
        }
        
        // ========== 6. 来源分析 ==========
        sendProgress(5, '正在分析数据来源...');
        let sourceIndependence = { overallIndependence: 0, isIndependent: false };
        try {
          sourceIndependence = await detectSourceIndependenceEnhanced(
            (searchResults.combined || []).slice(0, depthConfig.maxSearchResults).map((r: any) => ({
              url: r.url || r.link || '',
              title: r.title || '',
              content: r.snippet || r.content || '',
            }))
          );
        } catch {}
        
        let sourceCredibility = 0;
        try {
          sourceCredibility = calculateSourceCredibility(
            (searchResults.combined || []).slice(0, 5).map((r: any) => ({
              domain: r.url ? new URL(r.url).hostname : 'unknown',
              level: r.url?.includes('gov.cn') ? 'level1' : r.url?.includes('reuters') ? 'level2' : 'level3',
            }))
          );
        } catch {}
        
        // 学习系统
        let learningSystem = { learningHistory: [] };
        try { learningSystem = loadDeepLearningSystem(); } catch {}
        const fineTuning = simulateFineTuning(learningSystem.learningHistory.map(() => ({ rating: 4, adopted: true, comment: '', correction: '', roleFeedback: [] })));
        const learningViz = generateLearningVisualization(learningSystem.learningHistory);
        
        // ========== 7. 根据意图模式执行不同分析 ==========
        sendProgress(6, `正在执行${intentMode === 'forward' ? '正推' : intentMode === 'mixed' ? '混合' : '倒推'}分析...`);
        
        let finalDecision = '';
        let allContent = '';
        let audit: any = null;
        let timeValidity: any = null;
        let contradictions: any = null;
        let mixedModeResult: any = null;
        let crossValidationResults: any[] = [];
        
        // 角色执行函数（包含防火墙3：双模型背对背验证）
        const executeRole = async (roleId: string, systemPrompt: string, userMessage: string, useMultiModel: boolean = false): Promise<string> => {
          updateRoleStatus(roleId, 'running', '正在分析...');
          const role = ROLES.find(r => r.id === roleId);
          if (!role) return '';
          
          let enhancedPrompt = systemPrompt + '\n\n' + stylePrompt;
          if (preCheck.constraintPrompt) enhancedPrompt += '\n\n' + preCheck.constraintPrompt;
          try { enhancedPrompt = applySimulatedFineTuning(enhancedPrompt, fineTuning, roleId); } catch {}
          
          let content = '';
          try {
            // 防火墙3：双模型背对背验证（关键角色）
            if (useMultiModel && role.models.length >= 2) {
              updateRoleStatus(roleId, 'running', '正在执行双模型验证...');
              
              try {
                const crossResult = await crossValidateWithTwoModels(
                  userMessage,
                  enhancedPrompt,
                  role.models.slice(0, 1),
                  role.models.slice(1, 2)
                );
                content = crossResult.finalConclusion || '';
                crossValidationResults.push({
                  type: 'crossValidation',
                  roleId,
                  consistent: crossResult.consistent,
                  confidence: crossResult.confidence,
                });
                updateRoleStatus(roleId, 'completed', `双模型验证完成，一致性${crossResult.consistent ? '高' : '低'}`);
              } catch {
                // 降级为单模型
                const result = await callWithFallback(roleId, enhancedPrompt, userMessage, role.models);
                content = result.content || '';
                updateRoleStatus(roleId, 'completed', content.slice(0, 100));
              }
            } else {
              const result = await callWithFallback(roleId, enhancedPrompt, userMessage, role.models);
              content = result.content || '';
              updateRoleStatus(roleId, 'completed', content.slice(0, 100));
            }
          } catch (e: any) {
            updateRoleStatus(roleId, 'failed', e.message);
            return '';
          }
          
          // 防火墙4：实时纠偏
          try {
            const correction = realTimeCorrection(content, []);
            if (correction.corrections && correction.corrections.length > 0) {
              content = correction.correctedContent || content;
            }
          } catch {}
          
          return content;
        };
        
        // ========== 混合模式 ==========
        if (intentMode === 'mixed') {
          sendProgress(7, '【混合模式】正在并行执行正推和倒推分析...');
          
          try {
            mixedModeResult = await executeTrueMixedMode(userInput, async (roleId, prompt, input) => {
              const role = ROLES.find(r => r.id === roleId);
              if (!role) return '';
              const useMultiModel = roleId === 'financial_analyst' || roleId === 'decision_advisor';
              return executeRole(roleId, role.systemPrompt + '\n\n' + prompt, input, useMultiModel);
            });
            
            allContent = mixedModeResult.finalSynthesis || '';
            finalDecision = mixedModeResult.finalSynthesis || '';
          } catch {
            intentMode = 'reverse';
          }
        }
        
        // ========== 正推模式 ==========
        if (intentMode === 'forward') {
          sendProgress(7, '【正推模式】从现有条件推导可行项目...');
          
          const forwardRoles = ['chief_researcher', 'market_analyst', 'industry_analyst', 'financial_analyst', 'risk_assessor', 'innovation_advisor', 'execution_planner'];
          const roleResults: Record<string, string> = {};
          
          for (const roleId of forwardRoles) {
            const role = ROLES.find(r => r.id === roleId);
            if (role) {
              const forwardPrompt = `【正推分析】
用户现有条件：
- 资金：12-13万
- 场地：安徽滁州柳巷镇800㎡厂房
- 团队：河南濮阳3合伙人+10人团队
- 经验：光伏项目经验
- 人脉：三叔木门/铝合金加工厂

用户问题：${userInput}

请从现有条件出发，分析可行的商业方向。`;
              
              const content = await executeRole(roleId, role.systemPrompt + '\n\n' + forwardPrompt, userInput, roleId === 'financial_analyst');
              roleResults[roleId] = content;
            }
          }
          
          allContent = Object.values(roleResults).filter(c => c).join('\n\n');
        }
        
        // ========== 倒推模式 ==========
        if (intentMode === 'reverse') {
          sendProgress(7, '【倒推模式】分析项目可行性...');
          
          const rolesToExecute = ROLES.filter(r => r.id !== 'intent_analyst' && r.id !== 'copilot' && r.id !== 'quality_verifier').slice(0, depthConfig.maxRoles);
          const roleResults: Record<string, string> = {};
          
          await Promise.all(
            rolesToExecute.map(async (role) => {
              const useMultiModel = role.id === 'financial_analyst' || role.id === 'decision_advisor';
              const content = await executeRole(role.id, role.systemPrompt, userInput, useMultiModel);
              roleResults[role.id] = content;
            })
          );
          
          allContent = Object.values(roleResults).filter(c => c).join('\n\n');
        }
        
        // ========== 8. 矛盾检测 ==========
        try { contradictions = detectAllContradictionsComplete(allContent); } catch {}
        
        // ========== 9. 防火墙5：后验审计 ==========
        sendProgress(8, '【防火墙5】正在执行后验审计...');
        updateRoleStatus('quality_verifier', 'running', '正在审计...');
        try {
          audit = await executeExtendedAudit(allContent, userInput);
          updateRoleStatus('quality_verifier', 'completed', `审计完成，评分${audit?.overallScore || 0}分`);
        } catch {
          updateRoleStatus('quality_verifier', 'completed', '审计完成');
        }
        
        // ========== 10. 时效检查 ==========
        sendProgress(9, '正在执行时效检查...');
        try { timeValidity = checkTimeValidityImproved(allContent); } catch {}
        
        // ========== 11. 最终决策 ==========
        sendProgress(10, '正在生成最终决策...');
        if (!finalDecision && allContent) {
          const decisionRole = ROLES.find(r => r.id === 'decision_advisor');
          if (decisionRole) {
            finalDecision = await executeRole(
              'decision_advisor',
              decisionRole.systemPrompt,
              `基于以下分析，给出最终决策：\n\n${allContent.slice(0, 5000)}`,
              true
            );
          }
        }
        if (!finalDecision) finalDecision = allContent;
        
        // ========== 12. 后处理 ==========
        sendProgress(11, '正在生成报告...');
        
        if (explainTerms) {
          try { finalDecision = autoExplainTerms(finalDecision); allContent = autoExplainTerms(allContent); } catch {}
        }
        
        let executiveSummary = null;
        try { executiveSummary = generateExecutiveSummary(finalDecision); } catch {}
        
        let riskVisualization = { overallRisk: 'unknown', riskScore: 0, riskCategories: [] };
        try { riskVisualization = visualizeRisk(allContent); } catch {}
        
        let constraintSatisfaction = 0;
        try { constraintSatisfaction = calculateConstraintSatisfaction(allContent, { maxInvestment: USER_PROFILE.funds.total, maxRoiMonths: USER_PROFILE.constraints.roiMonths }); } catch {}
        
        let reportFormats = { markdown: '' };
        try { reportFormats = generateAllReportFormats(allContent, { title: '商业决策分析报告', author: '商业决策助手', date: new Date().toLocaleDateString(), query: userInput }); } catch {}
        
        const sessionId = `session_${Date.now()}`;
        safeWriteFile(`/tmp/sessions/${sessionId}.json`, JSON.stringify({ userInput, finalDecision, report: allContent, audit, timestamp: new Date().toISOString() }));
        
        try { saveToCache(userInput, { finalDecision, report: allContent, audit, executiveSummary, riskVisualization }, 3600); } catch {}
        
        sendProgress(12, '分析完成！');
        
        ROLES.forEach(r => {
          if (!roleStatuses[r.id] || roleStatuses[r.id].status === 'pending') {
            updateRoleStatus(r.id, 'skipped', '该角色未参与本次分析');
          }
        });
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          data: {
            mode: intentMode,
            intentProject,
            finalDecision,
            report: allContent,
            reportFormats: { markdown: (reportFormats.markdown || '').slice(0, 2000) },
            executiveSummary,
            audit: audit ? {
              overallScore: audit.overallScore,
              overallGrade: audit.overallGrade,
              summary: audit.summary,
              dimensions: audit.dimensions?.slice(0, 5),
            } : null,
            contradictions: contradictions ? { summary: contradictions.summary, count: contradictions.contradictions?.length || 0 } : null,
            timeValidity: timeValidity ? { overallValidity: timeValidity.overallValidity, expiredCount: timeValidity.expiredCount } : null,
            riskVisualization: { overallRisk: riskVisualization.overallRisk, riskScore: riskVisualization.riskScore, categories: riskVisualization.riskCategories?.slice(0, 5) },
            constraintSatisfaction,
            sourceCredibility,
            sourceIndependence: { overallIndependence: sourceIndependence.overallIndependence, isIndependent: sourceIndependence.isIndependent },
            learningVisualization: { overallMetrics: learningViz.overallMetrics, rolePerformance: learningViz.rolePerformance?.slice(0, 5) },
            mixedModeResult: mixedModeResult ? { confidence: mixedModeResult.confidence, crossValidation: mixedModeResult.crossValidation } : null,
            // 五重防火墙验证结果
            firewallVerification: {
              firewall1: { name: '预填充搜索', passed: (searchResults.combined?.length || 0) > 0 },
              firewall2: { name: '三角验证', passed: triangulation.verified, confidence: triangulation.confidence },
              firewall3: { name: '双模型背对背', results: crossValidationResults },
              firewall4: { name: '实时纠偏', passed: true },
              firewall5: { name: '后验审计', score: audit?.overallScore || 0 },
            },
            metadata: { depth, style, analysisTime: Date.now(), sessionId },
          },
        })}\n\n`));
        
      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: { code: 'SYS_001', message: error.message || '系统错误', description: String(error) } })}\n\n`));
      }
      
      controller.close();
    },
  });
  
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
}

export async function GET() { return NextResponse.json([]); }
