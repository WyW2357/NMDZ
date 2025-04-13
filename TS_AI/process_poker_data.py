import json
import numpy as np
import torch
import torch.nn as nn

# 德州扑克最大玩家数量
MAX_PLAYERS = 9
# 德州扑克最大轮数
MAX_ROUNDS = 4
# 德州扑克最大公共牌数量
MAX_COMMUNITY_CARDS = 5

class BetEncoder(nn.Module):
    def __init__(self):
        super(BetEncoder, self).__init__()
        # 输入维度不固定，使用自适应池化
        self.pool = nn.AdaptiveAvgPool1d(64)
        self.fc = nn.Linear(64, 64)
        self.relu = nn.ReLU()
        
    def forward(self, x):
        # 将输入转换为1D向量
        x = x.view(1, 1, -1)
        # 使用自适应池化将向量长度调整为64
        x = self.pool(x)
        # 全连接层
        x = self.relu(self.fc(x.squeeze()))
        return x

class PlayerEncoder(nn.Module):
    def __init__(self):
        super(PlayerEncoder, self).__init__()
        # 输入维度不固定，使用自适应池化
        self.pool = nn.AdaptiveAvgPool1d(64)
        self.fc = nn.Linear(64, 64)
        self.relu = nn.ReLU()
        
    def forward(self, x):
        # 将输入转换为1D向量
        x = x.view(1, 1, -1)
        # 使用自适应池化将向量长度调整为64
        x = self.pool(x)
        # 全连接层
        x = self.relu(self.fc(x.squeeze()))
        return x

def load_data(file_path):
    """加载数据，支持连续的JSON对象"""
    data_list = []
    with open(file_path, 'r', encoding='utf-8') as f:
        # 读取整个文件内容
        content = f.read().strip()
        # 使用简单的字符串分割
        json_strings = content.split('}\n{')
        # 修复分割后的JSON字符串
        for i, json_str in enumerate(json_strings):
            if i == 0:
                json_str = json_str + '}'
            elif i == len(json_strings) - 1:
                json_str = '{' + json_str
            else:
                json_str = '{' + json_str + '}'
            try:
                data = json.loads(json_str)
                data_list.append(data)
            except json.JSONDecodeError as e:
                print(f"解析JSON时出错: {e}")
                print(f"问题JSON字符串: {json_str}")
    return data_list

def card_to_vector(card):
    """将扑克牌转换为向量表示
    输入格式: {'value': '1'-'13'或'A','J','Q','K', 'suit': '♠♥♦♣'}
    输出: 单个数字 1-52
    编码方式:
    - 点数(rank): 1-13 (对应 A,2,3,4,5,6,7,8,9,10,J,Q,K)
    - 花色(suit): 1-4 (对应 ♠,♥,♦,♣)
    - 最终编码: (rank-1) * 4 + suit
    """
    # 处理特殊牌值
    value_map = {
        'A': 1,
        'J': 11,
        'Q': 12,
        'K': 13
    }
    value = card['value']
    if value in value_map:
        rank = value_map[value]
    else:
        rank = int(value)
    
    # 花色映射
    suit_map = {'♠': 1, '♥': 2, '♦': 3, '♣': 4}
    suit = suit_map[card['suit']]
    # 返回单个数字表示
    return (rank - 1) * 4 + suit

def calculate_total_money(data):
    """计算总钱数（所有玩家筹码加底池）"""
    total = data['pot']  # 底池
    for player in data['playersToAI']:
        total += player['money']
    return total

def encode_bets(bets_data, total_money, data):
    """将下注信息编码为64维向量"""
    # 收集所有下注信息
    all_bets = []
    for round_idx, round_bets in enumerate(bets_data):
        for bet in round_bets:
            if bet['bet'] == 'Fold':
                continue
            player_name = bet['player']
            player_idx = next(i for i, p in enumerate(data['playersToAI']) if p['username'] == player_name)
            is_bot = 1 if player_name == 'wy' else 0
            
            bet_info = [
                round_idx,  # 轮数标记
                player_idx,  # 玩家编号
                is_bot,  # 是否为BOT
                bet['bet'] / total_money  # 下注金额百分比
            ]
            all_bets.extend(bet_info)
    
    # 将下注信息转换为张量
    bet_tensor = torch.FloatTensor(all_bets)
    
    # 使用神经网络编码
    encoder = BetEncoder()
    with torch.no_grad():
        encoded_bets = encoder(bet_tensor).numpy()
    
    return encoded_bets

def encode_players(players_data, total_money):
    """将玩家信息编码为64维向量"""
    # 收集所有玩家信息
    all_players = []
    for player in players_data:
        player_info = [
            player['money'] / total_money,  # 筹码量百分比
            1 if player['blind'] == 'Small Blind' else 0,  # 是否为小盲注
            1 if player['blind'] == 'Big Blind' else 0,  # 是否为大盲注
            1 if player['username'] == 'wy' else 0  # 是否为BOT
        ]
        all_players.extend(player_info)
    
    # 将玩家信息转换为张量
    player_tensor = torch.FloatTensor(all_players)
    
    # 使用神经网络编码
    encoder = PlayerEncoder()
    with torch.no_grad():
        encoded_players = encoder(player_tensor).numpy()
    
    return encoded_players

def process_data(data):
    # 找到BOT的位置
    bot_index = next(i for i, player in enumerate(data['playersToAI']) if player['username'] == 'wy')
    num_players = len(data['playersToAI'])
    
    # 为玩家分配编号（从0开始按顺序）
    player_ids = {i: i for i in range(num_players)}  # 所有玩家从0开始按顺序编号
    
    # 计算总钱数
    total_money = calculate_total_money(data)
    
    # 处理手牌（BOT的手牌）
    my_cards = [card_to_vector(card) for card in data['mycards']]
    
    # 处理公共牌，确保固定为5张
    community_cards = []
    for i in range(MAX_COMMUNITY_CARDS):
        if i < len(data['community']):
            community_cards.append(card_to_vector(data['community'][i]))
        else:
            # 用0表示没有牌
            community_cards.append(0)
    
    # 处理玩家信息
    encoded_players = encode_players(data['playersToAI'], total_money)
    
    # 处理下注信息
    encoded_bets = encode_bets(data['bets'], total_money, data)
    
    # 组合所有特征
    features = []
    # 1. BOT的手牌特征 (2个值，每个值1-52)
    features.extend(my_cards)
    # 2. 公共牌特征 (5个值，每个值1-52，没有牌用0表示)
    features.extend(community_cards)
    # 3. 玩家信息 (64维向量)
    features.extend(encoded_players)
    # 4. 下注信息 (64维向量)
    features.extend(encoded_bets)
    # 5. 奖池大小（转换为百分比）
    features.append(data['pot'] / total_money)
    
    return np.array(features), player_ids

def main():
    # 加载数据
    data_list = load_data('Input.txt')
    print(f"加载了 {len(data_list)} 个样本")
    
    # 处理每个样本
    all_features = []
    for i, data in enumerate(data_list):
        # 计算总钱数
        total_money = calculate_total_money(data)
        
        # 处理数据
        features, player_ids = process_data(data)
        all_features.append(features)
        
    
    # 将所有特征向量写入Input2.txt
    with open('Input2.txt', 'w', encoding='utf-8') as f:
        for features in all_features:
            f.write(f"{features}\n")
    
    print(f"\n已将 {len(all_features)} 个特征向量写入 Input2.txt")

if __name__ == "__main__":
    main() 