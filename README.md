# Guess the Gibberish 🤪

A real-time multiplayer party game where players decode phonetic nonsense phrases and race to type the correct answer before the timer runs out.

## How to Play

1. One player creates a room and shares the 4-letter room code with friends
2. Up to 15 players join the same room
3. Each round plays through 15 cards. Each card shows a gibberish phrase — sound it out!
4. **Type your answer** in the chat box. Your answer is hidden from other players until the timer ends
5. When the 15-second timer runs out, the card automatically flips to reveal the answer, and everyone's answers are shown simultaneously
6. **You cannot type after the timer ends**
7. Scoring: first correct answer = **2 points**, all other correct answers = **1 point**
8. After 3 rounds (36 cards total), the player with the most points wins

## Example

> **Gibberish:** `hints toe cram starry`
>
> **Answer:** Instagram story

## Setup

### Requirements

- Node.js 18 or later

### Install & Run

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

For development with auto-reload:

```bash
npm run dev
```

### Multiplayer

All players open the same URL. The player who creates the room shares the 4-letter code. Everyone joins before the host clicks **Start Game**.

To host publicly, deploy to any Node.js host (Railway, Render, Fly.io) or run behind a reverse proxy (nginx, Caddy). The server uses a single HTTP + WebSocket port.

## Tech Stack

- **Server:** Node.js, Express, `ws` (WebSocket)
- **Client:** Vanilla HTML/CSS/JavaScript — no framework, no build step
- **State:** In-memory (rooms reset on server restart)

## Game Rules Summary

| Event | Points |
|---|---|
| First player with correct answer | 2 pts |
| Other players with correct answer | 1 pt |
| Incorrect or no answer | 0 pts |

- Answers are auto-scored by normalized text match (case-insensitive, punctuation-ignored)
- One answer per player per card
- Typing is disabled once the timer reaches zero
- The host controls "Next Card" and "Next Round" progression
