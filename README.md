# 💣 扫雷 — Minesweeper 多人对战

一个基于 Web 的经典扫雷游戏，支持单人经典模式与多人实时对战。采用 Node.js + WebSocket 构建，前端使用原生 HTML/CSS/JS。

## ✨ 功能

- 🎮 **经典模式** — 重温经典扫雷玩法，支持左键翻开、右键插旗
- 🌐 **多人对战** — 实时匹配，与朋友比拼速度和准确度
- 📊 **三种难度** — 初级 (9×9 · 10雷)、中级 (16×16 · 40雷)、高级 (30×16 · 99雷)
- 👤 **账号系统** — 注册/登录，记录个人最佳成绩
- 🌗 **暗色主题** — 带动态粒子背景的沉浸式视觉体验
- 📱 **响应式布局** — 适配不同屏幕尺寸

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 16

### 安装与运行

```bash
# 克隆项目
git clone <repo-url>
cd MInesweeper

# 安装依赖
npm install

# 启动服务器
npm start
```

或者直接双击运行 `start-multiplayer.bat`（Windows）。

打开浏览器访问 **http://localhost:3000** 即可开始游戏。

## 📁 项目结构

```
MInesweeper/
├── index.html              # 前端页面
├── style.css               # 样式（暗色主题 + 动画）
├── script.js               # 前端游戏逻辑
├── server.js               # Node.js 后端服务器
├── users.json              # 用户数据持久化
├── package.json            # 项目配置
└── start-multiplayer.bat   # Windows 一键启动脚本
```

## 🛠️ 技术栈

| 层级   | 技术                          |
| ------ | ----------------------------- |
| 前端   | HTML5, CSS3, JavaScript (ES6) |
| 后端   | Node.js, WebSocket (ws)       |
| 通信   | HTTP + WebSocket              |

## 📝 License

MIT © xlcm111
