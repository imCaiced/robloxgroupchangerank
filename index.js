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

console.log("=== CONFIGURACIÓN DEL SERVIDOR ===");
console.log("GROUP_ID:", GROUP_ID);
console.log("SECURITY (primeros 5 chars):", SECURITY ? SECURITY.slice(0, 5) : "NO CONFIGURADO");
console.log("WEBHOOK_URL:", WEBHOOK_URL ? "CARGADO" : "NO CONFIGURADO");
console.log("===================================\n");

// Inicializar Roblox
async function initRoblox() {
    const cookie = process.env.ROBLOX_COOKIE;

    console.log("Intentando conectar a Roblox...");

    if (!cookie) {
        console.warn("❌ ROBLOX_COOKIE NO CONFIGURADA");
        return false;
    }

    try {
        await noblox.setCookie(cookie);
        const user = await noblox.getAuthenticatedUser();

        console.log("✅ Conectado a Roblox como:", user.name);
        return true;

    } catch (err) {
        console.error("❌ Error al conectar con Roblox:", err);
        return false;
    }
}

// Seguridad (Webhook)
async function logSecurityAlert(ip, reason, body) {
    console.log("⚠️ ALERTA DE SEGURIDAD");
    console.log("IP:", ip);
    console.log("Razón:", reason);
    console.log("Body recibido:", body);

    if (!WEBHOOK_URL) {
        console.log("⚠️ No hay WEBHOOK_URL configurado. No se enviará alerta.");
        return;
    }

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
    console.log("\n=== Ejecutando doLevelUp ===");
    console.log("UserID recibido:", userId);

    if (!isLoggedIn) throw new Error("No conectado a Roblox");

    const currentRank = await noblox.getRankInGroup(GROUP_ID, userId);
    console.log("Rank actual del usuario:", currentRank);

    if (currentRank === 0) {
        console.log("❌ Usuario no está en el grupo");
        throw new Error("El usuario no está en el grupo");
    }

    const roles = await noblox.getRoles(GROUP_ID);
    console.log("Roles del grupo:", roles);

    const currentIndex = roles.findIndex(r => r.rank === currentRank);
    console.log("Index del rol actual:", currentIndex);

    if (currentIndex === -1) throw new Error("Rol actual no encontrado");

    const nextRole = roles[currentIndex + 1];
    console.log("Rol siguiente:", nextRole);

    if (!nextRole) {
        console.log("⚠ Usuario ya tiene el rango máximo");
        return { message: "Rango máximo alcanzado" };
    }

    console.log(`Intentando cambiar rango ${currentRank} → ${nextRole.rank}`);

    await noblox.setRank(GROUP_ID, userId, nextRole.rank);

    console.log("✅ Rango cambiado exitosamente");

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

    console.log("\n=== Nueva petición a /start-levelup ===");
    console.log("IP:", requesterIP);
    console.log("Body recibido:", req.body);

    // Validación seguridad
    console.log("Comparando SECURITY tokens...");
    console.log("Token recibido:", req.body.security);
    console.log("Token esperado:", SECURITY);

    if (req.body.security !== SECURITY) {
        console.log("❌ SECURITY TOKEN INCORRECTO");
        await logSecurityAlert(requesterIP, "Security token incorrecto", req.body);
        return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = Number(req.body.userId);
    console.log("UserID validado:", userId);

    if (!userId) {
        console.log("❌ userId faltante");
        return res.status(400).json({ error: "userId requerido" });
    }

    try {
        const result = await doLevelUp(userId);
        console.log("Resultado final:", result);
        res.json(result);

    } catch (err) {
        console.error("❌ Error interno:", err);
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
        console.log(`\n🚀 Servidor corriendo en http://${HOST}:${PORT}`);
    });
}

startServer();
