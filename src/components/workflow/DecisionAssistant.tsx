'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import dynamic from 'next/dynamic';

// 版本号
const VERSION = '1.0.0';

const FeedbackCollector = dynamic(
  () => import('./FeedbackCollector').then(mod => mod.FeedbackCollector || mod.default),
  { ssr: false }
);

const ROLES = [
  { id: 'intent_analyst', name: '战略入口分析师', icon: '🎯', layer: '第1层' },
  { id: 'market_analyst', name: '宏观市场分析师', icon: '📊', layer: '第1层' },
  { id: 'chief_researcher', name: '首席研究员', icon: '🔍', layer: '第1层' },
  { id: 'industry_analyst', name: '行业分析师', icon: '🏭', layer: '第1层' },
  { id: 'financial_analyst', name: '财务建模师', icon: '💰', layer: '第1层' },
  { id: 'risk_assessor', name: '风险评估师', icon: '⚠️', layer: '第1层' },
  { id: 'innovation_advisor', name: '创新顾问', icon: '💡', layer: '第1层' },
  { id: 'execution_planner', name: '执行路径规划师', icon: '📋', layer: '第1层' },
  { id: 'quality_verifier', name: '质量验证员', icon: '✅', layer: '第2层' },
  { id: 'copilot', name: 'Copilot', icon: '🤖', layer: '第1层' },
  { id: 'decision_advisor', name: '决策顾问', icon: '👔', layer: '第1层' },
];

interface RoleStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  model: string;
  provider: string;
  latency: number;
  fallback: boolean;
}

interface ExecutiveSummary {
  oneLineSummary: string;
  keyFindings: string[];
  recommendations: string[];
  risks: string[];
  nextSteps: string[];
  confidence: number;
}

interface RiskVisualization {
  overallRisk: string;
  riskScore: number;
  categories: { category: string; level: string; score: number; factors: string[] }[];
}

interface DetailedError {
  code: string;
  message: string;
  description: string;
  possibleCauses: string[];
  solutions: string[];
  severity: string;
  recoverable: boolean;
  retryAfter?: number;
}

// 骨架屏组件
const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
);

// 离线检测Hook
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);
  
  return isOnline;
}

// 深色模式Hook
function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        setIsDark(saved === 'true');
      } else {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    }
  }, []);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem('darkMode', String(isDark));
    }
  }, [isDark]);
  
  return [isDark, setIsDark] as const;
}

export default function DecisionAssistant() {
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [roleStatuses, setRoleStatuses] = useState<Record<string, RoleStatus>>({});
  const [progress, setProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('');
  const [stepName, setStepName] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [estimatedRemainingMs, setEstimatedRemainingMs] = useState(0);
  const [report, setReport] = useState('');
  const [finalDecision, setFinalDecision] = useState('');
  const [audit, setAudit] = useState<any>(null);
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null);
  const [riskVisualization, setRiskVisualization] = useState<RiskVisualization | null>(null);
  const [constraintSatisfaction, setConstraintSatisfaction] = useState<any>(null);
  const [sourceCredibility, setSourceCredibility] = useState<any>(null);
  const [contradictions, setContradictions] = useState<any>(null);
  const [timeValidity, setTimeValidity] = useState<any>(null);
  const [learningViz, setLearningViz] = useState<any>(null);
  const [historyComparison, setHistoryComparison] = useState<any>(null);
  const [error, setError] = useState<DetailedError | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [decisionId, setDecisionId] = useState('');
  const [fromCache, setFromCache] = useState(false);
  
  // 设置选项
  const [depth, setDepth] = useState<'quick' | 'standard' | 'deep' | 'comprehensive'>('standard');
  const [style, setStyle] = useState<'formal' | 'casual' | 'technical' | 'business'>('business');
  const [useCache, setUseCache] = useState(true);
  const [explainTerms, setExplainTerms] = useState(true);
  
  // 显示控制
  const [showDetails, setShowDetails] = useState(false);
  const [showReportFormats, setShowReportFormats] = useState(false);
  
  // 新增状态
  const [isDark, setIsDark] = useDarkMode();
  const isOnline = useOnlineStatus();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roleStatuses, currentStatus]);

  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter 或 Cmd+Enter 提交
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isRunning && input.trim()) {
          runAnalysis();
        }
      }
      // Escape 取消
      if (e.key === 'Escape' && isRunning) {
        // 可以添加取消逻辑
      }
      // / 聚焦输入框
      if (e.key === '/' && !isRunning && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, input]);

  const runAnalysis = useCallback(async () => {
    if (!input.trim() || isRunning || !isOnline) return;
    
    setIsRunning(true);
    setRoleStatuses({});
    setProgress(0);
    setCurrentStatus('正在启动分析...');
    setStepName('');
    setReport('');
    setFinalDecision('');
    setAudit(null);
    setExecutiveSummary(null);
    setRiskVisualization(null);
    setConstraintSatisfaction(null);
    setSourceCredibility(null);
    setContradictions(null);
    setTimeValidity(null);
    setLearningViz(null);
    setHistoryComparison(null);
    setError(null);
    setShowFeedback(false);
    setFromCache(false);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userInput: input,
          depth,
          style,
          useCache,
          explainTerms,
        }),
      });
      
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.type === 'cached') {
          setFromCache(true);
          setFinalDecision(data.data.finalDecision);
          setReport(data.data.report);
          setAudit(data.data.audit);
          setExecutiveSummary(data.data.executiveSummary);
          setRiskVisualization(data.data.riskVisualization);
          setProgress(100);
          setCurrentStatus(`从缓存加载 (${data.data.cacheAge}秒前)`);
          setIsRunning(false);
          setTimeout(() => setShowFeedback(true), 1000);
          return;
        }
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('无法读取响应');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                const status = data.data;
                setProgress(status.progress);
                setCurrentStatus(status.currentStatus || '');
                setStepName(status.stepName || '');
                setElapsedMs(status.elapsedMs || 0);
                setEstimatedRemainingMs(status.estimatedRemainingMs || 0);
                if (status.state?.results) setRoleStatuses(status.state.results);
              }
              
              if (data.type === 'complete') {
                const result = data.data;
                setProgress(100);
                setCurrentStatus('分析完成！');
                
                if (result.finalDecision) setFinalDecision(result.finalDecision);
                if (result.report) setReport(result.report);
                if (result.audit) setAudit(result.audit);
                if (result.executiveSummary) setExecutiveSummary(result.executiveSummary);
                if (result.riskVisualization) setRiskVisualization(result.riskVisualization);
                if (result.constraintSatisfaction) setConstraintSatisfaction(result.constraintSatisfaction);
                if (result.sourceCredibility) setSourceCredibility(result.sourceCredibility);
                if (result.contradictions) setContradictions(result.contradictions);
                if (result.timeValidity) setTimeValidity(result.timeValidity);
                if (result.learningVisualization) setLearningViz(result.learningVisualization);
                if (result.historyComparison) setHistoryComparison(result.historyComparison);
                if (result.metadata?.sessionId) setDecisionId(result.metadata.sessionId);
                
                setTimeout(() => setShowFeedback(true), 1000);
              }
              
              if (data.type === 'error') {
                setError(data.data);
                setCurrentStatus(`错误: ${data.data.message}`);
              }
            } catch (e) {}
          }
        }
      }
    } catch (error: any) {
      setCurrentStatus(`错误: ${error.message}`);
    }
    
    setIsRunning(false);
  }, [input, isRunning, isOnline, depth, style, useCache, explainTerms]);

  const handleFeedback = async (feedback: any) => {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...feedback, decisionId }),
      });
    } catch (e) {}
  };

  const exportReport = (format: 'markdown' | 'html' | 'pdf' | 'excel' | 'json') => {
    if (!report) return;
    
    let content = report;
    let filename = `董事会决策报告_${new Date().toISOString().slice(0, 10)}`;
    let mimeType = 'text/plain';
    
    switch (format) {
      case 'markdown':
        filename += '.md';
        mimeType = 'text/markdown';
        break;
      case 'html':
        content = generateHTML();
        filename += '.html';
        mimeType = 'text/html';
        break;
      case 'json':
        content = JSON.stringify({ query: input, decision: finalDecision, report, audit, executiveSummary, timestamp: new Date() }, null, 2);
        filename += '.json';
        mimeType = 'application/json';
        break;
      case 'excel':
        content = generateCSV();
        filename += '.csv';
        mimeType = 'text/csv';
        break;
      case 'pdf':
        content = generateHTML();
        filename += '.html';
        mimeType = 'text/html';
        break;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateHTML = () => `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>董事会决策报告</title><style>body{font-family:Arial,sans-serif;line-height:1.6;padding:20px;max-width:900px;margin:0 auto}.key-number{color:red;font-weight:bold}h1{color:#1a365d;border-bottom:3px solid #3182ce;padding-bottom:10px}</style></head><body><h1>董事会决策报告</h1><p><strong>问题:</strong> ${input}</p><p><strong>时间:</strong> ${new Date().toLocaleString()}</p><hr>${renderHighlightedContent(report)}</body></html>`;

  const generateCSV = () => `董事会决策报告\n问题,${input}\n时间,${new Date().toLocaleString()}\n\n执行摘要\n${executiveSummary?.keyFindings?.map((f, i) => `${i + 1},${f}`).join('\n') || ''}\n\n结论\n${finalDecision?.slice(0, 500) || ''}`;

  const renderHighlightedContent = (content: string) => {
    if (!content) return null;
    let html = content
      .replace(/(\d+\.?\d*\s*(万|亿|元|吨|公斤|平方米|㎡|%))/g, '<span style="color:red;font-weight:bold">$1</span>')
      .replace(/(风险|注意|警告|可能|不确定|缺口)/g, '<span style="color:orange;font-weight:bold">$1</span>')
      .replace(/(约|预计|估算|预估|大概|左右)/g, '<span style="color:blue">$1</span>')
      .replace(/(来源[：:]\s*[^\n]+)/g, '<span style="color:green;font-size:0.9em">$1</span>')
      .replace(/^## (.+)$/gm, '<h2 style="font-size:1.25em;font-weight:bold;margin:1em 0 0.5em">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 style="font-size:1.1em;font-weight:bold;margin:0.8em 0 0.4em">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li style="margin-left:1em">$1</li>')
      .replace(/\n/g, '<br/>');
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300';
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark bg-slate-900' : 'bg-gradient-to-br from-slate-50 to-slate-100'} p-4 md:p-8 print:p-0 print:bg-white`}>
      <div className="max-w-6xl mx-auto">
        {/* 头部 */}
        <header className="text-center mb-8 print:mb-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className={`text-3xl md:text-4xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              董事会
            </h1>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded dark:bg-blue-900 dark:text-blue-300">
              v{VERSION}
            </span>
          </div>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} print:text-black`}>
            11人董事会决策系统 · 五重防火墙验证 · 深度学习进化
          </p>
          
          {/* 控制按钮 */}
          <div className="flex items-center justify-center gap-4 mt-4 print:hidden">
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg ${isDark ? 'bg-slate-800 text-yellow-400' : 'bg-slate-200 text-slate-600'}`}
              aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* 离线提示 */}
        {!isOnline && (
          <Card className="mb-4 border-2 border-red-300 bg-red-50 dark:bg-red-900 print:hidden">
            <CardContent className="pt-4">
              <p className="text-red-700 dark:text-red-300">⚠️ 网络已断开，请检查网络连接</p>
            </CardContent>
          </Card>
        )}

        {/* 设置选项 */}
        <Card className={`mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-50'} print:hidden`}>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label htmlFor="depth-select" className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>分析深度:</label>
                <select 
                  id="depth-select"
                  value={depth} 
                  onChange={(e) => setDepth(e.target.value as any)}
                  className={`px-2 py-1 border rounded text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : ''}`}
                  disabled={isRunning}
                  aria-label="选择分析深度"
                >
                  <option value="quick">快速</option>
                  <option value="standard">标准</option>
                  <option value="deep">深度</option>
                  <option value="comprehensive">全面</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label htmlFor="style-select" className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>输出风格:</label>
                <select 
                  id="style-select"
                  value={style} 
                  onChange={(e) => setStyle(e.target.value as any)}
                  className={`px-2 py-1 border rounded text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : ''}`}
                  disabled={isRunning}
                  aria-label="选择输出风格"
                >
                  <option value="formal">正式</option>
                  <option value="casual">通俗</option>
                  <option value="technical">技术</option>
                  <option value="business">商业</option>
                </select>
              </div>
              
              <label className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-300' : ''}`}>
                <input type="checkbox" checked={useCache} onChange={(e) => setUseCache(e.target.checked)} disabled={isRunning} />
                使用缓存
              </label>
              
              <label className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-300' : ''}`}>
                <input type="checkbox" checked={explainTerms} onChange={(e) => setExplainTerms(e.target.checked)} disabled={isRunning} />
                解释术语
              </label>
              
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                快捷键: Ctrl+Enter 提交
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 输入区域 */}
        <Card className={`mb-6 ${isDark ? 'bg-slate-800' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                ref={inputRef}
                placeholder="输入你的问题，按 Ctrl+Enter 提交..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && runAnalysis()}
                className={`flex-1 text-lg py-6 ${isDark ? 'bg-slate-700 border-slate-600 text-white' : ''}`}
                disabled={isRunning}
                aria-label="输入问题"
              />
              <Button 
                onClick={runAnalysis} 
                disabled={isRunning || !input.trim() || !isOnline} 
                className="md:w-32 py-6 text-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                aria-label="开始分析"
              >
                {isRunning ? '分析中...' : '开始分析'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 错误显示 */}
        {error && (
          <Card className="mb-6 border-2 border-red-300 bg-red-50 dark:bg-red-900 print:hidden" role="alert">
            <CardHeader>
              <CardTitle className="text-red-800 dark:text-red-300">❌ {error.code}: {error.message}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700 dark:text-red-300 mb-4">{error.description}</p>
              <div className="mb-4">
                <div className="font-medium text-red-800 dark:text-red-300 mb-2">可能原因:</div>
                <ul className="list-disc list-inside text-red-700 dark:text-red-300">{error.possibleCauses.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
              <div className="mb-4">
                <div className="font-medium text-red-800 dark:text-red-300 mb-2">解决方案:</div>
                <ul className="list-disc list-inside text-red-700 dark:text-red-300">{error.solutions.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
              {error.recoverable && <Button onClick={runAnalysis} variant="outline" className="mt-2">重试</Button>}
            </CardContent>
          </Card>
        )}

        {/* 进度显示 */}
        {(isRunning || progress > 0) && (
          <Card className={`mb-6 ${isDark ? 'bg-slate-800' : ''}`} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{currentStatus}</span>
                  {stepName && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded dark:bg-blue-900 dark:text-blue-300">{stepName}</span>}
                </div>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : ''}`}>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {elapsedMs > 0 && (
                <div className={`flex justify-between mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  <span>已用: {formatTime(elapsedMs)}</span>
                  {estimatedRemainingMs > 0 && <span>预计: {formatTime(estimatedRemainingMs)}</span>}
                </div>
              )}
            </CardContent>
          </Card>
        )}


        {/* 角色状态卡片 */}
        {(isRunning || progress > 0) && (
          <Card className={`mb-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                <span>👥</span>
                角色执行状态
                <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  {Object.values(roleStatuses).filter(r => r.status === 'completed').length}/{ROLES.length} 完成
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {ROLES.map((role) => {
                  const status = roleStatuses[role.id];
                  const statusText = status?.status || 'pending';
                  const statusColor = 
                    statusText === 'completed' ? 'bg-green-500' :
                    statusText === 'running' ? 'bg-blue-500 animate-pulse' :
                    statusText === 'failed' ? 'bg-red-500' :
                    statusText === 'skipped' ? 'bg-gray-400' :
                    'bg-gray-300';
                  
                  return (
                    <div 
                      key={role.id}
                      className={`relative p-3 rounded-lg border transition-all duration-300 ${
                        isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'
                      } ${statusText === 'running' ? 'ring-2 ring-blue-400' : ''}`}
                    >
                      <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${statusColor}`} />
                      <div className="flex flex-col items-center text-center">
                        <span className="text-2xl mb-1">{role.icon}</span>
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {role.name}
                        </span>
                        <span className={`text-xs mt-1 ${
                          statusText === 'completed' ? 'text-green-500' :
                          statusText === 'running' ? 'text-blue-500' :
                          statusText === 'failed' ? 'text-red-500' :
                          statusText === 'skipped' ? 'text-gray-400' :
                          'text-gray-400'
                        }`}>
                          {statusText === 'completed' ? '✓ 完成' :
                           statusText === 'running' ? '● 执行中' :
                           statusText === 'failed' ? '✗ 失败' :
                           statusText === 'skipped' ? '○ 跳过' :
                           '○ 等待'}
                        </span>
                      </div>
                      {status?.content && statusText !== 'pending' && (
                        <div className={`mt-2 text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {status.content.slice(0, 30)}...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {Object.values(roleStatuses).filter(r => r.status === 'skipped').length > 0 && (
                <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    ⚠️ 以下角色未参与本次分析：
                    {ROLES.filter(r => roleStatuses[r.id]?.status === 'skipped').map(r => r.name).join('、')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 执行摘要 */}
        {executiveSummary && (
          <Card className={`mb-6 border-2 border-indigo-300 ${isDark ? 'bg-indigo-900' : 'bg-indigo-50'}`}>
            <CardHeader><CardTitle className={isDark ? 'text-indigo-300' : 'text-indigo-800'}>📋 执行摘要</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-lg font-medium mb-4 ${isDark ? 'text-indigo-200' : 'text-indigo-900'}`}>{executiveSummary.oneLineSummary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {executiveSummary.keyFindings.length > 0 && (
                  <div>
                    <div className={`font-medium mb-2 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>关键发现</div>
                    <ul className={`text-sm space-y-1 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {executiveSummary.keyFindings.slice(0, 3).map((f, i) => <li key={i}>• {f.slice(0, 80)}...</li>)}
                    </ul>
                  </div>
                )}
                {executiveSummary.recommendations.length > 0 && (
                  <div>
                    <div className={`font-medium mb-2 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>建议</div>
                    <ul className={`text-sm space-y-1 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {executiveSummary.recommendations.slice(0, 3).map((r, i) => <li key={i}>• {r.slice(0, 80)}</li>)}
                    </ul>
                  </div>
                )}
                {executiveSummary.risks.length > 0 && (
                  <div>
                    <div className={`font-medium mb-2 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>风险</div>
                    <ul className={`text-sm space-y-1 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {executiveSummary.risks.slice(0, 3).map((r, i) => <li key={i}>⚠️ {r.slice(0, 80)}</li>)}
                    </ul>
                  </div>
                )}
                {executiveSummary.nextSteps.length > 0 && (
                  <div>
                    <div className={`font-medium mb-2 ${isDark ? 'text-indigo-300' : 'text-indigo-800'}`}>下一步</div>
                    <ul className={`text-sm space-y-1 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {executiveSummary.nextSteps.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <div className={`mt-4 text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>置信度: {(executiveSummary.confidence * 100).toFixed(0)}%</div>
            </CardContent>
          </Card>
        )}

        {/* 风险可视化 */}
        {riskVisualization && (
          <Card className={`mb-6 border-2 border-orange-300 ${isDark ? 'bg-orange-900' : 'bg-orange-50'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-300">
                <span>⚠️</span>风险分析
                <span className={`ml-2 px-2 py-1 rounded text-sm ${getRiskColor(riskVisualization.overallRisk)}`}>{riskVisualization.overallRisk.toUpperCase()}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center gap-4">
                  <span className={`text-2xl font-bold ${isDark ? 'text-orange-400' : 'text-orange-700'}`}>{riskVisualization.riskScore}</span>
                  <span className={isDark ? 'text-orange-400' : 'text-orange-600'}>风险评分</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {riskVisualization.categories.map((c, i) => (
                  <div key={i} className={`p-2 rounded ${getRiskColor(c.level)}`}>
                    <div className="font-medium text-sm">{c.category}</div>
                    <div className="text-xs">{c.level} - {c.score}分</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 审计结果 */}
        {audit && (
          <Card className={`mb-6 border-2 border-purple-300 ${isDark ? 'bg-purple-900' : 'bg-purple-50'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-300">
                <span>🛡️</span>后验审计（10维度）
                <span className={`ml-2 px-2 py-1 rounded text-sm ${audit.overallGrade === 'A' ? 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300' : audit.overallGrade === 'B' ? 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-300' : audit.overallGrade === 'C' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300'}`}>
                  {audit.overallGrade}级 - {audit.overallScore}分
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`mb-4 ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>{audit.summary}</p>
              {audit.dimensions && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {audit.dimensions.map((d: any, i: number) => (
                    <div key={i} className={`p-2 rounded text-center ${d.verified ? 'bg-green-100 dark:bg-green-800' : 'bg-red-100 dark:bg-red-800'}`}>
                      <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{d.name}</div>
                      <div className={`font-bold ${d.verified ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{d.score}分</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 最终决策 */}
        {finalDecision && (
          <Card className={`mb-6 border-2 border-green-300 ${isDark ? 'bg-green-900' : 'bg-green-50'}`}>
            <CardHeader><CardTitle className="text-green-800 dark:text-green-300">✅ 最终决策</CardTitle></CardHeader>
            <CardContent>
              <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>{renderHighlightedContent(finalDecision)}</div>
            </CardContent>
          </Card>
        )}

        {/* 详细报告 */}
        {report && (
          <Card className={`mb-6 ${isDark ? 'bg-slate-800' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className={`flex items-center gap-2 ${isDark ? 'text-white' : ''}`}>
                  <span>📄</span>详细报告
                  {fromCache && <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">来自缓存</span>}
                </CardTitle>
                <div className="flex gap-2 print:hidden">
                  <Button onClick={() => setShowDetails(!showDetails)} variant="outline" size="sm">{showDetails ? '收起' : '展开'}</Button>
                  <Button onClick={() => setShowReportFormats(!showReportFormats)} variant="outline" size="sm">导出</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showReportFormats && (
                <div className="flex flex-wrap gap-2 mb-4 print:hidden">
                  <Button onClick={() => exportReport('markdown')} variant="outline" size="sm">Markdown</Button>
                  <Button onClick={() => exportReport('html')} variant="outline" size="sm">HTML</Button>
                  <Button onClick={() => exportReport('json')} variant="outline" size="sm">JSON</Button>
                  <Button onClick={() => exportReport('excel')} variant="outline" size="sm">Excel</Button>
                </div>
              )}
              {showDetails && <div className={`prose prose-sm max-w-none max-h-96 overflow-y-auto p-4 rounded-lg ${isDark ? 'bg-slate-700 prose-invert' : 'bg-slate-50'}`}>{renderHighlightedContent(report)}</div>}
            </CardContent>
          </Card>
        )}

        {/* 反馈收集 */}
        {showFeedback && decisionId && (
          <FeedbackCollector decisionId={decisionId} query={input} roles={ROLES} onSubmit={handleFeedback} />
        )}

        {/* 示例问题 */}
        {!isRunning && progress === 0 && (
          <Card className={`${isDark ? 'bg-slate-800' : ''} print:hidden`}>
            <CardHeader><CardTitle className={`text-lg ${isDark ? 'text-white' : ''}`}>💡 试试这些问题</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['我想做塑料回收项目，行不行？', '我有12万资金，安徽厂房，能做什么生意？', '1.我有12万能做什么 2.我想做塑料回收行不行 3.对比这两个选项', '光伏安装项目现在还能做吗？'].map((example, i) => (
                  <Button key={i} variant="outline" size="sm" onClick={() => setInput(example)} className={`text-sm ${isDark ? 'border-slate-600 text-slate-300' : ''}`}>{example}</Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 页脚 */}
        <footer className={`text-center mt-8 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} print:hidden`}>
          董事会决策系统 v{VERSION} · 按 / 聚焦输入框 · Ctrl+Enter 提交
        </footer>

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
