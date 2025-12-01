import express from "express";
import noblox from "noblox.js";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// CONFIG
const GROUP_ID = Number(process.env.GROUP_ID);
const SECURITY = process.env.SECURITY;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
let isLoggedIn = false;

// Inicializar Roblox
async function initRoblox() {
    const cookie = process.env.ROBLOX_COOKIE;

    if (!cookie) {
        console.warn("ROBLOX_COOKIE no configurada.");
        return false;
    }

    try {
        await noblox.setCookie(cookie);
        await noblox.setOptions({ show_deprecation_warnings: false });
        const user = await noblox.getAuthenticatedUser();

        console.log(`Conectado como: ${user.name}`);
        return true;

    } catch (err) {
        console.error("Error al conectar con Roblox:", err);
        return false;
    }
}

// Seguridad
async function logSecurityAlert(ip, reason, body) {
    if (!WEBHOOK_URL) return;

    await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content: `⚠ **INTENTO DE ACCESO NO AUTORIZADO**\nIP: ${ip}\nRazón: ${reason}\nBody: ${JSON.stringify(body)}`
        })
    });
}

// Cambiar rango
async function doLevelUp(userId) {
    if (!isLoggedIn) throw new Error("No conectado a Roblox");

    const currentRank = await noblox.getRankInGroup(GROUP_ID, userId);
    if (currentRank === 0) throw new Error("El usuario no está en el grupo");

    const roles = await noblox.getRoles(GROUP_ID);
    const currentIndex = roles.findIndex(r => r.rank === currentRank);

    if (currentIndex === -1) throw new Error("Rol actual no encontrado");

    const nextRole = roles[currentIndex + 1];
    if (!nextRole) return { message: "Rango máximo alcanzado" };

    await noblox.setRank(GROUP_ID, userId, nextRole.rank);

    return {
        message: "Rango actualizado",
        oldRank: currentRank,
        newRank: nextRole.rank,
        roleName: nextRole.name
    };
}

// Endpoint principal
app.post("/start-levelup", async (req, res) => {
    const requesterIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // 1. Validar seguridad
    if (req.body.security !== SECURITY) {
        await logSecurityAlert(requesterIP, "Security token incorrecto", req.body);
        return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = Number(req.body.userId);
    if (!userId) {
        return res.status(400).json({ error: "userId requerido" });
    }

    try {
        const result = await doLevelUp(userId);
        res.json(result);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        robloxConnected: isLoggedIn,
        groupId: GROUP_ID
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

async function startServer() {
    isLoggedIn = await initRoblox();
    app.listen(PORT, HOST, () => {
        console.log(`Servidor listo en ${HOST}:${PORT}`);
    });
}

startServer();
