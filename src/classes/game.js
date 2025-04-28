const Deck = require('./deck');            // 引入牌组类
const Player = require('./player');        // 引入玩家类
const Hand = require('pokersolver').Hand;  // 引入牌型解析器
const fs = require('fs');                  // 引入文件系统模块
const path = require('path');              // 引入路径处理模块

// 游戏类：德州扑克游戏主体逻辑
const Game = function (name, host) {
  this.Deck = new Deck();         // 创建新的牌组实例
  this.Host = host;               // 设置房主
  this.Players = [];              // 存储当前游戏中的玩家
  this.WaitingPlayers = [];       // 存储等待加入的玩家
  this.GameName = name;           // 游戏房间名称
  this.RoundNum = 0;              // 当前回合数
  this.RoundData = {              // 回合数据
    Dealer: 0,                    // 庄家位置
    BigBlind: '',                 // 大盲位置
    SmallBlind: '',               // 小盲位置
    Bets: [],                     // 下注记录
  };
  this.Community = [];            // 公共牌区
  this.FoldMargin = [];           // 弃牌玩家的下注记录
  this.BigBlindWent = false;      // 大盲是否已行动
  this.LastMoveParsed = { Move: '', Player: '' };  // 最后一步行动记录
  this.RoundInProgress = false;   // 回合是否进行中
  this.DisconnectedPlayers = [];  // 断开连接的玩家列表
  this.SmallBlind = 1;            // 小盲注金额
  this.BigBlind = 2;              // 大盲注金额
  this.PlayerStats = [];          // 玩家统计数据
  this.LogQueue = [];             // 日志队列
  this.IsWriting = false;         // 日志写入锁
  this.ActionTimers = new Map();  // 玩家行动计时器
  this.InitialMoney = new Map();  // 记录玩家初始金额

  // 清空同名GameData.txt
  const logFile = path.join(__dirname, `../../GameData/GameData_${this.GameName}.txt`);
  fs.writeFile(logFile, '', (err) => {
    if (err)
      console.error('清空日志文件失败: ', err);
    else {
      this.Log('=== 创建新房间 ===');
      this.Log('房间号: ' + this.GameName);
      this.Log('房主: ' + this.Host);
      this.Log('================');
    }
  });

  // 日志记录函数
  this.Log = (...args) => {
    // 将日志加入队列
    const logMessage = args.join(' ') + '\n';
    this.LogQueue.push(logMessage);
    // 如果当前没有在写入，则开始写入
    if (!this.IsWriting) this.WriteLog();
  };

  // 写入日志到文件
  this.WriteLog = () => {
    if (this.LogQueue.length === 0) {
      this.IsWriting = false;
      return;
    }
    this.IsWriting = true;
    const logMessage = this.LogQueue.shift();
    const logFile = path.join(__dirname, `../../GameData/GameData_${this.GameName}.txt`);
    fs.appendFile(logFile, logMessage, (err) => {
      if (err) console.error('写入日志文件失败: ', err);
      // 继续写入队列中的下一条日志
      this.WriteLog();
    });
  };

  // 分配盲注位置
  this.AssignBlind = () => {
    this.RoundData.SmallBlind = this.RoundData.Dealer + 1 < this.Players.length ? this.RoundData.Dealer + 1 : 0;
    this.RoundData.BigBlind = this.RoundData.SmallBlind + 1 < this.Players.length ? this.RoundData.SmallBlind + 1 : 0;
    this.Log('庄家: ' + this.Players[this.RoundData.Dealer].GetUsername() + ' 小盲: ' + this.Players[this.RoundData.SmallBlind].GetUsername() + ' 大盲: ' + this.Players[this.RoundData.BigBlind].GetUsername());
    for (let i = 0; i < this.Players.length; i++) {
      if (i == this.RoundData.BigBlind) {
        this.Players[i].SetBlind('Big Blind');
      } else if (i == this.RoundData.SmallBlind) {
        this.Players[i].SetBlind('Small Blind');
      } else {
        this.Players[i].SetBlind('');
      }
      // 清空所有 player.Status
      this.Players[i].SetStatus('');
    }
    const goFirstIndex = this.RoundData.BigBlind + 1 < this.Players.length ? this.RoundData.BigBlind + 1 : 0;
    this.Players[goFirstIndex].SetStatus('Their Turn');
    this.StartActionTimer(this.Players[goFirstIndex]);
  };

  // 开始新一局
  this.StartNewRound = () => {
    // 移除掉线玩家
    for (let player of this.DisconnectedPlayers) {
      this.Players = this.Players.filter((p) => p != player);
      if (player.GetUsername() == this.Host) this.Host = this.Players[0].GetUsername();
      this.DisconnectedPlayers = this.DisconnectedPlayers.filter((p) => p != player);
    }
    // 添加等待玩家
    if (this.WaitingPlayers.length > 0) this.AddWaitingPlayersToGame();
    this.LastMoveParsed = { Move: '', Player: '' };
    this.RoundInProgress = true;
    this.FoldMargin = [];
    this.BigBlindWent = false;
    this.Community = [];
    this.RoundData.Bets = [];
    for (let player of this.Players) player.AllIn = false;
    this.DealCards();
    // 打印所有玩家信息
    this.Log('\n\n\n=== 新一局开始 ===');
    this.Log('当前局数: ' + (this.RoundNum + 1));
    // 初始设置庄家
    if (this.RoundNum == 0) this.RoundData.Dealer = 0;
    else this.RoundData.Dealer = this.RoundData.Dealer + 1 < this.Players.length ? this.RoundData.Dealer + 1 : 0;
    // 分配盲注位置
    this.AssignBlind();
    // 自动买入
    for (let player of this.Players) {
      if (player.GetMoney() <= this.BigBlind) {
        player.Money += 50;
        player.BuyIns = player.BuyIns + 1;
      }
      while (player.GetMoney() >= 100) {
        player.Money -= 50;
        player.BuyIns = player.BuyIns - 1;
      }
    }
    // 清空和记录玩家初始金额
    this.InitialMoney.clear();
    this.Log('玩家信息: ');
    for (let player of this.Players) {
      this.InitialMoney.set(player.GetUsername(), player.GetMoney());
      this.Log(`${player.GetUsername()}  筹码: ${player.GetMoney()} 买入: ${player.BuyIns} 手牌: ${player.Cards.map(card => `${card.GetValue()}${card.GetSuit()}`).join(' ')}`);
    }
    this.Players[this.RoundData.BigBlind].Money = this.Players[this.RoundData.BigBlind].Money - this.BigBlind;
    this.Players[this.RoundData.SmallBlind].Money = this.Players[this.RoundData.SmallBlind].Money - this.SmallBlind;
    this.RoundData.Bets.push([
      {
        Player: this.Players[this.RoundData.BigBlind].GetUsername(),
        Bet: this.BigBlind
      },
      {
      Player: this.Players[this.RoundData.SmallBlind].GetUsername(),
      Bet: this.SmallBlind
      }
    ]);
    this.RoundNum++;
    this.Rerender();
  };

  // 重新渲染
  this.Rerender = () => {
    let PlayersData = [];
    // 构造PlayersData
    for (let player of this.Players)
      PlayersData.push({
        Username: player.GetUsername(),
        Status: player.GetStatus(),
        Blind: player.GetBlind(),
        Money: player.GetMoney(),
        BuyIns: player.GetBuyIns(),
        IsChecked: this.PlayerIsChecked(player)
      });
    for (let player of this.Players)
      player.Emit('rerender', {
        Community: this.Community,
        TopBet: this.GetCurrentTopBet(),
        Bets: this.RoundData.Bets,
        Round: this.RoundNum,
        Stage: this.GetStageName(),
        Pot: this.GetCurrentPot(),
        PlayersData: PlayersData,
        MyUsername: player.GetUsername(),
        MyMoney: player.GetMoney(),
        MyBet: this.GetPlayerBetInStage(player),
        MyStatus: player.GetStatus(),
        MyBlind: player.GetBlind(),
        MyBuyIns: player.GetBuyIns(),
        MyCards: player.GetCards(),
        MyStrength: this.Community.length > 0 ? Hand.solve(this.ConvertCardsFormat(player.Cards.concat(this.Community))).name : '',
        RoundInProgress: this.RoundInProgress
      });
    this.Log('================');
    // 打印公牌信息
    if (this.Community.length > 0) this.Log(this.GetStageName() + ' 底池: ' + this.GetCurrentPot() + ' 公牌: ' + this.Community.map(card => `${card.GetValue()}${card.GetSuit()}`).join(' '));
    else this.Log(this.GetStageName() + ' 底池: ' + this.GetCurrentPot());
    for (let player of this.Players) this.Log(`${player.GetUsername()}(${player.GetMoney()}) ${player.Cards.map(card => `${card.GetValue()}${card.GetSuit()}`).join(' ')} 状态: ${player.GetStatus()}`);
  };

  // 获取当前底池
  this.GetCurrentPot = () => {
    let sum = 0;
    for (let i = 0; i < this.RoundData.Bets.length; i++) sum += this.RoundData.Bets[i].reduce((acc, curr) => curr.Bet != 'Fold' ? acc + curr.Bet : acc, 0);
    let foldMarginPot = this.FoldMargin.map((a) => a.Amount).reduce((a, b) => a + b, 0);
    return foldMarginPot + sum;
  };

  // 获取当前玩家在当前阶段的下注
  this.GetPlayerBetInStage = (player) => {
    const stageData = this.GetCurrentRoundBets();
    const bet = stageData.find(bet => bet.Player == player.GetUsername() && bet.Bet != 'Fold');
    return bet ? bet.Bet : 0;
  };

  // 获取当前最大下注
  this.GetCurrentTopBet = () => {
    return this.Players.reduce((maxBet, player) => Math.max(maxBet, this.GetPlayerBetInStage(player)), 0);
  };

  // 获取当前阶段名称
  this.GetStageName = () => {
    if (this.RoundData.Bets.length == 1) return '翻牌前';
    if (this.RoundData.Bets.length == 2) return '翻牌';
    if (this.RoundData.Bets.length == 3) return '转牌';
    if (this.RoundData.Bets.length == 4) return '河牌';
    return '';
  };

  // 判断当前玩家是否过牌
  this.PlayerIsChecked = (player) => {
    const bets = this.GetCurrentRoundBets();
    return bets.some(bet => bet.Player == player.GetUsername() && bet.Bet == 0);
  };

  // 获取第一个需要行动的玩家(返回玩家索引)
  this.FindFirstToGoPlayer = () => {
    if (this.Players[this.RoundData.SmallBlind].GetStatus() == 'Fold' || this.Players[this.RoundData.SmallBlind].AllIn) {
      let index = this.RoundData.SmallBlind;
      do {
        index = index + 1 < this.Players.length ? index + 1 : 0;
      } while (this.Players[index].GetStatus() == 'Fold' || this.Players[index].AllIn);
      return index;
    } 
    else return this.RoundData.SmallBlind;
  };

  // 获取未弃牌的玩家(返回玩家数量和最后一个未弃牌玩家)
  this.GetNonFoldedPlayer = () => {
    let numNonFolds = 0;
    let nonFolderPlayer = null;
    for (let player of this.Players)
      if (player.GetStatus() != 'Fold') {
        numNonFolds++;
        nonFolderPlayer = player;
      }
    return [numNonFolds, nonFolderPlayer];
  };

  // 更新阶段
  this.UpdateStage = () => {
    // 检查是否有掉线玩家需要处理
    for (let player of this.Players) {
      if (this.DisconnectedPlayers.includes(player)) {
        this.Log('UpdateStage掉线处理: ' + player.GetUsername());
        if (player.GetStatus() != 'Fold') this.AutoFold(player);
      }
    }
    this.LastMoveParsed = { Move: '', Player: '' };
    // 设置下一个行动玩家
    for (let i = 0; i < this.Players.length; i++) {
      if (i == this.FindFirstToGoPlayer()) {
        this.Players[i].SetStatus('Their Turn');
        this.StartActionTimer(this.Players[i]);
      } 
      else if (this.Players[i].GetStatus() != 'Fold') this.Players[i].SetStatus('');
    }
    this.RoundData.Bets.push([]);
  };

  // 移动到下一个玩家
  this.MoveOntoNextPlayer = () => {
    let handOver = false;
    // 首先检查是否只剩一个玩家未弃牌
    const [numNonFolds, nonFolderPlayer] = this.GetNonFoldedPlayer();
    if (numNonFolds == 1) {
      this.Log('除一人外所有玩家弃牌');
      nonFolderPlayer.Money += this.GetCurrentPot();
      handOver = true;
      this.Rerender();
      this.EndHandAllFold(nonFolderPlayer.GetUsername());
    }
    else if (this.IsStageComplete()) {
      this.Log('阶段完成');
      if (this.AllPlayersAllIn()) {
        this.Log('所有玩家 ALL-IN');
        if (this.RoundData.Bets.length == 1) {
          this.Community.push(this.Deck.DealRandomCard());
          this.Community.push(this.Deck.DealRandomCard());
          this.Community.push(this.Deck.DealRandomCard());
          this.RoundData.Bets.push([]);
        }
        if (this.RoundData.Bets.length == 2) {
          this.Community.push(this.Deck.DealRandomCard());
          this.RoundData.Bets.push([]);
        }
        if (this.RoundData.Bets.length == 3) {
          this.Community.push(this.Deck.DealRandomCard());
          this.RoundData.Bets.push([]);
        }
        if (this.RoundData.Bets.length == 4) {
          handOver = true;
          this.Rerender();
          const playersData = this.DistributeMoney();
          for (let p of playersData) p.Player.SetHand(p.Hand ? p.Hand.name : '');
          this.RevealCards(playersData.filter((p) => p.Gain > 0));
        }
      }
      else if (this.RoundData.Bets.length == 1) {
        this.Community.push(this.Deck.DealRandomCard());
        this.Community.push(this.Deck.DealRandomCard());
        this.Community.push(this.Deck.DealRandomCard());
        this.UpdateStage();
      } 
      else if (this.RoundData.Bets.length == 2) {
        this.Community.push(this.Deck.DealRandomCard());
        this.UpdateStage();
      }
      else if (this.RoundData.Bets.length == 3) {
        this.Community.push(this.Deck.DealRandomCard());
        this.UpdateStage();
      } 
      else if (this.RoundData.Bets.length == 4) {
        handOver = true;
        this.Rerender();
        const playersData = this.DistributeMoney();
        for (let p of playersData) p.Player.SetHand(p.Hand ? p.Hand.name : '');
        this.RevealCards(playersData.filter((p) => p.Gain > 0));
      } 
    } else {
      let currTurnIndex = 0;
      if (this.LastMoveParsed.Move == 'Fold') {
        currTurnIndex = this.Players.findIndex((p) => p == this.LastMoveParsed.Player);
        this.LastMoveParsed = { Move: '', Player: '' };
      } else {
        currTurnIndex = this.Players.findIndex((p) => p.GetStatus() === 'Their Turn');
        this.Players[currTurnIndex].SetStatus('');
      }
      do {
        currTurnIndex = currTurnIndex + 1 < this.Players.length ? currTurnIndex + 1 : 0;
        // 检查当前玩家是否在掉线列表中
        if (this.DisconnectedPlayers.includes(this.Players[currTurnIndex]) && this.Players[currTurnIndex].GetStatus() != 'Fold') {
          this.Log('MoveOntoNextPlayer掉线处理: ' + this.Players[currTurnIndex].GetUsername());
          this.Fold(this.Players[currTurnIndex]);
          return;
        }
      } while (this.Players[currTurnIndex].GetStatus() == 'Fold' || this.Players[currTurnIndex].AllIn);
      this.Players[currTurnIndex].SetStatus('Their Turn');
      this.StartActionTimer(this.Players[currTurnIndex]);
    }
    if (!handOver) {
      this.Rerender();
    }
  };
  
  // 获取指定玩家在指定阶段的总下注金额
  this.GetPlayerBetInStageNum = (player, stageNum) => {
    // 检查阶段数据是否存在
    if (this.RoundData.Bets[stageNum - 1] == undefined) return 0;
    const stageData = this.RoundData.Bets[stageNum - 1];
    for (let i = 0; i < stageData.length; i++)
      if (stageData[i].Player == player.GetUsername() && stageData[i].Bet != 'Fold') return stageData[i].Bet;
    return 0;
  };

  // 计算玩家在当前的总下注金额
  this.GetTotalInvested = (player) => {
    return (
      this.GetPlayerBetInStageNum(player, 1) +
      this.GetPlayerBetInStageNum(player, 2) +
      this.GetPlayerBetInStageNum(player, 3) +
      this.GetPlayerBetInStageNum(player, 4)
    );
  };

  // 分配底池金额给赢家
  this.DistributeMoney = () => {
    // 计算分钱所需的基本信息
    let playersData = this.Players.map((p) => {
      const live = p.GetStatus() != 'Fold';  // 玩家是否未弃牌
      return {
        Player: p,
        Hand: live ? Hand.solve(this.ConvertCardsFormat(p.Cards.concat(this.Community))) : null,  // 计算玩家手牌大小
        Invest: this.GetTotalInvested(p),  // 玩家总下注金额
        Live: live,
        Gain: 0,  // 初始获得奖金为0
      }
    });
    // 处理弃牌玩家的下注金额
    for (let i = 0; i < playersData.length; i++) {
      const foldPD = this.FoldMargin.find((f) => f.Player == playersData[i].Player.GetUsername());
      if (foldPD) playersData[i].Invest += foldPD.Amount;  // 加上弃牌时的下注金额
    }
    // 获取未弃牌的玩家数据
    let activePlayersData = playersData.filter((p) => p.Live);
    let currentBet = 0;  // 当前处理的下注金额
    let previousBet = 0;  // 上一次处理的下注金额
    // 循环分钱流程
    while (activePlayersData.length > 0) {
      let currentHands = activePlayersData.map((p) => p.Hand);  // 当前参与玩家的手牌
      let winnerHands = Hand.winners(currentHands);  // 计算当前最大手牌
      let winnerData = [];  // 当前赢家数据
      // 找出所有拥有最大手牌的玩家
      for (let playerData of activePlayersData)
        for (let winnerHand of winnerHands) {
          let winnerArray = winnerHand.toString().split(', ');
          if (this.ArraysEqual(playerData.Hand.cards.sort(), winnerArray.sort())) {
            winnerData.push(playerData);
            break;
          }
        }
      // 按投资金额排序赢家(从小到大)
      winnerData.sort((a, b) => a.Invest - b.Invest);
      previousBet = currentBet;
      currentBet = winnerData[0].Invest;
      // 计算当前赢家赢得的底池
      const winnerPot = playersData.reduce((acc, cur) => {
        let playerPot = 0;
        if (cur.Invest > currentBet) playerPot = currentBet - previousBet;  // 超出当前处理金额的部分
        else if (cur.Invest > previousBet) playerPot = cur.Invest - previousBet;  // 在当前处理金额范围内的部分
        return acc + playerPot;
      }, 0);
      // 计算每个赢家的基本奖金和余数
      const baseAmount = Math.trunc(winnerPot / winnerData.length);  // 直接使用整数除法
      const remainder = winnerPot % winnerData.length;  // 计算余数
      // 找出离庄家最近的赢家（用于分配余数）
      let closestToDealer = winnerData[0];
      let minDistance = 20;
      for (const winner of winnerData) {
        const seat = this.Players.findIndex(p => p == winner.Player);
        const distance = (seat - this.RoundData.Dealer) >= 0 ? (seat - this.RoundData.Dealer) : (seat - this.RoundData.Dealer + this.Players.length);
        if (distance < minDistance) {
          minDistance = distance;
          closestToDealer = winner;
        }
      }
      // 分配基本奖金给所有赢家
      for (const winner of winnerData) {
        winner.Player.Money += baseAmount;  // 更新玩家金额
        playersData.find((p) => p.Player === winner.Player).Gain += baseAmount;  // 记录获得的奖金
      }
      // 将余数给离庄家最近的赢家
      if (remainder > 0) {
        closestToDealer.Player.Money += remainder;  // 更新玩家金额
        playersData.find((p) => p.Player === closestToDealer.Player).Gain += remainder;  // 记录获得的奖金
      }
      // 移除已处理完的玩家
      activePlayersData = activePlayersData.filter((p) => p.Invest > currentBet);
    }
    return playersData;
  };

  // 比较两个数组是否相等
  this.ArraysEqual = (a, b) => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;
    for (let i = 0; i < a.length; ++i) if (a[i] != b[i]) return false;
    return true;
  };

  // 将卡牌数组转换为 pokersolver 库需要的格式
  this.ConvertCardsFormat = (arr) => {
    let res = [];
    for (let i = 0; i < arr.length; i++) {
      let str = '';
      let value = arr[i].GetValue();
      let suit = arr[i].GetSuit();
      if (value == 10) str += 'T';
      else str += value.toString();
      if (suit == '♠') str += 's';
      if (suit == '♥') str += 'h';
      if (suit == '♦') str += 'd';
      if (suit == '♣') str += 'c';
      res.push(str);
    }
    return res;
  };

  // 结束本局，其他所有玩家弃牌
  this.EndHandAllFold = (username) => {
    this.ClearAllActionTimers();
    this.RoundInProgress = false;
    let cardsData = [];
    for (let player of this.Players) {
      // 保存玩家统计信息
      const money = player.GetMoney();
      const buyIns = player.GetBuyIns();
      const profit = money - 50 - (50 * buyIns);
      // 查找是否已有该玩家的记录
      const existingStats = this.PlayerStats.find(stats => stats.Username == player.GetUsername());
      if (existingStats) {
        existingStats.Money = money;
        existingStats.BuyIns = buyIns;
        existingStats.Profit = profit;
        existingStats.LastUpdate = Date.now();
      } 
      else
        this.PlayerStats.push({
          Username: player.GetUsername(),
          Money: money,
          BuyIns: buyIns,
          Profit: profit,
          LastUpdate: Date.now()
        });
      cardsData.push({
        Username: player.GetUsername(),
        Blind: player.GetBlind(),
        Money: player.GetMoney(),
        BuyIns: player.GetBuyIns(),
        IsChecked: this.PlayerIsChecked(player),
        Status: player.GetStatus()
      }); 
    }
    for (let player of this.Players) {
      player.Emit('endHand', {
        Winner: username,
        Pot: this.GetCurrentPot(),
        Money: player.GetMoney(),
        Blind: player.GetBlind(),
        PlayerStats: this.PlayerStats,
        Bets: this.RoundData.Bets,
        CardsData: cardsData
      });
    }
    // 打印所有玩家金额变化
    this.Log('\n本局结束:');
    for (let player of this.Players) {
      const initial = this.InitialMoney.get(player.GetUsername());
      const change = player.GetMoney() - initial;
      const changeText = change >= 0 ? `+${change}` : change;
      this.Log(`${player.GetUsername()}: ${initial} -> ${player.GetMoney()} (${changeText})`);
    }
    this.Log('================');
    // 10秒后自动开始下一局
    setTimeout(() => {this.StartNewRound();}, 10000);
  };

  // 揭示所有玩家的手牌并处理游戏结束逻辑
  this.RevealCards = (winners) => {
    this.ClearAllActionTimers();
    this.RoundInProgress = false;
    let cardsData = []; 
    for (let player of this.Players) {
      const money = player.GetMoney();
      const buyIns = player.GetBuyIns();
      const profit = money - 50 - (50 * buyIns);
      const existingStats = this.PlayerStats.find(stats => stats.Username === player.GetUsername());
      if (existingStats) {
        // 更新现有记录
        existingStats.Money = money;
        existingStats.BuyIns = buyIns;
        existingStats.Profit = profit;
        existingStats.LastUpdate = Date.now();
      } 
      else 
        this.PlayerStats.push({
          Username: player.GetUsername(),
          Money: money,
          BuyIns: buyIns,
          Profit: profit,
          LastUpdate: Date.now()
        });
      cardsData.push({
        Username: player.GetUsername(),
        Cards: player.GetCards(),
        Folded: player.GetStatus() == 'Fold',
        Money: player.GetMoney(),
        EndHand: player.GetHand(),
        BuyIns: player.GetBuyIns(),
        Blind: player.GetBlind()
      });
    }
    // 生成获胜者名单字符串，包含获得的筹码数
    const winnersUsernames = winners.map((a) => {
        const gain = `(+${a.Gain}<span style="color: #8B4513;">ⓜ</span>) `;
        return a.Player.GetUsername() + gain;
    }).toString();
    for (let player of this.Players) {
      player.Emit('reveal', {
        Blind: player.GetBlind(),
        Money: player.GetMoney(),
        PlayerStats: this.PlayerStats,
        Winners: winnersUsernames,
        WinnersNames: winners.map((a) => a.Player.GetUsername()),
        CardsData: cardsData
      });
    }
    // 记录本局结束时的玩家筹码变化
    this.Log('\n本局结束:');
    for (let player of this.Players) {
      const initial = this.InitialMoney.get(player.GetUsername());
      const change = player.GetMoney() - initial;
      const changeText = change >= 0 ? `+${change}` : change;
      this.Log(`${player.GetUsername()}: ${initial} -> ${player.GetMoney()} (${changeText})`);
    }
    this.Log('================');
    // 10秒后自动开始下一局
    setTimeout(() => {this.StartNewRound();}, 10000);
  };

  // 判断是否多人在场 并且 仅剩1人可行动
  this.AllPlayersAllIn = () => {
    let participatingPlayers = 0;
    let hasAllInPlayer = false;
    for (const player of this.Players) {
      if (player.AllIn) hasAllInPlayer = true;
      if (!player.AllIn && player.GetStatus() != 'Fold') participatingPlayers++;
    }
    return hasAllInPlayer && participatingPlayers <= 1;
  };

  // 检查当前阶段是否完成：所有未弃牌且未全押的玩家都已经行动 并且 所有未弃牌且未全押的玩家的下注金额都相等
  this.IsStageComplete = () => {
    let allPlayersPresent = false;  // 标记是否所有玩家都已行动
    let numUnfolded = 0;  // 统计未弃牌且未全押的玩家数量
    for (let player of this.Players)
      if (player.Status != 'Fold' && !player.AllIn) numUnfolded++;
    const currRound = this.GetCurrentRoundBets();
    // 第一轮特殊处理：需要确保大盲已经行动
    if (this.RoundData.Bets.length == 1) allPlayersPresent = currRound.filter((a) => a.Bet != 'Fold').length >= numUnfolded && this.BigBlindWent;
    else allPlayersPresent = currRound.filter((a) => a.Bet != 'Fold').length >= numUnfolded;
    // 检查所有未弃牌且未全押的玩家的下注金额是否相等
    let allPlayersCall = true;
    for (const player of this.Players)
      if (player.Status != 'Fold' && this.GetPlayerBetInStage(player) != this.GetCurrentTopBet() && !player.AllIn) {
        allPlayersCall = false;
        break;
      }
    return allPlayersPresent && allPlayersCall;
  };

  // 返回房主
  this.GetHostName = () => {
    return this.Host;
  };

  // 获取玩家列表
  this.GetPlayersArray = () => {
    return this.Players.map((p) => {return p.GetUsername();});
  };

  // 返回房间号
  this.GetCode = () => {
    return this.GameName;
  };

  // 添加玩家
  this.AddPlayer = (playerName, socket) => {
    const player = new Player(playerName, socket);
    this.Players.push(player);
    return player;
  };

  // 发牌并显示
  this.DealCards = () => {
    this.Deck.ShuffleCards();
    for (let player of this.Players) {
      player.Cards = [];
      player.AddCard(this.Deck.DealRandomCard());
      player.AddCard(this.Deck.DealRandomCard());
    }
  };

  // 向所有玩家发布消息
  this.EmitToPlayers = (eventName, payload) => {
    for (let player of this.Players) player.Emit(eventName, payload);
  };

  // 查找玩家(使用socketid查找)
  this.FindPlayer = (socketid) => {
    for (let player of this.Players) if (player.GetSocket().id == socketid) return player;
    return null;
  };

  // 掉线处理
  this.DisconnectPlayer = (player) => {
    // 保存玩家统计信息
    const username = player.GetUsername();
    const money = player.GetMoney();
    const buyIns = player.GetBuyIns();
    const profit = money - 50 - (50 * buyIns);
    // 查找是否已有该玩家的记录
    const existingStats = this.PlayerStats.find(stats => stats.Username == username);
    if (existingStats) {
      // 更新现有记录
      existingStats.Money = money;
      existingStats.BuyIns = buyIns;
      existingStats.Profit = profit;
      existingStats.LastUpdate = Date.now();
    } 
    else
      this.PlayerStats.push({
        Username: username,
        Money: money,
        BuyIns: buyIns,
        Profit: profit,
        LastUpdate: Date.now()
      });
    // 将玩家标记为断开连接
    this.DisconnectedPlayers.push(player);
    // 如果玩家正在行动，直接弃牌
    if (player.GetStatus() == 'Their Turn') {
      this.Log('DisconnectPlayer行动中掉线处理: ' + username);
      this.Fold(player);
    }
    // 通知其他玩家该玩家已断开连接
    this.EmitToPlayers('playerDisconnected', { Player: username });
    this.Rerender();
  };

  // 检查大盲是否已行动
  this.CheckBigBlindWent = (player) => {
    if (player.GetBlind() == 'Big Blind' && this.RoundData.Bets.length == 1) this.BigBlindWent = true;
  };

  // 获取当前回合的下注记录
  this.GetCurrentRoundBets = () => {
    return this.RoundData.Bets[this.RoundData.Bets.length - 1];
  };

  // 设置当前回合的下注记录
  this.SetCurrentRoundBets = (bets) => {
    this.RoundData.Bets[this.RoundData.Bets.length - 1] = bets;
  };

  // 弃牌
  this.Fold = (player) => {
    this.AutoFold(player);
    this.MoveOntoNextPlayer();
  };

  // 自动弃牌
  this.AutoFold = (player) => {
    this.ClearActionTimer(player);
    this.CheckBigBlindWent(player);
    // 获取该玩家当前回合的下注记录
    const roundDataStage = this.GetCurrentRoundBets().find((a) => a.Player == player.GetUsername());
    if (roundDataStage) this.FoldMargin.push({ Player: player.GetUsername(), Amount: roundDataStage.Bet });
    // 如果当前回合的下注记录中包含该玩家，则更新当前回合的下注记录
    if (this.GetCurrentRoundBets().some((a) => a.Player == player.GetUsername()))
      this.SetCurrentRoundBets(this.GetCurrentRoundBets().map((a) => a.Player == player.GetUsername() ? { Player: player.GetUsername(), Bet: 'Fold' } : a));
    // 如果当前回合的下注记录中不包含该玩家，则添加当前回合的下注记录 
    else
      this.GetCurrentRoundBets().push({
        Player: player.GetUsername(),
        Bet: 'Fold'
      });
    player.SetStatus('Fold');
    this.LastMoveParsed = { Move: 'Fold', Player: player };
    this.Log(`${player.GetUsername()} [弃牌]`);
  };

  // 跟注
  this.Call = (player) => {
    this.ClearActionTimer(player);
    this.CheckBigBlindWent(player);
    let currBet = this.GetPlayerBetInStage(player);
    const topBet = this.GetCurrentTopBet();
    if (currBet == 0) {
      // 如果当前回合的下注记录中包含该玩家，则更新当前回合的下注记录
      if (this.GetCurrentRoundBets().some((a) => a.Player == player.GetUsername())) {
        // 如果当前玩家没有足够的钱，则全押
        if (player.GetMoney() - topBet <= 0) {
          this.SetCurrentRoundBets(this.GetCurrentRoundBets().map((a) => a.Player == player.Username ? { Player: player.GetUsername(), Bet: player.GetMoney() } : a));
          player.Money = 0;
          player.AllIn = true;
          this.Log(`${player.GetUsername()} [跟注]ALL-IN 0 -> ${player.GetMoney()}`);
        } else {
          this.SetCurrentRoundBets(this.GetCurrentRoundBets().map((a) => a.Player == player.Username ? { Player: player.GetUsername(), Bet: topBet } : a));
          player.Money = player.Money - topBet;
          this.Log(`${player.GetUsername()} [跟注] 0 -> ${topBet}`);
        }
      } else {
        if (player.GetMoney() - topBet <= 0) {
          this.GetCurrentRoundBets().push({
            Player: player.GetUsername(),
            Bet: player.GetMoney()
          });
          player.Money = 0;
          player.AllIn = true;
          this.Log(`${player.GetUsername()} [跟注]ALL-IN 0 -> ${player.GetMoney()}`);
        } else {
          this.GetCurrentRoundBets().push({
            Player: player.GetUsername(),
            Bet: topBet,
          });
          player.Money = player.Money - topBet;
          this.Log(`${player.GetUsername()} [跟注] 0 -> ${topBet}`); 
        }
      }
    } 
    else {
      if (this.GetCurrentRoundBets().some((a) => a.Player == player.GetUsername())) {
        if (player.GetMoney() + currBet - topBet <= 0) {
          this.SetCurrentRoundBets(this.GetCurrentRoundBets().map((a) => a.Player == player.Username ? { Player: player.GetUsername(), Bet: player.GetMoney() + currBet } : a));
          player.Money = 0;
          player.AllIn = true;
          this.Log(`${player.GetUsername()} [跟注]ALL-IN ${currBet} -> ${player.GetMoney() + currBet}`);
        } else {
          this.SetCurrentRoundBets(this.GetCurrentRoundBets().map((a) => a.Player == player.Username ? { Player: player.GetUsername(), Bet: topBet } : a));
          player.Money = player.Money - (topBet - currBet);
          this.Log(`${player.GetUsername()} [跟注] ${currBet} -> ${topBet}`);
        }
      }
    }
    this.MoveOntoNextPlayer();
  };

  // 下注
  this.Bet = (player, bet) => {
    this.ClearActionTimer(player);
    this.CheckBigBlindWent(player);
    this.SetCurrentRoundBets(this.GetCurrentRoundBets().filter((a) => a.Player != player.GetUsername()));
    this.GetCurrentRoundBets().push({
      Player: player.GetUsername(),
      Bet: bet,
    }); // 好写法
    player.Money = player.Money - bet;
    if (player.Money == 0) {
      player.AllIn = true;
      this.Log(`${player.GetUsername()} [下注]ALL-IN ${bet}`);
    } 
    else this.Log(`${player.GetUsername()} [下注] ${bet}`);
    this.MoveOntoNextPlayer();
  };

  // 过牌
  this.Check = (player) => {
    this.ClearActionTimer(player);
    this.CheckBigBlindWent(player);
    this.Log(`${player.GetUsername()} [过牌]`);
    // 如果玩家在当前回合还没有下注记录，则添加一条记录
    if (!this.GetCurrentRoundBets().some(a => a.Player == player.GetUsername()))
      this.GetCurrentRoundBets().push({
        Player: player.GetUsername(),
        Bet: 0
      });
    this.MoveOntoNextPlayer();
  };

  // 加注
  this.Raise = (player, bet) => {
    this.ClearActionTimer(player);
    this.CheckBigBlindWent(player);
    const currBet = this.GetPlayerBetInStage(player);
    const moneyToRemove = bet - currBet;
    // 如果当前玩家没有下注，则将当前下注设置为当前玩家的下注
    if (!this.GetCurrentRoundBets().some((a) => a.Player == player.GetUsername()))
      this.GetCurrentRoundBets().push({
        Player: player.GetUsername(),
        Bet: bet,
      });
    // 如果当前玩家已经下注，则将当前下注设置为当前玩家的下注
    else this.SetCurrentRoundBets(this.GetCurrentRoundBets().map((a) => a.Player == player.GetUsername() ? { Player: player.GetUsername(), Bet: bet } : a));
    player.Money -= moneyToRemove;
    if (player.Money == 0) {
      player.AllIn = true;
      this.Log(`${player.GetUsername()} [加注]ALL-IN ${currBet} -> ${bet}`);
    } 
    else this.Log(`${player.GetUsername()} [加注] ${currBet} -> ${bet}`);
    this.MoveOntoNextPlayer();
  };

  // 获取玩家可能的行动
  this.GetPossibleMoves = (player) => {
    const playerBet = this.GetPlayerBetInStage(player);
    const topBet = this.GetCurrentTopBet();
    let possibleMoves = {
      Fold: 'yes',
      Check: 'yes',
      Bet: 'yes',
      Call: topBet,
      Raise: 'yes',
    };
    if (topBet != 0) {
      possibleMoves.Bet = 'no';
      possibleMoves.Check = 'no';
      if (player.GetBlind() == 'Big Blind' && !this.BigBlindWent && topBet == this.BigBlind) {
        possibleMoves.Check = 'yes';
        possibleMoves.Call = 'no';
      }
    } 
    else {
      possibleMoves.Raise = 'no';
      possibleMoves.Call = 'no';
      possibleMoves.Fold = 'no';
    } 
    if(topBet == playerBet) possibleMoves.Fold = 'no';
    if (topBet >= player.GetMoney() + playerBet) {
      possibleMoves.Raise = 'no';
      possibleMoves.Call = 'all-in';
    }
    return possibleMoves;
  };

  // 将等待中的玩家加入等待列表
  this.AddWaitingPlayer = (playerName, socket) => {
    this.WaitingPlayers.push({
      Username: playerName,
      Socket: socket
    });
    this.Log(`玩家 ${playerName} 已加入等待列表`);
  };

  // 将等待中的玩家加入游戏
  this.AddWaitingPlayersToGame = () => {
    for (const waitingPlayer of this.WaitingPlayers) {
      const player = new Player(waitingPlayer.Username, waitingPlayer.Socket);
      // 检查是否有同名玩家的历史记录
      const existingStats = this.PlayerStats.find(stats => stats.Username == player.GetUsername());
      if (existingStats) {
        // 继承历史记录
        player.Money = existingStats.Money;
        player.BuyIns = existingStats.BuyIns;
        this.Log(`玩家 ${player.GetUsername()} 继承历史记录`);
      }
      this.Players.push(player);
      this.Log(`玩家 ${player.GetUsername()} 已从等待列表加入游戏`);
      // 通知等待玩家已加入游戏
      player.Emit('waitingPlayerJoined');
      // 移除等待列表中的玩家
      this.WaitingPlayers = this.WaitingPlayers.filter(p => p.Username != player.GetUsername());
      // 通知所有玩家有新玩家加入
      this.EmitToPlayers('playerJoined', {
        Player: player.GetUsername(),
      });
    }
  };

  // 开始玩家行动计时
  this.StartActionTimer = (player) => {
    // 清除之前的计时器
    this.ClearActionTimer(player);
    // 设置新的计时器
    const timer = setTimeout(() => {
      if (player.GetStatus() === 'Their Turn') {
        // 发送关闭加注和下注窗口的信号
        player.Emit('closeRaiseWindow', {});
        this.Log(`${player.GetUsername()} 30秒未行动, 自动弃牌`);
        this.Fold(player);
      }
    }, 30000); // 30秒超时
    // 设置玩家行动计时器
    this.ActionTimers.set(player.GetUsername(), timer);
  }

  // 清除玩家行动计时器
  this.ClearActionTimer = (player) => {
    const timer = this.ActionTimers.get(player.GetUsername());
    if (timer) {
      clearTimeout(timer);
      this.ActionTimers.delete(player.GetUsername());
    }
  }

  // 清除所有行动计时器
  this.ClearAllActionTimers = () => {
    for (const timer of this.ActionTimers.values()) clearTimeout(timer);
    this.ActionTimers.clear();
  }
};

// 导出游戏类
module.exports = Game;