# Guess the Gibberish 🤪

A real-time multiplayer party game where players decode phonetic nonsense phrases and race to type the correct answer before the timer runs out.

## How to Play

1. One player creates a room and shares the 4-letter room code with friends
2. Up to 15 players join the same room
3. The host chooses a difficulty before starting. Easy is selected by default
4. Each round plays through up to 15 cards. Each card shows a gibberish phrase - sound it out!
5. **Type your answer** in the chat box. Your answer is hidden from other players until the timer ends
6. When the 30-second timer runs out, or when every player has submitted, the card automatically flips to reveal the answer, and everyone's answers are shown simultaneously
7. **You cannot type after the timer ends**
8. Scoring: first correct answer = **2 points**, all other correct answers = **1 point**
9. The player with the most points wins

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
- Cards reveal early when every player has submitted
- The host controls "Next Card" and "Next Round" progression
