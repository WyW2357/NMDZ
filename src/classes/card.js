// 卡牌类：标准52张扑克牌中1张牌的表示
const Card = function (value, suit) {
  // 初始化牌的点数和花色
  this.Value = value;
  this.Suit = suit;

  // 获取牌的点数
  this.GetValue = () => {
    return this.Value;
  };

  // 获取牌的花色
  this.GetSuit = () => {
    return this.Suit;
  };
};

// 导出 Card 类
module.exports = Card;