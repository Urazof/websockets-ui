export class MessageHandler {
    constructor(gameManager) {
        this.gameManager = gameManager;
    }

    handleMessage(ws, request) {
        const { type, data, id } = request;

        console.log('Received command:', type, data);

        switch (type) {
            case 'reg':
                this.gameManager.handleRegistration(ws, data, id);
                break;
            case 'create_room':
                this.gameManager.handleCreateRoom(ws, data, id);
                break;
            case 'add_user_to_room':
                this.gameManager.handleAddUserToRoom(ws, data, id);
                break;
            case 'add_ships':
                this.gameManager.handleAddShips(ws, data, id);
                break;
            case 'attack':
                this.gameManager.handleAttack(ws, data, id);
                break;
            case 'randomAttack':
                this.gameManager.handleRandomAttack(ws, data, id);
                break;
            default:
                console.log('Unknown command type:', type);
                this.sendError(ws, `Unknown command type: ${type}`);
        }
    }

    sendError(ws, errorText) {
        this.gameManager.sendMessage(ws, {
            type: 'error',
            data: { error: true, errorText },
            id: 0
        });
    }
}

