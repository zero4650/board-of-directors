// 多平台API调用层 - 带故障转移
import { ModelConfig } from './config';

// API密钥（从环境变量读取）
const API_KEYS: Record<string, string> = {
  SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY || '',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
  KIMI_API_KEY: process.env.KIMI_API_KEY || '',
  ZHIPU_API_KEY: process.env.ZHIPU_API_KEY || '',
  ALIYUN_API_KEY: process.env.ALIYUN_API_KEY || '',
  BAIDU_API_KEY: process.env.BAIDU_API_KEY || '',
  TAVILY_API_KEY: process.env.TAVILY_API_KEY || '',
  SERPER_API_KEY: process.env.SERPER_API_KEY || '',
};

// 调用结果
export interface CallResult {
  success: boolean;
  content: string;
  model: string;
  provider: string;
  latency: number;
  fallback?: boolean;
  fallbackLevel?: number;
  error?: string;
}

// 调用日志
export interface CallLog {
  role: string;
  model: string;
  provider: string;
  success: boolean;
  latency: number;
  fallback: boolean;
  timestamp: Date;
  error?: string;
}

// 全局调用日志
const callLogs: CallLog[] = [];

// 获取调用日志
export function getCallLogs(): CallLog[] {
  return callLogs;
}

// 获取API密钥
function getApiKey(envKey: string): string {
  return API_KEYS[envKey] || '';
}

// OpenAI兼容格式调用
async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  timeout: number = 30000
): Promise<{ content: string; latency: number }> {
  const startTime = Date.now();
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API错误 ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const latency = Date.now() - startTime;
    
    return { content, latency };
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 智谱AI特殊格式调用
async function callZhipu(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  timeout: number = 30000
): Promise<{ content: string; latency: number }> {
  const startTime = Date.now();
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`智谱API错误 ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const latency = Date.now() - startTime;
    
    return { content, latency };
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 带故障转移的调用
export async function callWithFallback(
  roleId: string,
  systemPrompt: string,
  userMessage: string,
  models: ModelConfig[],
  onProgress?: (status: string) => void
): Promise<CallResult> {
  let lastError: string = '';
  
  for (let i = 0; i < models.length; i++) {
    const modelConfig = models[i];
    const apiKey = getApiKey(modelConfig.apiKeyEnv);
    
    if (!apiKey) {
      lastError = `API密钥未配置: ${modelConfig.apiKeyEnv}`;
      continue;
    }
    
    onProgress?.(`正在调用 ${modelConfig.name}...`);
    
    try {
      let result: { content: string; latency: number };
      
      // 智谱AI需要特殊处理
      if (modelConfig.provider === 'zhipu') {
        result = await callZhipu(apiKey, modelConfig.model, systemPrompt, userMessage);
      } else {
        result = await callOpenAICompatible(
          modelConfig.baseUrl,
          apiKey,
          modelConfig.model,
          systemPrompt,
          userMessage
        );
      }
      
      // 记录成功日志
      callLogs.push({
        role: roleId,
        model: modelConfig.model,
        provider: modelConfig.provider,
        success: true,
        latency: result.latency,
        fallback: i > 0,
        timestamp: new Date(),
      });
      
      return {
        success: true,
        content: result.content,
        model: modelConfig.model,
        provider: modelConfig.provider,
        latency: result.latency,
        fallback: i > 0,
        fallbackLevel: i,
      };
      
    } catch (error: any) {
      lastError = error.message;
      
      // 记录失败日志
      callLogs.push({
        role: roleId,
        model: modelConfig.model,
        provider: modelConfig.provider,
        success: false,
        latency: 0,
        fallback: false,
        timestamp: new Date(),
        error: error.message,
      });
      
      onProgress?.(`${modelConfig.name} 调用失败，尝试备用平台...`);
      
      // 继续尝试下一个平台
      continue;
    }
  }
  
  // 所有平台都失败
  return {
    success: false,
    content: '',
    model: '',
    provider: '',
    latency: 0,
    error: `所有平台调用失败: ${lastError}`,
  };
}

// 搜索验证 - Tavily
export async function searchTavily(query: string): Promise<{ success: boolean; results: any[] }> {
  const apiKey = getApiKey('TAVILY_API_KEY');
  
  if (!apiKey) {
    return { success: false, results: [] };
  }
  
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5,
      }),
    });
    
    if (!response.ok) {
      return { success: false, results: [] };
    }
    
    const data = await response.json();
    return { success: true, results: data.results || [] };
  } catch (error) {
    return { success: false, results: [] };
  }
}

// 搜索验证 - Serper
export async function searchSerper(query: string): Promise<{ success: boolean; results: any[] }> {
  const apiKey = getApiKey('SERPER_API_KEY');
  
  if (!apiKey) {
    return { success: false, results: [] };
  }
  
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        q: query,
      }),
    });
    
    if (!response.ok) {
      return { success: false, results: [] };
    }
    
    const data = await response.json();
    return { success: true, results: data.organic || [] };
  } catch (error) {
    return { success: false, results: [] };
  }
}

// 双重搜索验证
export async function searchWithVerification(query: string): Promise<{
  success: boolean;
  tavilyResults: any[];
  serperResults: any[];
  combined: any[];
}> {
  const [tavily, serper] = await Promise.all([
    searchTavily(query),
    searchSerper(query),
  ]);
  
  return {
    success: tavily.success || serper.success,
    tavilyResults: tavily.results,
    serperResults: serper.results,
    combined: [...tavily.results, ...serper.results],
  };
}
