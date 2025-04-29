// 页面加载完成后的初始化工作
$(document).ready(function () {
  // 初始化时隐藏游戏界面，等待用户操作
  $('#gameDiv').hide();
  // 初始化模态框（弹出窗口）功能，用于显示各种弹窗，如：用户名输入框、游戏规则说明等
  $('.modal-trigger').leanModal();
  // 初始化工具提示功能，设置延迟时间为50毫秒，当鼠标悬停在带有 tooltipped 类的元素上时，会显示提示信息
  $('.tooltipped').tooltip({ delay: 50 });
  // 加载统计数据
  LoadStatisticsTable();
});

var socket = io();
var gameInfo = null;

// 处理玩家断开连接的事件
socket.on('playerDisconnected', function (data) {
  Materialize.toast(data.Player + ' 断开连接', 4000);
});

// 处理创建房间的响应，显示房间信息和玩家列表
socket.on('hostRoom', function (data) {
  if (data != undefined) {
    if (data.Players.length >= 11) {
      $('#hostModalContent').html('<h5>房间号:</h5><code>' + data.Code + '</code><br /><h5>警告: 房间中有太多玩家, 最多为11人。</h5><h5>当前在房间中的玩家:</h5>');
      // 显示当前房间中的玩家列表
      $('#playersNames').html(data.Players.map(function (p) { return '<span>' + p + '</span><br />';}));
    } else {
      $('#hostModalContent').html('<h5>房间号:</h5><code>' + data.Code + '</code><br /><h5>当前在房间中的玩家:</h5>');
      $('#playersNames').html(data.Players.map(function (p) { return '<span>' + p + '</span><br />';}));
      if (data.Players.length > 1)
        // 显示开始游戏按钮
        $('#startGameArea').html('<br /><button onclick=StartGame('+ data.Code +') type="submit" class= "waves-effect waves-light green darken-3 white-text btn-flat">开始游戏</button >');
    }
  } 
  else {
    $('#hostModal').closeModal();
    Materialize.toast('输入了非法ID!(最长为10个字符)', 4000);
  }
});

// 处理加入房间的响应，显示等待界面
socket.on('joinRoom', function (data) {
  if (data == undefined) {
    // 输入非法ID/房间号时的错误处理
    $('#joinModal').closeModal();
    Materialize.toast("输入了非法房间号/ID!(最长为10个字符且不能和别人的一样)", 4000);
  } else {
    // 成功加入房间后的界面更新
    $('#navbar').hide();
    $('#joinModal').closeModal();
    $('#mainContent').hide();
    // 移除已存在的等待页面
    $('#waitingPage').remove();
    // 创建新的等待页面
    var waitingPage = $('<div id="waitingPage" class="container center-align" style="margin-top: 50px;"></div>');
    waitingPage.append('<h4>' + data.Host + ' 的房间</h4>');
    waitingPage.append('<p>请等待房主开始游戏，离开或刷新页面将会使你断开连接。</p>');
    waitingPage.append('<div class="center-align" style="margin-top: 20px;"><h5 class="white-text">请等待游戏开始</h5></div>');
    // 将等待页面添加到body中
    $('body').append(waitingPage);
  }
});

// 重新渲染游戏界面，更新所有玩家的状态
socket.on('rerender', function (data) {
  // 更新玩家手牌显示，包括下注信息
  $('#mycards').html(data.MyCards.map(function (c) { return RenderCard(c);}));
  if (data.MyStrength == '') {
    if (data.MyBet == 0) $('#usernamesCards').text(data.MyUsername + ' - 我的手牌');
    else $('#usernamesCards').html(data.MyUsername + ' - 我的手牌 - 我的下注 ' + data.MyBet + '<span style="color: #8B4513;">ⓜ</span>');
  }
  else {
    const strengthText = HandTextTranslate(data.MyStrength);
    if (data.MyBet == 0) $('#usernamesCards').text(data.MyUsername + ' - 我的手牌 - (' + strengthText + ')');
    else $('#usernamesCards').html(data.MyUsername + ' - 我的手牌 - (' + strengthText + ') - 我的下注 ' + data.MyBet + '<span style="color: #8B4513;">ⓜ</span>');
  }
  // 更新公共牌显示
  if (data.Community != undefined) $('#communityCards').html(data.Community.map(function (c) {return RenderCard(c);}));
  else $('#communityCards').html('<p></p>');
  // 更新游戏状态标题
  $('#table-title').html(
    '第' + data.Round + '局' + 
    '    |    ' + data.Stage +
    '    |    当前最高下注 ' + data.TopBet + '<span style="color: #8B4513;">ⓜ</span>' +
    '    |    底池 ' + data.Pot + '<span style="color: #8B4513;">ⓜ</span>'
  );
  // 更新对手信息显示
  $('#opponentCards').html(
    data.PlayersData.map(function (p) {
      return RenderOpponent({
        Username: p.Username,
        Status: p.Status,
        Money: p.Money,
        Blind: p.Blind,
        Bets: data.Bets,
        BuyIns: p.BuyIns,
        IsChecked: p.IsChecked
      });
    })
  );
  // 更新玩家自身信息
  RenderSelf({
    Money: data.MyMoney,
    Status: data.MyStatus,
    Blind: data.MyBlind,
    Bets: data.Bets,
    BuyIns: data.MyBuyIns
  });
  // 如果游戏未进行中，隐藏所有动作按钮
  if (!data.RoundInProgress) {
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
  }
});

// 处理游戏开始的响应，显示游戏界面
socket.on('gameBegin', function (data) {
  if (data == undefined) alert('错误 - 不存在游戏');
  else {
    // 隐藏导航栏和模态框
    $('#navbar').hide();
    $('#joinModal').closeModal();
    $('#hostModal').closeModal();
    $('#mainContent').hide();
    // 移除等待界面
    $('#waitingPage').remove();
    $('#waitingDiv').remove();
    // 显示游戏界面
    $('#gameDiv').show().addClass('visible');
    // 添加玩家排行榜
    var playerTable = $('.card:contains("玩家排行榜")').parent().parent();
    playerTable.appendTo('#gameDiv');
    // 添加实时统计
    var statisticsTable = $('.card:contains("实时统计")').parent().parent();
    statisticsTable.appendTo('#gameDiv');
  }
});

// 显示等待下一轮游戏的界面
socket.on('waitingForNextRound', function (data) {
  // 隐藏导航栏和模态框
  $('#navbar').hide();
  $('#joinModal').closeModal();
  $('#hostModal').closeModal();
  $('#mainContent').hide();
  // 移除旧的等待界面
  $('#waitingDiv').remove();
  // 创建新的等待界面
  var waitingDiv = $('<div id="waitingDiv" class="container center-align" style="margin-top: 50px;"></div>');
  waitingDiv.append('<h4>游戏正在进行中</h4>');
  waitingDiv.append('<p>你将在下一局开始时加入游戏</p>');
  waitingDiv.append('<p>当前房间: ' + data.Host + ' 的房间</p>');
  waitingDiv.append('<p>当前玩家: ' + data.Players.join(', ') + '</p>');
  // 添加等待界面到页面
  $('body').append(waitingDiv);
});

// 显示新玩家加入的提示信息
socket.on('playerJoined', function (data) {
  Materialize.toast(data.Player + ' 加入游戏', 4000);
});

// 处理等待玩家成功加入游戏的事件
socket.on('waitingPlayerJoined', function () {
  // 移除等待页面
  $('#waitingDiv').remove();
  // 显示游戏界面
  $('#gameDiv').show().addClass('visible');
  // 添加玩家排行榜和实时统计
  var playerTable = $('.card:contains("玩家排行榜")').parent().parent();
  playerTable.appendTo('#gameDiv');
  var statisticsTable = $('.card:contains("实时统计")').parent().parent();
  statisticsTable.appendTo('#gameDiv');
  Materialize.toast('你已成功加入游戏!', 4000);
});

// 处理揭示手牌，显示赢家和统计信息
socket.on('reveal', function (data) {
  $('#usernameFold').hide();
  $('#usernameCheck').hide();
  $('#usernameBet').hide();
  $('#usernameCall').hide();
  $('#usernameRaise').hide();
  // 更新游戏标题显示赢家
  $('#table-title').html('本局赢家: ' + data.Winners);
  $('#playNext').empty();
  // 更新统计信息
  UpdateStatisticsTable(data.PlayerStats);
  var blindText;
  if (data.Blind == '') blindText = '';
  if (data.Blind == 'Big Blind') blindText = '大盲';
  if (data.Blind == 'Small Blind') blindText = '小盲';
  $('#blindStatus').text(blindText);
  $('#usernamesMoney').html(data.Money + '<span style="color: #8B4513;">ⓜ</span>');
  $('#opponentCards').html(
    data.CardsData.map(function (p) {
      return RenderOpponentCards({
        Username: p.Username,
        Cards: p.Cards,
        Folded: p.Folded,
        Money: p.Money,
        EndHand: p.EndHand,
        BuyIns: p.BuyIns,
        Blind: p.Blind,
        WinnersNames: data.WinnersNames
      });
    })
  );
  // 添加倒计时显示
  let countdown = 10;
  const countdownElement = $('<div class="countdown">下一局将在 <span class="countdown-number">10</span> 秒后开始</div>');
  $('#playNext').append(countdownElement);
  // 启动倒计时
  const timer = setInterval(() => {
    countdown--;
    countdownElement.find('.countdown-number').text(countdown);
    if (countdown <= 0) {
      clearInterval(timer);
      countdownElement.remove();
    }
  }, 1000);
});

// 处理一手牌结束，显示赢家和更新界面
socket.on('endHand', function (data) {
  // 隐藏所有动作按钮
  $('#usernameFold').hide();
  $('#usernameCheck').hide();
  $('#usernameBet').hide();
  $('#usernameCall').hide();
  $('#usernameRaise').hide();
  // 更新游戏标题显示赢家和底池
  $('#table-title').html(data.Winner + ' 赢得了 ' + data.Pot + '<span style="color: #8B4513;">ⓜ</span> 的底池!');
  $('#playNext').empty();
  // 更新统计信息
  UpdateStatisticsTable(data.PlayerStats);
  var blindText;
  if (data.Blind == '') blindText = '';
  if (data.Blind == 'Big Blind') blindText = '大盲';
  if (data.Blind == 'Small Blind') blindText = '小盲';
  $('#blindStatus').text(blindText);
  // 如果玩家已弃牌，更新界面状态
  if (data.Folded == 'Fold') {
    $('#playerInformationCard').removeClass('green');
    $('#playerInformationCard').removeClass('yellow');
    $('#playerInformationCard').removeClass('darken-2');
    $('#playerInformationCard').addClass('grey');
    $('#usernamesCards').removeClass('black-text');
    $('#usernamesCards').addClass('white-text');
  }
  // 更新玩家资金显示
  $('#usernamesMoney').html(data.Money + '<span style="color: #8B4513;">ⓜ</span>');
  // 更新对手信息显示
  $('#opponentCards').html(
    data.CardsData.map(function (p) {
      return RenderOpponent({
        Username: p.Username,
        Status: p.Status,
        Money: p.Money,
        Blind: p.Blind,
        Bets: data.Bets,
        BuyIns: p.BuyIns,
        IsChecked: p.IsChecked
      });
    })
  );
  // 添加倒计时显示
  let countdown = 10;
  const countdownElement = $('<div class="countdown">下一局将在 <span class="countdown-number">10</span> 秒后开始</div>');
  $('#playNext').append(countdownElement);
  // 启动倒计时
  const timer = setInterval(() => {
    countdown--;
    countdownElement.find('.countdown-number').text(countdown);
    if (countdown <= 0) {
      clearInterval(timer);
      countdownElement.remove();
    }
  }, 1000);
});

// 处理创建房间的请求，点击 获得房间号 按钮触发
var BeginHost = function () {
  // 发送创建房间请求到服务器
  socket.emit('host', { Username: $('#hostName-field').val() });
};

var JoinRoom = function () {
  socket.emit('join', {
      Code: $('#code-field').val(),
      Username: $('#joinName-field').val(),
    });
};

var StartGame = function (gameCode) {
  socket.emit('startGame', { Code: gameCode });
};

var Fold = function () {
  socket.emit('moveMade', { Move: 'Fold', Bet: 'Fold' });
};

var Bet = function () {
  socket.emit('moveMade', { Move: 'Bet', Bet: parseInt($('#betRangeSlider').val()) });
};

function Call() {
  socket.emit('moveMade', { Move: 'Call', Bet: 'Call' });
}

var Check = function () {
  socket.emit('moveMade', { Move: 'Check', Bet: 'Check' });
};

var Raise = function () {
  socket.emit('moveMade', { Move: 'Raise', Bet: parseInt($('#raiseRangeSlider').val()) });
};

function UpdateStatisticsTable(playerStats) {
  const statisticsBody = $('#statisticsBody');
  // 清空表格
  statisticsBody.empty();
  // 按收益从高到低排序并显示所有记录
  playerStats
    .sort((a, b) => b.Profit - a.Profit)
    .forEach(player => {
      const row = $('<tr>');
      row.append($('<td>').text(player.Username));
      const profitCell = $('<td>');
      // 正数带加号
      profitCell.text(player.Profit > 0 ? '+' + player.Profit : player.Profit);
      if (player.Profit > 0) {
        profitCell.css('color', 'red');
      } else if (player.Profit < 0) {
        profitCell.css('color', 'green');
      }
      row.append(profitCell);
      statisticsBody.append(row);
    });
}

function LoadStatisticsTable() {
  // app.js 中使用了静态目录
  fetch('/GameData/Game_PT.txt')
    .then(response => response.text())
    .then(data => {
      const playerStats = JSON.parse(data);
      const statisticsBody = $('#playerstatisticsBody');
      statisticsBody.empty();
      playerStats
        .sort((a, b) => b.Profit - a.Profit)
        .forEach((player, index) => {
          const row = $('<tr>');
          // 添加排名列，设置居中对齐
          row.append($('<td>').text(index + 1).css('text-align', 'center'));
          row.append($('<td>').text(player.Username).css('text-align', 'center'));
          const profitCell = $('<td>').css('text-align', 'center');
          profitCell.text(player.Profit > 0 ? '+' + player.Profit : player.Profit);
          if (player.Profit > 0) {
            profitCell.css('color', 'red');
          } else if (player.Profit < 0) {
            profitCell.css('color', 'green');
          }
          row.append(profitCell);
          statisticsBody.append(row);
        });
    });
}

// 显示卡牌
function RenderCard(card) {
  if (card.Suit == '♠' || card.Suit == '♣')
    return (
      '<div class="playingCard_black" id="card"' +
      card.Value +
      card.Suit +
      '" data-value="' +
      card.Value +
      ' ' +
      card.Suit +
      '">' +
      card.Value +
      ' ' +
      card.Suit +
      '</div>'
    );
  else
    return (
      '<div class="playingCard_red" id="card"' +
      card.Value +
      card.Suit +
      '" data-value="' +
      card.Value +
      ' ' +
      card.Suit +
      '">' +
      card.Value +
      ' ' +
      card.Suit +
      '</div>'
    );
}

function RenderOpponent(data) {
  var bet = 0;
  if (data.Bets != undefined) {
    var arr = data.Bets[data.Bets.length - 1];
    for (var pn = 0; pn < arr.length; pn++) if (arr[pn].Player == data.Username) bet = arr[pn].Bet;
  }
  var buyIns = data.BuyIns;
  var buyInsText = '';
  if (buyIns > 0) buyInsText = '次买入';
  if (buyIns == 0) buyInsText = '';
  if (buyIns < 0) buyInsText = '次卖出';
  var blindText;
  if (data.Blind == '') blindText = '';
  if (data.Blind == 'Big Blind') blindText = '大盲';
  if (data.Blind == 'Small Blind') blindText = '小盲';
  var statusText = '';
  if (data.Status == '') statusText = '';
  if (data.Status == 'Fold') statusText = '已弃牌';
  if (data.Status == 'Their Turn') {
    // 添加倒计时显示
    let countdown = 30;
    statusText = '行动中 <span class="countdown-number" style="color: black;">30</span>';
    // 在DOM更新后启动倒计时
    setTimeout(() => {
      const countdownElement = $('.countdown-number').last();
      const timer = setInterval(() => {
        countdown--;
        if (countdown < 10) {
          countdownElement.css('color', 'red');
        }
        countdownElement.text(countdown);
        if (countdown <= 0) {
          clearInterval(timer);
          countdownElement.parent().remove();
        }
      }, 1000);
    }, 0);
  }
  // 根据钱数和all-in状态决定名字颜色和显示
  var nameText = data.Money == 0 ? '<span style="color: red;">' + data.Username + '</span>' : data.Username;
  if (buyIns !== 0) {
    if (data.Status == 'Fold') {
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey"><div class="card-content white-text"><span class="card-title">' +
        nameText +
        ' (弃牌)</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
        blindText +
        '<br />' +
        statusText +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
        ' (' +
        Math.abs(buyIns) +
        ' ' +
        buyInsText +
        ')' +
        '</div></div></div>'
      );
    } else {
      if (data.Status == 'Their Turn') {
        if (data.IsChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            nameText +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            ' (' +
            Math.abs(buyIns) +
            ' ' +
            buyInsText +
            ')' +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            nameText +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            ' (' +
            Math.abs(buyIns) +
            ' ' +
            buyInsText +
            ')' +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            nameText +
            '<br />下注 ' +
            bet + '<span style="color: #8B4513;">ⓜ</span>' +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            ' (' +
            Math.abs(buyIns) +
            ' ' +
            buyInsText +
            ')' +
            '</div></div></div>'
          );
        }
      } else {
        if (data.IsChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameText +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            ' (' +
            Math.abs(buyIns) +
            ' ' +
            buyInsText +
            ')' +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameText +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            ' (' +
            Math.abs(buyIns) +
            ' ' +
            buyInsText +
            ')' +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameText +
            '<br />下注 ' +
            bet + '<span style="color: #8B4513;">ⓜ</span>' +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            ' (' +
            Math.abs(buyIns) +
            ' ' +
            buyInsText +
            ')' +
            '</div></div></div>'
          );
        }
      }
    }
  }
  else {
    if (data.Status == 'Fold') {
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey"><div class="card-content white-text"><span class="card-title">' +
        nameText +
        ' (弃牌)</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
        blindText +
        '<br />' +
        statusText +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
        '</div></div></div>'
      );
    } else {
      if (data.Status == 'Their Turn') {
        if (data.IsChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            nameText +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            nameText +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            nameText +
            '<br />下注 ' +
            bet + '<span style="color: #8B4513;">ⓜ</span>' +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        }
      } else {
        if (data.IsChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameText +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameText +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameText +
            '<br />下注 ' +
            bet + '<span style="color: #8B4513;">ⓜ</span>' +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindText +
            '<br />' +
            statusText +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        }
      }
    }
  }
}

function RenderOpponentCards(data) {
  var buyIns = data.BuyIns;
  var buyInsText = '';
  if (buyIns > 0) buyInsText = '次买入';
  if (buyIns == 0) buyInsText = '';
  if (buyIns < 0) buyInsText = '次卖出';
  var blindText;
  if (data.Blind == '') blindText = '';
  if (data.Blind == 'Big Blind') blindText = '大盲';
  if (data.Blind == 'Small Blind') blindText = '小盲';
  var endHandText = HandTextTranslate(data.EndHand);
  // 判断是否是赢家
  const isWinner = data.WinnersNames.includes(data.Username);
  // 根据钱数和背景颜色决定名字颜色和显示
  var nameText = data.Money == 0 ? '<span style="color: red;">' + data.Username + '</span>' : (isWinner ? '<span style="color: black;">' + data.Username + '</span>' : data.Username);
  if (buyIns != 0) {
    if (data.Folded)
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey" ><div class="card-content white-text"><span class="card-title">' +
        nameText +
        ' (弃牌)</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
        '<span style="color: white;">' + blindText + '</span>' +
        '<br />' +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
        ' (' +
        Math.abs(buyIns) +
        ' ' +
        buyInsText +
        ')' +
        '</div></div></div>'
      );
    else
      return (
        '<div class="col s12 m2 opponentCard"><div class="card ' + (isWinner ? 'pink lighten-3' : 'green darken-2') + '" ><div class="card-content ' + (isWinner ? 'black-text' : 'white-text') + '"><span class="card-title">' +
        nameText +
        '</span><p><div class="center-align"> ' +
        RenderOpponentCard(data.Cards[0]) +
        RenderOpponentCard(data.Cards[1]) +
        ' </div><br /><br /><br /><br /><br />' +
        '<span style="color: white;">' + blindText + '</span>' +
        '<br />' +
        '<span style="color: purple; font-weight: bold; font-size: 30px;">' + endHandText + (isWinner ? ' <img src="/img/Chicken.jpg" style="width: 45px; height: 45px; vertical-align: middle;">' : '') + '</span>' +
        '</p></div><div class="card-action ' + (isWinner ? 'pink lighten-2' : 'green darken-3') + ' ' + (isWinner ? 'black-text' : 'white-text') + ' center-align" style="font-size: 20px;">' +
        data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
        ' (' +
        Math.abs(buyIns) +
        ' ' +
        buyInsText +
        ')' +
        '</div></div></div>'
      );
  } else {
    if (data.Folded)
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey" ><div class="card-content white-text"><span class="card-title">' +
        nameText +
        ' (弃牌)</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
        '<span style="color: white;">' + blindText + '</span>' +
        '<br />' +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
        '</div></div></div>'
      );
    else
      return (
        '<div class="col s12 m2 opponentCard"><div class="card ' + (isWinner ? 'pink lighten-3' : 'green darken-2') + '" ><div class="card-content ' + (isWinner ? 'black-text' : 'white-text') + '"><span class="card-title">' +
        nameText +
        '</span><p><div class="center-align"> ' +
        RenderOpponentCard(data.Cards[0]) +
        RenderOpponentCard(data.Cards[1]) +
        ' </div><br /><br /><br /><br /><br />' +
        '<span style="color: white;">' + blindText + '</span>' +
        '<br />' +
        '<span style="color: purple; font-weight: bold; font-size: 30px;">' + endHandText + (isWinner ? ' <img src="/img/Chicken.jpg" style="width: 45px; height: 45px; vertical-align: middle;">' : '') + '</span>' +
        '</p></div><div class="card-action ' + (isWinner ? 'pink lighten-2' : 'green darken-3') + ' ' + (isWinner ? 'black-text' : 'white-text') + ' center-align" style="font-size: 20px;">' +
        data.Money + '<span style="color: #8B4513;">ⓜ</span>' +
        '</div></div></div>'
      );
  }
}

// 渲染对手的牌(CSS小一号)
function RenderOpponentCard(card) {
  if (card.Suit == '♠' || card.Suit == '♣')
    return (
      '<div class="playingCard_black_opponent" id="card"' +
      card.Value +
      card.Suit +
      '" data-value="' +
      card.Value +
      ' ' +
      card.Suit +
      '">' +
      card.Value +
      ' ' +
      card.Suit +
      '</div>'
    );
  else
    return (
      '<div class="playingCard_red_opponent" id="card"' +
      card.Value +
      card.Suit +
      '" data-value="' +
      card.Value +
      ' ' +
      card.Suit +
      '">' +
      card.Value +
      ' ' +
      card.Suit +
      '</div>'
    );
}

function UpdateBetModal() {
  socket.emit('betModalData', {});
}

// 更新下注模态框的滑块范围
socket.on('updateBetModal', function (data) {
  // 设置下注滑块的最大值、最小值和初始值
  $('#betRangeSlider').attr({
    max: data.UsernameMoney,
    min: data.UsernameMoney < 2 ? 1 : 2,
    value: data.UsernameMoney < 2 ? 1 : 2,  
  });
  // 立即更新显示
  UpdateBetDisplay();
});

function UpdateBetDisplay() {
  $('#betDisplay').html('<h3 class="center-align">' + $('#betRangeSlider').val() + '<span style="color: #8B4513;">ⓜ</span></h3>');
}

function UpdateRaiseModal() {
  socket.emit('raiseModalData', {});
}

// 更新加注模态框的滑块范围
socket.on('updateRaiseModal', function (data) {
  // 设置加注滑块的最大值、最小值和初始值
  $('#raiseRangeSlider').attr({
    max: data.UsernameMoney,
    min: Math.min(data.NextRaise, data.UsernameMoney),
    value: Math.min(data.NextRaise, data.UsernameMoney),
  });
  UpdateRaiseDisplay();
});

function UpdateRaiseDisplay() {
  $('#raiseDisplay').html('<h3 class="center-align">' + $('#raiseRangeSlider').val() + '<span style="color: #8B4513;">ⓜ</span></h3>');
}

// 根据当前游戏状态显示玩家可用的动作按钮
socket.on('displayPossibleMoves', function (data) {
  // 根据服务器返回的数据显示/隐藏各个动作按钮
  if (data.Fold == 'yes') $('#usernameFold').show();
  else $('#usernameFold').hide();
  if (data.Check == 'yes') $('#usernameCheck').show();
  else $('#usernameCheck').hide();
  if (data.Bet == 'yes') $('#usernameBet').show();
  else $('#usernameBet').hide();
  if (data.Call != 'no') {
    if (data.Call == 'all-in') $('#usernameCall').text('跟注 All-In');
    else $('#usernameCall').html('跟注 ' + data.Call + '<span style="color: #8B4513;">ⓜ</span>');
    $('#usernameCall').show();
  } 
  else $('#usernameCall').hide();
  if (data.Raise != 'no') {
    if (data.Raise == 'all-in') $('#usernameRaise').text('加注 All-In');
    else $('#usernameRaise').text('加注');
    $('#usernameRaise').show();
  }
  else $('#usernameRaise').hide();
});

function RenderSelf(data) {
  $('#playNext').empty();
  $('#usernamesMoney').html(data.Money + '<span style="color: #8B4513;">ⓜ</span>');
  var blindText;
  if (data.Blind == '') blindText = '';
  if (data.Blind == 'Big Blind') blindText = '大盲';
  if (data.Blind == 'Small Blind') blindText = '小盲';
  if (data.Status == 'Their Turn') {
    $('#playerInformationCard').removeClass('grey');
    $('#playerInformationCard').removeClass('green');
    $('#playerInformationCard').addClass('yellow');
    $('#playerInformationCard').addClass('darken-2');
    $('#usernamesCards').removeClass('white-text');
    $('#usernamesCards').addClass('black-text');
    $('#status').text('我的回合');
    Materialize.toast('我的回合', 4000);
    socket.emit('evaluatePossibleMoves', {});
  } else if (data.Status == 'Fold') {
    $('#status').text('你已经弃牌');
    $('#playerInformationCard').removeClass('green');
    $('#playerInformationCard').removeClass('yellow');
    $('#playerInformationCard').removeClass('darken-2');
    $('#playerInformationCard').addClass('grey');
    $('#usernamesCards').removeClass('black-text');
    $('#usernamesCards').addClass('white-text');
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
  } else {
    $('#status').text('');
    $('#playerInformationCard').removeClass('grey');
    $('#playerInformationCard').removeClass('yellow');
    $('#playerInformationCard').removeClass('darken-2');
    $('#playerInformationCard').addClass('green');
    $('#usernamesCards').removeClass('black-text');
    $('#usernamesCards').addClass('white-text');
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
  }
  $('#blindStatus').text(blindText);
}

// 关闭加注和下注的模态框
socket.on('closeRaiseWindow', function () {
  // 关闭加注和下注窗口
  $('#raiseModal').hide();
  $('#betModal').hide();
  // 移除背景遮罩层
  $('.lean-overlay').hide();
});

// 牌型翻译函数
function HandTextTranslate(handName) {
  switch (handName) {
    case 'High Card':
      return '高牌';
    case 'Pair':
      return '一对';
    case 'Two Pair':
      return '两对';
    case 'Three of a Kind':
      return '三条';
    case 'Straight':
      return '顺子';
    case 'Flush':
      return '同花';
    case 'Full House':
      return '葫芦';
    case 'Four of a Kind':
      return '四条';
    case 'Straight Flush':
      return '同花顺';
    case 'Royal Flush':
      return '皇家同花顺';
    default:
      return '';
  }
}
