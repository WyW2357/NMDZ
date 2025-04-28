// 引入卡牌类
const Card = require('./card');

// 牌组类：标准52张扑克牌牌组的表示
const Deck = function () {
  // 初始化牌组
  this.Cards = [];

  // 洗牌方法：重新初始化牌组
  this.ShuffleCards = () => {
    // 清空当前牌组
    this.Cards = [];
    // 定义花色
    const Suits = ['♠', '♥', '♦', '♣'];
    // 生成所有牌
    for (let i = 0; i < Suits.length; i++) {
      for (let j = 1; j <= 13; j++) {
        // 特殊牌处理
        if (j === 1) {
          this.Cards.push(new Card('A', Suits[i]));
        } else if (j === 11) {
          this.Cards.push(new Card('J', Suits[i]));
        } else if (j === 12) {
          this.Cards.push(new Card('Q', Suits[i]));
        } else if (j === 13) {
          this.Cards.push(new Card('K', Suits[i]));
        } 
        // 数字牌处理
        else {
          this.Cards.push(new Card(j, Suits[i]));
        }
      }
    }
  };

  // 发牌方法：随机抽取一张牌
  this.DealRandomCard = () => {
    // 随机选择一张牌的索引
    const index = Math.floor(Math.random() * this.Cards.length);
    const value = this.Cards[index];
    // 从牌组中移除这张牌
    this.Cards.splice(index, 1);
    return value;
  };
};

// 导出牌组类
module.exports = Deck;