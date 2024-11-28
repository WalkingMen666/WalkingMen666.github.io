const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

const rows = 20;
const cols = 10;
const blockSize = 30;

let grid = Array.from({ length: rows }, () => Array(cols).fill(0));
let activeTetromino = null; // do latest block active
let gameInterval = null;
let isRunning = false;
let dropSpeed = 1000; // start speed(ms)
let isPaused = false;
let forceDropTimeout; // timer

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragOffsetX = 0;
let dragOffsetY = 0;

let startAnimation = null;
let animationProgress = 0;
const animationDuration = 3000;

let score = 0;

class Tetromino {
    constructor(shape, colorStart, colorEnd) {
        this.shape = shape;
        this.colorStart = colorStart;
        this.colorEnd = colorEnd;
        this.x = Math.floor(cols / 2) - 1;
        this.y = 0;
        this.isDragging = false; // Move isDragging to be a property of the tetromino
    }

    createGradient() {
        const gradient = ctx.createLinearGradient(
            this.x * blockSize,
            this.y * blockSize,
            (this.x + this.shape[0].length) * blockSize,
            (this.y + this.shape.length) * blockSize
        );
        gradient.addColorStop(0, this.colorStart);
        gradient.addColorStop(1, this.colorEnd);
        return gradient;
    }

    draw() {
        const gradient = this.createGradient();
        ctx.fillStyle = gradient;

        this.shape.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell) {
                    // Draw the block
                    ctx.fillRect(
                        (this.x + colIndex) * blockSize,
                        (this.y + rowIndex) * blockSize,
                        blockSize,
                        blockSize
                    );
                    
                    // Default block border
                    ctx.strokeStyle = "#333";
                    ctx.strokeRect(
                        (this.x + colIndex) * blockSize,
                        (this.y + rowIndex) * blockSize,
                        blockSize,
                        blockSize
                    );
                }
            });
        });

        // Add red highlight border when dragging
        if (this.isDragging) {
            ctx.strokeStyle = "red";
            ctx.lineWidth = 3; // Thicker red border
            
            // Calculate the bounding box of the entire tetromino
            const startX = this.x * blockSize;
            const startY = this.y * blockSize;
            const width = this.shape[0].length * blockSize;
            const height = this.shape.length * blockSize;
            
            ctx.strokeRect(startX, startY, width, height);
            
            // Reset line width to default
            ctx.lineWidth = 1;
        }
    }

    canMove(dx, dy) {
        // dx, dy => offest
        return this.shape.every((row, rowIndex) =>
            row.every((cell, colIndex) => {
                if (!cell) return true;
                const newX = this.x + colIndex + dx;
                const newY = this.y + rowIndex + dy;
                return (
                    newX >= 0 &&
                    newX < cols &&
                    newY >= 0 &&
                    newY < rows &&
                    grid[newY][newX] === 0
                );
            })
        );
    }

    move(dx, dy) {
        if (this.canMove(dx, dy)) {
            this.x += dx;
            this.y += dy;
        }
    }

    rotate() {
        const newShape = this.shape[0].map((_, colIndex) =>
            this.shape.map(row => row[colIndex]).reverse()
        );

        const originalX = this.x;
        const originalY = this.y;

        this.shape = newShape;

        // adjust pos
        while (this.x < 0) this.x++;
        while (this.x + this.shape[0].length > cols) this.x--;
        while (!this.canMove(0, 0)) this.y--;

        // recover when rotate failed
        if (!this.canMove(0, 0)) {
            this.shape = this.shape[0].map((_, colIndex) =>
                this.shape.map(row => row[row.length - 1 - colIndex])
            );
            this.x = originalX;
            this.y = originalY;
        }
    }


    place() {
        this.shape.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell) {
                    const newX = this.x + colIndex;
                    const newY = this.y + rowIndex;
                    if (newY >= 0) {
                        grid[newY][newX] = 2;
                    }
                }
            });
        });
    }

    dropToBottom() {
        // cal the max possible move
        let maxDrop = 0;
        while (this.canMove(0, maxDrop + 1)) {
            maxDrop++;
        }
    
        this.y += maxDrop;
    
        this.place();
    
        clearTimeout(forceDropTimeout);

        clearLines();
        activeTetromino = spawnTetromino();
    
        drawGrid();
    }
                

    startDrag(mouseX, mouseY) {
        // Calculate the offset of the mouse from the top-left of the tetromino
        const blockX = Math.floor(mouseX / blockSize);
        const blockY = Math.floor(mouseY / blockSize);
        
        // Check if the mouse is within the current tetromino
        if (
            blockX >= this.x && 
            blockX < this.x + this.shape[0].length &&
            blockY >= this.y && 
            blockY < this.y + this.shape.length &&
            this.shape[blockY - this.y][blockX - this.x]
        ) {
            this.isDragging = true;
            dragOffsetX = blockX - this.x;
            dragOffsetY = blockY - this.y;
            return true;
        }
        return false;
    }

    drag(mouseX, mouseY) {
        if (!this.isDragging) return;

        // Calculate new position
        const newX = Math.floor(mouseX / blockSize) - dragOffsetX;
        const newY = Math.floor(mouseY / blockSize) - dragOffsetY;

        // Prevent moving block upwards or above its current position
        if (newY < this.y) {
            return;
        }

        // Temporary move to check validity
        const originalX = this.x;
        const originalY = this.y;
        this.x = newX;
        this.y = newY;

        // Validate the new position
        if (this.canMove(0, 0)) {
            // Position is valid, keep the new position
            drawGrid();
        } else {
            // Invalid position, revert
            this.x = originalX;
            this.y = originalY;
        }
    }

    endDrag() {
        this.isDragging = false;
    }
}

function drawBackgroundGrid() {
    ctx.strokeStyle = "#444";
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            ctx.strokeRect(c * blockSize, r * blockSize, blockSize, blockSize);
        }
    }
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackgroundGrid();
    grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell === 2) {
                ctx.fillStyle = "#9d9d9d";
                ctx.fillRect(
                    colIndex * blockSize,
                    rowIndex * blockSize,
                    blockSize,
                    blockSize
                );
                ctx.strokeStyle = "#333";
                ctx.strokeRect(
                    colIndex * blockSize,
                    rowIndex * blockSize,
                    blockSize,
                    blockSize
                );
            }
        });
    });

    if (activeTetromino) {
        activeTetromino.draw();
    }
}

function drawStartAnimation(timestamp) {
    if (!startAnimation) startAnimation = timestamp;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Calculate progress (0 to 1)
    const progress = Math.min((timestamp - startAnimation) / animationDuration, 1);
    
    // Animate text position from left to right
    const textX = -300 + (progress * (canvasWidth + 300));
    const textY = canvasHeight / 2;
    
    // Set up text style
    ctx.font = 'bold 120px Arial';
    ctx.fillStyle = `rgba(97, 218, 251, ${1 - progress})`; // Fade out effect
    
    // Create 3D/gradient effect
    const gradient = ctx.createLinearGradient(textX, textY, textX + 300, textY);
    gradient.addColorStop(0, '#61DAFB');
    gradient.addColorStop(0.5, '#21a1f1');
    gradient.addColorStop(1, '#0e7ab7');

    ctx.fillStyle = gradient;
    
    // Draw text with shadow for depth
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    ctx.fillText('2024', textX, textY);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Continue animation if not complete
    if (progress < 1) {
        requestAnimationFrame(drawStartAnimation);
    } else {
        // Animation complete, start the game
        drawGrid();
        startAnimation = null;
    }
}

function gameLoop() {
    if (isPaused) return;

    if (activeTetromino.canMove(0, 1)) {
        activeTetromino.move(0, 1);
    } else {
        clearTimeout(forceDropTimeout);
        activeTetromino.place();
        clearLines();
        activeTetromino = spawnTetromino();

        // stopped game when new tetromino can't move
        if (!activeTetromino.canMove(0, 0)) {
            clearInterval(gameInterval);
            clearTimeout(forceDropTimeout);
            alert(`Game Over! Your final score: ${score}`);
            isRunning = false;
        }
    }
    drawGrid();
}  

function updateGameSpeed() {
    if (isRunning) {
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, dropSpeed);
    }
}

// initial game start
updateGameSpeed();
drawGrid();

function clearLines() {
    let linesCleared = 0;

    grid = grid.filter(row => {
        if (row.every(cell => cell === 2)) {
            linesCleared++;
            return false;
        }
        return true;
    });

    while (grid.length < rows) {
        grid.unshift(Array(cols).fill(0));
    }

    if (linesCleared > 0) {
        score += linesCleared ** 2;
        updateScoreBoard();
    }
}


function spawnTetromino() {
    if (forceDropTimeout) clearTimeout(forceDropTimeout);
    const shapes = [
        [[1, 1, 1], [0, 1, 0]],     // T shape
        [[1, 1], [1, 1]],           // O shape
        [[1, 1, 0], [0, 1, 1]],     // Z shape
        [[0, 1, 1], [1, 1, 0]],     // S shape(Z shape's transform)
        [[1, 1, 1, 1]],             // I shape
        [[1, 0], [1, 0], [1, 1]],   // L shape
        [[0, 1], [0, 1], [1, 1]]    // ｣ shape(L shape's transform)
    ];

    // random color & shape
    const colorStart = `hsl(${Math.random() * 360}, 100%, 50%)`;
    const colorEnd = `hsl(${(Math.random() + 0.5) * 360}, 100%, 50%)`;
    const shape = shapes[Math.floor(Math.random() * shapes.length)];

    const tetromino = new Tetromino(shape, colorStart, colorEnd);

    // set timmer
    forceDropTimeout = setTimeout(() => {
        if (tetromino) {
            tetromino.dropToBottom();
        }
    }, 5000);

    return tetromino;
}      

function updateScoreBoard() {
    document.getElementById("scoreBoard").textContent = `Score: ${score}`;
}

document.getElementById("start-button").addEventListener("click", () => {
    if (!isRunning) {
        isRunning = true;
        score = 0;
        updateScoreBoard();
        // Clear previous game state
        grid = Array.from({ length: rows }, () => Array(cols).fill(0));
        
        // Start the animation
        requestAnimationFrame(drawStartAnimation);
        
        // Set up game after animation
        setTimeout(() => {
            activeTetromino = spawnTetromino();
            isRunning = true;
            isPaused = false;
            updateGameSpeed();
        }, animationDuration);
    } else if (isPaused) {
        // If already running but paused, resume
        isPaused = false;
        updateGameSpeed();
    }
});

document.getElementById("left-button").addEventListener("click", () => {
    if (!isPaused && activeTetromino) activeTetromino.move(-1, 0);
    drawGrid();
});

document.getElementById("right-button").addEventListener("click", () => {
    if (!isPaused && activeTetromino) activeTetromino.move(1, 0);
    drawGrid();
});


document.getElementById("rotate-button").addEventListener("click", () => {
    if (!isPaused && activeTetromino) activeTetromino.rotate();
    drawGrid();
});

document.getElementById("drop-to-bottom").addEventListener("click", () => {
    if (!isPaused && activeTetromino) activeTetromino.dropToBottom();
});


document.getElementById("increase-speed").addEventListener("click", () => {
    dropSpeed = Math.max(100, dropSpeed - 100); // 100ms increase each click, 100ms minimum
    updateGameSpeed();
});

document.getElementById("decrease-speed").addEventListener("click", () => {
    dropSpeed = Math.min(2000, dropSpeed + 100); // 100ms decrease each click, 2000ms maximum
    updateGameSpeed();
});

document.getElementById("reset-button").addEventListener("click", (event) => {
    event.preventDefault();
    document.activeElement.blur();

    clearInterval(gameInterval);
    clearTimeout(forceDropTimeout);

    grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    activeTetromino = spawnTetromino();
    dropSpeed = 500;
    score = 0;
    isRunning = true;
    isPaused = false;

    updateScoreBoard();
    updateGameSpeed();
    drawGrid();
});

document.getElementById("pause-button").addEventListener("click", () => {
    if (isRunning) {
        if (!isPaused) {
            // pause game
            clearInterval(gameInterval);
            clearTimeout(forceDropTimeout);
            isPaused = true;
        } else {
            // restart game
            isPaused = false;
            updateGameSpeed();
        }
    }
});        

document.addEventListener("keydown", (event) => {
    // I don't know if its the browser setting or what, we can easily found that
    // when we press space bar after we click a button, that button will be triggered also.
    // So the code block below is to prevent that thing happened.

    if (event.key === " ") {
        event.preventDefault(); // prevent browser auto trigger
        if (!isPaused && activeTetromino) {
            activeTetromino.dropToBottom();
        }
        return;
    }

    if (isPaused || !activeTetromino) return;

    switch (event.key) {
        case "ArrowLeft":
            activeTetromino.move(-1, 0);
            break;
        case "ArrowRight":
            activeTetromino.move(1, 0);
            break;
        case "ArrowUp":
            activeTetromino.rotate();
            break;
        case "ArrowDown":
            activeTetromino.move(0, 1);
            break;
    }
    drawGrid();
});


// instruction modal popped when window being load
document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("instruction-modal");
    const closeModal = document.getElementById("close-modal");

    // show hint block
    modal.classList.add("show");

    // close hint block
    closeModal.addEventListener("click", () => {
        modal.classList.remove("show");
    });
});        

// Add drag event listeners
canvas.addEventListener('mousedown', (event) => {
    if (isPaused || !activeTetromino) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    activeTetromino.startDrag(mouseX, mouseY);
});

canvas.addEventListener('mousemove', (event) => {
    if (isPaused || !activeTetromino) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    activeTetromino.drag(mouseX, mouseY);
});

canvas.addEventListener('mouseup', () => {
    if (isPaused || !activeTetromino) return;
    
    activeTetromino.endDrag();
});

canvas.addEventListener('mouseleave', () => {
    if (isPaused || !activeTetromino) return;
    
    activeTetromino.endDrag();
});

// Touch event support
canvas.addEventListener('touchstart', (event) => {
    if (isPaused || !activeTetromino) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;
    
    activeTetromino.startDrag(mouseX, mouseY);
    event.preventDefault(); // Prevent scrolling
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    if (isPaused || !activeTetromino) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;
    
    activeTetromino.drag(mouseX, mouseY);
    event.preventDefault(); // Prevent scrolling
}, { passive: false });

canvas.addEventListener('touchend', (event) => {
    if (isPaused || !activeTetromino) return;
    
    activeTetromino.endDrag();
    event.preventDefault(); // Prevent scrolling
}, { passive: false });