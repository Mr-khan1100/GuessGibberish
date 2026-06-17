'use strict';
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const path   = require('path');
const http   = require('http');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

const ALL_CARDS = [
  { g: 'clue tin furry',                   a: 'Gluten free',              difficulty: 'easy' },
  { g: 'hints toe cram starry',            a: 'Instagram story',          difficulty: 'easy' },
  { g: 'boe day tote ships',               a: 'Potato chips',             difficulty: 'easy' },
  { g: 'high dance eek',                   a: 'Hide and seek',            difficulty: 'easy' },
  { g: 'highs creek own',                  a: 'Ice cream cone',           difficulty: 'easy' },
  { g: 'Bull lag fried hay',               a: 'Black Friday',             difficulty: 'easy' },
  { g: 'ehm ine hm',                       a: 'Eminem',                   difficulty: 'easy' },
  { g: 'Faye Stew Phase',                  a: 'Face to face',             difficulty: 'easy' },
  { g: "Meek Came How's",                  a: 'Mickey Mouse',             difficulty: 'easy' },
  { g: 'Sand Tackle Laws',                 a: 'Santa Claus',              difficulty: 'easy' },
  { g: 'She is burg her',                  a: 'Cheeseburger',             difficulty: 'easy' },
  { g: 'tan cue ex',                       a: 'Thank you next',           difficulty: 'easy' },

  { g: 'lis sin sand dedges tray shun',    a: 'Licence and registration', difficulty: 'medium' },
  { g: 'jock lit prow knees',              a: 'Chocolate brownies',       difficulty: 'medium' },
  { g: 'phase poke off his shoal',         a: 'Facebook official',        difficulty: 'medium' },
  { g: 'police dew nod hutch',             a: 'Please do not touch',      difficulty: 'medium' },
  { g: "I'm issues home hutch",            a: 'I miss you so much',       difficulty: 'medium' },
  { g: 'tree chores hail fright',          a: 'Treat yourself right',     difficulty: 'medium' },
  { g: 'sock her go all key per',          a: 'Soccer goalkeeper',        difficulty: 'medium' },
  { g: 'mere ors elf free',                a: 'Mirror selfie',            difficulty: 'medium' },
  { g: 'door her text pull horror',        a: 'Dora the Explorer',        difficulty: 'medium' },
  { g: 'bep her own knee peas uh',         a: 'Pepperoni pizza',          difficulty: 'medium' },
  { g: 'croupe miss itch',                 a: 'Group message',            difficulty: 'medium' },
  { g: 'Ewe Night Ted King Dumb',          a: 'United Kingdom',           difficulty: 'medium' },

  { g: 'han dover theme honey',            a: 'Hand over the money',      difficulty: 'hard' },
  { g: 'pie rate softy care hip been',     a: 'Pirates of the Caribbean', difficulty: 'hard' },
  { g: 'high wheel hall weighs loaf view', a: 'I will always love you',   difficulty: 'hard' },
  { g: 'shelf dry fink curse',             a: 'Self driving car',         difficulty: 'hard' },
  { g: 'knit flick sand shill',            a: 'Netflix and chill',        difficulty: 'hard' },
  { g: 'Tay Cove Ache A shun',             a: 'Take a vacation',          difficulty: 'hard' },
  { g: "mack her owe knee inch he's",      a: 'Macaroni and cheese',      difficulty: 'hard' },
  { g: 'is bunch pops queer pans',         a: 'SpongeBob SquarePants',    difficulty: 'hard' },
  { g: 'sore hay nods ore hee',            a: 'Sorry not sorry',          difficulty: 'hard' },
  { g: 'thief hearse touch an you weary',  a: 'The first of January',     difficulty: 'hard' },
  { g: 'own late aches ai men hit',        a: 'Only takes a minute',      difficulty: 'hard' },
  { g: 'wad kin eyed who fur uwu',         a: 'What can I do for you',    difficulty: 'hard' },
];

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'mixed']);

const rooms = new Map();

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeDifficulty(value) {
  const difficulty = String(value || 'easy').trim().toLowerCase();
  return VALID_DIFFICULTIES.has(difficulty) ? difficulty : 'easy';
}

function cardsForDifficulty(difficulty) {
  if (difficulty === 'mixed') return ALL_CARDS;
  return ALL_CARDS.filter(card => card.difficulty === difficulty);
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  room.players.forEach(p => { if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data); });
}

function playerList(room) {
  return room.players.map(p => ({ name: p.name, score: p.score, isHost: p.isHost }));
}

function loadCard(room) {
  room.chats  = [];
  room.phase  = 'playing';
  const card  = room.deck[room.cardIdx];
  broadcast(room, {
    type:      'card',
    index:     room.cardIdx,
    total:     room.deckSize,
    gibberish: card.g,
    difficulty: card.difficulty,
  });
  startTimer(room);
}

function startTimer(room) {
  clearInterval(room.timer);
  room.timeLeft = 30;
  broadcast(room, { type: 'timer_tick', timeLeft: 30 });
  room.timer = setInterval(() => {
    room.timeLeft--;
    if (room.timeLeft <= 0) {
      finishCard(room, 'time');
      return;
    }
    broadcast(room, { type: 'timer_tick', timeLeft: room.timeLeft });
  }, 1000);
}

function finishCard(room, reason) {
  if (room.phase !== 'playing') return;
  clearInterval(room.timer);
  room.timeLeft = 0;
  broadcast(room, { type: 'timer_tick', timeLeft: 0, reason });
  revealCard(room);
}

function revealCard(room) {
  if (room.phase !== 'playing') return;
  room.phase = 'reveal';
  const card    = room.deck[room.cardIdx];
  const ansNorm = normalize(card.a);
  let firstCorrect = true;

  const answered = [...room.chats].sort((a, b) => a.time - b.time).map(msg => {
    const correct = normalize(msg.text) === ansNorm;
    let pts = 0;
    if (correct) {
      pts = firstCorrect ? 2 : 1;
      firstCorrect = false;
      const p = room.players.find(pl => pl.name === msg.name);
      if (p) p.score += pts;
    }
    return { name: msg.name, text: msg.text, correct, pts };
  });

  const answeredNames = new Set(room.chats.map(c => c.name));
  room.players.forEach(p => {
    if (!answeredNames.has(p.name)) answered.push({ name: p.name, text: null, correct: false, pts: 0 });
  });

  broadcast(room, { type: 'reveal', answer: card.a, results: answered, scores: playerList(room) });
}

wss.on('connection', ws => {
  let room = null, pname = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      const name = String(msg.name || '').trim().slice(0, 20);
      const code = String(msg.roomCode || '').trim().toUpperCase().slice(0, 4);
      if (!name) { send(ws, { type: 'error', message: 'Name is required' }); return; }

      if (code && rooms.has(code)) {
        room = rooms.get(code);
        if (room.phase !== 'lobby')                          { send(ws, { type: 'error', message: 'Game already in progress' }); return; }
        if (room.players.length >= 15)                       { send(ws, { type: 'error', message: 'Room is full (15 players max)' }); return; }
        if (room.players.find(p => p.name === name))         { send(ws, { type: 'error', message: 'Name already taken in this room' }); return; }
      } else if (code) {
        send(ws, { type: 'error', message: 'Room not found — check the code or leave blank to create a new room' });
        return;
      } else {
        const newCode = genCode();
        room = { code: newCode, phase: 'lobby', players: [], fullDeck: [], deck: [], deckSize: 0, cardIdx: 0, chats: [], timer: null, timeLeft: 30, roundNum: 1, difficulty: 'easy' };
        rooms.set(newCode, room);
      }

      const isHost = room.players.length === 0;
      room.players.push({ ws, name, score: 0, isHost });
      pname = name;

      send(ws, { type: 'joined', roomCode: room.code, isHost, players: playerList(room) });
      broadcast(room, { type: 'player_update', players: playerList(room) });
      return;
    }

    if (!room || !pname) return;
    const self = room.players.find(p => p.name === pname);
    if (!self) return;

    if (msg.type === 'start') {
      if (!self.isHost || room.phase !== 'lobby') return;
      if (room.players.length < 2) { send(ws, { type: 'error', message: 'Need at least 2 players to start' }); return; }
      room.difficulty = normalizeDifficulty(msg.difficulty);
      room.fullDeck = shuffle(cardsForDifficulty(room.difficulty));
      room.deck     = room.fullDeck.splice(0, Math.min(15, room.fullDeck.length));
      room.deckSize = room.deck.length;
      room.cardIdx  = 0;
      broadcast(room, { type: 'game_started', roundNum: room.roundNum, difficulty: room.difficulty });
      loadCard(room);
    }

    else if (msg.type === 'chat') {
      if (room.phase !== 'playing') return;
      if (room.chats.find(c => c.name === pname)) return;
      const text = String(msg.text || '').trim().slice(0, 120);
      if (!text) return;
      room.chats.push({ name: pname, text, time: Date.now() });
      send(ws, { type: 'answer_ack', text });
      broadcast(room, { type: 'answer_count', count: room.chats.length, total: room.players.length });
      if (room.chats.length >= room.players.length) finishCard(room, 'all_answered');
    }

    else if (msg.type === 'next_card') {
      if (!self.isHost || room.phase !== 'reveal') return;
      room.cardIdx++;
      if (room.cardIdx >= room.deckSize) {
        const hasMore = room.fullDeck.length > 0;
        room.phase = hasMore ? 'roundend' : 'gameover';
        broadcast(room, {
          type:         room.phase === 'roundend' ? 'round_end' : 'game_over',
          scores:       playerList(room),
          roundNum:     room.roundNum,
          hasNextRound: hasMore,
        });
      } else {
        loadCard(room);
      }
    }

    else if (msg.type === 'next_round') {
      if (!self.isHost || room.phase !== 'roundend') return;
      room.roundNum++;
      room.deck     = room.fullDeck.splice(0, Math.min(15, room.fullDeck.length));
      room.deckSize = room.deck.length;
      room.cardIdx  = 0;
      broadcast(room, { type: 'game_started', roundNum: room.roundNum, difficulty: room.difficulty });
      loadCard(room);
    }

    else if (msg.type === 'restart') {
      if (!self.isHost) return;
      clearInterval(room.timer);
      room.fullDeck = [];
      room.deck     = [];
      room.chats    = [];
      room.roundNum = 1;
      room.difficulty = 'easy';
      room.phase    = 'lobby';
      room.players.forEach(p => p.score = 0);
      broadcast(room, { type: 'restarted', players: playerList(room) });
    }
  });

  ws.on('close', () => {
    if (!room) return;
    room.players = room.players.filter(p => p.name !== pname);
    if (room.players.length === 0) { clearInterval(room.timer); rooms.delete(room.code); return; }
    if (!room.players.find(p => p.isHost)) {
      room.players[0].isHost = true;
      send(room.players[0].ws, { type: 'host_transferred' });
    }
    if (room.phase === 'playing' && room.chats.length >= room.players.length) finishCard(room, 'all_answered');
    broadcast(room, { type: 'player_update', players: playerList(room) });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Guess the Gibberish → http://localhost:${PORT}`));
