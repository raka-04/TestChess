let express = require("express");
let socket = require("socket.io");
let http = require("http");
let { Chess } = require("chess.js");
let path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

// Store multiple games
let games = {}; // { roomId: { chess: Chess(), players: { white: id, black: id } } }

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

io.on("connection", function (socket) {
    const roomId = "room1"; // single room for now
    if (!games[roomId]) {
        games[roomId] = {
            chess: new Chess(),
            players: {}
        };
    }
    const game = games[roomId];

    // Assign roles
    if (!game.players.white) {
        game.players.white = socket.id;
        socket.emit("playerRole", "w");

        // White is waiting
        socket.emit("waitingForOpponent");
    } else if (!game.players.black) {
        game.players.black = socket.id;
        socket.emit("playerRole", "b");

        // Notify both players game started
        io.to(game.players.white).emit("opponentJoined");
        socket.emit("opponentJoined");
    } else {
        socket.emit("spectatorRole");
    }

    socket.join(roomId);

    // Disconnect handling
    socket.on("disconnect", function () {
        if (socket.id === game.players.white) {
            delete game.players.white;
        } else if (socket.id === game.players.black) {
            delete game.players.black;
        }
    });

    // Handle moves
    socket.on("move", (move) => {
        try {
            const chess = game.chess;

            if (chess.turn() === "w" && socket.id !== game.players.white) return;
            if (chess.turn() === "b" && socket.id !== game.players.black) return;

            const result = chess.move(move);
            if (result) {
                io.to(roomId).emit("move", move);
                io.to(roomId).emit("boardState", chess.fen());

                // Check game status
                if (chess.isGameOver()) {
                    let winnerMsg = "";
                    if (chess.isCheckmate()) {
                        winnerMsg = chess.turn() === "w" ? "Black wins!" : "White wins!";
                    } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
                        winnerMsg = "Game Draw!";
                    }
                    io.to(roomId).emit("gameOver", winnerMsg);
                }

            } else {
                socket.emit("invalidMove", { move, message: "Illegal move" });
            }
        } catch (err) {
            socket.emit("invalidMove", { move, message: "Error processing move" });
        }
    });

    // Restart game
    socket.on("newGame", () => {
        games[roomId].chess = new Chess();
        io.to(roomId).emit("boardState", games[roomId].chess.fen());
        io.to(roomId).emit("newGameStarted");
    });
});

server.listen(3000, function () {
    console.log("Listening on port 3000");
});
