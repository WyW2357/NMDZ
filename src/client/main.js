$(document).ready(function () {
  $('#gameDiv').hide();
  $('.modal-trigger').leanModal();
  $('.tooltipped').tooltip({ delay: 50 });
});

var socket = io();
var gameInfo = null;

socket.on('playerDisconnected', function (data) {
  Materialize.toast(data.player + ' 断开连接.', 4000);
  // 保留断开连接玩家的记录，不需要额外处理
});

socket.on('hostRoom', function (data) {
  if (data != undefined) {
    if (data.players.length >= 11) {
      $('#hostModalContent').html(
        '<h5>房间号:</h5><code>' +
          data.code +
          '</code><br /><h5>警告: 房间中有太多玩家. 最多为11人.</h5><h5>当前在房间中的玩家:</h5>'
      );
      $('#playersNames').html(
        data.players.map(function (p) {
          return '<span>' + p + '</span><br />';
        })
      );
    } else if (data.players.length > 1) {
      $('#hostModalContent').html(
        '<h5>房间号:</h5><code>' +
          data.code +
          '</code><br /><h5>当前在房间中的玩家:</h5>'
      );
      $('#playersNames').html(
        data.players.map(function (p) {
          return '<span>' + p + '</span><br />';
        })
      );
      $('#startGameArea').html(
        '<br /><button onclick=startGame(' +
          data.code +
          ') type="submit" class= "waves-effect waves-light green darken-3 white-text btn-flat">开始游戏</button >'
      );
    } else {
      $('#hostModalContent').html(
        '<h5>房间号:</h5><code>' +
          data.code +
          '</code><br /><h5>当前在房间中的玩家:</h5>'
      );
      $('#playersNames').html(
        data.players.map(function (p) {
          return '<span>' + p + '</span><br />';
        })
      );
    }
  } else {
    Materialize.toast(
      '输入了非法ID! (最长为12个字符)',
      4000
    );
    $('#joinButton').removeClass('disabled');
  }
});

socket.on('hostRoomUpdate', function (data) {
  $('#playersNames').html(
    data.players.map(function (p) {
      return '<span>' + p + '</span><br />';
    })
  );
  if (data.players.length == 1) {
    $('#startGameArea').empty();
  }
});

socket.on('joinRoomUpdate', function (data) {
  $('#startGameAreaDisconnectSituation').html(
    '<br /><button onclick=startGame(' +
      data.code +
      ') type="submit" class= "waves-effect waves-light green darken-3 white-text btn-flat">开始游戏</button >'
  );
  $('#joinModalContent').html(
    '<h5>' +
      data.host +
      "的房间</h5><hr /><h5>当前在房间中的玩家:</h5><p>你现在是房主了.</p>"
  );

  $('#playersNamesJoined').html(
    data.players.map(function (p) {
      return '<span>' + p + '</span><br />';
    })
  );
});

socket.on('joinRoom', function (data) {
  if (data == undefined) {
    $('#joinModal').closeModal();
    Materialize.toast(
      "输入了非法ID/房间号! (最长为12个字符并且不能和别人的一样)",
      4000
    );
    $('#hostButton').removeClass('disabled');
    $('#hostButton').on('click');
  } else {
    $('#navbar-ptwu').hide();
    $('#joinModal').closeModal();
    $('#mainContent').fadeOut(300);
    
    // 检查是否已经存在等待页面，如果存在则移除
    if ($('#waitingPage').length > 0) {
      $('#waitingPage').remove();
    }
    
    // 创建等待页面
    var waitingPage = $('<div id="waitingPage" class="container center-align" style="margin-top: 50px;"></div>');
    waitingPage.append('<h4>' + data.host + ' 的房间</h4>');
    waitingPage.append('<p>请等待房主开始游戏. 离开或刷新页面将会使你断开连接.</p>');
    waitingPage.append('<div class="center-align" style="margin-top: 20px;"><h5 class="white-text">请等待游戏开始</h5></div>');
    
    // 添加到页面
    $('body').append(waitingPage);
  }
});

socket.on('dealt', function (data) {
  $('#mycards').html(
    data.cards.map(function (c) {
      return renderCard(c);
    })
  );
  $('#usernamesCards').text(data.username + ' - 我的手牌');
  $('#mainContent').remove();
});

socket.on('rerender', function (data) {
  if (data.myBet == 0) {
    $('#usernamesCards').text(data.username + ' - 我的手牌');
  } else {
    $('#usernamesCards').html(data.username + ' - 我的下注: ' + data.myBet + '<span style="color: #8B4513;">ⓜ</span>');
  }
  if (data.community != undefined)
    $('#communityCards').html(
      data.community.map(function (c) {
        return renderCard(c);
      })
    );
  else $('#communityCards').html('<p></p>');
  if (data.currBet == undefined) data.currBet = 0;
  $('#table-title').html(
    '第' +
      data.round +'局'+
      '    |    ' +
      data.stage +
      '    |    当前最高下注: ' +
      data.topBet + '<span style="color: #8B4513;">ⓜ</span>' +
      '    |    底池: ' +
      data.pot + '<span style="color: #8B4513;">ⓜ</span>'
  );
  $('#opponentCards').html(
    data.players.map(function (p) {
      return renderOpponent(p.username, {
        text: p.status,
        money: p.money,
        blind: p.blind,
        bets: data.bets,
        buyIns: p.buyIns,
        isChecked: p.isChecked,
      });
    })
  );
  renderSelf({
    money: data.myMoney,
    text: data.myStatus,
    blind: data.myBlind,
    bets: data.bets,
    buyIns: data.buyIns,
  });
  if (!data.roundInProgress) {
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
  }
});

socket.on('gameBegin', function (data) {
  $('#navbar-ptwu').hide();
  $('#joinModal').closeModal();
  $('#hostModal').closeModal();
  
  // 移除所有等待界面的内容
  $('#waitingPage').remove();
  $('#waitingDiv').remove();
  
  if (data == undefined) {
    alert('错误 - 不存在游戏.');
  } else {
    $('#gameDiv').show().addClass('visible');
    var playerTable = $('.card:contains("玩家排行榜")').parent().parent();
    playerTable.appendTo('#gameDiv');
    var statisticsTable = $('.card:contains("实时统计")').parent().parent();
    statisticsTable.appendTo('#gameDiv');
  }
});

socket.on('waitingForNextRound', function (data) {
  $('#navbar-ptwu').hide();
  $('#joinModal').closeModal();
  $('#hostModal').closeModal();
  $('#mainContent').fadeOut(300);
  
  $('#waitingDiv').remove();
  
  var waitingDiv = $('<div id="waitingDiv" class="container center-align" style="margin-top: 50px;"></div>');
  waitingDiv.append('<h4>游戏正在进行中</h4>');
  waitingDiv.append('<p>你将在下一局开始时加入游戏</p>');
  waitingDiv.append('<p>当前房间: ' + data.host + ' 的房间</p>');
  waitingDiv.append('<p>当前玩家: ' + data.players.join(', ') + '</p>');
  
  $('body').append(waitingDiv);
});

socket.on('playerJoined', function (data) {
  Materialize.toast('新玩家已加入游戏: ' + data.players.join(', '), 4000);
});

// 添加处理等待玩家加入游戏的事件
socket.on('waitingPlayerJoined', function (data) {
  // 移除等待页面
  $('#waitingDiv').remove();
  
  // 显示游戏界面
  $('#gameDiv').show().addClass('visible');
  var playerTable = $('.card:contains("玩家排行榜")').parent().parent();
  playerTable.appendTo('#gameDiv');
  
  Materialize.toast('你已成功加入游戏!', 4000);
});

function playNext() {
  socket.emit('startNextRound', {});
}

function updateStatisticsTable(cardData) {
  const statisticsBody = $('#statisticsBody');
  
  // 获取当前表格中的所有玩家记录
  const currentTable = {};
  $('#statisticsBody tr').each(function() {
    const username = $(this).find('td:first').text();
    const profit = parseInt($(this).find('td:last').text());
    currentTable[username] = profit;
  });
  
  // 更新或添加玩家记录
  cardData.forEach(player => {
    const profit = player.money - 50 - (50 * (player.buyIns || 0));
    currentTable[player.username] = profit;
  });
  
  // 清空表格
  statisticsBody.empty();
  
  // 按收益从高到低排序并显示所有记录
  Object.entries(currentTable)
    .sort(([, a], [, b]) => b - a)
    .forEach(([username, profit]) => {
      const row = $('<tr>');
      row.append($('<td>').text(username));
      const profitCell = $('<td>');
      // 正数带加号
      profitCell.text(profit > 0 ? '+' + profit : profit);
      if (profit > 0) {
        profitCell.css('color', 'red');
      } else if (profit < 0) {
        profitCell.css('color', 'green');
      }
      row.append(profitCell);
      statisticsBody.append(row);
    });
}

socket.on('reveal', function (data) {
  $('#usernameFold').hide();
  $('#usernameCheck').hide();
  $('#usernameBet').hide();
  $('#usernameCall').hide();
  $('#usernameRaise').hide();

  for (var i = 0; i < data.winners.length; i++) {
    if (data.winners[i] == data.username) {
      Materialize.toast('你赢了这手牌!', 4000);
      break;
    }
  }
  $('#table-title').text('本局赢家: ' + data.winners);
  $('#playNext').html(
    '<button onClick=playNext() id="playNextButton" class="btn white black-text menuButtons">开始下一局</button>'
  );
  
  updateStatisticsTable(data.cards);
  
  var handTest;
  if(data.hand == '')
    handTest='';
  if(data.hand == 'High Card')
    handTest='高牌';
  if(data.hand == 'Pair')
    handTest='一对';
  if(data.hand == 'Two Pair')
    handTest='两对';
  if(data.hand == 'Three of a Kind')
    handTest='三条';
  if(data.hand == 'Straight')
    handTest='顺子';
  if(data.hand == 'Flush')
    handTest='同花';
  if(data.hand == 'Full House')
    handTest='葫芦';
  if(data.hand == 'Four of a Kind')
    handTest='四条';
  if(data.hand == 'Straight Flush')
    handTest='同花顺';
  if(data.hand == 'Royal Flush')
    handTest='皇家同花顺';
    
  $('#blindStatus').text(handTest);
  $('#usernamesMoney').html(data.money + '<span style="color: #8B4513;">ⓜ</span>');
  $('#opponentCards').html(
    data.cards.map(function (p) {
      return renderOpponentCards(p.username, {
        cards: p.cards,
        folded: p.folded,
        money: p.money,
        endHand: p.hand,
        buyIns: p.buyIns,
      });
    })
  );
});

socket.on('endHand', function (data) {
  $('#usernameFold').hide();
  $('#usernameCheck').hide();
  $('#usernameBet').hide();
  $('#usernameCall').hide();
  $('#usernameRaise').hide();
  $('#table-title').html(data.winner + ' 赢得了 ' + data.pot + '<span style="color: #8B4513;">ⓜ</span> 的底池!');
  $('#playNext').html(
    '<button onClick=playNext() id="playNextButton" class="btn white black-text menuButtons">开始下一局</button>'
  );
  updateStatisticsTable(data.cards);
  $('#blindStatus').text('');
  if (data.folded == 'Fold') {
    $('#status').text('你已经弃牌');
    $('#playerInformationCard').removeClass('theirTurn');
    $('#playerInformationCard').removeClass('green');
    $('#playerInformationCard').addClass('grey');
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
  }
  $('#usernamesMoney').html(data.money + '<span style="color: #8B4513;">ⓜ</span>');
  $('#opponentCards').html(
    data.cards.map(function (p) {
      return renderOpponent(p.username, {
        text: p.text,
        money: p.money,
        blind: '',
        bets: data.bets,
        buyIns: p.buyIns,
      });
    })
  );
});

var beginHost = function () {
  if ($('#hostName-field').val() == '') {
    $('.toast').hide();
    $('#hostModal').closeModal();
    Materialize.toast(
      '输入了非法ID! (最长为12个字符)',
      4000
    );
    $('#joinButton').removeClass('disabled');
  } else {
    socket.emit('host', { username: $('#hostName-field').val() });
    $('#joinButton').addClass('disabled');
    $('#joinButton').off('click');
  }
};

var joinRoom = function () {
  // yes, i know this is client-side.
  if (
    $('#joinName-field').val() == '' ||
    $('#code-field').val() == '' ||
    $('#joinName-field').val().length > 12
  ) {
    $('.toast').hide();
    Materialize.toast(
      '输入了非法ID/房间号! (最长为12个字符.)',
      4000
    );
    $('#joinModal').closeModal();
    $('#hostButton').removeClass('disabled');
    $('#hostButton').on('click');
  } else {
    socket.emit('join', {
      code: $('#code-field').val(),
      username: $('#joinName-field').val(),
    });
    $('#hostButton').addClass('disabled');
    $('#hostButton').off('click');
  }
};

var startGame = function (gameCode) {
  socket.emit('startGame', { code: gameCode });
};

var fold = function () {
  socket.emit('moveMade', { move: 'fold', bet: 'Fold' });
};

var bet = function () {
  if (parseInt($('#betRangeSlider').val()) == 0) {
    Materialize.toast('你必须有所下注!', 4000);
  } else if (parseInt($('#betRangeSlider').val()) < 2) {
    Materialize.toast('最小下注为 2<span style="color: #8B4513;">ⓜ</span>.', 4000);
  } else {
    socket.emit('moveMade', {
      move: 'bet',
      bet: parseInt($('#betRangeSlider').val()),
    });
  }
};

function call() {
  socket.emit('moveMade', { move: 'call', bet: 'Call' });
}

var check = function () {
  socket.emit('moveMade', { move: 'check', bet: 'Check' });
};

var raise = function () {
  if (
    parseInt($('#raiseRangeSlider').val()) < $('#raiseRangeSlider').prop('min')//==
  ) {
    Materialize.toast(
      '你的加注必须高于当前最高下注!',
      4000
    );
  } else {
    socket.emit('moveMade', {
      move: 'raise',
      bet: parseInt($('#raiseRangeSlider').val()),
    });
  }
};

function renderCard(card) {
  if (card.suit == '♠' || card.suit == '♣')
    return (
      '<div class="playingCard_black" id="card"' +
      card.value +
      card.suit +
      '" data-value="' +
      card.value +
      ' ' +
      card.suit +
      '">' +
      card.value +
      ' ' +
      card.suit +
      '</div>'
    );
  else
    return (
      '<div class="playingCard_red" id="card"' +
      card.value +
      card.suit +
      '" data-value="' +
      card.value +
      ' ' +
      card.suit +
      '">' +
      card.value +
      ' ' +
      card.suit +
      '</div>'
    );
}

function renderOpponent(name, data) {
  var bet = 0;
  if (data.bets != undefined) {
    var arr = data.bets[data.bets.length - 1];
    for (var pn = 0; pn < arr.length; pn++) {
      if (arr[pn].player == name) bet = arr[pn].bet;
    }
  }
  var buyIns = Number(data.buyIns || 0);
  var buyInsText = '';
  if(buyIns > 0)
    buyInsText='次买入';
  if(buyIns == 0)
    buyInsText='';
  if(buyIns < 0)
    buyInsText='次卖出';
  
  var blindTest;
  if(data.blind == '')
    blindTest='';
  if(data.blind == 'Big Blind')
    blindTest='大盲';
  if(data.blind == 'Small Blind')
    blindTest='小盲';
  
  var textTest = '';
  if(data.text == '')
    textTest='';
  if(data.text == 'Their Turn')
    textTest='行动中';
  if(data.text == 'Fold')
    textTest='已弃牌';

  // 根据钱数和all-in状态决定名字颜色和显示
  var nameDisplay = data.money == 0 ?  
      '<span style="color: red;">' + name + ' (ALL-IN)</span>' : name;
  
  if (buyIns !== 0) {
    if (data.text == 'Fold') {
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey"><div class="card-content white-text"><span class="card-title">' +
        nameDisplay +
        ' (弃牌)</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
        blindTest +
        '<br />' +
        textTest +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.money + '<span style="color: #8B4513;">ⓜ</span>' +
        ' (' +
        Math.abs(buyIns) +
        ' ' +
        buyInsText +
        ')' +
        '</div></div></div>'
      );
    } else {
      if (data.text == 'Their Turn') {
        if (data.isChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title">' +
            nameDisplay +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
            ' (' +
            Math.abs(buyIns) +
            ' ' +
            buyInsText +
            ')' +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title">' +
            nameDisplay +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
            ' (' +
            Math.abs(buyIns) +
            ' ' +
            buyInsText +
            ')' +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title">' +
            nameDisplay +
            '<br />下注: ' +
            bet + '<span style="color: #8B4513;">ⓜ</span>' +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br /><br />' +
            textTest +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
            ' (' +
            Math.abs(buyIns) +
            ' ' +
            buyInsText +
            ')' +
            '</div></div></div>'
          );
        }
      } else {
        if (data.isChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameDisplay +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
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
            nameDisplay +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
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
            nameDisplay +
            '<br />下注: ' +
            bet + '<span style="color: #8B4513;">ⓜ</span>' +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
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
  // buy-ins rendering
  else {
    if (data.text == 'Fold') {
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey"><div class="card-content white-text"><span class="card-title">' +
        nameDisplay +
        ' (弃牌)</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
        blindTest +
        '<br />' +
        textTest +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.money + '<span style="color: #8B4513;">ⓜ</span>' +
        '</div></div></div>'
      );
    } else {
      if (data.text == 'Their Turn') {
        if (data.isChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            nameDisplay +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            nameDisplay +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            nameDisplay +
            '<br />下注: ' +
            bet + '<span style="color: #8B4513;">ⓜ</span>' +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br /><br />' +
            textTest +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        }
      } else {
        if (data.isChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameDisplay +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameDisplay +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            nameDisplay +
            '<br />下注: ' +
            bet + '<span style="color: #8B4513;">ⓜ</span>' +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            blindTest +
            '<br />' +
            textTest +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
            data.money + '<span style="color: #8B4513;">ⓜ</span>' +
            '</div></div></div>'
          );
        }
      }
    }
  }
}

function renderOpponentCards(name, data) {
  var bet = 0;
  if (data.bets != undefined) {
    var arr = data.bets[data.bets.length - 1].reverse();
    for (var pn = 0; pn < arr.length; pn++) {
      if (arr[pn].player == name) bet = arr[pn].bet;
    }
  }
  var buyIns2 = Number(data.buyIns || 0);
  var buyInsText2 = '';
  if(buyIns2 > 0)
    buyInsText2='次买入';
  if(buyIns2 == 0)
    buyInsText2='';
  if(buyIns2 < 0)
    buyInsText2='次卖出';

  var endHandTest;
  if(data.endHand == '')
    endHandTest='';
  if(data.endHand == 'High Card')
    endHandTest='高牌';
  if(data.endHand == 'Pair')
    endHandTest='一对';
  if(data.endHand == 'Two Pair')
    endHandTest='两对';
  if(data.endHand == 'Three of a Kind')
    endHandTest='三条';
  if(data.endHand == 'Straight')
    endHandTest='顺子';
  if(data.endHand == 'Flush')
    endHandTest='同花';
  if(data.endHand == 'Full House')
    endHandTest='葫芦';
  if(data.endHand == 'Four of a Kind')
    endHandTest='四条';
  if(data.endHand == 'Straight Flush')
    endHandTest='同花顺';
  if(data.endHand == 'Royal Flush')
    endHandTest='皇家同花顺';

  // 根据钱数和all-in状态决定名字颜色和显示
  var nameDisplay = data.money == 0 ?  
      '<span style="color: red;">' + name + ' (ALL-IN)</span>' : name;

  if (buyIns2 !== 0) {
    if (data.folded)
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey" ><div class="card-content white-text"><span class="card-title">' +
        nameDisplay +
        ' | 下注: ' +
        bet + '<span style="color: #8B4513;">ⓜ</span>' +
        '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br /><br /></p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.money + '<span style="color: #8B4513;">ⓜ</span>' +
        ' (' +
        Math.abs(buyIns2) +
        ' ' +
        buyInsText2 +
        ')' +
        '</div></div></div>'
      );
    else
      return (
        '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
        nameDisplay +
        ' | 下注: ' +
        bet + '<span style="color: #8B4513;">ⓜ</span>' +
        '</span><p><div class="center-align"> ' +
        renderOpponentCard(data.cards[0]) +
        renderOpponentCard(data.cards[1]) +
        ' </div><br /><br /><br /><br /><br />' +
        endHandTest +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.money + '<span style="color: #8B4513;">ⓜ</span>' +
        ' (' +
        Math.abs(buyIns2) +
        ' ' +
        buyInsText2 +
        ')' +
        '</div></div></div>'
      );
  } else {
    if (data.folded)
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey" ><div class="card-content white-text"><span class="card-title">' +
        nameDisplay +
        ' | 下注: ' +
        bet + '<span style="color: #8B4513;">ⓜ</span>' +
        '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br /><br /></p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.money + '<span style="color: #8B4513;">ⓜ</span>' +
        '</div></div></div>'
      );
    else
      return (
        '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
        nameDisplay +
        ' | 下注: ' +
        bet + '<span style="color: #8B4513;">ⓜ</span>' +
        '</span><p><div class="center-align"> ' +
        renderOpponentCard(data.cards[0]) +
        renderOpponentCard(data.cards[1]) +
        ' </div><br /><br /><br /><br /><br />' +
        endHandTest +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">' +
        data.money + '<span style="color: #8B4513;">ⓜ</span>' +
        '</div></div></div>'
      );
  }
}

function renderOpponentCard(card) {
  if (card.suit == '♠' || card.suit == '♣')
    return (
      '<div class="playingCard_black_opponent" id="card"' +
      card.value +
      card.suit +
      '" data-value="' +
      card.value +
      ' ' +
      card.suit +
      '">' +
      card.value +
      ' ' +
      card.suit +
      '</div>'
    );
  else
    return (
      '<div class="playingCard_red_opponent" id="card"' +
      card.value +
      card.suit +
      '" data-value="' +
      card.value +
      ' ' +
      card.suit +
      '">' +
      card.value +
      ' ' +
      card.suit +
      '</div>'
    );
}

function updateBetDisplay() {
  if ($('#betRangeSlider').val() == $('#usernamesMoney').text()) {
    $('#betDisplay').html(
      '<h3 class="center-align">All-In ' +
        $('#betRangeSlider').val() + '<span style="color: #8B4513;">ⓜ</span>' +
        '</h36>'
    );
  } else {
    $('#betDisplay').html(
      '<h3 class="center-align">' + $('#betRangeSlider').val() + '<span style="color: #8B4513;">ⓜ</span></h36>'
    );
  }
}

function updateBetModal() {
  $('#betDisplay').html('<h3 class="center-align">0<span style="color: #8B4513;">ⓜ</span></h3>');
  document.getElementById('betRangeSlider').value = 0;
  var usernamesMoneyStr = $('#usernamesMoney').text().replace('ⓜ', '');
  var usernamesMoneyNum = parseInt(usernamesMoneyStr);
  $('#betRangeSlider').attr({
    max: usernamesMoneyNum,
    min: 0,
  });
}

function updateRaiseDisplay() {
  $('#raiseDisplay').html(
    '<h3 class="center-align">将下注加到 ' +
      $('#raiseRangeSlider').val() + '<span style="color: #8B4513;">ⓜ</span>' +
      '</h3>'
  );
}

socket.on('updateRaiseModal', function (data) {
  $('#raiseRangeSlider').attr({
    max: data.usernameMoney,
    min: data.topBet,
  });
});

function updateRaiseModal() {
  document.getElementById('raiseRangeSlider').value = 0;
  socket.emit('raiseModalData', {});
}

socket.on('displayPossibleMoves', function (data) {
  if (data.fold == 'yes') $('#usernameFold').show();
  else $('#usernameHide').hide();
  if (data.check == 'yes') $('#usernameCheck').show();
  else $('#usernameCheck').hide();
  if (data.bet == 'yes') $('#usernameBet').show();
  else $('#usernameBet').hide();
  if (data.call != 'no' || data.call == 'all-in') {
    $('#usernameCall').show();
    if (data.call == 'all-in') $('#usernameCall').text('跟注 All-In');
    else $('#usernameCall').html('跟注 ' + data.call + '<span style="color: #8B4513;">ⓜ</span>');
  } else $('#usernameCall').hide();
  if (data.raise == 'yes') $('#usernameRaise').show();
  else $('#usernameRaise').hide();
});

function renderSelf(data) {
  $('#playNext').empty();
  $('#usernamesMoney').html(data.money + '<span style="color: #8B4513;">ⓜ</span>');
  
  var blindTest;
  if(data.blind == '')
    blindTest='';
  if(data.blind == 'Big Blind')
    blindTest='大盲';
  if(data.blind == 'Small Blind')
    blindTest='小盲';
    
  if (data.text == 'Their Turn') {
    $('#playerInformationCard').removeClass('grey');
    $('#playerInformationCard').removeClass('grey');
    $('#playerInformationCard').addClass('yellow');
    $('#playerInformationCard').addClass('darken-2');
    $('#usernamesCards').removeClass('white-text');
    $('#usernamesCards').addClass('black-text');
    $('#status').text('我的回合');
    Materialize.toast('我的回合', 4000);
    socket.emit('evaluatePossibleMoves', {});
  } else if (data.text == 'Fold') {
    $('#status').text('你已经弃牌');
    $('#playerInformationCard').removeClass('green');
    $('#playerInformationCard').removeClass('yellow');
    $('#playerInformationCard').removeClass('darken-2');
    $('#playerInformationCard').addClass('grey');
    $('#usernamesCards').removeClass('black-text');
    $('#usernamesCards').addClass('white-text');
    Materialize.toast('你已经弃牌', 3000);
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
  } else {
    $('#status').text('');
    $('#usernamesCards').removeClass('black-text');
    $('#usernamesCards').addClass('white-text');
    $('#playerInformationCard').removeClass('grey');
    $('#playerInformationCard').removeClass('yellow');
    $('#playerInformationCard').removeClass('darken-2');
    $('#playerInformationCard').addClass('green');
    $('#playerInformationCard').removeClass('theirTurn');
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
  }
  $('#blindStatus').text(blindTest);
}
