// 服务器端 socket.io 后端事件处理
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const Game = require('../classes/game.js');
const path = require('path');
// 创建 Express 应用和 HTTP 服务器
const app = express();
const server = http.createServer(app);
// 初始化 Socket.io
const io = socketio(server);
// 设置服务器端口
const PORT = process.env.PORT || 3000;
// 设置静态文件目录
app.use('/', express.static(path.join(__dirname, '../client')));
app.use('/GameData', express.static(path.join(__dirname, '../../GameData')));
// 存储所有游戏房间
let rooms = [];

// 监听客户端连接
io.on('connection', (socket) => {
  console.log('新的连接: ', socket.id);
  // 处理创建房间请求
  socket.on('host', (data) => {
    if (data.Username == '' || data.Username.length > 10) socket.emit('hostRoom', undefined);
    else {
      let code;
      do {
        code = '' + // 确保生成字符串 
              Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10);
      } while (rooms.length != 0 && rooms.some((r) => r.GetCode() == code));
      // 创建新游戏实例并添加到房间列表
      const game = new Game(code, data.Username);
      rooms.push(game);
      game.AddPlayer(data.Username, socket);
      game.EmitToPlayers('hostRoom', {
        Code: code,
        Players: game.GetPlayersArray()
      });
    }
  });

  // 处理加入房间请求
  socket.on('join', (data) => {
    const game = rooms.find((r) => r.GetCode() == data.Code);
    if (game == undefined || game.GetPlayersArray().some((p) => p == data.Username) || data.Username == '' || data.Username.length > 10)
      socket.emit('joinRoom', undefined);
    else {
      // 如果游戏正在进行中，将玩家加入等待列表
      if (game.RoundInProgress || game.RoundNum > 0) {
        game.AddWaitingPlayer(data.Username, socket);
        socket.emit('waitingForNextRound', {
          Host: game.GetHostName(),
          Players: game.GetPlayersArray(),
        });
      } else {
        // 直接加入游戏
        game.AddPlayer(data.Username, socket);
        rooms = rooms.map((r) => (r.GetCode() == data.Code ? game : r));
        game.EmitToPlayers('joinRoom', {
          Host: game.GetHostName(),
          Players: game.GetPlayersArray(),
        });
        game.EmitToPlayers('hostRoom', {
          Code: data.Code,
          Players: game.GetPlayersArray(),
        });
      }
    }
  });

  // 处理开始游戏请求
  socket.on('startGame', (data) => {
    const game = rooms.find((r) => r.GetCode() == data.Code);
    if (game == undefined) socket.emit('gameBegin', undefined);
    else {
      game.EmitToPlayers('gameBegin', { Code: data.Code });
      game.StartNewRound();
    }
  });

  // 处理评估可能行动请求
  socket.on('evaluatePossibleMoves', async () => {
    const game = rooms.find((r) => r.FindPlayer(socket.id).Socket.id == socket.id);
    if (game.RoundInProgress) {
      const possibleMoves = await game.GetPossibleMoves(game.FindPlayer(socket.id));
      socket.emit('displayPossibleMoves', possibleMoves);
    }
  });

  // 处理加注模态框数据请求
  socket.on('raiseModalData', () => {
    const game = rooms.find((r) => r.FindPlayer(socket.id).Socket.id == socket.id);
    socket.emit('updateRaiseModal', {
      TopBet: game.GetCurrentTopBet(),
      UsernameMoney: game.GetPlayerBetInStage(game.FindPlayer(socket.id)) + game.FindPlayer(socket.id).GetMoney(),
    });
  });

  // 处理下注模态框数据请求
  socket.on('betModalData', () => {
    const game = rooms.find((r) => r.FindPlayer(socket.id).Socket.id == socket.id);
    socket.emit('updateBetModal', {
      UsernameMoney: game.FindPlayer(socket.id).GetMoney(), 
    });
  }); 

  // 处理玩家行动请求
  socket.on('moveMade', (data) => {
    const game = rooms.find((r) => r.FindPlayer(socket.id).Socket.id == socket.id);
    const player = game.FindPlayer(socket.id);
    // 根据不同的行动类型调用相应的处理方法
    if (data.Move == 'Fold') game.Fold(player);
    if (data.Move == 'Check') game.Check(player);
    if (data.Move == 'Bet') game.Bet(player, data.Bet);
    if (data.Move == 'Call') game.Call(player);
    if (data.Move == 'Raise') game.Raise(player, data.Bet);
  });

  // 处理玩家断开连接
  socket.on('disconnect', () => {
    const game = rooms.find((r) => r.FindPlayer(socket.id).Socket.id == socket.id);
    if (game) {
      const player = game.FindPlayer(socket.id);
      if (player) {
        game.DisconnectPlayer(player);
        // 如果房间没有玩家，则移除该房间
        if (game.Players.length == 0) rooms = rooms.filter((a) => a != game);
      }
    }
  });
});

// 启动服务器
server.listen(PORT, () => console.log(`正在端口 ${PORT} 运行`));