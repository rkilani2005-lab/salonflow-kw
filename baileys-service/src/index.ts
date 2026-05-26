// baileys-service/src/index.ts
// ---------------------------------------------------------------
// ZAINA Baileys Session Manager
// ---------------------------------------------------------------
// Self-hosted Node.js service that maintains one WhatsApp multi-device
// session per tenant. Tenants scan a QR code (exactly like WhatsApp Web
// on desktop) and their phone gets linked as a device.
//
// Responsibilities:
//   - POST   /sessions/:id/start       → generate QR, begin pairing
//   - GET    /sessions/:id             → status poll (QR data URI, connected info)
//   - POST   /sessions/:id/messages    → send text/media
//   - DELETE /sessions/:id             → logout + wipe local auth
//   - On inbound message / connection change, webhook Supabase
//
// Auth:
//   All requests require header  X-Baileys-Auth: <BAILEYS_SHARED_SECRET>
//
// Persistence:
//   Auth state files stored in ./auth/<sessionId>/ (useMultiFileAuthState).
//   Mount this directory as a persistent volume in production.
// ---------------------------------------------------------------
import express from "express";
import QRCode from "qrcode";
import pino from "pino";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  Browsers,
} from "baileys";
import { Boom } from "@hapi/boom";

// ---------- Config -------------------------------------------------------
const PORT                   = Number(process.env.PORT ?? 3001);
const AUTH_DIR               = process.env.AUTH_DIR ?? "./auth";
const BAILEYS_SHARED_SECRET  = process.env.BAILEYS_SHARED_SECRET!;
const SUPABASE_WEBHOOK_URL   = process.env.SUPABASE_WEBHOOK_URL!;  // .../functions/v1/baileys-inbound
const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET!;

if (!BAILEYS_SHARED_SECRET || !SUPABASE_WEBHOOK_URL || !SUPABASE_WEBHOOK_SECRET) {
  console.error("Missing required env: BAILEYS_SHARED_SECRET, SUPABASE_WEBHOOK_URL, SUPABASE_WEBHOOK_SECRET");
  process.exit(1);
}

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

// ---------- In-memory session registry ----------------------------------
type SessionState = {
  id: string;                      // == channel_account_id (uuid)
  tenantId: string;
  sock?: WASocket;
  status: "pending" | "connected" | "disconnected" | "error";
  qr?: string;                     // data URI
  phone?: string;
  pushName?: string;
  lastError?: string;
};
const sessions = new Map<string, SessionState>();

// ---------- Webhook dispatch (Baileys → Supabase) -----------------------
async function dispatch(event: Record<string, unknown>) {
  try {
    await fetch(SUPABASE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Baileys-Auth": SUPABASE_WEBHOOK_SECRET,
      },
      body: JSON.stringify(event),
    });
  } catch (err) {
    logger.error({ err }, "webhook dispatch failed");
  }
}

// ---------- Start / resume a session ------------------------------------
async function startSession(id: string, tenantId: string): Promise<SessionState> {
  // Reuse existing if already running
  const existing = sessions.get(id);
  if (existing?.sock && existing.status === "connected") return existing;

  const { state, saveCreds } = await useMultiFileAuthState(`${AUTH_DIR}/${id}`);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.ubuntu("ZAINA"),
    logger: logger.child({ session: id }),
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: false,     // don't steal "online" from the tenant's phone
  });

  const session: SessionState = {
    id, tenantId,
    sock,
    status: sessions.get(id)?.status ?? "pending",
  };
  sessions.set(id, session);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      session.qr = await QRCode.toDataURL(qr);
      session.status = "pending";
      sessions.set(id, session);
      dispatch({ event: "qr", session_id: id, tenant_id: tenantId });
    }

    if (connection === "open") {
      session.status = "connected";
      session.qr = undefined;
      session.phone = sock.user?.id?.split(":")[0]?.split("@")[0];
      session.pushName = sock.user?.name;
      sessions.set(id, session);
      dispatch({
        event: "connection",
        session_id: id, tenant_id: tenantId,
        data: { status: "connected", phone: session.phone, push_name: session.pushName },
      });
      logger.info({ id, phone: session.phone }, "session connected");
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      session.status = loggedOut ? "disconnected" : "error";
      session.lastError = lastDisconnect?.error?.message;
      sessions.set(id, session);
      dispatch({
        event: "connection",
        session_id: id, tenant_id: tenantId,
        data: { status: session.status, error: session.lastError, logged_out: loggedOut },
      });
      if (!loggedOut) {
        // transient, reconnect after backoff
        const delay = Math.min(30_000, 2000 * Math.pow(2, Math.random()));
        logger.info({ id, delay }, "reconnecting");
        setTimeout(() => startSession(id, tenantId).catch(e => logger.error({ e }, "reconnect failed")), delay);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (m.key.fromMe) continue;
      if (!m.message) continue;

      // ---- Pick the best contact identifier ----------------------------
      // In Baileys v7+, m.key.remoteJid can be a Linked Identity (LID)
      // JID like "1550828804751:57@lid" when the contact has WhatsApp's
      // privacy mode on.  Stripping non-digits from this gives a fake
      // 15-digit "phone" that breaks everything downstream.  Prefer any
      // available @s.whatsapp.net JID; if only LID is available, mark
      // the contact as anonymous so the Supabase side knows to ask the
      // customer for their real phone.
      const k: any = m.key;
      const jidCandidates: string[] = [
        k.remoteJidAlt,   // v7 phone-number alt for LID chats
        k.senderPn,       // alternate naming in some builds
        k.remoteJid,
      ].filter((j): j is string => typeof j === "string");
      const phoneJid = jidCandidates.find(j => j.endsWith("@s.whatsapp.net"));
      const fromJid  = phoneJid ?? k.remoteJid ?? "";
      const isLidOnly = !phoneJid && typeof k.remoteJid === "string" && k.remoteJid.endsWith("@lid");

      if (isLidOnly) {
        logger.warn({ remoteJid: k.remoteJid, candidates: jidCandidates },
          "LID-only contact; downstream will need to ask for phone");
      }

      const text =
        m.message.conversation ??
        m.message.extendedTextMessage?.text ??
        m.message.imageMessage?.caption ??
        m.message.videoMessage?.caption ??
        null;
      const contentType =
        m.message.imageMessage ? "image"
        : m.message.videoMessage ? "video"
        : m.message.audioMessage ? "audio"
        : m.message.documentMessage ? "document"
        : "text";
      dispatch({
        event: "message",
        session_id: id, tenant_id: tenantId,
        data: {
          message_id: m.key.id,
          from_jid: fromJid,
          raw_remote_jid: k.remoteJid,  // for debug + future LID resolution
          is_lid_only: isLidOnly,
          push_name: m.pushName ?? null,
          text,
          content_type: contentType,
          timestamp: Number(m.messageTimestamp) * 1000,
          is_group: fromJid?.endsWith("@g.us") ?? false,
        },
      });
    }
  });

  return session;
}

// ---------- Resume all on startup ---------------------------------------
async function resumeExistingSessions() {
  // On cold start, the service doesn't know which sessions were connected.
  // Strategy: the Supabase function `channel-connect` keeps channel_accounts
  // authoritative. We just wait for it to hit our /sessions/:id/start
  // endpoint again, or optionally replay from a list file.
  // For v1, cold-start reconnection happens lazily via requests.
  logger.info("Baileys service ready. Sessions will resume on demand.");
}

// ---------- HTTP API ----------------------------------------------------
const app = express();
app.use(express.json({ limit: "25mb" }));

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const got = req.header("X-Baileys-Auth");
  if (got !== BAILEYS_SHARED_SECRET) return res.status(401).json({ error: "unauthorized" });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, sessions: sessions.size }));

app.post("/sessions/:id/start", async (req, res) => {
  const { id } = req.params;
  const { tenant_id } = req.body;
  if (!tenant_id) return res.status(400).json({ error: "tenant_id required" });
  try {
    const s = await startSession(id, tenant_id);
    // Wait briefly for a QR if we don't have one yet
    for (let i = 0; i < 20 && !s.qr && s.status === "pending"; i++) {
      await new Promise(r => setTimeout(r, 250));
    }
    res.json({
      id: s.id,
      status: s.status,
      qr: s.qr ?? null,
      phone: s.phone ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/sessions/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "session not found" });
  res.json({ id: s.id, status: s.status, qr: s.qr ?? null, phone: s.phone ?? null });
});

app.post("/sessions/:id/messages", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s?.sock || s.status !== "connected") {
    return res.status(409).json({ error: "session not connected" });
  }
  const { to, text, media_url, media_type, caption } = req.body as {
    to: string; text?: string; media_url?: string; media_type?: "image" | "video" | "document"; caption?: string;
  };
  if (!to) return res.status(400).json({ error: "to required" });
  const jid = to.includes("@") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;

  try {
    let sent;
    if (media_url) {
      const content =
        media_type === "image"    ? { image:    { url: media_url }, caption }
      : media_type === "video"    ? { video:    { url: media_url }, caption }
      : media_type === "document" ? { document: { url: media_url }, caption, mimetype: "application/pdf" }
      : { image: { url: media_url }, caption };
      sent = await s.sock.sendMessage(jid, content);
    } else if (text) {
      sent = await s.sock.sendMessage(jid, { text });
    } else {
      return res.status(400).json({ error: "text or media_url required" });
    }
    res.json({ message_id: sent?.key?.id, status: "sent" });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

app.delete("/sessions/:id", async (req, res) => {
  const s = sessions.get(req.params.id);
  try {
    await s?.sock?.logout();
  } catch { /* ignore */ }
  sessions.delete(req.params.id);
  // Wipe auth files so next scan starts fresh
  try {
    const fs = await import("fs/promises");
    await fs.rm(`${AUTH_DIR}/${req.params.id}`, { recursive: true, force: true });
  } catch { /* ignore */ }
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', async () => {
  logger.info({ port: PORT }, "baileys service listening");
  await resumeExistingSessions();
});
