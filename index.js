// index.js
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const express = require('express'); // YENİ: Web sunucusu için

// Modelleri Çağırıyoruz
const GeneralKey = require('./models/generalKeyModel');
const SubscriberKey = require('./models/subscriberKeyModel');

// --- EXPRESS (ROBLOX API) AYARLARI ---
const app = express();
const PORT = process.env.PORT || 3000; 

app.use(express.json());

// Botu oluştur
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ] 
});
// ==========================================================
// 🏠 ANA SAYFA (Root Endpoint)
// ==========================================================
app.get('/', (req, res) => {
    // Tırnak içine istediğin her şeyi yazabilirsin
    res.send('👑 Zyphera Bot API Sistemi Aktif! 👑'); 
});
// Komut koleksiyonunu hazırla
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[UYARI] ${filePath} dosyasında gerekli özellikler eksik.`);
        }
    }
}

// Ses Kanalı ID'si
const TARGET_VOICE_CHANNEL_ID = '1448368801606533364';

// ==========================================================
// 🌍 ROBLOX API ENDPOINT (YENİ EKLENDİ)
// ==========================================================
app.get('/check-key', async (req, res) => {
    // Roblox'tan gelen veriler: ?key=KEY&hwid=HWID
    const { key, hwid } = req.query;

    if (!key || !hwid) {
        return res.json({ success: false, message: "Key veya HWID eksik! / Key or HWID missing!" });
    }

    try {
        // 1. Önce Normal Keylerde Ara
        let dbKey = await GeneralKey.findOne({ key: key });
        let keyType = 'general';

        // 2. Bulamazsa Abone Keylerde Ara
        if (!dbKey) {
            dbKey = await SubscriberKey.findOne({ key: key });
            keyType = 'subscriber';
        }

        // 3. Hiçbir yerde yoksa
        if (!dbKey) {
            return res.json({ success: false, message: "Geçersiz Key! / Invalid Key!" });
        }

        // --- KONTROLLER ---

        // A) Süre Kontrolü (Sadece General Key için)
        if (keyType === 'general' && dbKey.expiresAt) {
            const now = new Date();
            if (now > dbKey.expiresAt) {
                return res.json({ success: false, message: "Key süresi dolmuş! / Key has expired!" });
            }
        }

        // B) HWID Kontrolü (Güvenlik)
        if (!dbKey.hwid) {
            // İlk defa kullanılıyor, HWID'i kilitle
            dbKey.hwid = hwid;
            dbKey.isUsed = true;
            await dbKey.save();
        } else {
            // Daha önce kullanılmış, HWID eşleşiyor mu?
            if (dbKey.hwid !== hwid) {
                return res.json({ success: false, message: "HWID Hatası! Başka cihazda kullanılmış. / HWID Mismatch! Used on another device." });
            }
        }

        // C) BAŞARILI!
        // Script linkini buraya koyabilirsin veya raw kod döndürebilirsin.
        const scriptToLoad = `print('Zyphera: Hoşgeldin/Welcome! (${keyType})')`; 

        return res.json({
            success: true,
            message: "Giriş Başarılı / Login Successful",
            script: scriptToLoad, 
            type: keyType
        });

    } catch (error) {
        console.error("API Hatası:", error);
        return res.json({ success: false, message: "Sunucu hatası! / Server error!" });
    }
});

// API Sunucusunu Başlat
app.listen(PORT, () => {
    console.log(`🌍 Roblox API çalışıyor: Port ${PORT}`);
});


// ==========================================================
// 🤖 DISCORD BOT EVENTS
// ==========================================================
client.once('ready', async () => {
    console.log(`🤖 Giriş yapıldı: ${client.user.tag}`);

    // MongoDB Bağlantısı
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log('✅ MongoDB bağlantısı başarılı.'))
        .catch(err => console.error('❌ MongoDB bağlantı hatası:', err));

    // Hareketli Durum Ayarı
    const activities = [
        { name: "👑 Zyphera #SCR1PT", type: ActivityType.Watching},
    ];

    let i = 0;
    setInterval(() => {
        if (i >= activities.length) i = 0;
        client.user.setPresence({
            activities: [activities[i]],
            status: 'online',
        });
        i++;
    }, 5000); 

    // SES SİSTEMİ
    const connectToVoice = async () => {
        try {
            const guildId = process.env.GUILD_ID; 
            const connection = getVoiceConnection(guildId);

            if (connection) return;

            const guild = client.guilds.cache.get(guildId);
            if (!guild) return console.log("Sunucu bulunamadı.");

            const voiceChannel = guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);
            if (!voiceChannel) return console.log("Ses kanalı bulunamadı.");

            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: true
            });
            console.log(`🔊 Ses kanalına bağlanıldı: ${voiceChannel.name}`);
        } catch (error) {
            console.error("Ses bağlantısı hatası:", error);
        }
    };

    connectToVoice();
    setInterval(connectToVoice, 5000);

    // ==========================================================
    // 🕒 OTOMATİK SÜRE KONTROL SİSTEMİ
    // ==========================================================
    setInterval(async () => {
        const now = new Date();

        const expiredGeneral = await GeneralKey.find({ expiresAt: { $ne: null, $lte: now } });
        const expiredSub = await SubscriberKey.find({ expiresAt: { $ne: null, $lte: now } });

        const processExpiredKey = async (keyData, Model) => {
            try {
                const guild = client.guilds.cache.get(process.env.GUILD_ID);
                if (!guild) return; 

                const logChannel = guild.channels.cache.get(process.env.CHANNEL_ID_LOG_EXPIRED);
                
                let member;
                try {
                    member = await guild.members.fetch(keyData.ownerId);
                } catch (e) {
                    member = null;
                }

                const isEnglish = member ? member.roles.cache.has(process.env.ROLE_ID_ENGLISH) : false;
                const ticketChannelId = isEnglish ? process.env.CHANNEL_ID_TICKET_EN : process.env.CHANNEL_ID_TICKET_TR;

                let createdTs, expiresTs;
                try {
                    createdTs = Math.floor(new Date(keyData.createdAt).getTime() / 1000);
                    expiresTs = Math.floor(new Date(keyData.expiresAt).getTime() / 1000);
                } catch (e) {
                    createdTs = Math.floor(Date.now() / 1000);
                    expiresTs = createdTs;
                }

                // DM GÖNDER
                if (member) {
                    const dmTitle = isEnglish ? "Your Key Has Expired" : "Bir Key'iniz Süresi Doldu";
                    const dmDesc = isEnglish 
                        ? `**⛓️‍💥 Expired Key --> ||\`${keyData.key}\`||
🆔 Expired Key ID --> \`${keyData.keyId}\`
🪄 Key Creator --> <@${keyData.creatorId}>
🧾 Creation Reason --> \`${keyData.reason}\`
📜 Script Name --> \`${keyData.scriptName}\`
⏰ Creation Time --> <t:${createdTs}:F>
⏱️ Expiration Time --> <t:${expiresTs}:F>
❗ __IF YOU THINK THERE IS AN ERROR, PLEASE OPEN A TICKET AT <#${ticketChannelId}>__**`
                        : `**⛓️‍💥 Süresi Biten Key --> ||\`${keyData.key}\`||
🆔 Süresi Biten Key'in ID --> \`${keyData.keyId}\`
🪄 Key'i Oluşturan Yetkili --> <@${keyData.creatorId}>
🧾 Key'in Oluşturulma Sebebi --> \`${keyData.reason}\`
📜 Script Adı --> \`${keyData.scriptName}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Zamanı --> <t:${expiresTs}:F>
❗ __EĞER BİR HATA OLDUĞUNU DÜŞÜNÜYORSANIZ <#${ticketChannelId}> KANALINDAN BİLET OLUŞTURUN__**`;

                    const dmEmbed = new EmbedBuilder()
                        .setTitle(dmTitle)
                        .setDescription(dmDesc)
                        .setColor('Random');

                    await member.send({ embeds: [dmEmbed] }).catch(() => {});
                }

                // LOG KANALINA GÖNDER
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('Bir Key\'in Süresi Bitti')
                        .setDescription(`
**⛓️‍💥 Süresi Biten Key --> ||\`${keyData.key}\`||
🆔 Süresi Biten Key'in ID --> \`${keyData.keyId}\`
🪄 Key'i Oluşturan Yetkili --> <@${keyData.creatorId}>
👑 Key Sahibi --> <@${keyData.ownerId}>
🧾 Key'in Oluşturulma Sebebi --> \`${keyData.reason}\`
📜 Script Adı --> \`${keyData.scriptName}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Zamanı --> <t:${expiresTs}:F>**`)
                        .setColor('Random');

                    await logChannel.send({ embeds: [logEmbed] });
                }

                await Model.deleteOne({ _id: keyData._id });
                console.log(`[OTOMATİK] ${keyData.keyId} ID'li keyin süresi doldu ve silindi.`);

            } catch (err) {
                console.error("Otomatik silme hatası:", err);
            }
        };

        for (const key of expiredGeneral) {
            await processExpiredKey(key, GeneralKey);
        }
        
        for (const key of expiredSub) {
            await processExpiredKey(key, SubscriberKey);
        }

    }, 5000); 
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`${interaction.commandName} komutu bulunamadı.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Komutu çalıştırırken bir hata oluştu!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Komutu çalıştırırken bir hata oluştu!', ephemeral: true });
        }
    }
});

client.login(process.env.CLIENT_TOKEN);