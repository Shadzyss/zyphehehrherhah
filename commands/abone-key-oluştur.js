// commands/abone-key-olustur.js
const { SlashCommandBuilder, EmbedBuilder, Colors } = require('discord.js');
const SubscriberKey = require('../models/subscriberKeyModel');

// Rastgele Harf Key Oluşturucu (ABCD-EFGH-IJKL-MNOP)
function generateLetterKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let key = '';
    for (let i = 0; i < 4; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        key += segment;
        if (i < 3) key += '-';
    }
    return key;
}

// 6 Haneli Sayısal ID Oluşturucu
function generateKeyId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abone-key-oluştur')
        .setDescription('Abone rolüne özel key oluşturur.')
        .setDescriptionLocalizations({
            'en-US': 'Creates a special key for subscribers.',
            'tr': 'Abone rolüne özel key oluşturur.'
        }),

    async execute(interaction) {
        const { member, guild, channel } = interaction;
        const aboneRoleId = process.env.ROLE_ID_ABONE;
        const isEnglish = member.roles.cache.has(process.env.ROLE_ID_ENGLISH);

        // --- 1. ROL KONTROLÜ ---
        if (!member.roles.cache.has(aboneRoleId)) {
            const errorText = isEnglish
                ? `**You Must Have the <@&${aboneRoleId}> Role to Use This Command**`
                : `**Bu Komutu Kullanabilmek İçin <@&${aboneRoleId}> Adlı Role Sahip Olman Gerekmektedir**`;

            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle(isEnglish ? '❌ Failed' : '❌ Başarısız')
                .setDescription(errorText);
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // --- 2. KANAL KONTROLÜ ---
        const targetChannelId = isEnglish ? process.env.CHANNEL_ID_EN_CMD : process.env.CHANNEL_ID_TR_CMD;

        if (channel.id !== targetChannelId) {
            const errorText = isEnglish
                ? `**You Can Only Use This Command in <#${targetChannelId}>**`
                : `**Bu Komutu Sadece <#${targetChannelId}> Adlı Kanalda Kullanabilirsin**`;

            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle(isEnglish ? '❌ Failed' : '❌ Başarısız')
                .setDescription(errorText);

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        try {
            // --- 3. MEVCUT KEY KONTROLÜ (YENİ EKLENEN KISIM) ---
            // Bu kullanıcının daha önce oluşturduğu bir "Abone Key" var mı?
            const existingKey = await SubscriberKey.findOne({ 
                creatorId: member.id, 
                reason: 'Abone Key' 
            });

            if (existingKey) {
                const errorDesc = isEnglish
                    ? `**${member} You Already Have an Active Subscriber Key\n✨ Your Active Subscriber Key --> ||\`${existingKey.key}\`||**`
                    : `**${member} Zaten Aktif Bir Abone Key'iniz Var\n✨ Aktif Abone Key'iniz --> ||\`${existingKey.key}\`||**`;

                const limitEmbed = new EmbedBuilder()
                    .setTitle(isEnglish ? '❌ Failed' : '❌ Başarısız')
                    .setDescription(errorDesc)
                    .setColor(Colors.Red);

                return interaction.reply({ embeds: [limitEmbed], ephemeral: true });
            }

            // --- 4. KEY OLUŞTURMA VE KAYIT ---
            const newKey = generateLetterKey();
            const newKeyId = generateKeyId();
            const now = new Date();
            
            // MongoDB'ye Kayıt
            await SubscriberKey.create({
                key: newKey,
                keyId: newKeyId,
                creatorId: member.id,
                ownerId: member.id, 
                reason: "Abone Key",
                scriptName: "ABONE KEY",
                createdAt: now,
                duration: "SINIRSIZ",
                hwid: null,
                isUsed: false
            });

            const timestamp = Math.floor(now.getTime() / 1000);

            // --- 5. KULLANICIYA DM GÖNDERME ---
            const dmTitle = isEnglish ? "Your Created Subscriber Key" : "Oluşturulan Abone Key'iniz";
            const durationText = isEnglish ? "Unlimited" : "Sınırsız";
            
            const dmDescription = isEnglish
                ? `**⛓️‍💥 Generated Key --> ||\`${newKey}\`||
🆔 Generated Key ID --> \`${newKeyId}\`
🪄 Key Creator --> ${member}
📜 Creation Reason --> \`Abone Key\`
🧾 Script Name --> \`ABONE KEY\`
⏰ Creation Time --> <t:${timestamp}:F>
⏱️ Expiration Time --> \`${durationText}\`**`
                : `**⛓️‍💥 Oluşturulan Key --> ||\`${newKey}\`||
🆔 Oluşturulan Key ID --> \`${newKeyId}\`
🪄 Key'i Oluşturan Kişi --> ${member}
📜 Key'in Oluşturulma Sebebi --> \`Abone Key\`
🧾 Script Adı --> \`ABONE KEY\`
⏰ Key'in Oluşturulma Zamanı --> <t:${timestamp}:F>
⏱️ Key'in Bitiş Zamanı --> \`${durationText}\`**`;

            const dmEmbed = new EmbedBuilder()
                .setTitle(dmTitle)
                .setDescription(dmDescription)
                .setColor('Random');

            let dmSent = true;
            try {
                await member.send({ embeds: [dmEmbed] });
            } catch (err) {
                dmSent = false;
            }

            // --- 6. LOG KANALINA MESAJ (SADECE TÜRKÇE) ---
            const logChannel = guild.channels.cache.get(process.env.CHANNEL_ID_LOG_KEY);
            
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('Bir Abone Key Oluşturuldu')
                    .setDescription(`**⛓️‍💥 Oluşturulan Key --> ||\`${newKey}\`||
🆔 Oluşturulan Key ID --> \`${newKeyId}\`
📜 Key'in Oluşturulma Sebebi --> \`Abone Key\`
🧾 Script Adı --> \`ABONE KEY\`
🪄 Key'i Oluşturan Kişi --> ${member}
👑 Key Sahibi --> ${member}
⏰ Key'in Oluşturulma Zamanı --> <t:${timestamp}:F>
⏱️ Key'in Bitiş Zamanı --> \`Sınırsız\`**`)
                    .setColor('Random');

                logChannel.send({ embeds: [logEmbed] }).catch(console.error);
            } else {
                console.log("Key Log kanalı bulunamadı.");
            }

            // --- 7. KOMUT YANITI (SUCCESS) ---
            const successTitle = isEnglish ? "✅ Success" : "✅ Başarılı";
            const successDesc = isEnglish
                ? `**${member} Subscriber Key Successfully Created, Check Your DM Box
❗ __IF YOUR DM IS CLOSED, THE BOT CANNOT SEND YOU KEY INFO. IF CLOSED, PLEASE OPEN IT.__**`
                : `**${member} Başarılıyla Abone Key Oluşturuldu Dm Kutunuzu Kontrol Edin
❗ __EĞER DM'İNİZ KAPALI İSE BOT SİZE KEY BİLGİLERİNİ GÖNDEREMEZ EĞER DM KUTUNUZ KAPALI İSE AÇIN__**`;
            
            const successEmbed = new EmbedBuilder()
                .setTitle(successTitle)
                .setDescription(successDesc)
                .setColor(Colors.Green);

            await interaction.reply({ embeds: [successEmbed], ephemeral: false });

            if (!dmSent) {
                await interaction.followUp({ 
                    content: isEnglish ? '❌ I couldn\'t send the DM. Please open your DMs.' : '❌ DM gönderemedim. Lütfen DM kutunu aç.',
                    ephemeral: true 
                });
            }

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: 'Bir hata oluştu.', ephemeral: true });
        }
    },
};