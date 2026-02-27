import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '董事会 - 商业决策系统',
  description: '11人董事会决策系统，五重防火墙验证，深度学习进化',
  keywords: ['商业决策', '董事会', 'AI决策', '商业分析'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#3b82f6" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
