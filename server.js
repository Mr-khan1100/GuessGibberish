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
  { g: 'clue tin furry',                   a: 'Gluten free' },
  { g: 'hints toe cram starry',            a: 'Instagram story' },
  { g: 'lis sin sand dedges tray shun',    a: 'Licence and registration' },
  { g: 'boe day tote ships',               a: 'Potato chips' },
  { g: 'high dance eek',                   a: 'Hide and seek' },
  { g: 'jock lit prow knees',              a: 'Chocolate brownies' },
  { g: 'phase poke off his shoal',         a: 'Facebook official' },
  { g: 'han dover theme honey',            a: 'Hand over the money' },
  { g: 'pie rate softy care hip been',     a: 'Pirates of the Caribbean' },
  { g: 'police dew nod hutch',             a: 'Please do not touch' },
  { g: "I'm issues home hutch",            a: 'I miss you so much' },
  { g: 'tree chores hail fright',          a: 'Treat yourself right' },
  { g: 'high wheel hall weighs loaf view', a: 'I will always love you' },
  { g: 'highs creek own',                  a: 'Ice cream cone' },
  { g: 'sock her go all key per',          a: 'Soccer goalkeeper' },
  { g: 'Bull lag fried hay',               a: 'Black Friday' },
  { g: 'mere ors elf free',                a: 'Mirror selfie' },
  { g: 'door her text pull horror',        a: 'Dora the Explorer' },
  { g: 'ehm ine hm',                       a: 'Eminem' },
  { g: 'bep her own knee peas uh',         a: 'Pepperoni pizza' },
  { g: 'shelf dry fink curse',             a: 'Self driving car' },
  { g: 'knit flick sand shill',            a: 'Netflix and chill' },
  { g: 'croupe miss itch',                 a: 'Group message' },
  { g: 'Faye Stew Phase',                  a: 'Face to face' },
  { g: "Meek Came How's",                  a: 'Mickey Mouse' },
  { g: 'Sand Tackle Laws',                 a: 'Santa Claus' },
  { g: 'Ewe Night Ted King Dumb',          a: 'United Kingdom' },
  { g: 'Tay Cove Ache A shun',             a: 'Take a vacation' },
  { g: 'She is burg her',                  a: 'Cheeseburger' },
  { g: "mack her owe knee inch he's",      a: 'Macaroni and cheese' },
  { g: 'is bunch pops queer pans',         a: 'SpongeBob SquarePants' },
  { g: 'tan cue ex',                       a: 'Thank you next' },
  { g: 'sore hay nods ore hee',            a: 'Sorry not sorry' },
  { g: 'thief hearse touch an you weary',  a: 'The first of January' },
  { g: 'own late aches ai men hit',        a: 'Only takes a minute' },
  { g: 'wad kin eyed who fur uwu',         a: 'What can I do for you' },
];

const rooms = new Map();

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
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
  });
  startTimer(room);
}

function startTimer(room) {
  clearInterval(room.timer);
  room.timeLeft = 30;
  broadcast(room, { type: 'timer_tick', timeLeft: 30 });
  room.timer = setInterval(() => {
    room.timeLeft--;
    broadcast(room, { type: 'timer_tick', timeLeft: room.timeLeft });
    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      revealCard(room);
    }
  }, 1000);
}

function revealCard(room) {
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
        room = { code: newCode, phase: 'lobby', players: [], fullDeck: shuffle(ALL_CARDS), deck: [], deckSize: 0, cardIdx: 0, chats: [], timer: null, timeLeft: 15, roundNum: 1 };
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
      room.deck     = room.fullDeck.splice(0, Math.min(15, room.fullDeck.length));
      room.deckSize = room.deck.length;
      room.cardIdx  = 0;
      broadcast(room, { type: 'game_started', roundNum: room.roundNum });
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
      broadcast(room, { type: 'game_started', roundNum: room.roundNum });
      loadCard(room);
    }

    else if (msg.type === 'restart') {
      if (!self.isHost) return;
      clearInterval(room.timer);
      room.fullDeck = shuffle(ALL_CARDS);
      room.deck     = [];
      room.chats    = [];
      room.roundNum = 1;
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
    broadcast(room, { type: 'player_update', players: playerList(room) });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Guess the Gibberish → http://localhost:${PORT}`));
