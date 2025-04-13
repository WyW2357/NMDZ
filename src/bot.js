const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

// 清空BotData.txt
function clearBotData() {
    try {
        const botDataPath = path.join(__dirname, '../BotData.txt');
        fs.writeFileSync(botDataPath, '');
    } catch (error) {
        console.error('清空BotData.txt失败:', error);
    }
}

// 从GameData.txt获取房间号
function getRoomCode() {
    try {
        const gameDataPath = path.join(__dirname, '../GameData.txt');
        const data = fs.readFileSync(gameDataPath, 'utf8');
        const roomCodeMatch = data.match(/房间号: (\d+)/);
        if (roomCodeMatch && roomCodeMatch[1]) {
            return roomCodeMatch[1];
        }
    } catch (error) {
        console.error('读取GameData.txt失败:', error);
    }
    return null;
}

// 写入数据到BotData.txt
function writeToFile(data) {
    try {
        const botDataPath = path.join(__dirname, '../BotData.txt');
        let logEntry;
        
        if (typeof data === 'string') {
            logEntry = `${data}\n`;
        } else {
            logEntry = `${JSON.stringify(data, null, 2)}\n`;
        }
        
        fs.appendFileSync(botDataPath, logEntry);
    } catch (error) {
        console.error('写入BotData.txt失败:', error);
    }
}

// 清空BotData.txt
clearBotData();

const socket = io('http://localhost:3000');

// 机器人配置
const BOT_NAME = 'BOT';
let ROOM_CODE = getRoomCode();

// 连接到服务器
socket.on('connect', () => {
    writeToFile('机器人已连接到服务器');
    if (!ROOM_CODE) {
        writeToFile('无法获取房间号，请确保GameData.txt文件存在且包含有效的房间号');
        return;
    }
    writeToFile('尝试加入房间: ' + ROOM_CODE);
    // 加入指定房间
    socket.emit('join', {
        code: ROOM_CODE,
        username: BOT_NAME
    });
});

// 监听游戏开始
socket.on('startGame', () => {
    writeToFile('游戏已开始');
});

let HandCards = [];

socket.on('dealt', (data) => {
    HandCards = data.cards;
});

// 监听游戏状态更新
socket.on('rerender', (data) => {
    if (data.username === BOT_NAME && data.myStatus === 'Their Turn') {
        // 记录关键信息
        const botData = {
            mycards: HandCards,
            community: data.community,
            bets: data.bets,
            pot: data.pot,
            playersToAI: data.playersToAI,
        };
        writeToFile(botData);
        writeToFile('轮到机器人行动');
        
        // 计算需要跟注的金额
        const callAmount = data.topBet - data.myBet;
        if (callAmount > 0) {
            writeToFile('跟注金额: ' + callAmount);
            // 自动跟注
            socket.emit('moveMade', { move: 'call', bet: callAmount });
        } else {
            writeToFile('无需跟注，选择过牌');
            // 如果没有需要跟注的金额，则过牌
            socket.emit('moveMade', { move: 'check', bet: 'Check' });
        }
    }
});

// 监听游戏结束
socket.on('roundOver', (data) => {
    writeToFile('游戏结束');
});

// 监听错误
socket.on('error', (error) => {
    writeToFile('发生错误: ' + error);
});

// 监听断开连接
socket.on('disconnect', () => {
    writeToFile('机器人已断开连接');
});

// 监听加入房间成功
socket.on('joinRoom', (data) => {
    if (data) {
        writeToFile('成功加入房间: ' + data.host + '的房间');
    } else {
        writeToFile('加入房间失败');
    }
});

// 监听等待下一轮
socket.on('waitingForNextRound', (data) => {
    writeToFile('等待下一轮游戏开始');
    writeToFile('当前房间: ' + data.host + '的房间');
    writeToFile('当前玩家: ' + data.players.join(', '));
}); 