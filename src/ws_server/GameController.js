import { Game } from './Game.js';

export class GameController {
    constructor() {
        this.games = new Map(); // Map<gameId, Game>
        this.nextGameId = 1;
    }

    createGame(player1Id, player2Id) {
        const gameId = String(this.nextGameId++);
        const game = new Game(gameId, player1Id, player2Id);
        this.games.set(gameId, game);
        return game;
    }

    getGame(gameId) {
        return this.games.get(String(gameId));
    }

    deleteGame(gameId) {
        this.games.delete(String(gameId));
    }

    addShipsToGame(gameId, playerId, ships) {
        const game = this.getGame(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }

        game.addShips(playerId, ships);
        return { success: true, ready: game.bothPlayersReady(), game };
    }

    processAttack(gameId, attackerId, x, y) {
        const game = this.getGame(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }

        const result = game.attack(attackerId, x, y);

        if (result.status === 'error') {
            return { success: false, error: result.error };
        }

        return {
            success: true,
            result,
            finished: game.isFinished(),
            winner: game.isFinished() ? game.getWinner() : null,
            game
        };
    }

    processRandomAttack(gameId, attackerId) {
        const game = this.getGame(gameId);
        if (!game) {
            return { success: false, error: 'Game not found' };
        }

        const { x, y } = game.getRandomAttackCoordinates(attackerId);
        return { success: true, x, y };
    }
}

