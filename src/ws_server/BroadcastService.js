export class BroadcastService {
    constructor(playerManager, roomManager) {
        this.playerManager = playerManager;
        this.roomManager = roomManager;
    }

    broadcastUpdateRoom() {
        const roomsData = this.roomManager.getRoomsData(this.playerManager);

        const message = {
            type: 'update_room',
            data: roomsData,
            id: 0
        };

        this.broadcast(message);
    }

    broadcastUpdateWinners() {
        const winnersData = this.playerManager.getWinnersData();

        const message = {
            type: 'update_winners',
            data: winnersData,
            id: 0
        };

        this.broadcast(message);
    }

    broadcast(message) {
        this.playerManager.getAllPlayers().forEach(player => {
            if (player.ws && player.ws.readyState === 1) {
                this.sendMessage(player.ws, message);
            }
        });
    }

    sendMessage(ws, message) {
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify(message));
        }
    }

    sendToPlayers(playerIds, message) {
        playerIds.forEach(pId => {
            const player = this.playerManager.getPlayerById(pId);
            if (player && player.ws) {
                this.sendMessage(player.ws, message);
            }
        });
    }
}

