# Texas Holdem Poker

## 简介

使用 `Socket.io`、`Node.js` 和 `Express` 开发的分布式扑克游戏, 支持多个游戏房间同时运行, 可以在不同设备上玩

## 项目结构

```
Texas Holdem Poker              # 项目主文件
├── GameData/                   # 保存历史记录
├── node_moudules/              # Node.js 依赖包
├── src/                        # 项目源码
│   ├── classes/                # 游戏核心类
│   │   ├── card.js             # 扑克牌类
│   │   ├── deck.js             # 牌组类
│   │   ├── game.js             # 游戏主类
│   │   └── player.js           # 玩家类
│   ├── client/                 # 前端代码
│   │   ├── css/                # 样式文件
│   │   │   ├── font/           # 字体文件
│   │   │   ├── index.css       # 主样式文件
│   │   │   └── materialize.css # Materialize 框架样式(.min是其压缩版本)
│   │   ├── img/                # 图片资源
│   │   ├── js/                 # JavaScript 文件库, 提供UI组件、动画、响应式布局等
│   │   ├── index.html          # 主页面
│   │   └── main.js             # 前端主要逻辑
│   └── server/                 # 后端代码
│       └── app.js              # 服务器主文件
├── package.json                # 项目配置文件
├── README.md                   # 项目说明文档
└── start.bat                   # Windows 快速启动脚本
```

## 技术栈

- 前端：
  - HTML5 + CSS3 + JavaScript
  - Materialize 框架
  - WebSocket 实时通信

- 后端：
  - Node.js + Express
  - Socket.io 实时通信
  - 游戏逻辑和房间管理

## 功能特点

- 支持多房间同时运行
- 实时游戏状态同步
- 响应式设计，支持多设备
- 完整的德州扑克规则实现
- 玩家排行榜系统
- 实时收益统计

## 安装和运行

1. 安装依赖：
```bash
yarn install
```

2. 开发环境运行（支持热重载）：
```bash
yarn dev
```

3. 生产环境运行：
```bash
yarn start
```

4. 访问游戏：
- 开发环境：`http://localhost:3000`
- 外部环境：根据服务器配置访问, 目前使用 Cpolar 内网穿透

## 游戏规则

- 使用标准德州扑克规则
- 支持 2-11 名玩家
- 包含大小盲注系统
- 支持加注、跟注、弃牌等标准操作

## 开发说明

- 前端代码位于 `src/client` 目录
- 后端代码位于 `src/server` 目录
- 游戏核心逻辑位于 `src/classes` 目录
- 使用 WebSocket 进行实时通信
- 支持热重载开发环境

## 许可证

MIT License


