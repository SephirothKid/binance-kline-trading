# 币安风格K线图交易页面

一个基于Vue3的专业K线图交易界面，模仿币安交易所的设计风格，支持PC端和移动端适配。

## 功能特性

### 核心功能

- **实时K线图**: 使用 Lightweight Charts 库展示专业的蜡烛图
- **实时数据**: 集成币安WebSocket API获取实时价格数据
- **多时间周期**: 支持3分钟、5分钟、15分钟、1小时、日线等
- **技术指标**: 已实现MA均线指标（MA5、MA10、MA20、MA60）
- **币对选择**: 已实现币对选择器（支持BTC、ETH、BNB、DOGE、SOL）
- **价格信息**: 实时显示当前价格、24小时变化、最高最低价等

### 响应式设计

- **设备检测**: 自动检测设备类型并跳转到对应页面
- **PC端**: 完整的交易界面，包含详细的价格信息和图表
- **移动端**: 简化的移动端界面，优化触摸操作体验

### 🎨 UI设计

- **深色主题**: 专业的深色交易界面
- **币安风格**: 模仿币安交易所的视觉设计
- **流畅动画**: 平滑的过渡动画和交互效果

## 快速开始

1. 确保已安装Node.js (版本 >= 16)
2. 安装依赖：

   ```bash
   npm install
   ```

3. 启动开发服务器：

   ```bash
   npm run dev
   ```

4. 在浏览器中访问 `http://localhost:3000`

## 技术栈

- **前端框架**: Vue 3 + Composition API
- **构建工具**: Vite
- **图表库**: Lightweight Charts
- **样式框架**: TailwindCSS
- **CSS预处理器**: Less
- **路由**: Vue Router 4
- **API**: 币安公开API + WebSocket

## API说明

### 币安API集成

- **REST API**: 获取历史K线数据和24小时统计
- **WebSocket**: 实时K线数据推送
- **数据格式**: 标准OHLCV格式

### 主要接口

- `GET /api/v3/klines` - 获取历史K线数据
- `GET /api/v3/ticker/24hr` - 获取24小时价格统计
- `WSS /ws/{symbol}@kline_{interval}` - 实时K线数据

## 许可证

MIT License
