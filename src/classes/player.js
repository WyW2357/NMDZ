// 玩家类：表示游戏中的一个玩家
const Player = function (playerName, socket) {
  // 玩家基本信息
  this.Username = playerName;  // 玩家用户名
  this.Cards = [];             // 玩家的手牌
  this.Socket = socket;        // 玩家的socket连接
  this.Money = 50;             // 玩家初始筹码数量
  this.BuyIns = 0;             // 玩家初始买入次数
  this.Status = '';            // 玩家当前状态
  this.Blind = '';             // 玩家盲注状态
  this.AllIn = false;          // 是否全押
  this.Hand = '';              // 玩家当前手牌类型

  // 获取玩家用户名
  this.GetUsername = () => {
    return this.Username;
  };

  // 获取玩家手牌
  this.GetCards = () => {
    return this.Cards;
  };  

  // 添加一张牌到玩家手牌
  this.AddCard = (card) => {
    this.Cards.push(card);
  };

  // 获取玩家socket
  this.GetSocket = () => {
    return this.Socket;
  };
  
  // 获取玩家筹码数量
  this.GetMoney = () => {
    return this.Money;
  };
  
  // 获取玩家买入次数
  this.GetBuyIns = () => {
    return this.BuyIns;
  };

  // 获取玩家当前状态
  this.GetStatus = () => {
    return this.Status;
  };

  // 设置玩家状态
  this.SetStatus = (data) => {
    this.Status = data;
  };

  // 获取玩家盲注状态
  this.GetBlind = () => {
    return this.Blind;
  };

  // 设置玩家盲注状态
  this.SetBlind = (data) => {
    this.Blind = data;
  };

  // 获取玩家手牌类型
  this.GetHand = () => {
    return this.Hand;
  };

  // 设置玩家手牌类型
  this.SetHand = (data) => {
    this.Hand = data;
  };

  // 向玩家发送事件
  this.Emit = (eventName, payload) => {
    this.Socket.emit(eventName, payload);
  };
};

// 导出玩家类
module.exports = Player;