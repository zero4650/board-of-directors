'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FeedbackData {
  rating: 1 | 2 | 3 | 4 | 5;
  adopted: boolean;
  comment: string;
  correction: string;
  roleFeedback: {
    roleId: string;
    helpful: boolean;
    comment: string;
  }[];
}

interface FeedbackCollectorProps {
  decisionId: string;
  query: string;
  roles: { id: string; name: string }[];
  onSubmit: (feedback: FeedbackData) => void;
}

export function FeedbackCollector({ decisionId, query, roles, onSubmit }: FeedbackCollectorProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [adopted, setAdopted] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [correction, setCorrection] = useState('');
  const [roleFeedback, setRoleFeedback] = useState<Record<string, { helpful: boolean; comment: string }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [learningEffect, setLearningEffect] = useState<any>(null);

  const handleSubmit = async () => {
    const feedback: FeedbackData = {
      rating,
      adopted: adopted === true,
      comment,
      correction,
      roleFeedback: Object.entries(roleFeedback).map(([roleId, data]) => ({
        roleId,
        helpful: data.helpful,
        comment: data.comment,
      })),
    };
    
    // 提交反馈
    onSubmit(feedback);
    
    // 调用API进行深度学习
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...feedback, decisionId }),
      });
      
      const result = await response.json();
      if (result.success && result.learningEffect) {
        setLearningEffect(result.learningEffect);
      }
    } catch (e) {}
    
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card className="border-green-300 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-green-700 font-medium">感谢您的反馈！系统已深度学习。</p>
          </div>
          
          {learningEffect && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
              <h4 className="font-medium text-slate-700 mb-2">📊 学习效果</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">已学习规则：</span>
                  <span className="font-medium">{learningEffect.rulesLearned}条</span>
                </div>
                <div>
                  <span className="text-slate-500">收集案例：</span>
                  <span className="font-medium">{learningEffect.casesCollected}个</span>
                </div>
                <div>
                  <span className="text-slate-500">准确率变化：</span>
                  <span className={`font-medium ${learningEffect.overallImprovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {learningEffect.overallImprovement >= 0 ? '+' : ''}{(learningEffect.overallImprovement * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              {learningEffect.topRules && learningEffect.topRules.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <span className="text-sm text-slate-500">最有效规则：</span>
                  <ul className="text-sm mt-1">
                    {learningEffect.topRules.slice(0, 3).map((r: any, i: number) => (
                      <li key={i} className="text-slate-600">
                        • {r.rule.slice(0, 30)}... ({(r.successRate * 100).toFixed(0)}%成功率)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-300 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-blue-800">📝 反馈收集（系统将深度学习）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 评分 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            整体评分
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star as 1 | 2 | 3 | 4 | 5)}
                className={`text-3xl transition-transform ${rating >= star ? 'scale-110' : 'scale-100'}`}
              >
                {rating >= star ? '⭐' : '☆'}
              </button>
            ))}
          </div>
        </div>

        {/* 是否采纳 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            是否采纳建议？
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setAdopted(true)}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                adopted === true
                  ? 'bg-green-100 border-green-500 text-green-700'
                  : 'bg-white border-slate-300 text-slate-600'
              }`}
            >
              ✅ 采纳
            </button>
            <button
              onClick={() => setAdopted(false)}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                adopted === false
                  ? 'bg-red-100 border-red-500 text-red-700'
                  : 'bg-white border-slate-300 text-slate-600'
              }`}
            >
              ❌ 不采纳
            </button>
          </div>
        </div>

        {/* 评论 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            您的评论（系统将从中学习您的偏好）
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="例如：我更看重利润，不太在意风险..."
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
          />
        </div>

        {/* 修正建议 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            如果有错误，请提供正确信息（系统将学习此规则）
          </label>
          <textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="例如：投资应该是10万，不是15万..."
            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
          />
        </div>

        {/* 角色反馈 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            各角色分析是否有帮助？（将调整角色权重）
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {roles.map((role) => (
              <div key={role.id} className="flex items-center gap-4 p-2 bg-white rounded border">
                <span className="font-medium text-sm w-32">{role.name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRoleFeedback({
                      ...roleFeedback,
                      [role.id]: { helpful: true, comment: roleFeedback[role.id]?.comment || '' },
                    })}
                    className={`px-2 py-1 text-xs rounded ${
                      roleFeedback[role.id]?.helpful === true
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    👍 有帮助
                  </button>
                  <button
                    onClick={() => setRoleFeedback({
                      ...roleFeedback,
                      [role.id]: { helpful: false, comment: roleFeedback[role.id]?.comment || '' },
                    })}
                    className={`px-2 py-1 text-xs rounded ${
                      roleFeedback[role.id]?.helpful === false
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    👎 没帮助
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={adopted === null}
            className="bg-blue-600 hover:bg-blue-700"
          >
            提交反馈并学习
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default FeedbackCollector;
