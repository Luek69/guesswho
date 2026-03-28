# Clash Guess Arena

A lightweight multiplayer website inspired by Guess Who, using Clash Royale-style character cards and private real-time boards.

## What it does

- Creates a shareable room link for a 2-player session
- Gives both players the same randomized board of 24 characters
- Lets each player secretly lock in one character
- Lets each player click cards to flip them down and back up like the physical tabletop game
- Supports quick board resets for a rematch

## Run locally

1. Install [Node.js](https://nodejs.org/) 18 or newer.
2. Open this folder in a terminal.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Project structure

- `server.js`: Express + Socket.IO room and game-state server
- `public/index.html`: Main page markup
- `public/styles.css`: Clash-inspired visual design and responsive layout
- `public/app.js`: Client-side room flow, board interactions, and live updates

## Notes

- Room state is stored in memory, so restarting the server clears active rooms.
- Each player's flipped cards are private to their own socket session.
- Character art is represented with stylized text cards so the project works without external image assets.
