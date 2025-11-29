import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Ruta que recibe el webhook del juego
app.post("/updateLevel", async (req, res) => {
    const { userId, level } = req.body;

    if (!userId || !level) {
        return res.status(400).send("Missing data");
    }

    console.log(`[Webhook] User ${userId} → Level ${level}`);

    // --- AQUÍ IRÁ EL SETRANK DE ROBLOX (cuando me pases tu cookie) ---

    res.send("Received");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
