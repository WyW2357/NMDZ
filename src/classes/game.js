// server-side game logic for a texas hold 'em game
const Deck = require('./deck');
const Player = require('./player');
const Card = require('./card');
const Hand = require('pokersolver').Hand;
const fs = require('fs');
const path = require('path');

const Game = function (name, host) {
  this.deck = new Deck();
  this.host = host;
  this.players = [];
  this.waitingPlayers = [];
  this.status = 0;
  this.cardsPerPlayer = 2;
  this.currentlyPlayed = 0;
  this.gameWinner = null;
  this.gameName = name;
  this.roundNum = 0;
  this.roundData = {
    dealer: 0,
    bigBlind: '',
    smallBlind: '',
    turn: '',
    bets: [],
  };
  this.community = [];
  this.foldPot = 0;
  this.bigBlindWent = false;
  this.lastMoveParsed = { move: '', player: '' };
  this.roundInProgress = false;
  this.disconnectedPlayers = [];
  this.autoBuyIns = true;
  this.debug = false;
  this.smallBlind = 1;
  this.bigBlind = 2;
  this.playerStats = {}; // 添加全局统计记录
  this.logQueue = [];  // 添加日志队列
  this.isWriting = false;  // 添加写入锁
  this.isWritingTeach = false;  // TeachData写入锁
  this.isWritingTeach2 = false;  // TeachData2写入锁
  this.actionTimers = new Map(); // 添加行动计时器
  this.AA = true;
  this.BB = true;
  this.CC = true;
  this.AAname = '1';
  this.BBname = '2';
  this.CCname = '3';
  this.initialMoney = new Map();  // 添加全局变量记录初始金额

  // 清空TeachData.txt
  this.clearTeachData = () => {
    try {
      const teachDataPath = path.join(__dirname, '../../TeachData.txt');
      const teachDataPath2 = path.join(__dirname, '../../TeachData2.txt');
      fs.writeFileSync(teachDataPath, '');
      fs.writeFileSync(teachDataPath2, '');
    } catch (error) {
      console.error('清空TeachData.txt失败:', error);
    }
  }

  // 写入数据到TeachData.txt
  this.writeToTeachFile = (data) => {
    if (this.isWritingTeach) return;
    this.isWritingTeach = true;
    try {
      const teachDataPath = path.join(__dirname, '../../TeachData.txt');
      let logEntry;

      if (typeof data === 'string') {
        logEntry = `${data}\n`;
      } else {
        logEntry = `${JSON.stringify(data, null, 2)}\n`;
      }

      fs.appendFileSync(teachDataPath, logEntry);
    } catch (error) {
      console.error('写入TeachData.txt失败:', error);
    } finally {
      this.isWritingTeach = false;
    }
  }

  // 写入数据到TeachData2.txt
  this.writeToTeachFile2 = (data) => {
    if (this.isWritingTeach2) return;
    this.isWritingTeach2 = true;
    try {
      const teachDataPath2 = path.join(__dirname, '../../TeachData2.txt');
      let logEntry;

      if (typeof data === 'string') {
        logEntry = `${data}\n`;
      } else {
        logEntry = `${JSON.stringify(data, null, 2)}\n`;
      }

      fs.appendFileSync(teachDataPath2, logEntry);
    } catch (error) {
      console.error('写入TeachData2.txt失败:', error);
    } finally {
      this.isWritingTeach2 = false;
    }
  }

  // 清空GameData.txt
  const logFile = path.join(__dirname, `../../GameData_${this.gameName}.txt`);
  fs.writeFile(logFile, '', (err) => {
    if (err) {
      console.error('清空日志文件失败:', err);
    } else {
      this.log('=== 创建新房间 ===');
      this.log('房间号: ' + this.gameName);
      this.log('房主: ' + this.host);
      this.log('================');
    }
  });

  const constructor = (function () { })(this);

  this.log = (...args) => {
    if (this.debug) {
      // 控制台输出
      console.log(...args);
    }
    // 将日志加入队列
    const logMessage = args.join(' ') + '\n';
    this.logQueue.push(logMessage);

    // 如果当前没有在写入，则开始写入
    if (!this.isWriting) {
      this.writeLog();
    }

  };

  this.writeLog = () => {
    if (this.logQueue.length === 0) {
      this.isWriting = false;
      return;
    }

    this.isWriting = true;
    const logMessage = this.logQueue.shift();
    const logFile = path.join(__dirname, `../../GameData_${this.gameName}.txt`);

    fs.appendFile(logFile, logMessage, (err) => {
      if (err) {
        console.error('写入日志文件失败:', err);
      }
      // 继续写入队列中的下一条日志
      this.writeLog();
    });
  };

  this.assignBlind = () => {
    this.roundData.smallBlind =
      this.roundData.dealer + 1 < this.players.length
        ? this.roundData.dealer + 1
        : 0;
    this.roundData.bigBlind =
      this.roundData.smallBlind + 1 < this.players.length
        ? this.roundData.smallBlind + 1
        : 0;

    this.log('庄家: ' + this.players[this.roundData.dealer].getUsername() + ' 小盲: ' +
      this.players[this.roundData.smallBlind].getUsername() + ' 大盲: '
      + this.players[this.roundData.bigBlind].getUsername());

    for (let i = 0; i < this.players.length; i++) {
      this.players[i].setDealer(i === this.roundData.dealer);
      if (i === this.roundData.bigBlind) {
        this.players[i].setBlind('Big Blind');
      } else if (i === this.roundData.smallBlind) {
        this.players[i].setBlind('Small Blind');
      } else {
        this.players[i].setBlind('');
      }
      this.players[i].setStatus('');
    }

    const goFirstIndex =
      this.roundData.bigBlind + 1 < this.players.length
        ? this.roundData.bigBlind + 1
        : 0;
    this.roundData.turn = this.players[goFirstIndex].getUsername();
    this.players[goFirstIndex].setStatus('Their Turn');
    this.startActionTimer(this.players[goFirstIndex]);
  };

  this.startNewRound = () => {
    // 在开始新一局时，移除所有断开连接的玩家
    this.disconnectedPlayers.forEach(player => {
      this.players = this.players.filter((p) => p !== player);
      if (player.getUsername() == this.host) {
        if (this.players.length > 0) {
          this.host = this.players[0].getUsername();
        }
      }
    });

    // 记录玩家初始金额
    this.initialMoney.clear();
    this.players.forEach(player => {
      this.initialMoney.set(player.getUsername(), player.getMoney());
    });

    this.disconnectedPlayers = [];
    this.lastMoveParsed = { move: '', player: '' };
    this.roundInProgress = true;
    this.foldPot = 0;
    this.bigBlindWent = false;
    this.community = [];
    this.roundData.turn = '';
    this.roundData.bets = [];
    this.dealCards();
    //this.log('剩余牌数:' + this.deck.cards.length);
    for (pn of this.players) {
      pn.allIn = false;
    }

    // 打印所有玩家信息
    this.log('\n\n\n=== 新一局开始 ===');
    this.log('当前局数: ' + (this.roundNum + 1));
    // Init dealer
    if (this.roundNum == 0) {
      this.roundData.dealer = 0;
    } else {
      this.roundData.dealer =
        this.roundData.dealer + 1 < this.players.length
          ? this.roundData.dealer + 1
          : 0;
    }
    // Init blind and first player
    this.assignBlind();

    if (this.autoBuyIns) {
      for (player of this.players) {
        if (player.getMoney() <= 2) {
          player.money += 50;//100
          player.buyIns = player.buyIns + 1;
        }
        while (player.getMoney() >= 100) {
          player.money -= 50;//100
          player.buyIns = player.buyIns - 1;
        }
      }
    }
    this.log('玩家信息:');
    this.players.forEach((player, index) => {
      this.log(`${player.getUsername()}  筹码: ${player.getMoney()} 买入: ${player.buyIns} 手牌: ${player.cards.map(card => `${card.getValue()}${card.getSuit()}`).join(' ')}`);
    });
    this.players[this.roundData.bigBlind].money =
      this.players[this.roundData.bigBlind].money - this.bigBlind;
    this.roundData.bets.push([
      {
        player: this.players[this.roundData.bigBlind].getUsername(),
        bet: this.bigBlind,
      },
    ])
    this.players[this.roundData.smallBlind].money =
      this.players[this.roundData.smallBlind].money - this.smallBlind;
    this.roundData.bets[0].push({
      player: this.players[this.roundData.smallBlind].getUsername(),
      bet: this.smallBlind,
    });

    this.roundNum++;
    this.rerender();
  };

  this.rerender = () => {
    let playersData = [];
    let playersDataToAI = [];
    let handStrength = '';
    for (let pn = 0; pn < this.getNumPlayers(); pn++) {
      if (this.community.length > 0) {
        const hand = Hand.solve(this.convertCardsFormat(this.players[pn].cards.concat(this.community)));
        if (hand.name === 'High Card') handStrength = '高牌';
        else if (hand.name === 'Pair') handStrength = '一对';
        else if (hand.name === 'Two Pair') handStrength = '两对';
        else if (hand.name === 'Three of a Kind') handStrength = '三条';
        else if (hand.name === 'Straight') handStrength = '顺子';
        else if (hand.name === 'Flush') handStrength = '同花';
        else if (hand.name === 'Full House') handStrength = '葫芦';
        else if (hand.name === 'Four of a Kind') handStrength = '四条';
        else if (hand.name === 'Straight Flush') handStrength = '同花顺';
        else if (hand.name === 'Royal Flush') handStrength = '皇家同花顺';
      }

      playersData.push({
        username: this.players[pn].getUsername(),
        status: this.players[pn].getStatus(),
        blind: this.players[pn].getBlind(),
        money: this.players[pn].getMoney(),
        buyIns: this.players[pn].buyIns,
        isChecked: this.playerIsChecked(this.players[pn]),
        strength: handStrength
      });
      playersDataToAI.push({
        username: this.players[pn].getUsername(),
        blind: this.players[pn].getBlind(),
        money: this.players[pn].getMoney(),
      });
    }
    for (let pn = 0; pn < this.getNumPlayers(); pn++) {
      this.players[pn].emit('rerender', {
        community: this.community,
        topBet: this.getCurrentTopBet(),
        bets: this.roundData.bets,
        username: this.players[pn].getUsername(),
        round: this.roundNum,
        stage: this.getStageName(),
        pot: this.getCurrentPot(),
        players: playersData,
        myMoney: this.players[pn].getMoney(),
        myBet: this.getPlayerBetInStage(this.players[pn]),
        myStatus: this.players[pn].getStatus(),
        myBlind: this.players[pn].getBlind(),
        roundInProgress: this.roundInProgress,
        buyIns: this.players[pn].buyIns,
        strength: playersData[pn].strength,
        playersToAI: playersDataToAI
      });
    }
    this.log('================');


    // 添加公牌信息
    if (this.community.length > 0) {
      this.log(this.getStageName() + ' 底池: ' + this.getCurrentPot() + ' 公牌: ' +
        this.community.map(card => `${card.getValue()}${card.getSuit()}`).join(' '));
    }
    else {
      this.log(this.getStageName() + ' 底池: ' + this.getCurrentPot());
    }

    this.players.forEach((player, index) => {
      this.log(`${player.getUsername()}(${player.getMoney()} ${player.buyIns}) ${player.cards.map(card => `${card.getValue()}${card.getSuit()}`).join(' ')}  状态: ${player.getStatus()}`);
    });

    // 记录teacher信息到TeachData
    const teacher = this.players.find(p => p.getUsername() === 'wy');
    if (teacher && teacher.getStatus() === 'Their Turn') {
      const teachData = {
        mycards: teacher.cards,
        community: this.community,
        bets: this.roundData.bets,
        pot: this.getCurrentPot(),
        playersToAI: playersDataToAI,
      };
      this.writeToTeachFile(teachData);
    }
  };

  this.getCurrentPot = () => {
    if (this.roundData.bets == undefined || this.roundData.bets.length == 0)
      return 0;
    else {
      let sum = 0;
      for (let i = 0; i < this.roundData.bets.length; i++) {
        sum += this.roundData.bets[i].reduce(
          (acc, curr) =>
            curr.bet != 'Buy-in' && curr.bet != 'Fold'
              ? acc + curr.bet
              : acc + 0,
          0
        );
      }
      return this.foldPot + sum;
    }
  };

  this.getPlayerBetInStage = (player) => {
    if (
      this.roundData.bets == undefined ||
      this.roundData.bets.length == 0 ||
      this.getCurrentRoundBets() == undefined
    )
      return 0;
    const stageData = this.getCurrentRoundBets();
    let totalBetInStage = 0;

    for (let j = 0; j < stageData.length; j++) {
      if (
        stageData[j].player == player.getUsername() &&
        stageData[j].bet != 'Buy-in' &&
        stageData[j].bet != 'Fold'
      ) {
        totalBetInStage += stageData[j].bet;
        break;
      }
    }
    return totalBetInStage;
  };

  this.getCurrentTopBet = () => {
    if (this.roundData.bets == undefined || this.roundData.bets.length == 0)
      return 0;
    else {
      let maxBet = 0;
      for (let i = 0; i < this.players.length; i++) {
        maxBet = Math.max(maxBet, this.getPlayerBetInStage(this.players[i]));
      }
      return maxBet;
    }
  };

  this.getStageName = () => {
    if (this.roundData.bets.length == 1) {
      return '翻牌前';
    } else if (this.roundData.bets.length == 2) {
      return '翻牌';
    } else if (this.roundData.bets.length == 3) {
      return '转牌';
    } else if (this.roundData.bets.length == 4) {
      return '河牌';
    } else {
      return '错误';
    }
  };

  this.playerIsChecked = (playr) => {
    if (this.roundData.bets) {
      const bets = this.getCurrentRoundBets() || [];
      return bets.some((a) => a.player == playr.getUsername() && a.bet == 0);
    }
  };

  this.findFirstToGoPlayer = () => {
    if (
      !this.players[this.roundData.smallBlind] ||
      this.players[this.roundData.smallBlind].getStatus() == 'Fold' ||
      this.players[this.roundData.smallBlind].allIn
    ) {
      let index = this.roundData.smallBlind;
      do {
        //index = index - 1 < 0 ? this.players.length - 1 : index - 1;
        index = index + 1 < this.players.length ? index + 1 : 0;
      } while (
        this.players[index].getStatus() == 'Fold' ||
        this.players[index].allIn
      );
      return index;
    } else {
      return this.roundData.smallBlind;
    }
  };

  this.getNonFoldedPlayer = () => {
    let numNonFolds = 0;
    let nonFolderPlayer;
    for (let i = 0; i < this.getNumPlayers(); i++) {
      if (this.players[i].getStatus() != 'Fold') {
        numNonFolds++;
        nonFolderPlayer = this.players[i];
      }
    }
    return [numNonFolds, nonFolderPlayer];
  };

  this.updateStage = () => {
    this.lastMoveParsed = { move: '', player: '' };
    // 检查是否有掉线玩家需要处理
    for (let i = 0; i < this.players.length; i++) {
      if (this.disconnectedPlayers.includes(this.players[i])) {
        this.log('updateStage掉线处理');
        // 如果掉线玩家未弃牌，则自动弃牌
        if (this.players[i].getStatus() !== 'Fold') {
          const currentBet = this.getPlayerBetInStage(this.players[i]);
          this.foldPot = this.foldPot + currentBet;

          // 更新当前回合的下注记录
          const currentRoundBets = this.getCurrentRoundBets();
          if (currentRoundBets.some(bet => bet.player === this.players[i].getUsername())) {
            this.setCurrentRoundBets(
              currentRoundBets.map(bet =>
                bet.player === this.players[i].getUsername()
                  ? { player: this.players[i].getUsername(), bet: 'Fold' }
                  : bet
              )
            );
          } else {
            currentRoundBets.push({
              player: this.players[i].getUsername(),
              bet: 'Fold'
            });
          }

          // 设置玩家状态为弃牌
          this.players[i].setStatus('Fold');

          // 如果掉线玩家是大盲，标记大盲已行动
          if (this.players[i].getBlind() === 'Big Blind' && this.roundData.bets.length === 1) {
            this.bigBlindWent = true;
          }
        }
      }
    }

    // 设置下一个行动玩家
    for (let i = 0; i < this.players.length; i++) {
      if (
        i === this.findFirstToGoPlayer() &&
        this.players[i].getStatus() !== 'Fold'
      ) {
        this.players[i].setStatus('Their Turn');
        this.startActionTimer(this.players[i]);
      } else if (this.players[i].getStatus() !== 'Fold') {
        this.players[i].setStatus('');
      }
    }
    this.roundData.bets.push([]);
  };

  this.moveOntoNextPlayer = () => {
    let handOver = false;

    // 首先检查是否只剩一个玩家未弃牌
    const [numNonFolds, nonFolderPlayer] = this.getNonFoldedPlayer();
    if (numNonFolds == 1) {
      // everyone folded, start new round, give pot to player
      this.log('除一人外所有玩家弃牌');
      nonFolderPlayer.money = this.getCurrentPot() + nonFolderPlayer.money;
      this.endHandAllFold(nonFolderPlayer.getUsername());
      handOver = true;
    }
    else if (this.isStageComplete()) {
      this.log('阶段完成');
      if (this.allPlayersAllIn()) {
        this.log('所有玩家 ALL-IN');
        if (this.roundData.bets.length == 1) {
          this.community.push(this.deck.dealRandomCard());
          this.community.push(this.deck.dealRandomCard());
          this.community.push(this.deck.dealRandomCard());
          this.roundData.bets.push([]);
        }
        if (this.roundData.bets.length == 2) {
          this.community.push(this.deck.dealRandomCard());
          this.roundData.bets.push([]);
        }
        if (this.roundData.bets.length == 3) {
          this.community.push(this.deck.dealRandomCard());
          this.roundData.bets.push([]);
        }
        this.rerender();
      }
      if (this.roundData.bets.length == 1) {
        this.community.push(this.deck.dealRandomCard());
        this.community.push(this.deck.dealRandomCard());
        this.community.push(this.deck.dealRandomCard());
        this.updateStage();
      } else if (this.roundData.bets.length == 2) {
        this.community.push(this.deck.dealRandomCard());
        this.updateStage();
      } else if (this.roundData.bets.length == 3) {
        this.community.push(this.deck.dealRandomCard());
        this.updateStage();
      } else if (this.roundData.bets.length == 4) {
        handOver = true;
        const roundResults = this.evaluateWinners();
        for (playerResult of roundResults.playersData) {
          playerResult.player.setStatus(playerResult.hand.name);
        }
        const winningData = this.distributeMoney(roundResults);
        this.revealCards(winningData.filter((a) => a.winner));
      } else {
        this.log('本轮的阶段不存在!');
      }
    } else {
      let currTurnIndex = 0;
      //check if move just made was a fold
      if (this.lastMoveParsed.move == 'Fold') {
        currTurnIndex = this.players.findIndex(
          (p) => p === this.lastMoveParsed.player
        );
        this.lastMoveParsed = { move: '', player: '' };
      } else {
        currTurnIndex = this.players.findIndex(
          (p) => p.getStatus() === 'Their Turn'
        );
        this.players[currTurnIndex].setStatus('');
      }
      let count = 0; let A = 0;
      do {
        currTurnIndex = currTurnIndex + 1 < this.players.length ? currTurnIndex + 1 : 0;
        count++;

        // 检查当前玩家是否在掉线列表中
        const currentPlayer = this.players[currTurnIndex];
        if (this.disconnectedPlayers.includes(currentPlayer)) {
          this.log('moveOntoNextPlayer掉线处理');
          // 如果玩家掉线，自动执行弃牌
          currentPlayer.setStatus('Fold');
          const currentBet = this.getPlayerBetInStage(currentPlayer);
          this.foldPot = this.foldPot + currentBet;

          // 更新当前回合的下注记录
          const currentRoundBets = this.getCurrentRoundBets();
          if (currentRoundBets.some(bet => bet.player === currentPlayer.getUsername())) {
            this.setCurrentRoundBets(
              currentRoundBets.map(bet =>
                bet.player === currentPlayer.getUsername()
                  ? { player: currentPlayer.getUsername(), bet: 'Fold' }
                  : bet
              )
            );
          } else {
            currentRoundBets.push({
              player: currentPlayer.getUsername(),
              bet: 'Fold'
            });
          }

          // 如果掉线玩家是大盲，标记大盲已行动
          if (currentPlayer.getBlind() === 'Big Blind' && this.roundData.bets.length === 1) {
            this.bigBlindWent = true;
          }

          // 检查是否只剩下一个玩家未弃牌
          const [numNonFolds, nonFolderPlayer] = this.getNonFoldedPlayer();
          if (numNonFolds === 1) {
            // 只剩下一个玩家，直接结束本局
            nonFolderPlayer.money = this.getCurrentPot() + nonFolderPlayer.money;
            this.endHandAllFold(nonFolderPlayer.getUsername());
            return;
          }

          // 检查当前阶段是否已完成
          if (this.isStageComplete()) {
            this.log('掉线玩家弃牌后，当前阶段已完成');
            if (this.roundData.bets.length == 1) {
              this.community.push(this.deck.dealRandomCard());
              this.community.push(this.deck.dealRandomCard());
              this.community.push(this.deck.dealRandomCard());
              this.updateStage();
            } else if (this.roundData.bets.length == 2) {
              this.community.push(this.deck.dealRandomCard());
              this.updateStage();
            } else if (this.roundData.bets.length == 3) {
              this.community.push(this.deck.dealRandomCard());
              this.updateStage();
            } else if (this.roundData.bets.length == 4) {
              handOver = true;
              const roundResults = this.evaluateWinners();
              for (playerResult of roundResults.playersData) {
                playerResult.player.setStatus(playerResult.hand.name);
              }
              const winningData = this.distributeMoney(roundResults);
              this.revealCards(winningData.filter((a) => a.winner));
            }
            A = 1;
          }
        }
      } while (
        (this.players[currTurnIndex].getStatus() == 'Fold' ||
          this.players[currTurnIndex].allIn ||
          this.disconnectedPlayers.includes(this.players[currTurnIndex]))
        && count < 100
      );
      if (A == 0) {
        this.players[currTurnIndex].setStatus('Their Turn');
        // 开始新玩家的行动计时
        this.startActionTimer(this.players[currTurnIndex]);
      }
    }
    if (!handOver) {
      this.rerender();
    }
  };

  this.getPlayerBetInStageNum = (player, stageNum) => {
    if (
      this.roundData.bets == undefined ||
      this.roundData.bets.length == 0 ||
      this.roundData.bets[stageNum - 1] == undefined
    )
      return 0;
    const stageData = this.roundData.bets[stageNum - 1];
    let totalBetInStage = 0;

    for (let j = 0; j < stageData.length; j++) {
      if (
        stageData[j].player == player.getUsername() &&
        stageData[j].bet != 'Buy-in' &&
        stageData[j].bet != 'Fold'
      )
        totalBetInStage += stageData[j].bet;
    }
    return totalBetInStage;
  };

  this.getTotalBetsInStageNum = (stageNum) => {
    if (
      this.roundData.bets == undefined ||
      this.roundData.bets.length == 0 ||
      this.roundData.bets[stageNum - 1] == undefined
    )
      return 0;
    const stageData = this.roundData.bets[stageNum - 1];
    let totalBetInStage = 0;

    for (let j = 0; j < stageData.length; j++) {
      if (stageData[j].bet != 'Buy-in' && stageData[j].bet != 'Fold')
        totalBetInStage += stageData[j].bet;
    }
    return totalBetInStage;
  };

  this.getTotalInvested = (player) => {
    return (
      this.getPlayerBetInStageNum(player, 1) +
      this.getPlayerBetInStageNum(player, 2) +
      this.getPlayerBetInStageNum(player, 3) +
      this.getPlayerBetInStageNum(player, 4)
    );
  };

  this.calculateMoney = (winnerPot, players) => {
    let playerInvestments = [...players];
    while (playerInvestments.length > 1) {
      const sortedByInvested = playerInvestments.sort((a, b) =>
        a.invested < b.invested ? -1 : 1
      );
      const minStack = sortedByInvested[0].invested;
      winnerPot += minStack * playerInvestments.length;
      for (p of playerInvestments) {
        p.invested -= minStack;
      }
      const sortedByHandStrength = playerInvestments.sort((a, b) =>
        a.handStrength > b.handStrength ? -1 : 1
      );
      const maxHand = sortedByHandStrength[0].handStrength;
      const winners = playerInvestments.filter(
        (p) => p.handStrength === maxHand && p.live
      );

      const baseAmount = Math.trunc(winnerPot / winners.length);  // 直接使用整数除法
      const remainder = winnerPot % winners.length;
      // 找到离庄家最近的赢家
      let closestToDealer = winners[0];
      let minDistance = 20;

      for (const winner of winners) {
        const seat = this.players.findIndex(p => p === winner.player);
        const distance = (seat - this.roundData.dealer) >= 0 ? (seat - this.roundData.dealer) : (seat - this.roundData.dealer + this.players.length);
        if (distance < minDistance) {
          minDistance = distance;
          closestToDealer = winner;
        }
      }

      // 分配奖金
      for (const winner of winners) {
        winner.result += baseAmount;
      }

      // 将余数给离庄家最近的赢家
      if (remainder > 0) {
        closestToDealer.result += remainder;
      }
      playerInvestments = playerInvestments.filter((p) => p.invested > 0);
      winnerPot = 0;
    }
    if (playerInvestments.length === 1) {
      let p = playerInvestments[0];
      p.result += winnerPot + p.invested;
    }
  };

  this.distributeMoney = (result) => {
    let playerInvestments = this.players.map((p) => {
      const winData = result.winnerData.find((w) => w.player === p);
      const invested = this.getTotalInvested(p);
      return {
        player: p,
        invested: invested,
        originalInvested: invested,
        handStrength: winData ? winData.rank : -1,
        result: -invested,
        live: p.getStatus() !== 'Fold',
        winner: false,
        gain: 0,
      };
    });
    let pot = this.foldPot;
    this.calculateMoney(pot, playerInvestments);

    for (p of playerInvestments) {
      p.gain = p.originalInvested + p.result;
      p.player.money += p.gain;
      if (p.gain > 0) {
        p.winner = true;
      }
    }
    return playerInvestments;
  };

  this.evaluateWinners = () => {
    let handArray = [];
    let playerArray = [];
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].getStatus() != 'Fold') {
        let h = Hand.solve(
          this.convertCardsFormat(this.players[i].cards.concat(this.community))
        );
        handArray.push(h);
        playerArray.push({ player: this.players[i], hand: h });
      }
    }
    const winners = Hand.winners(handArray);

    let winnerData = [];
    if (Array.isArray(winners)) {
      for (playerHand of playerArray) {
        for (winner of winners) {
          let winnerArray = winner.toString().split(', ');
          if (
            this.arraysEqual(playerHand.hand.cards.sort(), winnerArray.sort())
          ) {
            winnerData.push({
              player: playerHand.player,
              rank: playerHand.hand.rank,
              handTitle: playerHand.hand.name,
            });
            break;
          }
        }
      }
    } else {
      this.log('错误:赢家无法计算');
    }
    const res = { winnerData: winnerData, playersData: playerArray };
    return res;
  };

  this.arraysEqual = (a, b) => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;

    for (let i = 0; i < a.length; ++i) {
      if (a[i] != b[i]) return false;
    }
    return true;
  };

  this.convertCardsFormat = (arr) => {
    let res = [];
    for (let i = 0; i < arr.length; i++) {
      let str = '';
      let value = arr[i].getValue();
      let suit = arr[i].getSuit();
      if (value == 10) {
        str += 'T';
      } else {
        str += value.toString();
      }
      if (suit == '♠') str += 's';
      else if (suit == '♥') str += 'h';
      else if (suit == '♦') str += 'd';
      else if (suit == '♣') str += 'c';
      res.push(str);
    }
    return res;
  };

  this.endHandAllFold = (username) => {
    this.clearAllActionTimers();
    this.roundInProgress = false;
    let cardData = [];
    for (let i = 0; i < this.players.length; i++) {
      cardData.push({
        username: this.players[i].getUsername(),
        money: this.players[i].getMoney(),
        text: this.players[i].getStatus(),
        buyIns: this.players[i].buyIns,  // 添加 buyIns 信息
      });
    }
    for (let pn = 0; pn < this.getNumPlayers(); pn++) {
      this.players[pn].emit('endHand', {
        winner: username,
        folded: this.players[pn].getUsername() != username ? 'Fold' : '',
        username: this.players[pn].getUsername(),
        pot: this.getCurrentPot(),
        money: this.players[pn].getMoney(),
        buyIns: this.players[pn].buyIns,  // 添加 buyIns 信息
        cards: cardData,
        bets: this.roundData.bets,
      });
    }
    // 打印所有玩家金额变化
    this.log('\n本局结束:');
    this.players.forEach(player => {
      const initial = this.initialMoney.get(player.getUsername());
      const change = player.getMoney() - initial;
      const changeText = change >= 0 ? `+${change}` : change;
      this.log(`${player.getUsername()}: ${initial} -> ${player.getMoney()} (${changeText})`);
    });
    this.log('================');
    // 5秒后自动开始下一局
    setTimeout(() => {
      if (this.waitingPlayers && this.waitingPlayers.length > 0) {
        this.addWaitingPlayersToGame();
      }
      this.startNewRound();
    }, 10000);
  };

  this.revealCards = (winners) => {
    this.clearAllActionTimers();
    this.roundInProgress = false;
    let cardData = [];
    for (let i = 0; i < this.players.length; i++) {
      const winData = winners.find((w) => w.player === this.players[i]);
      const money = this.players[i].getMoney();
      const buyIns = this.players[i].buyIns;
      const profit = money - 50 - (50 * (buyIns || 0));

      // 更新统计信息
      this.playerStats[this.players[i].getUsername()] = {
        money,
        buyIns,
        profit,
        lastUpdate: Date.now()
      };

      cardData.push({
        username: this.players[i].getUsername(),
        cards: this.players[i].cards,
        hand: this.players[i].getStatus(),
        folded: this.players[i].getStatus() == 'Fold',
        money: money,
        buyIns: buyIns,
        gain: winData ? winData.gain : null,
      });
    }
    const winnersUsernames = winners
      .map((a) => {
        const gain = a.gain > 0 ? `(+${a.gain}<span style="color: #8B4513;">ⓜ</span>) ` : '';
        return a.player.getUsername() + gain;
      })
      .toString();
    for (let pn = 0; pn < this.getNumPlayers(); pn++) {
      this.players[pn].emit('reveal', {
        username: this.players[pn].getUsername(),
        money: this.players[pn].getMoney(),
        cards: cardData,
        bets: this.roundData.bets,
        winners: winnersUsernames,
        hand: this.players[pn].getStatus(),
      });
    }
    // 打印所有玩家金额变化
    this.log('\n本局结束:');
    this.players.forEach(player => {
      const initial = this.initialMoney.get(player.getUsername());
      const change = player.getMoney() - initial;
      const changeText = change >= 0 ? `+${change}` : change;
      this.log(`${player.getUsername()}: ${initial} -> ${player.getMoney()} (${changeText})`);
    });
    this.log('================');
    // 5秒后自动开始下一局
    setTimeout(() => {
      if (this.waitingPlayers && this.waitingPlayers.length > 0) {
        this.addWaitingPlayersToGame();
      }
      this.startNewRound();
    }, 10000);
  };

  this.allPlayersAllIn = () => {
    let participatingPlayers = 0;
    let hasAllInPlayer = false;
    for (player of this.players) {
      if (player.allIn) {
        hasAllInPlayer = true;
      }
      if (!player.allIn && player.getStatus() != 'Fold') {
        participatingPlayers++;
      }
    }
    return hasAllInPlayer && participatingPlayers <= 1;
  };

  this.isStageComplete = () => {
    let allPlayersPresent = false;
    let numUnfolded = 0;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].status != 'Fold' && !this.players[i].allIn)
        numUnfolded++;
    }
    const currRound = this.getCurrentRoundBets();
    if (this.roundData.bets.length == 1) {
      allPlayersPresent =
        currRound.filter((a) => a.bet != 'Fold').length >= numUnfolded &&
        this.bigBlindWent;
    } else {
      allPlayersPresent =
        currRound.filter((a) => a.bet != 'Fold').length >= numUnfolded;
    }
    //this.log('所有可行动玩家已行动 ' + allPlayersPresent);
    let allPlayersCall = true;
    for (player of this.players) {
      if (
        player.getStatus() != 'Fold' &&
        this.getPlayerBetInStage(player) != this.getCurrentTopBet() &&
        !player.allIn
      ) {
        allPlayersCall = false;
        break;
      }
    }
    //this.log('所有玩家跟平 ' + allPlayersCall);
    return allPlayersPresent && allPlayersCall;
  };

  this.setCardsPerPlayer = (numCards) => {
    this.cardsPerPlayer = numCards;
  };

  this.getHostName = () => {
    return this.host;
  };

  this.getPlayersArray = () => {
    return this.players.map((p) => {
      return p.getUsername();
    });
  };

  this.getCode = () => {
    return this.gameName;
  };

  this.addPlayer = (playerName, socket) => {
    const player = new Player(playerName, socket, this.debug);
    this.players.push(player);
    return player;
  };

  this.getNumPlayers = () => {
    return this.players.length;
  };

  this.startGame = () => {
    //this.dealCards();
    this.clearTeachData();
    this.emitPlayers('startGame', {
      players: this.players.map((p) => {
        return p.username;
      }),
    });
    this.startNewRound();
  };

  this.dealCards = () => {
    this.deck.shuffle();

    const AAPlayer = this.players.find(player => player.getUsername() === this.AAname);
    const BBPlayer = this.players.find(player => player.getUsername() === this.BBname);
    const CCPlayer = this.players.find(player => player.getUsername() === this.CCname);
    if (AAPlayer && this.AA) {
      this.deck.cards = this.deck.cards.filter(card =>
        !(card.getValue() === 'A' && (card.getSuit() === '♠' || card.getSuit() === '♥'))
      );
    }
    if (BBPlayer && this.BB) {
      this.deck.cards = this.deck.cards.filter(card =>
        !(card.getValue() === 'A' && (card.getSuit() === '♠' || card.getSuit() === '♥'))
      );
    }
    if (CCPlayer && this.CC) {
      this.deck.cards = this.deck.cards.filter(card =>
        !(card.getValue() === 'A' && (card.getSuit() === '♠' || card.getSuit() === '♥'))
      );
    }

    for (let pn = 0; pn < this.getNumPlayers(); pn++) {
      this.players[pn].cards = [];
      if (this.AA && this.players[pn].getUsername() === this.AAname) {
        // 为特定玩家发特定的牌
        const aceSpade = new Card('A', '♠');
        const aceHeart = new Card('A', '♥');
        this.players[pn].addCard(aceSpade);
        this.players[pn].addCard(aceHeart);
      } else if (this.BB && this.players[pn].getUsername() === this.BBname) {
        // 为特定玩家发特定的牌
        const twoSpade = new Card('A', '♠');
        const twoHeart = new Card('A', '♥');
        this.players[pn].addCard(twoSpade);
        this.players[pn].addCard(twoHeart);
      } else if (this.CC && this.players[pn].getUsername() === this.CCname) {
        // 为特定玩家发特定的牌
        const threeSpade = new Card('A', '♠');
        const threeHeart = new Card('A', '♥');
        this.players[pn].addCard(threeSpade);
        this.players[pn].addCard(threeHeart);
      } else {
        for (let i = 0; i < this.cardsPerPlayer; i++) {
          this.players[pn].addCard(this.deck.dealRandomCard());
        }
      }
    }
    this.refreshCards();
  };

  this.refreshCards = function () {
    for (let pn = 0; pn < this.getNumPlayers(); pn++) {
      this.players[pn].cards.sort((a, b) => {
        return a.compare(b);
      });

      this.players[pn].emit('dealt', {
        currBet: this.getCurrentTopBet(),
        username: this.players[pn].getUsername(),
        cards: this.players[pn].cards,
        players: this.players.map((p) => {
          return p.username;
        }),
      });
    }
  };

  this.emitPlayers = (eventName, payload) => {
    for (let pn = 0; pn < this.getNumPlayers(); pn++) {
      this.players[pn].emit(eventName, payload);
    }
  };

  this.findPlayer = (socketId) => {
    for (let pn = 0; pn < this.getNumPlayers(); pn++) {
      if (this.players[pn].socket.id === socketId) {
        return this.players[pn];
      }
    }
    return { socket: { id: 0 } };
  };

  this.disconnectPlayer = (player) => {
    // 保存玩家统计信息
    const username = player.getUsername();
    const money = player.getMoney();
    const buyIns = player.buyIns;
    const profit = money - 50 - (50 * (buyIns || 0));
    this.playerStats[username] = {
      money,
      buyIns,
      profit,
      lastUpdate: Date.now()
    };

    // 将玩家标记为断开连接
    this.disconnectedPlayers.push(player);

    // 如果玩家正在行动，直接弃牌
    if (player.getStatus() === 'Their Turn') {
      this.log('disconnectPlayer掉线处理');
      const currentBet = this.getPlayerBetInStage(player);
      this.foldPot = this.foldPot + currentBet;

      // 更新当前回合的下注记录
      const currentRoundBets = this.getCurrentRoundBets();
      if (currentRoundBets.some(bet => bet.player === player.getUsername())) {
        this.setCurrentRoundBets(
          currentRoundBets.map(bet =>
            bet.player === player.getUsername()
              ? { player: player.getUsername(), bet: 'Fold' }
              : bet
          )
        );
      } else {
        currentRoundBets.push({
          player: player.getUsername(),
          bet: 'Fold'
        });
      }

      // 设置玩家状态为弃牌
      player.setStatus('Fold');

      // 如果掉线玩家是大盲，标记大盲已行动
      if (player.getBlind() === 'Big Blind' && this.roundData.bets.length === 1) {
        this.bigBlindWent = true;
      }
      this.lastMoveParsed = { move: 'Fold', player: player };

      // 移动到下一个玩家
      if (this.roundInProgress) {
        this.moveOntoNextPlayer();
      }
    }

    // 通知其他玩家该玩家已断开连接
    this.emitPlayers('playerDisconnected', { player: username });
    this.emitPlayers('joinRoomUpdate', {
      players: this.getPlayersArray(),
      code: this.getCode(),
    });
    this.emitPlayers('hostRoomUpdate', { players: this.getPlayersArray() });
    this.rerender();
  };

  this.checkBigBlindWent = (socket) => {
    if (
      this.findPlayer(socket.id).blindValue == 'Big Blind' &&
      this.roundData.bets.length == 1
    ) {
      this.bigBlindWent = true;
    }
  };

  this.getCurrentRoundBets = () => {
    return this.roundData.bets[this.roundData.bets.length - 1];
  };

  this.setCurrentRoundBets = (bets) => {
    return (this.roundData.bets[this.roundData.bets.length - 1] = bets);
  };

  this.fold = (socket) => {
    this.clearActionTimer(this.findPlayer(socket.id));
    this.checkBigBlindWent(socket);
    const player = this.findPlayer(socket.id);
    let preFoldBetAmount = 0;

    let roundDataStage = this.getCurrentRoundBets().find(
      (a) => a.player == player.getUsername()
    );
    if (roundDataStage != undefined && roundDataStage.bet != 'Fold') {
      preFoldBetAmount += roundDataStage.bet;
    }
    player.setStatus('Fold');
    this.foldPot = this.foldPot + preFoldBetAmount;
    this.log(`${player.getUsername()} [弃牌]`);

    if (
      this.getCurrentRoundBets().some((a) => a.player == player.getUsername())
    ) {
      this.setCurrentRoundBets(
        this.getCurrentRoundBets().map((a) =>
          a.player == player.getUsername()
            ? { player: player.getUsername(), bet: 'Fold' }
            : a
        )
      );
    } else {
      this.getCurrentRoundBets().push({
        player: player.getUsername(),
        bet: 'Fold',
      });
    }
    this.lastMoveParsed = { move: 'Fold', player: player };

    // 记录teacher的行动
    if (player.getUsername() === 'wy') {
      const teachData = {
        action: 'Fold'
      };
      this.writeToTeachFile2(teachData);
    }

    this.moveOntoNextPlayer();
    return true;
  };

  this.call = (socket) => {
    this.clearActionTimer(this.findPlayer(socket.id));
    this.checkBigBlindWent(socket);
    const player = this.findPlayer(socket.id);
    let currBet = this.getPlayerBetInStage(player);
    const topBet = this.getCurrentTopBet();
    this.log(`${player.getUsername()} [跟注] ${currBet} -> ${topBet}`);
    if (currBet === 0) {
      if (
        this.getCurrentRoundBets().some((a) => a.player == player.getUsername())
      ) {
        if (player.getMoney() - topBet <= 0) {
          this.setCurrentRoundBets(
            this.getCurrentRoundBets().map((a) =>
              a.player == player.username
                ? { player: player.getUsername(), bet: player.getMoney() }
                : a
            )
          );
          player.money = 0;
          player.allIn = true;
          this.log(`${player.getUsername()} ALL-IN`);
        } else {
          this.setCurrentRoundBets(
            this.getCurrentRoundBets().map((a) =>
              a.player == player.username
                ? { player: player.getUsername(), bet: topBet }
                : a
            )
          );
          player.money = player.money - topBet;
        }
      } else {
        if (player.getMoney() - topBet <= 0) {
          this.getCurrentRoundBets().push({
            player: player.getUsername(),
            bet: player.getMoney(),
          });
          player.money = 0;
          player.allIn = true;
          this.log(`${player.getUsername()} ALL-IN`);
        } else {
          this.getCurrentRoundBets().push({
            player: player.getUsername(),
            bet: topBet,
          });
          player.money = player.money - topBet;
        }
      }

      // 记录teacher的行动
      if (player.getUsername() === 'wy') {
        const teachData = {
          action: 'Call'
        };
        this.writeToTeachFile2(teachData);
      }

      this.moveOntoNextPlayer();
      return true;
    } else {
      if (
        this.getCurrentRoundBets().some((a) => a.player == player.getUsername())
      ) {
        if (player.getMoney() + currBet - topBet <= 0) {
          this.setCurrentRoundBets(
            this.getCurrentRoundBets().map((a) =>
              a.player == player.username
                ? {
                  player: player.getUsername(),
                  bet: player.getMoney() + currBet,
                }
                : a
            )
          );
          player.money = 0;
          player.allIn = true;
          this.log(`${player.getUsername()} ALL-IN`);
          this.moveOntoNextPlayer();
        } else {
          this.setCurrentRoundBets(
            this.getCurrentRoundBets().map((a) =>
              a.player == player.username
                ? { player: player.getUsername(), bet: topBet }
                : a
            )
          );
          player.money = player.money - (topBet - currBet);
          this.moveOntoNextPlayer();
        }

        // 记录teacher的行动
        if (player.getUsername() === 'wy') {
          const teachData = {
            action: 'Call'
          };
          this.writeToTeachFile2(teachData);
        }

        return true;
      } else {
        this.log('这不应该发生');
      }
    }
  };

  this.bet = (socket, bet) => {
    this.clearActionTimer(this.findPlayer(socket.id));
    this.checkBigBlindWent(socket);
    if (bet >= this.bigBlind) {
      const player = this.findPlayer(socket.id);
      if (player.getMoney() - bet >= 0) {
        this.log(`${player.getUsername()} [下注] ${bet}`);
        this.setCurrentRoundBets(
          this.getCurrentRoundBets().filter(
            (a) => a.player != player.getUsername()
          )
        );
        this.getCurrentRoundBets().push({
          player: player.getUsername(),
          bet: bet,
        });
        player.money = player.money - bet;
        if (player.money == 0) {
          player.allIn = true;
          this.log(`[全押] 玩家 ${player.getUsername()} 全押`);
        }

        // 记录teacher的行动
        if (player.getUsername() === 'wy') {
          const teachData = {
            action: 'Raise'
          };
          this.writeToTeachFile2(teachData);
        }

        this.moveOntoNextPlayer();
        return true;
      }
    }
  };

  this.check = (socket) => {
    this.clearActionTimer(this.findPlayer(socket.id));
    this.checkBigBlindWent(socket);
    let currBet = 0;
    const player = this.findPlayer(socket.id);
    this.log(`${player.getUsername()} [过牌]`);

    if (
      this.getCurrentRoundBets().find(
        (a) => a.player == player.getUsername()
      ) != undefined
    ) {
      currBet = this.getCurrentRoundBets().find(
        (a) => a.player == player.getUsername()
      ).bet;
      this.setCurrentRoundBets(
        this.getCurrentRoundBets().map((a) =>
          a.player == player.getUsername()
            ? { player: player.getUsername(), bet: currBet }
            : a
        )
      );
    } else {
      this.getCurrentRoundBets().push({
        player: player.getUsername(),
        bet: currBet,
      });
    }

    // 记录teacher的行动
    if (player.getUsername() === 'wy') {
      const teachData = {
        action: 'Check'
      };
      this.writeToTeachFile2(teachData);
    }

    this.moveOntoNextPlayer();
    return true;
  };

  this.raise = (socket, bet) => {
    this.clearActionTimer(this.findPlayer(socket.id));
    this.checkBigBlindWent(socket);
    const topBet = this.getCurrentTopBet();
    const player = this.findPlayer(socket.id);
    const currBet = this.getPlayerBetInStage(player);
    const moneyToRemove = bet - currBet;
    this.log(`${player.getUsername()} [加注] ${currBet} -> ${bet}`);

    if (
      moneyToRemove > 0 &&
      bet >= topBet &&
      player.getMoney() - moneyToRemove >= 0
    ) {
      if (currBet === 0) {
        this.setCurrentRoundBets(
          this.getCurrentRoundBets().filter(
            (a) => a.player != player.getUsername()
          )
        );
        this.getCurrentRoundBets().push({
          player: player.getUsername(),
          bet: bet,
        });
      } else {
        this.setCurrentRoundBets(
          this.getCurrentRoundBets().map((a) =>
            a.player == player.getUsername()
              ? { player: player.getUsername(), bet: bet }
              : a
          )
        );
      }
      player.money -= moneyToRemove;
      if (player.money == 0) {
        player.allIn = true;
        this.log(`${player.getUsername()} ALL-IN`);
      }

      // 记录teacher的行动
      if (player.getUsername() === 'wy') {
        const teachData = {
          action: 'Raise'
        };
        this.writeToTeachFile2(teachData);
      }

      this.moveOntoNextPlayer();
      return true;
    }
  };

  this.getPossibleMoves = (socket) => {
    const player = this.findPlayer(socket.id);
    const playerBet = this.getPlayerBetInStage(player);
    const topBet = this.getCurrentTopBet();
    let possibleMoves = {
      fold: 'yes',
      check: 'yes',
      bet: 'yes',
      call: topBet,
      raise: 'yes',
    };
    if (player.getStatus() == 'Fold') {
      this.log('错误: 已弃牌玩家不应该行动.');
    }
    if (topBet != 0) {
      possibleMoves.bet = 'no';
      possibleMoves.check = 'no';
      if (
        player.blindValue == 'Big Blind' &&
        !this.bigBlindWent &&
        topBet == this.bigBlind
      )
        possibleMoves.check = 'yes';
    } else {
      possibleMoves.raise = 'no';
    }
    if (topBet <= playerBet) {
      possibleMoves.call = 'no';
    }
    if (topBet >= player.getMoney() + playerBet) {
      possibleMoves.raise = 'no';
      possibleMoves.call = 'all-in';
    }
    return possibleMoves;
  };

  this.addWaitingPlayer = (playerName, socket) => {
    this.waitingPlayers.push({
      username: playerName,
      socket: socket
    });
    this.log('玩家 ' + playerName + ' 已加入等待列表');
  };

  this.addWaitingPlayersToGame = () => {
    if (this.waitingPlayers.length === 0) return;

    this.log('将等待中的玩家加入游戏');

    for (const waitingPlayer of this.waitingPlayers) {
      const player = new Player(waitingPlayer.username, waitingPlayer.socket, this.debug);

      // 检查是否有同名玩家的历史记录
      if (this.playerStats[waitingPlayer.username]) {
        // 继承历史记录
        player.money = this.playerStats[waitingPlayer.username].money;
        player.buyIns = this.playerStats[waitingPlayer.username].buyIns;
        this.log(`玩家 ${waitingPlayer.username} 中途加入游戏，继承历史记录`);
      }

      this.players.push(player);
      this.log('玩家 ' + waitingPlayer.username + ' 已从等待列表加入游戏');

      // 通知等待玩家已加入游戏
      waitingPlayer.socket.emit('waitingPlayerJoined', {
        players: this.getPlayersArray()
      });
    }

    // 清空等待列表
    this.waitingPlayers = [];

    // 通知所有玩家有新玩家加入
    this.emitPlayers('playerJoined', {
      players: this.getPlayersArray()
    });
  };

  this.removePlayer = (socket) => {
    const player = this.findPlayer(socket.id);
    if (player) {
      // 保存玩家统计信息
      const username = player.getUsername();
      const money = player.getMoney();
      const buyIns = player.buyIns;
      const profit = money - 50 - (50 * (buyIns || 0));
      this.playerStats[username] = {
        money,
        buyIns,
        profit,
        lastUpdate: Date.now()
      };

      this.players = this.players.filter((p) => p.id != socket.id);
      this.log('玩家 ' + player.getUsername() + ' 离开游戏');
      this.emitToAll('playerDisconnected', { player: player.getUsername() });
    }
  };

  // 开始玩家行动计时
  this.startActionTimer = (player) => {
    // 清除之前的计时器
    this.clearActionTimer(player);

    // 设置新的计时器
    const timer = setTimeout(() => {
      if (player.getStatus() === 'Their Turn') {
        // 发送关闭加注窗口的信号
        player.emit('closeRaiseWindow', {});
        // 等待100ms确保窗口关闭后再执行弃牌
        setTimeout(() => {
          this.log(`${player.getUsername()} 30秒未行动，自动弃牌`);
          this.fold(player.socket);
        }, 100);
      }
    }, 30000); // 30秒超时

    this.actionTimers.set(player.getUsername(), timer);
  }

  // 清除玩家行动计时器
  this.clearActionTimer = (player) => {
    const timer = this.actionTimers.get(player.getUsername());
    if (timer) {
      clearTimeout(timer);
      this.actionTimers.delete(player.getUsername());
    }
  }

  // 清除所有行动计时器
  this.clearAllActionTimers = () => {
    for (const timer of this.actionTimers.values()) {
      clearTimeout(timer);
    }
    this.actionTimers.clear();
  }
};

module.exports = Game;
