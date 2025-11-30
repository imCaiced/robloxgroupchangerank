import express from "express";
import noblox from "noblox.js";

const app = express();
app.use(express.json());

const GROUP_ID = Number(process.env.GROUP_ID) || 947791644;
let isLoggedIn = false;

async function initRoblox() {
    const cookie = process.env.ROBLOX_COOKIE;
    if (!cookie) {
        console.warn(
            "ROBLOX_COOKIE no está configurada. El servidor arrancará pero no podrá cambiar rangos.",
        );
        return false;
    }
    try {
        await noblox.setCookie(cookie);
        const user = await noblox.getCurrentUser();
        console.log(`Conectado a Roblox como: ${user.UserName}`);
        return true;
    } catch (err) {
        console.error("Error al conectar con Roblox:", err.message);
        return false;
    }
}

async function doLevelUp(userId) {
    if (!isLoggedIn) {
        throw new Error("No conectado a Roblox");
    }

    const currentRank = await noblox.getRankInGroup(GROUP_ID, userId);

    if (currentRank === 0) {
        throw new Error("El usuario no está en el grupo");
    }

    const roles = await noblox.getRoles(GROUP_ID);
    const currentIndex = roles.findIndex((r) => r.rank === currentRank);

    if (currentIndex === -1) {
        throw new Error("Rol actual no encontrado");
    }

    const nextRole = roles[currentIndex + 1];

    if (!nextRole) {
        return { message: "El usuario ya tiene el rango máximo", currentRank };
    }

    await noblox.setRank(GROUP_ID, userId, nextRole.rank);

    return {
        message: "Rango actualizado exitosamente",
        oldRank: currentRank,
        newRank: nextRole.rank,
        roleName: nextRole.name,
    };
}

app.post("/start-levelup", async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "userId es requerido" });
        }

        const result = await doLevelUp(Number(userId));
        return res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err.message || "Error interno del servidor",
        });
    }
});

app.get("/test-levelup/:id", async (req, res) => {
    const userId = Number(req.params.id);

    try {
        const result = await doLevelUp(userId);
        res.json(result);
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        robloxConnected: isLoggedIn,
        groupId: GROUP_ID,
    });
});

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

async function startServer() {
    isLoggedIn = await initRoblox();
    app.listen(PORT, HOST, () => {
        console.log(`Servidor corriendo en ${HOST}:${PORT}`);
        console.log(`GROUP_ID: ${GROUP_ID}`);
    });
}

startServer();
