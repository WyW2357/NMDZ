import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import torch.optim as optim
from sklearn.model_selection import train_test_split

class PokerDecisionNetwork(nn.Module):
    def __init__(self):
        super(PokerDecisionNetwork, self).__init__()
        # 简化网络结构以适应小样本
        self.input_layer = nn.Linear(136, 64)
        self.hidden1 = nn.Linear(64, 32)
        self.output_layer = nn.Linear(32, 4)
        
    def forward(self, x):
        x = F.relu(self.input_layer(x))
        x = F.relu(self.hidden1(x))
        x = self.output_layer(x)
        return F.softmax(x, dim=1)

def load_input_data(file_path):
    """加载输入数据"""
    features = []
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        samples = content.split('[')[1:]  # 跳过第一个空分割
        for sample in samples:
            numbers = sample.strip().rstrip(']').split()
            feature = [float(x) for x in numbers]
            if len(feature) != 136:
                print(f"警告: 样本维度为 {len(feature)}，期望136维")
            features.append(feature)
    return np.array(features)

def load_output_data(file_path):
    """加载输出数据"""
    features = []
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        samples = content.split('[')[1:]  # 跳过第一个空分割
        for sample in samples:
            numbers = sample.strip().rstrip(']').split()
            feature = [float(x) for x in numbers]
            features.append(feature)
    return np.array(features)

def train_model(model, input_data, output_data, num_epochs=1000, learning_rate=0.01):
    """训练模型"""
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    print("开始训练...")
    best_loss = float('inf')
    patience = 100  # 早停的耐心值
    patience_counter = 0
    
    for epoch in range(num_epochs):
        # 前向传播
        outputs = model(input_data)
        loss = criterion(outputs, output_data)
        
        # 反向传播和优化
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        
        # 早停检查
        if loss.item() < best_loss:
            best_loss = loss.item()
            patience_counter = 0
            # 保存最佳模型
            torch.save(model.state_dict(), 'best_model.pth')
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"早停触发，在第 {epoch+1} 轮停止训练")
                break
        
        if (epoch + 1) % 100 == 0:
            print(f'Epoch [{epoch+1}/{num_epochs}], Loss: {loss.item():.4f}')
    
    # 加载最佳模型
    model.load_state_dict(torch.load('best_model.pth'))
    return model

def main():
    # 创建模型实例
    model = PokerDecisionNetwork()
    
    # 加载输入数据
    print("加载输入数据...")
    input_features = load_input_data('Input2.txt')
    print(f"加载了 {len(input_features)} 个输入样本")
    print(f"输入数据维度: {input_features.shape}")
    
    # 加载输出数据
    print("\n加载输出数据...")
    output_features = load_output_data('Output2.txt')
    print(f"加载了 {len(output_features)} 个输出样本")
    print(f"输出数据维度: {output_features.shape}")
    
    # 分割训练集和测试集
    X_train, X_test, y_train, y_test = train_test_split(
        input_features, output_features, test_size=0.2, random_state=42
    )
    
    # 转换为张量
    X_train = torch.FloatTensor(X_train)
    X_test = torch.FloatTensor(X_test)
    y_train = torch.FloatTensor(y_train)
    y_test = torch.FloatTensor(y_test)
    
    print(f"\n训练集大小: {len(X_train)} 个样本")
    print(f"测试集大小: {len(X_test)} 个样本")
    
    # 训练模型
    model = train_model(model, X_train, y_train)
    
    # 保存最终模型
    torch.save(model.state_dict(), 'poker_decision_model.pth')
    print("\n模型已保存到 poker_decision_model.pth")
    
    # 测试模型
    print("\n测试模型预测:")
    with torch.no_grad():
        predictions = model(X_test)
        total_correct = 0
        for i, (input_sample, output_sample, prediction) in enumerate(zip(X_test, y_test, predictions)):
            print(f"\n测试样本 {i+1}:")
            print(f"输入: {input_sample.numpy()}")
            print(f"实际输出: {output_sample.numpy()}")
            print(f"预测输出: {prediction.numpy()}")
            # 计算预测的准确率
            pred_action = torch.argmax(prediction).item()
            true_action = torch.argmax(output_sample).item()
            print(f"预测动作: {pred_action}, 实际动作: {true_action}")
            if pred_action == true_action:
                total_correct += 1
        
        accuracy = total_correct / len(X_test) * 100
        print(f"\n测试集准确率: {accuracy:.2f}%")

if __name__ == "__main__":
    main() 