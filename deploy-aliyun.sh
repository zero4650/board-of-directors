#!/bin/bash

echo "=========================================="
echo "董事会决策系统 - 阿里云一键部署"
echo "=========================================="

# 进入项目目录
cd /var/www/board-of-directors

# 拉取最新代码
echo ">>> 拉取最新代码..."
git pull origin main

# 创建环境变量文件
echo ">>> 配置API密钥..."
cat > .env.local << 'EOF'
# DeepSeek API
DEEPSEEK_API_KEY=sk-c67ed195ac274c8a88e807874741a724

# 硅基流动 API
SILICONFLOW_API_KEY=sk-lbrnpecggjkscymgpwlzrxqzinickdzawljnkcussrwbtwoz

# Kimi API
KIMI_API_KEY=sk-rmbU46dFJCIE1IM1N0Z8LozZyUyVKoydIAOk2t5p0fu2ckcT

# 智谱AI API
ZHIPU_API_KEY=5a96faa89d08458695a085dce235929f.SIHsHxyWwudRBMZs

# 阿里百炼 API
ALIYUN_API_KEY=sk-88b55c009efd4d28b4ec4cd8d3460fe1

# 百度 API
BAIDU_API_KEY=RUWhyjD65qBDbDpXFcDNf6VJINunPwp1

# Tavily搜索 API
TAVILY_API_KEY=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

# Serper搜索 API
SERPER_API_KEY=c7f61fa4ba649b9b95eb6221339c6a5f87cadbe6

# OpenRouter API
OPENROUTER_API_KEY=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

# 火山引擎 API
VOLCENGINE_API_KEY=7f368bea-37c4-42aa-af93-d37ef170b266
EOF

echo ">>> API密钥配置完成"

# 安装依赖
echo ">>> 安装依赖..."
npm install

# 构建项目
echo ">>> 构建项目（需要几分钟）..."
npm run build

# 停止旧进程
echo ">>> 停止旧进程..."
pm2 stop board-of-directors 2>/dev/null || true
pm2 delete board-of-directors 2>/dev/null || true

# 启动服务
echo ">>> 启动服务..."
pm2 start npm --name "board-of-directors" -- start

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://121.43.134.211:3000"
echo ""
echo "查看日志: pm2 logs board-of-directors"
echo "重启服务: pm2 restart board-of-directors"
echo "=========================================="
