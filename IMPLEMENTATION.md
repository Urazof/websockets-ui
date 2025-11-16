# Battleship WebSocket Backend Implementation

## Overview
This is a complete WebSocket-based battleship game backend implementation that handles multiplayer gameplay, room management, and real-time game state synchronization.

## Features Implemented

### ✅ WebSocket Server
- Server runs on port **3000**
- HTTP server runs on port **8181** (for frontend)
- Handles multiple concurrent connections
- Automatic reconnection support

### ✅ Player Management
- **Registration/Login**: Players can register or login with name and password
- **In-memory database**: Player data stored with wins tracking
- **Authentication**: Simple password-based authentication
- **Persistent statistics**: Win counts maintained across sessions

### ✅ Room Management
- **Create rooms**: Players can create game rooms
- **Join rooms**: Players can join available rooms with 1 player
- **Room listing**: Broadcasts available rooms (only rooms with 1 player)
- **Automatic game creation**: Game starts when 2 players join a room

### ✅ Ship Placement
- **Ship configuration**: Accepts ships with position, direction, length, and type
- **Validation**: Ensures both players place ships before game starts
- **Ship types supported**: small, medium, large, huge

### ✅ Game Mechanics
- **Turn-based gameplay**: Players alternate turns
- **Attack system**: Regular attacks with coordinate validation
- **Random attacks**: Computer-assisted random attack option
- **Hit detection**: Accurate ship hit detection (miss/shot/killed)
- **Kill detection**: Marks cells around killed ships as misses automatically
- **Extra turns**: Player gets another turn on hit/kill
- **Winner detection**: Automatic game end when all ships destroyed
- **Statistics update**: Winner's stats updated and broadcasted

### ✅ Response Types
All 3 response types implemented:
1. **Personal responses**: `reg`, `create_game`, `start_game`
2. **Game room responses**: `turn`, `attack`, `finish`
3. **Broadcast responses**: `update_room`, `update_winners`

## Command Reference

### Player Commands

#### Registration/Login
```json
// Request
{
  "type": "reg",
  "data": {
    "name": "PlayerName",
    "password": "password123"
  },
  "id": 0
}

// Response
{
  "type": "reg",
  "data": {
    "name": "PlayerName",
    "index": "1",
    "error": false,
    "errorText": ""
  },
  "id": 0
}
```

### Room Commands

#### Create Room
```json
// Request
{
  "type": "create_room",
  "data": "",
  "id": 0
}

// Broadcasts update_room to all players
```

#### Join Room
```json
// Request
{
  "type": "add_user_to_room",
  "data": {
    "indexRoom": "1"
  },
  "id": 0
}

// Response (to both players)
{
  "type": "create_game",
  "data": {
    "idGame": "1",
    "idPlayer": "1"
  },
  "id": 0
}
```

### Ship Commands

#### Add Ships
```json
// Request
{
  "type": "add_ships",
  "data": {
    "gameId": "1",
    "ships": [
      {
        "position": { "x": 0, "y": 0 },
        "direction": true,
        "length": 4,
        "type": "huge"
      }
    ],
    "indexPlayer": "1"
  },
  "id": 0
}

// Response (when both players ready)
{
  "type": "start_game",
  "data": {
    "ships": [...],
    "currentPlayerIndex": "1"
  },
  "id": 0
}
```

### Game Commands

#### Attack
```json
// Request
{
  "type": "attack",
  "data": {
    "gameId": "1",
    "x": 5,
    "y": 5,
    "indexPlayer": "1"
  },
  "id": 0
}

// Response
{
  "type": "attack",
  "data": {
    "position": { "x": 5, "y": 5 },
    "currentPlayer": "1",
    "status": "shot"  // or "miss" or "killed"
  },
  "id": 0
}
```

#### Random Attack
```json
// Request
{
  "type": "randomAttack",
  "data": {
    "gameId": "1",
    "indexPlayer": "1"
  },
  "id": 0
}
// Server generates random coordinates and processes as regular attack
```

### Broadcast Messages

#### Room Update
```json
{
  "type": "update_room",
  "data": [
    {
      "roomId": "1",
      "roomUsers": [
        {
          "name": "PlayerName",
          "index": "1"
        }
      ]
    }
  ],
  "id": 0
}
```

#### Winners Update
```json
{
  "type": "update_winners",
  "data": [
    {
      "name": "PlayerName",
      "wins": 5
    }
  ],
  "id": 0
}
```

#### Turn Notification
```json
{
  "type": "turn",
  "data": {
    "currentPlayer": "1"
  },
  "id": 0
}
```

#### Game Finish
```json
{
  "type": "finish",
  "data": {
    "winPlayer": "1"
  },
  "id": 0
}
```

## Starting the Server

```bash
# Production
npm start

# Development (with auto-restart)
npm run start:dev
```

## Server Output

The server logs all commands and results:
```
Start WebSocket server on the 3000 port!
Start static http server on the 8181 port!
New client connected
Received command: reg { name: 'Player1', password: 'pass123' }
Result: Player Player1 registered/logged in with ID 1
Received command: create_room
Result: Room 1 created by player 1
Received command: attack { gameId: '1', x: 5, y: 5, indexPlayer: '1' }
Result: Attack at (5, 5) by player 1: shot
```

## Game Flow

1. **Registration**: Both players register/login
2. **Room Creation**: Player 1 creates a room
3. **Room Join**: Player 2 joins the room
4. **Ship Placement**: Both players place their ships
5. **Game Start**: Server sends start_game and initial turn
6. **Combat**: Players take turns attacking
7. **Victory**: Game ends when all ships of one player are destroyed
8. **Cleanup**: Winner stats updated, room removed

## Technical Details

- **Language**: JavaScript (ES6 modules)
- **Node.js Version**: 24.x.x (tested with v22.19.0)
- **WebSocket Library**: ws v8.8.0
- **Data Storage**: In-memory (Map objects)
- **Protocol**: JSON over WebSocket

## Architecture

```
src/
├── ws_server/
│   ├── index.js          # WebSocket server initialization
│   └── GameManager.js    # Game logic and state management
├── http_server/
│   └── index.js          # Static file server
└── index.js              # Entry point
```

## Key Implementation Details

### Turn Management
- Player gets another turn on hit or kill
- Turn switches only on miss
- Turn notifications sent after every action

### Ship Kill Detection
- When a ship is killed, all surrounding cells are automatically marked as miss
- This prevents players from wasting turns on cells around destroyed ships
- Follows standard battleship rules

### Game State
- Each game maintains:
  - Ship positions for both players
  - Hit cells tracking
  - Individual ship health
  - Current turn player

### Error Handling
- Validates game existence before processing commands
- Checks for player authentication
- Prevents duplicate attacks on same cell
- Graceful handling of disconnections

## Future Enhancements (Optional)

- Single player bot AI
- Persistent database (PostgreSQL/MongoDB)
- Game replay functionality
- Spectator mode
- Tournament brackets
- Time limits per turn
- Extended ship configurations

## Testing

The frontend is available at `http://localhost:8181` and will automatically connect to the WebSocket server on port 3000.

Open the frontend in two browser windows to test multiplayer functionality.

