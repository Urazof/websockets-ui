export class GameManager {
    constructor() {
        this.players = new Map(); // Map<playerId, {name, password, ws, wins}>
        this.rooms = new Map(); // Map<roomId, {roomId, players: [], gameId}>
        this.games = new Map(); // Map<gameId, Game>
        this.wsToPlayer = new Map(); // Map<ws, playerId>
        this.nextPlayerId = 1;
        this.nextRoomId = 1;
        this.nextGameId = 1;
    }

    handleMessage(ws, request) {
        const { type, data, id } = request;

        switch (type) {
            case 'reg':
                this.handleRegistration(ws, data, id);
                break;
            case 'create_room':
                this.handleCreateRoom(ws, data, id);
                break;
            case 'add_user_to_room':
                this.handleAddUserToRoom(ws, data, id);
                break;
            case 'add_ships':
                this.handleAddShips(ws, data, id);
                break;
            case 'attack':
                this.handleAttack(ws, data, id);
                break;
            case 'randomAttack':
                this.handleRandomAttack(ws, data, id);
                break;
            default:
                console.log('Unknown command type:', type);
        }
    }

    handleRegistration(ws, data, id) {
        const { name, password } = data;

        // Check if player exists
        let player = Array.from(this.players.values()).find(
            p => p.name === name && p.password === password
        );

        if (player) {
            // Login existing player
            player.ws = ws;
            this.wsToPlayer.set(ws, player.index);
        } else {
            // Create new player
            const playerId = String(this.nextPlayerId++);
            player = {
                name,
                password,
                index: playerId,
                ws,
                wins: 0
            };
            this.players.set(playerId, player);
            this.wsToPlayer.set(ws, playerId);
        }

        // Send registration response
        this.sendMessage(ws, {
            type: 'reg',
            data: {
                name: player.name,
                index: player.index,
                error: false,
                errorText: ''
            },
            id: 0
        });

        console.log(`Result: Player ${name} registered/logged in with ID ${player.index}`);

        // Send current room state
        this.broadcastUpdateRoom();

        // Send winners table
        this.broadcastUpdateWinners();
    }

    handleCreateRoom(ws, data, id) {
        const playerId = this.wsToPlayer.get(ws);
        if (!playerId) return;

        const roomId = String(this.nextRoomId++);
        const room = {
            roomId,
            players: [playerId]
        };

        this.rooms.set(roomId, room);

        console.log(`Result: Room ${roomId} created by player ${playerId}`);

        this.broadcastUpdateRoom();
    }

    handleAddUserToRoom(ws, data, id) {
        const playerId = this.wsToPlayer.get(ws);
        if (!playerId) return;

        const { indexRoom } = data;
        const room = this.rooms.get(String(indexRoom));

        if (!room || room.players.length >= 2) {
            console.log(`Result: Room ${indexRoom} not found or full`);
            return;
        }

        room.players.push(playerId);

        console.log(`Result: Player ${playerId} joined room ${indexRoom}`);

        // Create game for both players
        const gameId = String(this.nextGameId++);
        room.gameId = gameId;

        const game = new Game(gameId, room.players[0], room.players[1]);
        this.games.set(gameId, game);

        // Send create_game to both players
        room.players.forEach((pId, index) => {
            const player = this.players.get(pId);
            if (player && player.ws) {
                this.sendMessage(player.ws, {
                    type: 'create_game',
                    data: {
                        idGame: gameId,
                        idPlayer: pId
                    },
                    id: 0
                });
            }
        });

        console.log(`Result: Game ${gameId} created for players ${room.players.join(', ')}`);

        this.broadcastUpdateRoom();
    }

    handleAddShips(ws, data, id) {
        const { gameId, ships, indexPlayer } = data;
        const game = this.games.get(String(gameId));

        if (!game) {
            console.log(`Result: Game ${gameId} not found`);
            return;
        }

        game.addShips(indexPlayer, ships);

        console.log(`Result: Ships added for player ${indexPlayer} in game ${gameId}`);

        // If both players have added ships, start the game
        if (game.bothPlayersReady()) {
            game.players.forEach(pId => {
                const player = this.players.get(pId);
                if (player && player.ws) {
                    this.sendMessage(player.ws, {
                        type: 'start_game',
                        data: {
                            ships: game.getPlayerShips(pId),
                            currentPlayerIndex: pId
                        },
                        id: 0
                    });
                }
            });

            console.log(`Result: Game ${gameId} started`);

            // Send turn notification
            this.sendTurn(game);
        }
    }

    handleAttack(ws, data, id) {
        const { gameId, x, y, indexPlayer } = data;
        const game = this.games.get(String(gameId));

        if (!game) {
            console.log(`Result: Game ${gameId} not found`);
            return;
        }

        const result = game.attack(indexPlayer, x, y);

        console.log(`Result: Attack at (${x}, ${y}) by player ${indexPlayer}: ${result.status}`);

        // Send attack results to both players
        result.attacks.forEach(attackData => {
            game.players.forEach(pId => {
                const player = this.players.get(pId);
                if (player && player.ws) {
                    this.sendMessage(player.ws, {
                        type: 'attack',
                        data: attackData,
                        id: 0
                    });
                }
            });
        });

        // Check if game is finished
        if (game.isFinished()) {
            const winner = game.getWinner();
            game.players.forEach(pId => {
                const player = this.players.get(pId);
                if (player && player.ws) {
                    this.sendMessage(player.ws, {
                        type: 'finish',
                        data: {
                            winPlayer: winner
                        },
                        id: 0
                    });
                }
            });

            console.log(`Result: Game ${gameId} finished, winner: ${winner}`);

            // Update winner stats
            const winnerPlayer = this.players.get(winner);
            if (winnerPlayer) {
                winnerPlayer.wins++;
            }

            // Clean up
            this.games.delete(gameId);
            const room = Array.from(this.rooms.values()).find(r => r.gameId === gameId);
            if (room) {
                this.rooms.delete(room.roomId);
            }

            this.broadcastUpdateWinners();
            this.broadcastUpdateRoom();
        } else if (result.status === 'miss') {
            // Turn already switched in attack method
            this.sendTurn(game);
        } else if (result.status === 'shot' || result.status === 'killed') {
            // Player gets another turn, send turn notification
            this.sendTurn(game);
        }
    }

    handleRandomAttack(ws, data, id) {
        const { gameId, indexPlayer } = data;
        const game = this.games.get(String(gameId));

        if (!game) {
            console.log(`Result: Game ${gameId} not found`);
            return;
        }

        const { x, y } = game.getRandomAttackCoordinates(indexPlayer);

        console.log(`Result: Random attack coordinates (${x}, ${y}) for player ${indexPlayer}`);

        // Process as regular attack
        this.handleAttack(ws, { gameId, x, y, indexPlayer }, id);
    }

    sendTurn(game) {
        game.players.forEach(pId => {
            const player = this.players.get(pId);
            if (player && player.ws) {
                this.sendMessage(player.ws, {
                    type: 'turn',
                    data: {
                        currentPlayer: game.currentPlayer
                    },
                    id: 0
                });
            }
        });
    }

    broadcastUpdateRoom() {
        const roomsData = Array.from(this.rooms.values())
            .filter(room => room.players.length === 1)
            .map(room => ({
                roomId: room.roomId,
                roomUsers: room.players.map(pId => {
                    const player = this.players.get(pId);
                    return {
                        name: player.name,
                        index: player.index
                    };
                })
            }));

        const message = {
            type: 'update_room',
            data: roomsData,
            id: 0
        };

        this.broadcast(message);
    }

    broadcastUpdateWinners() {
        const winnersData = Array.from(this.players.values())
            .map(player => ({
                name: player.name,
                wins: player.wins
            }))
            .sort((a, b) => b.wins - a.wins);

        const message = {
            type: 'update_winners',
            data: winnersData,
            id: 0
        };

        this.broadcast(message);
    }

    broadcast(message) {
        this.players.forEach(player => {
            if (player.ws && player.ws.readyState === 1) {
                this.sendMessage(player.ws, message);
            }
        });
    }

    sendMessage(ws, message) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(message));
        }
    }

    handleDisconnect(ws) {
        const playerId = this.wsToPlayer.get(ws);
        if (playerId) {
            this.wsToPlayer.delete(ws);
            // Note: We keep player data in memory for reconnection
        }
    }
}

class Game {
    constructor(gameId, player1Id, player2Id) {
        this.gameId = gameId;
        this.players = [player1Id, player2Id];
        this.ships = new Map(); // Map<playerId, ships[]>
        this.boards = new Map(); // Map<playerId, Set<"x,y">> - hit cells
        this.currentPlayer = player1Id;
        this.shipsHealth = new Map(); // Map<playerId, Map<shipIndex, health>>
    }

    addShips(playerId, ships) {
        this.ships.set(playerId, ships);

        // Initialize ship health
        const healthMap = new Map();
        ships.forEach((ship, index) => {
            healthMap.set(index, ship.length);
        });
        this.shipsHealth.set(playerId, healthMap);

        this.boards.set(playerId, new Set());
    }

    bothPlayersReady() {
        return this.ships.size === 2;
    }

    getPlayerShips(playerId) {
        return this.ships.get(playerId) || [];
    }

    attack(attackerId, x, y) {
        const defenderId = this.players.find(p => p !== attackerId);
        const defenderShips = this.ships.get(defenderId);
        const hitCells = this.boards.get(defenderId);

        const cellKey = `${x},${y}`;

        // Check if already attacked
        if (hitCells.has(cellKey)) {
            return {
                status: 'miss',
                attacks: [{
                    position: { x, y },
                    currentPlayer: attackerId,
                    status: 'miss'
                }]
            };
        }

        hitCells.add(cellKey);

        // Check if hit a ship
        let hitShipIndex = -1;
        defenderShips.forEach((ship, index) => {
            const cells = this.getShipCells(ship);
            if (cells.some(cell => cell.x === x && cell.y === y)) {
                hitShipIndex = index;
            }
        });

        const attacks = [];

        if (hitShipIndex >= 0) {
            // Hit!
            const healthMap = this.shipsHealth.get(defenderId);
            const currentHealth = healthMap.get(hitShipIndex);
            healthMap.set(hitShipIndex, currentHealth - 1);

            if (currentHealth - 1 === 0) {
                // Killed!
                attacks.push({
                    position: { x, y },
                    currentPlayer: attackerId,
                    status: 'killed'
                });

                // Add misses around the killed ship
                const ship = defenderShips[hitShipIndex];
                const shipCells = this.getShipCells(ship);
                const aroundCells = this.getCellsAroundShip(shipCells);

                aroundCells.forEach(cell => {
                    const aroundKey = `${cell.x},${cell.y}`;
                    if (!hitCells.has(aroundKey)) {
                        hitCells.add(aroundKey);
                        attacks.push({
                            position: { x: cell.x, y: cell.y },
                            currentPlayer: attackerId,
                            status: 'miss'
                        });
                    }
                });

                return { status: 'killed', attacks };
            } else {
                // Shot!
                attacks.push({
                    position: { x, y },
                    currentPlayer: attackerId,
                    status: 'shot'
                });
                return { status: 'shot', attacks };
            }
        } else {
            // Miss - switch turn
            this.switchTurn();
            attacks.push({
                position: { x, y },
                currentPlayer: attackerId,
                status: 'miss'
            });
            return { status: 'miss', attacks };
        }
    }

    getShipCells(ship) {
        const cells = [];
        const { position, direction, length } = ship;

        for (let i = 0; i < length; i++) {
            if (direction) {
                // Horizontal
                cells.push({ x: position.x + i, y: position.y });
            } else {
                // Vertical
                cells.push({ x: position.x, y: position.y + i });
            }
        }

        return cells;
    }

    getCellsAroundShip(shipCells) {
        const around = new Set();

        shipCells.forEach(cell => {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const newX = cell.x + dx;
                    const newY = cell.y + dy;

                    if (newX >= 0 && newX < 10 && newY >= 0 && newY < 10) {
                        const key = `${newX},${newY}`;
                        const isShipCell = shipCells.some(sc => sc.x === newX && sc.y === newY);
                        if (!isShipCell) {
                            around.add(key);
                        }
                    }
                }
            }
        });

        return Array.from(around).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
    }

    switchTurn() {
        const currentIndex = this.players.indexOf(this.currentPlayer);
        this.currentPlayer = this.players[(currentIndex + 1) % 2];
    }

    isFinished() {
        for (const [playerId, healthMap] of this.shipsHealth.entries()) {
            const allShipsDead = Array.from(healthMap.values()).every(health => health === 0);
            if (allShipsDead) {
                return true;
            }
        }
        return false;
    }

    getWinner() {
        for (const playerId of this.players) {
            const healthMap = this.shipsHealth.get(playerId);
            const allShipsDead = Array.from(healthMap.values()).every(health => health === 0);
            if (!allShipsDead) {
                return playerId;
            }
        }
        return null;
    }

    getRandomAttackCoordinates(attackerId) {
        const defenderId = this.players.find(p => p !== attackerId);
        const hitCells = this.boards.get(defenderId);

        let x, y;
        do {
            x = Math.floor(Math.random() * 10);
            y = Math.floor(Math.random() * 10);
        } while (hitCells.has(`${x},${y}`));

        return { x, y };
    }
}

