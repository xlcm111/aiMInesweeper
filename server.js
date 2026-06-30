// =========================
// 扫雷多人对战服务器
// =========================

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = 3000;
const USERS_FILE = path.join(__dirname, "users.json");

// =========================
// 用户存储（内存 + JSON 文件持久化）
// =========================

let usersStore = {};

/** 从文件加载用户 */
function loadUsersFromFile() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            usersStore = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
            console.log(`[用户] 已加载 ${Object.keys(usersStore).length} 个账号`);
        }
    } catch (err) {
        console.error("[用户] 加载失败:", err.message);
        usersStore = {};
    }
}

/** 保存用户到文件 */
function saveUsersToFile() {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersStore, null, 2), "utf-8");
    } catch (err) {
        console.error("[用户] 保存失败:", err.message);
    }
}

/** SHA-256 哈希 */
function sha256(str) {
    return crypto.createHash("sha256").update(str).digest("hex");
}

loadUsersFromFile();

// =========================
// MIME 类型
// =========================

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
};

// =========================
// JSON 请求体解析
// =========================

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error("无效的 JSON"));
            }
        });
        req.on("error", reject);
    });
}

// =========================
// CORS & JSON 响应工具
// =========================

function setCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJSON(res, status, data) {
    setCORS(res);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
}

// =========================
// HTTP 服务（API + 静态文件）
// =========================

const server = http.createServer(async (req, res) => {
    // CORS 预检
    if (req.method === "OPTIONS") {
        setCORS(res);
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // =========================
    // API 路由
    // =========================

    // POST /api/register
    if (req.method === "POST" && pathname === "/api/register") {
        try {
            const body = await parseBody(req);
            const { username, password } = body;

            if (!username || !password) {
                return sendJSON(res, 400, { ok: false, message: "用户名和密码不能为空" });
            }
            if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) {
                return sendJSON(res, 400, { ok: false, message: "用户名需为4-20位字母/数字/下划线" });
            }
            if (password.length < 6 || password.length > 30) {
                return sendJSON(res, 400, { ok: false, message: "密码需为6-30位" });
            }

            // 用户名唯一性校验（大小写不敏感，防止 "Xlcm1" 和 "xlcm1" 被视为不同账号）
            const normalizedKey = username.toLowerCase();
            const existingEntry = Object.entries(usersStore).find(
                ([key]) => key.toLowerCase() === normalizedKey
            );
            if (existingEntry) {
                const existingName = existingEntry[0]; // 原始大小写的用户名
                return sendJSON(res, 409, {
                    ok: false,
                    message: `该用户名已被注册（已存在账号：${existingName}），请直接登录或换个名字`,
                });
            }

            // 以原始大小写存储用户名 key，保留用户输入的大小写偏好
            usersStore[username] = {
                passwordHash: sha256(password),
                createdAt: new Date().toISOString(),
                nickname: username,
                avatar: "👤",
                stats: { games: 0, wins: 0, losses: 0, totalSeconds: 0, history: [], bestTimes: { beginner: null, intermediate: null, expert: null } },
                friends: [],
                friendRequestsSent: [],
                friendRequestsReceived: [],
            };

            saveUsersToFile();
            console.log(`[注册] 新用户: ${username}`);
            return sendJSON(res, 201, { ok: true, message: "注册成功" });
        } catch (err) {
            return sendJSON(res, 400, { ok: false, message: err.message });
        }
    }

    // POST /api/login
    if (req.method === "POST" && pathname === "/api/login") {
        try {
            const body = await parseBody(req);
            const { username, password } = body;

            if (!username || !password) {
                return sendJSON(res, 400, { ok: false, message: "用户名和密码不能为空" });
            }

            // 大小写不敏感查找用户（"Xlcm1" 和 "xlcm1" 视为同一账号）
            const normalizedKey = username.toLowerCase();
            const existingEntry = Object.entries(usersStore).find(
                ([key]) => key.toLowerCase() === normalizedKey
            );
            if (!existingEntry) {
                return sendJSON(res, 401, { ok: false, message: "用户不存在" });
            }

            const [storedKey, user] = existingEntry;

            if (sha256(password) !== user.passwordHash) {
                return sendJSON(res, 401, { ok: false, message: "密码错误" });
            }

            console.log(`[登录] ${storedKey}`);
            return sendJSON(res, 200, {
                ok: true,
                message: "登录成功",
                user: {
                    username: storedKey,
                    nickname: user.nickname || storedKey,
                    avatar: user.avatar || "👤",
                    createdAt: user.createdAt,
                    stats: user.stats,
                    friends: user.friends || [],
                    friendRequestsSent: user.friendRequestsSent || [],
                    friendRequestsReceived: user.friendRequestsReceived || [],
                },
            });
        } catch (err) {
            return sendJSON(res, 400, { ok: false, message: err.message });
        }
    }

    // POST /api/save-profile  — 保存个人资料（昵称/头像）
    if (req.method === "POST" && pathname === "/api/save-profile") {
        try {
            const body = await parseBody(req);
            const { username, nickname, avatar } = body;
            // 大小写不敏感查找
            const normalizedKey = (username || "").toLowerCase();
            const existingEntry = Object.entries(usersStore).find(
                ([key]) => key.toLowerCase() === normalizedKey
            );
            if (!existingEntry) return sendJSON(res, 404, { ok: false, message: "用户不存在" });

            const [storedKey, user] = existingEntry;
            if (nickname) user.nickname = nickname.substring(0, 12);
            if (avatar) user.avatar = avatar;
            saveUsersToFile();
            return sendJSON(res, 200, { ok: true, message: "资料已保存", username: storedKey });
        } catch (err) {
            return sendJSON(res, 400, { ok: false, message: err.message });
        }
    }

    // POST /api/save-stats  — 保存游戏统计数据
    if (req.method === "POST" && pathname === "/api/save-stats") {
        try {
            const body = await parseBody(req);
            const { username, stats, friends, friendRequestsSent, friendRequestsReceived } = body;
            // 大小写不敏感查找
            const normalizedKey = (username || "").toLowerCase();
            const existingEntry = Object.entries(usersStore).find(
                ([key]) => key.toLowerCase() === normalizedKey
            );
            if (!existingEntry) return sendJSON(res, 404, { ok: false, message: "用户不存在" });

            const [storedKey, user] = existingEntry;
            if (stats) user.stats = stats;
            if (friends) user.friends = friends;
            if (friendRequestsSent) user.friendsRequestsSent = friendRequestsSent;
            if (friendRequestsReceived) user.friendsRequestsReceived = friendRequestsReceived;
            saveUsersToFile();
            return sendJSON(res, 200, { ok: true, message: "数据已同步" });
        } catch (err) {
            return sendJSON(res, 400, { ok: false, message: err.message });
        }
    }

    // GET /api/leaderboard?by=wins|winrate|beginner|intermediate|expert
    if (req.method === "GET" && pathname === "/api/leaderboard") {
        const by = url.searchParams.get("by") || "wins";
        const entries = [];

        for (const [username, user] of Object.entries(usersStore)) {
            const stats = user.stats || {};
            entries.push({
                username,
                nickname: user.nickname || username,
                avatar: user.avatar || "👤",
                games: stats.games || 0,
                wins: stats.wins || 0,
                losses: stats.losses || 0,
                winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
                bestTimes: stats.bestTimes || {},
            });
        }

        if (by === "winrate") {
            entries.sort((a, b) => b.winRate - a.winRate || b.games - a.games);
        } else if (by === "wins") {
            entries.sort((a, b) => b.wins - a.wins);
        } else if (["beginner", "intermediate", "expert"].includes(by)) {
            entries.sort((a, b) => {
                const ta = a.bestTimes[by], tb = b.bestTimes[by];
                if (ta === null || ta === undefined) return 1;
                if (tb === null || tb === undefined) return -1;
                return ta - tb;
            });
        }

        return sendJSON(res, 200, { ok: true, leaderboard: entries.slice(0, 50) });
    }

    // =========================
    // 静态文件服务
    // =========================
    let filePath = pathname === "/" ? "/index.html" : pathname;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not Found");
            return;
        }
        setCORS(res);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    });
});

// =========================
// WebSocket 服务
// =========================

const wss = new WebSocketServer({ server });

// =========================
// 在线用户 & 房间存储
// =========================

const rooms = new Map();
const onlineUsers = new Map();  // username → { ws, clientId }

// =========================
// 工具函数
// =========================

/** 生成 6 位大写字母数字房间码 */
function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 排除容易混淆的 0/O/1/I
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    // 防碰撞
    if (rooms.has(code)) return generateRoomCode();
    return code;
}

/** 生成随机 ID */
function generateId() {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * 生成雷图
 * @param {number} rows
 * @param {number} cols
 * @param {number} mineCount
 * @returns {{ r: number, c: number }[]}
 */
function generateMineLayout(rows, cols, mineCount) {
    // 随机选一个安全格
    const safeRow = Math.floor(Math.random() * rows);
    const safeCol = Math.floor(Math.random() * cols);

    // 候选格（排除安全格及其周围8格）
    const candidates = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1) continue;
            candidates.push({ r, c });
        }
    }

    // Fisher-Yates 洗牌
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const actualMines = Math.min(mineCount, candidates.length);
    return candidates.slice(0, actualMines);
}

/**
 * 向房间内所有玩家广播消息
 */
function broadcast(room, message, excludeWs) {
    const data = JSON.stringify(message);
    for (const player of room.players) {
        if (player.ws !== excludeWs && player.ws.readyState === 1) {
            player.ws.send(data);
        }
    }
}

/**
 * 向单个玩家发送消息
 */
function sendTo(ws, message) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(message));
    }
}

/**
 * 获取房间玩家列表（不含 WebSocket 引用）
 */
function getPlayerList(room) {
    return room.players.map(p => ({
        id: p.id,
        username: p.username,
        isHost: p.isHost,
        alive: p.alive,
        finished: p.finished,
        openedCount: p.openedCount,
        flagCount: p.flagCount,
        seconds: p.seconds,
    }));
}

/**
 * 获取排名
 */
function getRankings(room) {
    const finished = room.players
        .filter(p => p.finished && p.alive)
        .sort((a, b) => (a.endTime - a.startTime) - (b.endTime - b.startTime));

    const dead = room.players.filter(p => !p.alive);
    const running = room.players.filter(p => !p.finished && p.alive);

    const rankings = [
        ...finished.map((p, i) => ({
            rank: i + 1,
            username: p.username,
            result: "win",
            seconds: p.seconds,
            time: p.endTime ? Math.round((p.endTime - p.startTime) / 1000) : p.seconds,
        })),
        ...running.map(p => ({
            rank: null,
            username: p.username,
            result: "unfinished",
            seconds: p.seconds,
        })),
        ...dead.map(p => ({
            rank: null,
            username: p.username,
            result: "lose",
            seconds: p.seconds,
        })),
    ];

    return rankings;
}

// =========================
// WebSocket 连接处理
// =========================

wss.on("connection", (ws) => {
    const clientId = generateId();
    let currentRoomCode = null;
    let currentPlayerId = null;

    console.log(`[连接] 新客户端: ${clientId}`);

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch (_) {
            sendTo(ws, { type: "error", message: "无效的消息格式" });
            return;
        }

        switch (msg.type) {

            // =========================
            // 创建房间
            // =========================
            case "create_room": {
                if (currentRoomCode) {
                    sendTo(ws, { type: "error", message: "你已在房间中" });
                    return;
                }

                const username = (msg.username || "Guest").substring(0, 20);
                const roomCode = generateRoomCode();

                const player = {
                    id: generateId(),
                    ws: ws,
                    username: username,
                    isHost: true,
                    alive: true,
                    finished: false,
                    openedCount: 0,
                    flagCount: 0,
                    seconds: 0,
                    startTime: null,
                    endTime: null,
                };

                const room = {
                    code: roomCode,
                    hostId: player.id,
                    players: [player],
                    difficulty: msg.difficulty || { rows: 9, cols: 9, mines: 10 },
                    mineLayout: null,
                    state: "lobby", // "lobby" | "playing" | "finished"
                };

                rooms.set(roomCode, room);
                currentRoomCode = roomCode;
                currentPlayerId = player.id;

                sendTo(ws, {
                    type: "room_created",
                    roomCode: roomCode,
                    players: getPlayerList(room),
                    difficulty: room.difficulty,
                });

                console.log(`[房间] ${username} 创建了房间 ${roomCode}`);
                break;
            }

            // =========================
            // 加入房间
            // =========================
            case "join_room": {
                if (currentRoomCode) {
                    sendTo(ws, { type: "error", message: "你已在房间中" });
                    return;
                }

                const roomCode = (msg.roomCode || "").toUpperCase().trim();
                const room = rooms.get(roomCode);

                if (!room) {
                    sendTo(ws, { type: "error", message: "房间不存在" });
                    return;
                }

                if (room.state !== "lobby") {
                    sendTo(ws, { type: "error", message: "游戏已开始，无法加入" });
                    return;
                }

                if (room.players.length >= 4) {
                    sendTo(ws, { type: "error", message: "房间已满（最多4人）" });
                    return;
                }

                const username = (msg.username || "Guest").substring(0, 20);

                // 检查用户名是否与已有玩家重名
                const nameExists = room.players.some(p => p.username === username);
                const displayName = nameExists ? username + "_" + generateId().substring(0, 3) : username;

                // 首个加入者自动成为房主
                const isFirstPlayer = room.players.length === 0;

                const player = {
                    id: generateId(),
                    ws: ws,
                    username: displayName,
                    isHost: isFirstPlayer,
                    alive: true,
                    finished: false,
                    openedCount: 0,
                    flagCount: 0,
                    seconds: 0,
                    startTime: null,
                    endTime: null,
                };

                if (isFirstPlayer) {
                    room.hostId = player.id;
                }

                room.players.push(player);
                currentRoomCode = roomCode;
                currentPlayerId = player.id;

                const playerList = getPlayerList(room);

                // 通知新玩家
                sendTo(ws, {
                    type: "room_joined",
                    roomCode: roomCode,
                    players: playerList,
                    difficulty: room.difficulty,
                    yourId: player.id,
                });

                // 通知房间内其他人
                broadcast(room, {
                    type: "player_joined",
                    player: {
                        id: player.id,
                        username: player.username,
                        isHost: false,
                        alive: true,
                        finished: false,
                        openedCount: 0,
                        flagCount: 0,
                        seconds: 0,
                    },
                    players: playerList,
                }, ws);

                console.log(`[房间] ${displayName} 加入了房间 ${roomCode} (${room.players.length}/4)`);
                break;
            }

            // =========================
            // 离开房间
            // =========================
            case "leave_room": {
                if (!currentRoomCode) break;

                const room = rooms.get(currentRoomCode);
                if (!room) break;

                const playerIdx = room.players.findIndex(p => p.id === currentPlayerId);
                if (playerIdx === -1) break;

                const wasHost = room.players[playerIdx].isHost;
                const leftUsername = room.players[playerIdx].username;
                room.players.splice(playerIdx, 1);

                if (room.players.length === 0) {
                    // 房间空了，删除
                    rooms.delete(currentRoomCode);
                    console.log(`[房间] ${currentRoomCode} 已关闭（无玩家）`);
                } else {
                    // 如果离开的是房主，转移房主
                    if (wasHost) {
                        room.players[0].isHost = true;
                        room.hostId = room.players[0].id;
                    }

                    const playerList = getPlayerList(room);
                    broadcast(room, {
                        type: "player_left",
                        username: leftUsername,
                        players: playerList,
                    });
                }

                sendTo(ws, { type: "left_room" });
                currentRoomCode = null;
                currentPlayerId = null;
                console.log(`[房间] ${leftUsername} 离开了房间`);
                break;
            }

            // =========================
            // 开始游戏
            // =========================
            case "start_game": {
                if (!currentRoomCode) {
                    sendTo(ws, { type: "error", message: "你不在房间中" });
                    return;
                }

                const room = rooms.get(currentRoomCode);
                if (!room) break;

                const player = room.players.find(p => p.id === currentPlayerId);
                if (!player || !player.isHost) {
                    sendTo(ws, { type: "error", message: "只有房主可以开始游戏" });
                    return;
                }

                if (room.players.length < 2) {
                    sendTo(ws, { type: "error", message: "至少需要2名玩家" });
                    return;
                }

                if (room.state !== "lobby") {
                    sendTo(ws, { type: "error", message: "游戏已在进行中" });
                    return;
                }

                // 应用难度
                const diff = msg.difficulty || room.difficulty;
                room.difficulty = diff;

                // 生成雷图
                const mineLayout = generateMineLayout(diff.rows, diff.cols, diff.mines);
                room.mineLayout = mineLayout;
                room.state = "playing";

                // 重置所有玩家状态
                const now = Date.now();
                for (const p of room.players) {
                    p.alive = true;
                    p.finished = false;
                    p.openedCount = 0;
                    p.flagCount = 0;
                    p.seconds = 0;
                    p.startTime = now;
                    p.endTime = null;
                }

                // 广播游戏开始
                const gameStartMsg = {
                    type: "game_started",
                    mineLayout: mineLayout,
                    rows: diff.rows,
                    cols: diff.cols,
                    mines: diff.mines,
                    players: getPlayerList(room),
                };

                for (const p of room.players) {
                    sendTo(p.ws, gameStartMsg);
                }

                console.log(`[游戏] 房间 ${currentRoomCode} 游戏开始 (${diff.rows}x${diff.cols}, ${diff.mines}雷)`);
                break;
            }

            // =========================
            // 翻开格子
            // =========================
            case "cell_open": {
                if (!currentRoomCode) break;
                const room = rooms.get(currentRoomCode);
                if (!room || room.state !== "playing") break;

                const player = room.players.find(p => p.id === currentPlayerId);
                if (!player) break;

                player.openedCount = msg.openedCount ?? player.openedCount;
                player.seconds = msg.seconds ?? player.seconds;

                // 广播进度给其他玩家
                broadcast(room, {
                    type: "player_progress",
                    playerId: player.id,
                    username: player.username,
                    openedCount: player.openedCount,
                    flagCount: player.flagCount,
                    seconds: player.seconds,
                    alive: player.alive,
                    finished: player.finished,
                }, ws);
                break;
            }

            // =========================
            // 插旗更新
            // =========================
            case "cell_flag": {
                if (!currentRoomCode) break;
                const room = rooms.get(currentRoomCode);
                if (!room || room.state !== "playing") break;

                const player = room.players.find(p => p.id === currentPlayerId);
                if (!player) break;

                player.flagCount = msg.flagCount ?? player.flagCount;
                player.seconds = msg.seconds ?? player.seconds;

                broadcast(room, {
                    type: "player_progress",
                    playerId: player.id,
                    username: player.username,
                    openedCount: player.openedCount,
                    flagCount: player.flagCount,
                    seconds: player.seconds,
                    alive: player.alive,
                    finished: player.finished,
                }, ws);
                break;
            }

            // =========================
            // 游戏结果
            // =========================
            case "game_result": {
                if (!currentRoomCode) break;
                const room = rooms.get(currentRoomCode);
                if (!room || room.state !== "playing") break;

                const player = room.players.find(p => p.id === currentPlayerId);
                if (!player || player.finished) break;

                player.finished = true;
                player.alive = (msg.result === "win");
                player.seconds = msg.seconds ?? player.seconds;
                player.endTime = Date.now();

                const rankings = getRankings(room);

                // 广播玩家结果
                broadcast(room, {
                    type: "player_result",
                    username: player.username,
                    playerId: player.id,
                    result: msg.result,
                    seconds: player.seconds,
                    rankings: rankings,
                });

                // 检查是否所有玩家都完成了
                const allDone = room.players.every(p => p.finished);
                if (allDone) {
                    room.state = "finished";
                    const finalRankings = getRankings(room);
                    broadcast(room, {
                        type: "game_ended",
                        rankings: finalRankings,
                    });
                    console.log(`[游戏] 房间 ${currentRoomCode} 游戏结束`);
                }

                console.log(`[游戏] ${player.username}: ${msg.result} (${player.seconds}s)`);
                break;
            }

            // =========================
            // 准备再来一局
            // =========================
            case "play_again": {
                if (!currentRoomCode) break;
                const room = rooms.get(currentRoomCode);
                if (!room) break;

                const player = room.players.find(p => p.id === currentPlayerId);
                if (!player || !player.isHost) {
                    sendTo(ws, { type: "error", message: "只有房主可以开始新一局" });
                    return;
                }

                // 重置房间状态
                room.state = "lobby";
                room.mineLayout = null;
                const now = Date.now();
                for (const p of room.players) {
                    p.alive = true;
                    p.finished = false;
                    p.openedCount = 0;
                    p.flagCount = 0;
                    p.seconds = 0;
                    p.startTime = null;
                    p.endTime = null;
                }

                const playerList = getPlayerList(room);
                broadcast(room, {
                    type: "room_reset",
                    players: playerList,
                    difficulty: room.difficulty,
                });

                console.log(`[房间] ${currentRoomCode} 已重置，等待新一局`);
                break;
            }

            // =========================
            // 更新难度（仅房主）
            // =========================
            case "update_difficulty": {
                if (!currentRoomCode) break;
                const room = rooms.get(currentRoomCode);
                if (!room) break;

                const player = room.players.find(p => p.id === currentPlayerId);
                if (!player || !player.isHost) {
                    sendTo(ws, { type: "error", message: "只有房主可以更改难度" });
                    return;
                }

                if (room.state !== "lobby") {
                    sendTo(ws, { type: "error", message: "游戏进行中无法更改难度" });
                    return;
                }

                room.difficulty = msg.difficulty || room.difficulty;
                broadcast(room, {
                    type: "difficulty_updated",
                    difficulty: room.difficulty,
                });
                break;
            }

            // =========================
            // 设置在线用户名（好友系统用）
            // =========================
            case "set_username": {
                const uname = (msg.username || "").trim();
                if (uname) {
                    // 如果该用户名之前有别的连接，先踢掉旧连接
                    const old = onlineUsers.get(uname);
                    if (old && old.ws !== ws) {
                        sendTo(old.ws, { type: "kicked", message: "账号在其他地方登录" });
                    }
                    onlineUsers.set(uname, { ws, clientId });
                    sendTo(ws, { type: "username_set", username: uname });
                    console.log(`[在线] ${uname} 上线`);
                }
                break;
            }

            // =========================
            // 好友挑战 — 发起挑战
            // =========================
            case "challenge_friend": {
                const fromName = (msg.from || "").trim();
                const toName = (msg.to || "").trim();
                const difficulty = msg.difficulty || { rows: 9, cols: 9, mines: 10 };

                if (!fromName || !toName) {
                    sendTo(ws, { type: "error", message: "参数不全" });
                    return;
                }

                const target = onlineUsers.get(toName);
                if (!target) {
                    sendTo(ws, { type: "challenge_error", message: `${toName} 当前离线` });
                    return;
                }

                // 通知被挑战者
                sendTo(target.ws, {
                    type: "challenge_received",
                    from: fromName,
                    difficulty: difficulty,
                });

                // 告知发起者已发送
                sendTo(ws, { type: "challenge_sent", to: toName });

                console.log(`[挑战] ${fromName} → ${toName}`);
                break;
            }

            // =========================
            // 好友挑战 — 被挑战者回应
            // =========================
            case "challenge_response": {
                const fromName = (msg.from || "").trim();   // 被挑战者（回应者）
                const toName = (msg.to || "").trim();       // 发起挑战者
                const accepted = msg.accepted === true;
                const difficulty = msg.difficulty || { rows: 9, cols: 9, mines: 10 };

                const challenger = onlineUsers.get(toName);
                if (!challenger) {
                    sendTo(ws, { type: "error", message: "对方已下线" });
                    return;
                }

                if (accepted) {
                    // 创建空房间，双方通过 join_room 加入（复用现有流程）
                    const roomCode = generateRoomCode();

                    const room = {
                        code: roomCode,
                        hostId: null,
                        players: [],
                        difficulty: difficulty,
                        mineLayout: null,
                        state: "lobby",
                    };

                    rooms.set(roomCode, room);

                    // 通知双方房间码
                    sendTo(challenger.ws, {
                        type: "challenge_accepted",
                        roomCode: roomCode,
                        opponent: fromName,
                        difficulty: difficulty,
                    });

                    sendTo(ws, {
                        type: "challenge_accepted",
                        roomCode: roomCode,
                        opponent: toName,
                        difficulty: difficulty,
                    });

                    console.log(`[挑战] ${toName} vs ${fromName} → 房间 ${roomCode}`);
                } else {
                    sendTo(challenger.ws, {
                        type: "challenge_declined",
                        from: fromName,
                        message: `${fromName} 拒绝了你的挑战`,
                    });
                    console.log(`[挑战] ${fromName} 拒绝了 ${toName} 的挑战`);
                }
                break;
            }

            // =========================
            // 好友挑战 — 取消挑战
            // =========================
            case "challenge_cancel": {
                const fromName = (msg.from || "").trim();
                const toName = (msg.to || "").trim();

                const target = onlineUsers.get(toName);
                if (target) {
                    sendTo(target.ws, {
                        type: "challenge_cancelled",
                        from: fromName,
                    });
                }
                break;
            }

            default:
                sendTo(ws, { type: "error", message: "未知消息类型: " + msg.type });
                break;
        }
    });

    // =========================
    // 断线处理
    // =========================
    ws.on("close", () => {
        console.log(`[断开] 客户端: ${clientId}`);

        // 从在线用户中移除
        for (const [uname, entry] of onlineUsers) {
            if (entry.ws === ws) {
                onlineUsers.delete(uname);
                console.log(`[离线] ${uname} 下线`);
                break;
            }
        }

        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const playerIdx = room.players.findIndex(p => p.id === currentPlayerId);
        if (playerIdx === -1) return;

        const player = room.players[playerIdx];
        const wasHost = player.isHost;
        const leftUsername = player.username;

        // 如果游戏进行中，标记为弃权
        if (room.state === "playing" && !player.finished) {
            player.finished = true;
            player.alive = false;
            const rankings = getRankings(room);
            broadcast(room, {
                type: "player_result",
                username: leftUsername,
                playerId: player.id,
                result: "forfeit",
                seconds: player.seconds,
                rankings: rankings,
            });

            // 检查是否全部完成
            const allDone = room.players.every(p => p.finished);
            if (allDone) {
                room.state = "finished";
                broadcast(room, {
                    type: "game_ended",
                    rankings: getRankings(room),
                });
            }
        }

        // 从房间移除
        room.players.splice(playerIdx, 1);

        if (room.players.length === 0) {
            rooms.delete(currentRoomCode);
            console.log(`[房间] ${currentRoomCode} 已关闭（无玩家）`);
        } else {
            if (wasHost) {
                room.players[0].isHost = true;
                room.hostId = room.players[0].id;
            }
            broadcast(room, {
                type: "player_left",
                username: leftUsername,
                players: getPlayerList(room),
            });
        }
    });

    ws.on("error", (err) => {
        console.error(`[错误] 客户端 ${clientId}:`, err.message);
    });
});

// =========================
// 启动
// =========================

/** 计算字符串的可视宽度（CJK 字符计 2，其余计 1） */
function visualWidth(str) {
    let w = 0;
    for (const ch of str) {
        const cp = ch.codePointAt(0);
        if ((cp >= 0x4E00 && cp <= 0x9FFF) ||   // CJK Unified Ideographs
            (cp >= 0x3400 && cp <= 0x4DBF) ||   // CJK Extension A
            (cp >= 0xF900 && cp <= 0xFAFF) ||   // CJK Compatibility
            (cp >= 0xFF01 && cp <= 0xFFE6) ||   // Fullwidth forms
            (cp >= 0x3000 && cp <= 0x303F) ||   // CJK Symbols
            (cp >= 0x20000 && cp <= 0x2FFFF)) { // CJK Extension B+
            w += 2;
        } else {
            w += 1;
        }
    }
    return w;
}

/** 将字符串填充到目标可视宽度（右侧补空格） */
function padR(str, target) {
    const pad = target - visualWidth(str);
    return pad > 0 ? str + " ".repeat(pad) : str;
}

server.listen(PORT, () => {
    const W = 36; // 边框内部宽度（═ 个数）
    // 格式: "  ║" + padR(content, W) + "║"
    //        ^3 cells  ^W cells       ^1 cell = W+4 = 40 cells = 与顶边一致
    const L = (s) => padR(s, W);

    console.log("");
    console.log("  ╔" + "═".repeat(W) + "╗");
    console.log("  ║" + L("     Minesweeper - 扫雷多人对战     ") + "║");
    console.log("  ║" + L("") + "║");
    console.log("  ║" + L("  地址: http://localhost:" + PORT + "  ") + "║");
    console.log("  ║" + L("") + "║");
    console.log("  ║" + L("  1. 打开浏览器访问上方地址  ") + "║");
    console.log("  ║" + L("  2. 创建房间并分享房间码    ") + "║");
    console.log("  ║" + L("  3. 最多 4 人对战           ") + "║");
    console.log("  ╚" + "═".repeat(W) + "╝");
    console.log("");
});
