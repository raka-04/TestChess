const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");
const statusElement = document.querySelector("#status");
const newGameBtn = document.querySelector("#newGameBtn");

let draggedPiece = null;
let fromSquare = null;
let playerRole = null; // 'w', 'b', or null for spectator
let lastMove = null;   // Track last move for highlighting

// Map chess.js piece to your image filenames
const getPieceImage = (piece) => {
    if (!piece) return "";
    const type = piece.type;
    const color = piece.color === "w" ? "l" : "d"; // white->l, black->d
    return `/pieces/Chess_${type}${color}t45.svg.png`;
};

// Render the chessboard
const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";

    board.forEach((row, rowIndex) => {
        row.forEach((square, colIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add(
                "square",
                (rowIndex + colIndex) % 2 === 0 ? "light" : "dark"
            );

            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = colIndex;

            // Highlight last move
            if (lastMove) {
                const fromCoords = {
                    row: 8 - parseInt(lastMove.from[1]),
                    col: lastMove.from.charCodeAt(0) - 97
                };
                const toCoords = {
                    row: 8 - parseInt(lastMove.to[1]),
                    col: lastMove.to.charCodeAt(0) - 97
                };
                if ((rowIndex === fromCoords.row && colIndex === fromCoords.col) ||
                    (rowIndex === toCoords.row && colIndex === toCoords.col)) {
                    squareElement.style.outline = "3px solid yellow";
                }
            }

            // Add piece if present
            if (square) {
                const pieceElement = document.createElement("img");
                pieceElement.src = getPieceImage(square);
                pieceElement.classList.add("piece-img");
                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (!pieceElement.draggable) return;
                    draggedPiece = pieceElement;
                    fromSquare = { row: rowIndex, col: colIndex };
                    e.dataTransfer.setData("text/plain", "");
                });

                pieceElement.addEventListener("dragend", () => {
                    draggedPiece = null;
                    fromSquare = null;
                });

                squareElement.appendChild(pieceElement);
            }

            // Drop target
            squareElement.addEventListener("dragover", (e) => e.preventDefault());
            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (!draggedPiece) return;

                const toSquare = {
                    row: parseInt(squareElement.dataset.row),
                    col: parseInt(squareElement.dataset.col)
                };
                handleMove(fromSquare, toSquare);
            });

            boardElement.appendChild(squareElement);
        });
    });

    // Flip board for black
    if (playerRole === "b") boardElement.classList.add("flipped");
    else boardElement.classList.remove("flipped");
};

// Send move to server
const handleMove = (from, to) => {
    const move = {
        from: `${String.fromCharCode(97 + from.col)}${8 - from.row}`,
        to: `${String.fromCharCode(97 + to.col)}${8 - to.row}`,
        promotion: "q" // default promotion to queen
    };
    lastMove = move;
    socket.emit("move", move);
};

// Socket events
socket.on("playerRole", (role) => {
    playerRole = role;
    renderBoard();
});

socket.on("spectatorRole", () => {
    playerRole = null;
    renderBoard();
});

socket.on("boardState", (fen) => {
    chess.load(fen);
    renderBoard();
});

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
});

socket.on("invalidMove", (data) => {
    alert(`Invalid move: ${data.move.from} → ${data.move.to}\nReason: ${data.message}`);
});

// Waiting for opponent
socket.on("waitingForOpponent", () => {
    statusElement.textContent = "Waiting for the other player...";
});

// Opponent joined
socket.on("opponentJoined", () => {
    statusElement.textContent = "";
});

// Game Over
socket.on("gameOver", (msg) => {
    statusElement.textContent = msg;
    newGameBtn.classList.remove("hidden");
});

// Restart game
newGameBtn.addEventListener("click", () => {
    socket.emit("newGame");
});

socket.on("newGameStarted", () => {
    statusElement.textContent = "";
    newGameBtn.classList.add("hidden");
    chess.reset();
    renderBoard();
});

// Initial render
renderBoard();
