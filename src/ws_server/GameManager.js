import { PlayerManager } from './PlayerManager.js';
import { RoomManager } from './RoomManager.js';
import { GameController } from './GameController.js';
import { BroadcastService } from './BroadcastService.js';

export class GameManager {
    constructor() {
        this.playerManager = new PlayerManager();
        this.roomManager = new RoomManager();
        this.gameController = new GameController();
        this.broadcastService = new BroadcastService(this.playerManager, this.roomManager);
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

        const { player, isNew } = this.playerManager.registerPlayer(ws, name, password);

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

        console.log(`Result: Player ${name} ${isNew ? 'registered' : 'logged in'} with ID ${player.index}`);

        // Send current room state and winners
        this.broadcastService.broadcastUpdateRoom();
        this.broadcastService.broadcastUpdateWinners();
    }

    handleCreateRoom(ws, data, id) {
        const playerId = this.playerManager.getPlayerIdByWs(ws);
        if (!playerId) {
            console.log('Result: Player not found');
            return;
        }

        const room = this.roomManager.createRoom(playerId);

        console.log(`Result: Room ${room.roomId} created by player ${playerId}`);

        this.broadcastService.broadcastUpdateRoom();
    }

    handleAddUserToRoom(ws, data, id) {
        const playerId = this.playerManager.getPlayerIdByWs(ws);
        if (!playerId) {
            console.log('Result: Player not found');
            return;
        }

        const { indexRoom } = data;
        const result = this.roomManager.addPlayerToRoom(indexRoom, playerId);

        if (!result.success) {
            console.log(`Result: ${result.error}`);
            return;
        }

        const room = result.room;

        console.log(`Result: Player ${playerId} joined room ${indexRoom}`);

        // Create game for both players
        const game = this.gameController.createGame(room.players[0], room.players[1]);
        this.roomManager.setGameIdForRoom(room.roomId, game.gameId);

        // Send create_game to both players
        room.players.forEach((pId) => {
            const player = this.playerManager.getPlayerById(pId);
            if (player && player.ws) {
                this.sendMessage(player.ws, {
                    type: 'create_game',
                    data: {
                        idGame: game.gameId,
                        idPlayer: pId
                    },
                    id: 0
                });
            }
        });

        console.log(`Result: Game ${game.gameId} created for players ${room.players.join(', ')}`);

        this.broadcastService.broadcastUpdateRoom();
    }

    handleAddShips(ws, data, id) {
        const { gameId, ships, indexPlayer } = data;

        const result = this.gameController.addShipsToGame(gameId, indexPlayer, ships);

        if (!result.success) {
            console.log(`Result: ${result.error}`);
            return;
        }

        console.log(`Result: Ships added for player ${indexPlayer} in game ${gameId}`);

        // If both players have added ships, start the game
        if (result.ready) {
            const game = result.game;

            game.getPlayers().forEach(pId => {
                const player = this.playerManager.getPlayerById(pId);
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

        const result = this.gameController.processAttack(gameId, indexPlayer, x, y);

        if (!result.success) {
            console.log(`Result: ${result.error}`);
            return;
        }

        const attackResult = result.result;
        const game = result.game;

        console.log(`Result: Attack at (${x}, ${y}) by player ${indexPlayer}: ${attackResult.status}`);

        // Send attack results to both players
        attackResult.attacks.forEach(attackData => {
            this.broadcastService.sendToPlayers(game.getPlayers(), {
                type: 'attack',
                data: attackData,
                id: 0
            });
        });

        // Check if game is finished
        if (result.finished) {
            const winner = result.winner;

            this.broadcastService.sendToPlayers(game.getPlayers(), {
                type: 'finish',
                data: {
                    winPlayer: winner
                },
                id: 0
            });

            console.log(`Result: Game ${gameId} finished, winner: ${winner}`);

            // Update winner stats
            this.playerManager.incrementWins(winner);

            // Clean up
            this.gameController.deleteGame(gameId);
            const room = this.roomManager.findRoomByGameId(gameId);
            if (room) {
                this.roomManager.deleteRoom(room.roomId);
            }

            this.broadcastService.broadcastUpdateWinners();
            this.broadcastService.broadcastUpdateRoom();
        } else if (attackResult.status === 'miss') {
            // Turn already switched in attack method
            this.sendTurn(game);
        } else if (attackResult.status === 'shot' || attackResult.status === 'killed') {
            // Player gets another turn, send turn notification
            this.sendTurn(game);
        }
    }

    handleRandomAttack(ws, data, id) {
        const { gameId, indexPlayer } = data;

        const result = this.gameController.processRandomAttack(gameId, indexPlayer);

        if (!result.success) {
            console.log(`Result: ${result.error}`);
            return;
        }

        const { x, y } = result;

        console.log(`Result: Random attack coordinates (${x}, ${y}) for player ${indexPlayer}`);

        // Process as regular attack
        this.handleAttack(ws, { gameId, x, y, indexPlayer }, id);
    }

    sendTurn(game) {
        this.broadcastService.sendToPlayers(game.getPlayers(), {
            type: 'turn',
            data: {
                currentPlayer: game.getCurrentPlayer()
            },
            id: 0
        });
    }

    sendMessage(ws, message) {
        this.broadcastService.sendMessage(ws, message);
    }

    handleDisconnect(ws) {
        const playerId = this.playerManager.handleDisconnect(ws);
        if (playerId) {
            console.log(`Result: Player ${playerId} disconnected`);
        }
    }
}
