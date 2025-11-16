export class PlayerManager {
    constructor() {
        this.players = new Map(); // Map<playerId, {name, password, ws, wins}>
        this.wsToPlayer = new Map(); // Map<ws, playerId>
        this.nextPlayerId = 1;
    }

    registerPlayer(ws, name, password) {
        // Check if player exists
        let player = Array.from(this.players.values()).find(
            p => p.name === name && p.password === password
        );

        if (player) {
            // Login existing player - update websocket connection
            player.ws = ws;
            this.wsToPlayer.set(ws, player.index);
            return { player, isNew: false };
        }

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

        return { player, isNew: true };
    }

    getPlayerById(playerId) {
        return this.players.get(playerId);
    }

    getPlayerByWs(ws) {
        const playerId = this.wsToPlayer.get(ws);
        return playerId ? this.players.get(playerId) : null;
    }

    getPlayerIdByWs(ws) {
        return this.wsToPlayer.get(ws);
    }

    incrementWins(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.wins++;
        }
    }

    getAllPlayers() {
        return Array.from(this.players.values());
    }

    getWinnersData() {
        return this.getAllPlayers()
            .map(player => ({
                name: player.name,
                wins: player.wins
            }))
            .sort((a, b) => b.wins - a.wins);
    }

    handleDisconnect(ws) {
        const playerId = this.wsToPlayer.get(ws);
        if (playerId) {
            this.wsToPlayer.delete(ws);
            // Keep player data in memory for reconnection
        }
        return playerId;
    }
}

