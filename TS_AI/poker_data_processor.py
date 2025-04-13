import json
import numpy as np

class PokerDataProcessor:
    def __init__(self):
        self.action_map = {
            'Fold': [1, 0, 0, 0],
            'Check': [0, 1, 0, 0],
            'Call': [0, 0, 1, 0],
            'Raise': [0, 0, 0, 1]
        }
        
    def load_data(self, file_path):
        """加载数据"""
        data_list = []
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            json_strings = content.split('}\n{')
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

    def process_data(self, data):
        """处理单个样本数据"""
        action = data.get('action', 'Fold')  # 默认为Fold
        if action not in self.action_map:
            print(f"警告: 未知的action值: {action}")
            action = 'Fold'  # 使用默认值
        
        return np.array(self.action_map[action])

    def process_batch(self, file_path):
        """处理批量数据"""
        data_list = self.load_data(file_path)
        print(f"加载了 {len(data_list)} 个样本")
        
        all_features = []
        for i, data in enumerate(data_list):
            features = self.process_data(data)
            all_features.append(features)
            
        
        return np.array(all_features)

def main():
    processor = PokerDataProcessor()
    features = processor.process_batch('Output.txt')
    
    # 将处理后的特征向量写入文件
    with open('Output2.txt', 'w', encoding='utf-8') as f:
        for feature in features:
            f.write(f"{feature}\n")
    
    print(f"\n已将 {len(features)} 个特征向量写入 Output2.txt")

if __name__ == "__main__":
    main() 