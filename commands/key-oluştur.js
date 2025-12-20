// commands/key-olustur.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel');
const GeneralKey = require('../models/generalKeyModel');

// --- YARDIMCI FONKSİYONLAR ---

// Rastgele Harf Key (ABCD-ABCD-ABCD-ABCD)
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

// 6 Haneli ID
function generateKeyId() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Süre Hesaplayıcı
function calculateExpiration(input) {
    if (!input) return null;
    const lower = input.toLowerCase();

    if (lower === 'sınırsız' || lower === 'unlimited') return null;

    const now = new Date();
    const match = lower.match(/^(\d+)([dhmwy])$/); 
    
    if (!match) return 'invalid'; 

    const amount = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'm': now.setMinutes(now.getMinutes() + amount); break; 
        case 'h': now.setHours(now.getHours() + amount); break;     
        case 'd': now.setDate(now.getDate() + amount); break;       
        case 'w': now.setDate(now.getDate() + (amount * 7)); break; 
        case 'y': now.setFullYear(now.getFullYear() + amount); break; 
    }
    return now;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('key-oluştur')
        .setDescription('Kullanıcıya Özel Key Oluşturur')
        .addUserOption(option => option.setName('kullanıcı').setDescription('Key kime oluşturulacak?').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Oluşturulma sebebi').setRequired(true))
        .addStringOption(option => option.setName('scriptadı').setDescription('Script adı').setRequired(true))
        .addStringOption(option => option.setName('süre').setDescription('Süre (Örn: 30m, 1h, 1d, 1w, 1y veya sınırsız)').setRequired(true)),

    async execute(interaction) {
        const { member, guild, options } = interaction;
        
        // Komutu kullananın dili (Hata mesajları için)
        const isCmdUserEnglish = member.roles.cache.has(process.env.ROLE_ID_ENGLISH);

        // --- 1. YETKİ KONTROLÜ ---
        const adminCheck = await Admin.findOne({ userId: member.id });
        if (!adminCheck) {
            const errorText = isCmdUserEnglish
                ? `**You Do Not Have Permission to Use This Command!**`
                : `**Bu Komutu Kullanmak İçin Bot Yetkilisi Olmalısın!**`;
            
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(errorText);
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const targetUser = options.getUser('kullanıcı');

        // --- 2. BOT KONTROLÜ (YENİ EKLENEN KISIM) ---
        if (targetUser.bot) {
            const botErrorText = isCmdUserEnglish
                ? '**You Cannot Perform Operations on Bots!**'
                : '**Botlar Üzerinde İşlem Yapamazsınız!**';

            const botErrorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(botErrorText);
            
            return interaction.reply({ embeds: [botErrorEmbed], ephemeral: true });
        }

        // --- GİRDİLER ---
        const reason = options.getString('sebep');
        const scriptName = options.getString('scriptadı');
        const durationInput = options.getString('süre');

        // --- SÜRE FORMAT KONTROLÜ ---
        const calculatedDate = calculateExpiration(durationInput);
        if (calculatedDate === 'invalid') {
            const errorText = isCmdUserEnglish
                ? `**Invalid Duration Format! Use: 1m, 1h, 1d, 1w, 1y or 'unlimited'**`
                : `**Geçersiz Süre Formatı! Kullanım: 1m, 1h, 1d, 1w, 1y veya 'sınırsız'**`;
            
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(errorText);
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Hedef kullanıcının rollerini al
        let targetMember;
        try {
            targetMember = await guild.members.fetch(targetUser.id);
        } catch (e) {
            targetMember = null;
        }

        // Hedef kullanıcıda İngilizce rolü var mı?
        const isTargetEnglish = targetMember ? targetMember.roles.cache.has(process.env.ROLE_ID_ENGLISH) : false;

        // --- 3. ONAY MEKANİZMASI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Key Oluşturulacak')
            .setDescription(`**${targetUser} Kişisine \`${scriptName}\` Adlı Bir Key Oluşturmak İstiyor Musunuz?**`)
            .setColor(Colors.Yellow);

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_gen_key')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_gen_key')
            .setLabel('İptal Et')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const response = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            fetchReply: true,
            ephemeral: false 
        });

        // --- 4. BUTON DİNLEYİCİSİ (ANA) ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonları sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'confirm_gen_key') {
                try {
                    // KEY OLUŞTURMA
                    const newKey = generateLetterKey();
                    const newKeyId = generateKeyId();
                    const createdAt = new Date();
                    const expiresAt = calculatedDate; 

                    // Timestamp Gösterimi
                    const createdTs = Math.floor(createdAt.getTime() / 1000);
                    const expiresTs = expiresAt ? Math.floor(expiresAt.getTime() / 1000) : null;
                    const expiresText = expiresTs ? `<t:${expiresTs}:R>` : (isTargetEnglish ? "Unlimited" : "Sınırsız");

                    // VERİTABANINA KAYIT
                    await GeneralKey.create({
                        key: newKey,
                        keyId: newKeyId,
                        creatorId: member.id,
                        ownerId: targetUser.id,
                        reason: reason,
                        scriptName: scriptName,
                        durationLabel: durationInput,
                        createdAt: createdAt,
                        expiresAt: expiresAt,
                        hwid: null,
                        isUsed: false
                    });

                    // --- 1. DM GÖNDERME (Hemen Gitsin) ---
                    const dmTitle = isTargetEnglish ? "Your Key Has Been Created" : "Key'iniz Oluşturuldu";
                    const dmDesc = isTargetEnglish
                        ? `**⛓️‍💥 Generated Key --> ||\`${newKey}\`||
🆔 Generated Key ID --> \`${newKeyId}\`
🪄 Key Creator --> ${member}
📜 Script Name --> \`${scriptName}\`
🧾 Creation Reason --> \`${reason}\`
⏰ Creation Time --> <t:${createdTs}:F>
⏱️ Expiration Time --> ${expiresText}
❗ __KEY IS FOR SINGLE USE ONLY. DO NOT SHARE YOUR KEY INFORMATION WITH ANYONE__**`
                        : `**⛓️‍💥 Oluşturulan Key --> ||\`${newKey}\`||
🆔 Oluşturulan Key ID --> \`${newKeyId}\`
🪄 Key'i Oluşturan Yetkili --> ${member}
📜 Script Adı --> \`${scriptName}\`
🧾 Key'in Oluşturulma Sebebi --> \`${reason}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Süresi --> ${expiresText}
❗ __KEY TEK KULLANIMLIKTIR KEY BİLGİLERİNİZİ KİMSEYLE PAYLAŞMAYIN__**`;

                    const dmEmbed = new EmbedBuilder()
                        .setTitle(dmTitle)
                        .setDescription(dmDesc)
                        .setColor('Random');

                    targetUser.send({ embeds: [dmEmbed] }).catch(() => {
                        interaction.followUp({ content: isTargetEnglish ? `❌ Could not send DM to ${targetUser}.` : `❌ ${targetUser} kişisine DM gönderilemedi.`, ephemeral: true });
                    });

                    // --- 2. LOG (Hemen Gitsin) ---
                    const logChannel = guild.channels.cache.get(process.env.CHANNEL_ID_LOG_KEY);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('Bir Key Oluşturuldu')
                            .setDescription(`**⛓️‍💥 Oluşturulan Key --> ||\`${newKey}\`||
🆔 Oluşturulan Key ID --> \`${newKeyId}\`
🪄 Key'i Oluşturan Yetkili --> ${member}
👑 Key Sahibi --> ${targetUser}
📜 Script Adı --> \`${scriptName}\`
🧾 Key'in Oluşturulma Sebebi --> \`${reason}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Süresi --> ${expiresText}**`)
                            .setColor('Random');

                        logChannel.send({ embeds: [logEmbed] });
                    }

                    // --- 3. ARA MESAJ (Gizli Gösterim) ---
                    const hiddenEmbed = new EmbedBuilder()
                        .setTitle('✅ Başarılı')
                        .setDescription(`**${member} Başarıyla Key Oluşturuldu Key Bilgilerini Görmek İçin ⛓️‍💥 Butonuna Tıklayın**`)
                        .setColor(Colors.Green);

                    const revealButton = new ButtonBuilder()
                        .setCustomId('reveal_key_details')
                        .setLabel('Göster / Reveal')
                        .setEmoji('⛓️‍💥')
                        .setStyle(ButtonStyle.Secondary);

                    const newRow = new ActionRowBuilder().addComponents(revealButton);

                    // Mesajı güncelle ve yeni bir dinleyici (collector) başlat
                    const updatedMessage = await i.update({ 
                        embeds: [hiddenEmbed], 
                        components: [newRow],
                        fetchReply: true 
                    });

                    // GÖSTER BUTONU DİNLEYİCİSİ
                    const revealCollector = updatedMessage.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 60000
                    });

                    revealCollector.on('collect', async subI => {
                        if (subI.user.id !== interaction.user.id) {
                            return subI.reply({ content: '**Bu butonu sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
                        }

                        if (subI.customId === 'reveal_key_details') {
                            // Hedef Diline Göre Final Embed
                            const finalTitle = isTargetEnglish ? "✅ Generated Key Information" : "✅ Oluşturulan Key Bilgileri";
                            const finalDesc = isTargetEnglish
                                ? `**⛓️‍💥 Generated Key --> ||\`${newKey}\`||
🆔 Generated Key ID --> \`${newKeyId}\`
🪄 Key Creator --> ${member}
👑 Key Owner --> ${targetUser}
📜 Script Name --> \`${scriptName}\`
🧾 Creation Reason --> \`${reason}\`
⏰ Creation Time --> <t:${createdTs}:F>
⏱️ Expiration Time --> ${expiresText}
❗ __KEY IS FOR SINGLE USE ONLY. DO NOT SHARE YOUR KEY INFORMATION WITH ANYONE__**`
                                : `**⛓️‍💥 Oluşturulan Key --> ||\`${newKey}\`||
🆔 Oluşturulan Key ID --> \`${newKeyId}\`
🪄 Key'i Oluşturan Yetkili --> ${member}
👑 Key Sahibi --> ${targetUser}
📜 Script Adı --> \`${scriptName}\`
🧾 Key'in Oluşturulma Sebebi --> \`${reason}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Süresi --> ${expiresText}
❗ __KEY TEK KULLANIMLIKTIR KEY BİLGİLERİNİZİ KİMSEYLE PAYLAŞMAYIN__**`;

                            const finalEmbed = new EmbedBuilder()
                                .setTitle(finalTitle)
                                .setDescription(finalDesc)
                                .setColor(Colors.Green);

                            // Butonu kaldırıp final bilgiyi göster
                            await subI.update({ embeds: [finalEmbed], components: [] });
                        }
                    });

                } catch (error) {
                    console.error(error);
                    await i.update({ content: '**Bir hata oluştu.**', embeds: [], components: [] });
                }

            } else if (i.customId === 'cancel_gen_key') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
        });
    },
};