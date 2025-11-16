export class Game {
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
        // Validate if it's the attacker's turn
        if (this.currentPlayer !== attackerId) {
            return {
                status: 'error',
                attacks: [],
                error: 'Not your turn'
            };
        }

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

    getCurrentPlayer() {
        return this.currentPlayer;
    }

    getPlayers() {
        return this.players;
    }
}

