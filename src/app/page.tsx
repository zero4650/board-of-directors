'use client';

import dynamic from 'next/dynamic';

// 动态导入决策助手组件（避免SSR问题）
const DecisionAssistant = dynamic(
  () => import('@/components/workflow/DecisionAssistant'),
  { ssr: false }
);

export default function Home() {
  return <DecisionAssistant />;
}
