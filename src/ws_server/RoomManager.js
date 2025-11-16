export class RoomManager {
    constructor() {
        this.rooms = new Map(); // Map<roomId, {roomId, players: [], gameId}>
        this.nextRoomId = 1;
    }

    createRoom(playerId) {
        const roomId = String(this.nextRoomId++);
        const room = {
            roomId,
            players: [playerId],
            gameId: null
        };
        this.rooms.set(roomId, room);
        return room;
    }

    getRoom(roomId) {
        return this.rooms.get(String(roomId));
    }

    addPlayerToRoom(roomId, playerId) {
        const room = this.getRoom(roomId);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }

        if (room.players.length >= 2) {
            return { success: false, error: 'Room is full' };
        }

        if (room.players.includes(playerId)) {
            return { success: false, error: 'Player already in room' };
        }

        room.players.push(playerId);
        return { success: true, room };
    }

    setGameIdForRoom(roomId, gameId) {
        const room = this.getRoom(roomId);
        if (room) {
            room.gameId = gameId;
        }
    }

    getAvailableRooms() {
        return Array.from(this.rooms.values())
            .filter(room => room.players.length === 1);
    }

    deleteRoom(roomId) {
        this.rooms.delete(roomId);
    }

    findRoomByGameId(gameId) {
        return Array.from(this.rooms.values()).find(r => r.gameId === gameId);
    }

    getRoomsData(playerManager) {
        return this.getAvailableRooms().map(room => ({
            roomId: room.roomId,
            roomUsers: room.players.map(pId => {
                const player = playerManager.getPlayerById(pId);
                return {
                    name: player.name,
                    index: player.index
                };
            })
        }));
    }
}

