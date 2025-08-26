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
/**
//══════════════════════════════════════════════════════════════════════════════════════════════════════//
//                                                                                                      //
//                                   ＷＨＡＴＳＡＰＰ　ＢＯＴ－ＤＡＮＵＷＡ　ＭＤ                           //
//                                                                                                      // 
//                                             Ｖ：1．0．0                                               //
//                                                                                                      //
//                            Powerful WhatsApp Bot by Danuka Disanayaka                                //
//══════════════════════════════════════════════════════════════════════════════════════════════════════//
**/

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
const path = require('path');
const axios = require('axios');
const https = require('https');
const qrcode = require('qrcode-terminal');
const express = require('express');

const { ownerNumber } = require('./config');
const { BOT_OWNER } = require('./config');
const { sms } = require('./lib/msg');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const { File } = require('megajs');

const app = express();
const port = process.env.PORT || 8080;
const prefix = '.';

// Session setup
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
  if (!config.SESSION_ID) {
    return console.log('❗ [DANUWA-MD] SESSION_ID not found in env. Please configure it.');
  }

  const sessdata = config.SESSION_ID;
  const filer = File.fromURL('https://mega.nz/file/' + sessdata);
  
  filer.download((err, data) => {
    if (err) throw err;
    fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
      console.log('📥 [DANUWA-MD] Session file downloaded and saved.');
    });
  });
}

// Load plugins
const { replyHandlers, commands } = require('./command');

// Function: Load remote plugins
async function loadRemotePlugins() {
  console.log('🔧 [DANUWA-MD] Installing plugins...');
  global.pluginHooks = [];

  const pluginBaseUrl = 'https://test30-26o.pages.dev/plugins/';
  const pluginFolder = path.join(__dirname, './remote_plugins');

  if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder);

  try {
    const res = await axios.get('https://test30-26o.pages.dev/plugins.json');
    const plugins = res.data;

    for (const plugin of plugins) {
      const pluginName = plugin.file;
      const pluginUrl = pluginBaseUrl + pluginName;
      const pluginPath = path.join(pluginFolder, pluginName);
      const stream = fs.createWriteStream(pluginPath);

      await new Promise((resolve, reject) => {
        https.get(pluginUrl, (res) => {
          res.pipe(stream);
          stream.on('finish', () => resolve());
        }).on('error', (err) => {
          fs.unlink(pluginPath, () => {});
          reject(err);
        });
      });

      try {
        const loadedPlugin = require(pluginPath);
        if (loadedPlugin && (loadedPlugin.onMessage || loadedPlugin.onDelete)) {
          global.pluginHooks.push(loadedPlugin);
        }
      } catch (err) {
        console.error('[PLUGIN ERROR] ' + pluginName + ':', err.message);
      }
    }

  } catch (err) {
    console.error('❌ [DANUWA-MD] Failed to load plugins:', err.message);
  }
}

// Function: Connect to WhatsApp
async function connectToWA() {
  console.log('🛰️ [DANUWA-MD] Initializing WhatsApp connection...');

  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS('Firefox'),
    syncFullHistory: true,
    auth: state,
    version: version
  });

  // Group participants update
  sock.ev.on('group-participants.update', async (update) => {
    console.log('📥 New Group Update:', update.id);
    try {
      const { id, participants, action } = update;
      const groupMeta = await sock.groupMetadata(id);
      const groupName = groupMeta.subject || 'No Group Name';

      if (action === 'add') {
        for (const user of participants) {
          const userId = user.split('@')[0];
          const welcomeMsg = `🗯️ *WELCOME TO ${groupName} ${userId}!* ❤️‍🩹\n\nWe’re delighted to have you join our community.\n\n✅ Please take a moment to read the group rules and feel free to introduce yourself.\n\n💎 *Let’s build a friendly and respectful environment together!*`;
          await sock.sendMessage(id, { image: { url: 'https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/welcome.jpg?raw=true' }, caption: welcomeMsg, mentions: [user] });
        }
      }

      if (action === 'remove') {
        for (const user of participants) {
          const userId = user.split('@')[0];
          const leaveMsg = `👋 *Goodbye @${userId} from ${groupName}.* We wish you all the best! ❤️‍🩹`;
          await sock.sendMessage(id, { image: { url: 'https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/leave.jpg?raw=true' }, caption: leaveMsg, mentions: [user] });
        }
      }

    } catch (err) {
      console.error('Group participants update error:', err);
    }
  });

  // Connection update
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      connectToWA();
    } else if (connection === 'open') {
      await loadRemotePlugins();
      console.log('✅ [DANUWA-MD] All plugins installed Successfully');

      const aliveMsg = 'Hey, DANUWA-MD started✅';
      await sock.sendMessage(ownerNumber[0] + '@s.whatsapp.net', {
        image: { url: config.ALIVE_IMG },
        caption: aliveMsg
      });
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Message handler
  sock.ev.on('messages.upsert', async (m) => {
    m = m.messages[0];
    if (!m.message) return;

    const type = getContentType(m.message);
    const msgContent = m.message[type];

    // Download media if exists
    if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(type)) {
      try {
        const stream = await downloadContentFromMessage(msgContent, type.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        m._mediaBuffer = buffer;
        m._mediaType = type;
      } catch (err) {
        console.log('onMessage error:', err);
      }
    }

    // Run plugins
    if (global.pluginHooks) {
      for (const hook of global.pluginHooks) {
        if (hook.onMessage) {
          try {
            await hook.onMessage(sock, m);
          } catch (err) {
            console.error('[PLUGIN ERROR]', err);
          }
        }
      }
    }

    // Auto mark status as seen
    if (config.AUTO_STATUS_SEEN === 'true') {
      try {
        await sock.sendReadReceipt([m.key]);
        console.log('[✓] Status seen:', m.key.id);
      } catch (err) {
        console.error('❌ Failed to mark status as seen:', err);
      }
    }
  });
}

// Start
connectToWA();
