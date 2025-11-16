import { WebSocketServer } from 'ws';
import { GameManager } from './GameManager.js';

const WS_PORT = 3000;

export const wss = new WebSocketServer({ port: WS_PORT });

const gameManager = new GameManager();

console.log(`Start WebSocket server on the ${WS_PORT} port!`);

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            const request = JSON.parse(message.toString());
            console.log('Received command:', request.type, request.data);

            gameManager.handleMessage(ws, request);
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        gameManager.handleDisconnect(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

export { gameManager };

