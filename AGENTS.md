# Guess the Gibberish — Project Context

Real-time multiplayer party game. Players join a shared room, see a phonetic nonsense phrase, and secretly type their answer in a chat box. Answers are hidden until the server-side timer expires, then auto-revealed simultaneously with the card flipping to show the correct answer.

## Architecture

```
guessGibberish/
├── server.js          # Node.js + WebSocket game server
├── package.json
└── public/
    └── index.html     # Single-file client (HTML + CSS + JS, no build step)
```

The server handles all game state. The client is a dumb display terminal that sends actions and renders server events.

## Server (`server.js`)

- **Express** serves `public/` as static files
- **`ws`** WebSocket server shares the same HTTP port
- **In-memory rooms** — `Map<roomCode, room>` — lost on restart
- Room codes are 4 random uppercase alphanumeric chars (no ambiguous chars like 0/O)
- Timer runs server-side with `setInterval` at 1-second ticks
- On timer end: server auto-scores and broadcasts `reveal` to all clients

### Room Object

```js
{
  code: string,
  phase: 'lobby' | 'playing' | 'reveal' | 'roundend' | 'gameover',
  players: [{ ws, name, score, isHost }],
  fullDeck: Card[],   // remaining unplayed cards across all rounds
  deck: Card[],       // current round's 15 cards
  deckSize: number,
  cardIdx: number,
  chats: [{ name, text, time }],
  timer: NodeJS timer,
  timeLeft: number,
  roundNum: number,
}
```

### Scoring Logic

Answers are normalized (`lowercase`, punctuation stripped, whitespace collapsed) before comparison. First correct answer in submission-time order scores **2 pts**; subsequent correct answers score **1 pt**. Scoring happens server-side in `revealCard()`.

## WebSocket Message Protocol

### Client → Server

| `type` | Payload | Notes |
|---|---|---|
| `join` | `{ name, roomCode }` | `roomCode` blank = create new room |
| `start` | — | Host only; phase must be `lobby` |
| `chat` | `{ text }` | Phase must be `playing`; one per player per card |
| `next_card` | — | Host only; phase must be `reveal` |
| `next_round` | — | Host only; phase must be `roundend` |
| `restart` | — | Host only; resets scores + deck, returns to lobby |

### Server → Client

| `type` | Key Payload Fields | Notes |
|---|---|---|
| `joined` | `{ roomCode, isHost, players }` | Sent only to joining player |
| `player_update` | `{ players }` | Broadcast on join/leave |
| `error` | `{ message }` | Sent only to relevant player |
| `game_started` | `{ roundNum }` | Broadcast |
| `card` | `{ index, total, gibberish }` | Broadcast; client resets UI |
| `timer_tick` | `{ timeLeft }` | Broadcast every second |
| `answer_ack` | `{ text }` | Sent only to submitting player |
| `answer_count` | `{ count, total }` | Broadcast (count of submitted, no content) |
| `reveal` | `{ answer, results, scores }` | Broadcast; triggers auto-flip |
| `round_end` | `{ scores, roundNum, hasNextRound }` | Broadcast |
| `game_over` | `{ scores, roundNum }` | Broadcast |
| `host_transferred` | — | Sent only to new host |
| `restarted` | `{ players }` | Broadcast; client goes to waiting room |

## Client (`public/index.html`)

Single file, no build step. Screens:
- `s-join` — name + room code form
- `s-waiting` — lobby with room code display and player list
- `s-game` — main game (handles both `playing` and `reveal` phases)
- `s-roundend` — round standings
- `s-gameover` — final standings + confetti

### Key Client Behaviors

- Chat input disabled immediately after submit (`answer_ack`) or when `timer_tick` reaches 0
- `reveal` event triggers CSS card flip (`.flipped` class), hides chat panel, shows answer reveal list
- Only the host sees "Next Card", "Next Round", "Play Again" buttons — non-hosts see "Waiting for host..."
- `host_transferred` message updates `isHost` flag and re-renders controls inline without screen change
- HTML is escaped via `escHtml()` before all DOM insertion to prevent XSS

## Card Data

36 cards total in `ALL_CARDS`. Each round uses `Math.min(15, remaining)` cards from a shuffled deck. Cards are consumed from `fullDeck`; when empty, game ends. A `restart` reshuffles all 36.

## Running Locally

```bash
npm install
npm start        # http://localhost:3000
npm run dev      # with nodemon auto-reload
```

## Known Limitations / Future Work

- No persistence — rooms vanish on server restart
- No reconnect — refreshing the page drops the player from the room
- Host disconnect during active game may leave other players stuck if the new host doesn't know to proceed
- Scoring is exact-match only (after normalization); no fuzzy matching
