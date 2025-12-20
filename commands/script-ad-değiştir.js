// commands/script-ad-degistir.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel');
const SubscriberKey = require('../models/subscriberKeyModel');
const GeneralKey = require('../models/generalKeyModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('script-ad-değiştir')
        .setDescription('Belirtilen Keyin Script Adını Değiştirir')
        .addStringOption(option => 
            option.setName('anahtar')
                .setDescription('İşlem yapılacak Key veya Key ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('yeni-ad')
                .setDescription('Scriptin yeni adı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Değişiklik sebebi')
                .setRequired(true)),

    async execute(interaction) {
        const { member, guild, options } = interaction;

        // --- 1. YETKİ KONTROLÜ ---
        const adminCheck = await Admin.findOne({ userId: member.id });
        if (!adminCheck) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Bu Komutu Kullanmak İçin Bot Yetkilisi Olmalısın!**');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const inputKey = options.getString('anahtar');
        const newScriptName = options.getString('yeni-ad');
        const changeReason = options.getString('sebep');

        // --- 2. VERİTABANI ARAMASI ---
        let keyData = await SubscriberKey.findOne({ $or: [{ key: inputKey }, { keyId: inputKey }] });
        let keyType = 'abone';

        if (!keyData) {
            keyData = await GeneralKey.findOne({ $or: [{ key: inputKey }, { keyId: inputKey }] });
            keyType = 'normal';
        }

        if (!keyData) {
            const notFoundEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`**Veritabanında \`${inputKey}\` verisine ait bir Key bulunamadı!**`);
            return interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
        }

        // --- 3. ONAY MEKANİZMASI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle(`⚠️ ${keyData.keyId} ID'li Key'in Adı Değiştirelecek`)
            .setDescription(`**${member} \`${keyData.keyId}\` ID'li Key'in Script Adını Değiştirmek İstiyor Musunuz?**`)
            .setColor(Colors.Yellow);

        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_name_change')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_name_change')
            .setLabel('İptal Et')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        const response = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            fetchReply: true
        });

        // --- 4. BUTON DİNLEYİCİSİ ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonu sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'cancel_name_change') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                await i.update({ embeds: [cancelEmbed], components: [] });
                return;
            }

            if (i.customId === 'confirm_name_change') {
                try {
                    // --- AD DEĞİŞTİRME İŞLEMİ ---
                    const oldScriptName = keyData.scriptName; // Eski adı kaydet
                    keyData.scriptName = newScriptName; // Yeni adı ata
                    await keyData.save(); // Kaydet

                    // --- 5. BİLGİLERİ HAZIRLA ---
                    const createdTs = Math.floor(new Date(keyData.createdAt).getTime() / 1000);
                    
                    let expiresText = "`Sınırsız`";
                    if (keyData.expiresAt) {
                        expiresText = `<t:${Math.floor(new Date(keyData.expiresAt).getTime() / 1000)}:R>`;
                    } else if (keyData.duration && (keyData.duration === 'SINIRSIZ' || keyData.duration === 'Unlimited')) {
                        expiresText = "`Sınırsız`";
                    }

                    // Script Adı ve Oluşturulma Sebebi (Genel Gösterim)
                    let scriptNameDisplay = "";
                    let creationReasonDisplay = "";

                    if (keyType === 'abone') {
                        scriptNameDisplay = "`ABONE KEY`";
                        creationReasonDisplay = "`Abone Key`";
                    } else {
                        // Veritabanı güncellendiği için burada yeni isim görünecek, bu normal.
                        scriptNameDisplay = `\`${keyData.scriptName}\``; 
                        creationReasonDisplay = `\`${keyData.reason}\``;
                    }

                    // --- 6. BAŞARILI MESAJI (YEŞİL) ---
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Ad Değiştirildi')
                        .setDescription(`**${member} Başarıyla \`${keyData.keyId}\` ID'li Keyin Script Adı Sıfırlandı\nAdı Değiştirilen Key'in Bilgilerini Görmek İçin ⛓️‍💥 Butonuna Basın**`)
                        .setColor(Colors.Green);

                    const revealButton = new ButtonBuilder()
                        .setCustomId('reveal_name_details')
                        .setLabel('Göster')
                        .setEmoji('⛓️‍💥')
                        .setStyle(ButtonStyle.Secondary);

                    const revealRow = new ActionRowBuilder().addComponents(revealButton);

                    const updatedMsg = await i.update({ embeds: [successEmbed], components: [revealRow], fetchReply: true });

                    // --- 7. İKİNCİ COLLECTOR (DETAYLAR) ---
                    const revealCollector = updatedMsg.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 60000
                    });

                    revealCollector.on('collect', async subI => {
                        if (subI.user.id !== interaction.user.id) {
                            return subI.reply({ content: '**Bu butonu sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
                        }

                        if (subI.customId === 'reveal_name_details') {
                            const detailsEmbed = new EmbedBuilder()
                                .setTitle('Ad\'ı Değiştirilen Key Bilgileri')
                                .setDescription(`
**⛓️‍💥 Key --> ||\`${keyData.key}\`||
🆔 Key ID --> \`${keyData.keyId}\`
🪄 Key'i Oluşturan Yetkili/Kişi --> <@${keyData.creatorId}>
🎈 Ad'ı Değiştiren Yetkili --> ${member}
👑 Key Sahibi --> <@${keyData.ownerId}>
📜 Script Adı --> ${scriptNameDisplay}
🧾 Key'in Oluşturulma Sebebi --> ${creationReasonDisplay}
📝 Ad'ın Değiştirilme Sebebi --> \`${changeReason}\`
✨ Script'in Yeni Adı --> \`${newScriptName}\`
🌟 Script'in Eski Adı --> \`${oldScriptName}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Süresi --> ${expiresText}**`)
                                .setColor('Random');

                            await subI.update({ embeds: [detailsEmbed], components: [] });
                        }
                    });

                    // --- 8. LOG KANALINA MESAJ (Sadece Türkçe) ---
                    const logChannel = guild.channels.cache.get(process.env.CHANNEL_ID_LOG_SCRIPT_NAME);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('Bir Key\'in Ad\'ı Değiştirildi')
                            .setDescription(`
**⛓️‍💥 Key --> ||\`${keyData.key}\`||
🆔 Key ID --> \`${keyData.keyId}\`
🪄 Key'i Oluşturan Yetkili/Kişi --> <@${keyData.creatorId}>
🎈 Ad'ı Değiştiren Yetkili --> ${member}
👑 Key Sahibi --> <@${keyData.ownerId}>
📜 Script Adı --> ${scriptNameDisplay}
🧾 Key'in Oluşturulma Sebebi --> ${creationReasonDisplay}
📝 Ad'ın Değiştirilme Sebebi --> \`${changeReason}\`
✨ Script'in Yeni Adı --> \`${newScriptName}\`
🌟 Script'in Eski Adı --> \`${oldScriptName}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Süresi --> ${expiresText}**`)
                            .setColor('Random');
                        
                        logChannel.send({ embeds: [logEmbed] });
                    }

                    // --- 9. KULLANICIYA DM (DİL KONTROLLÜ) ---
                    let targetMember;
                    try {
                        targetMember = await guild.members.fetch(keyData.ownerId);
                    } catch (e) { targetMember = null; }

                    if (targetMember) {
                        const isEnglish = targetMember.roles.cache.has(process.env.ROLE_ID_ENGLISH);
                        // Ticket Kanalları
                        const ticketChannel = isEnglish ? process.env.CHANNEL_ID_TICKET_EN : process.env.CHANNEL_ID_TICKET_TR;

                        let dmTitle, dmDesc;

                        if (isEnglish) {
                            // İNGİLİZCE MESAJ
                            dmTitle = "One of Your Key's Script Name Has Been Changed";
                            dmDesc = `
**⛓️‍💥 Key --> ||\`${keyData.key}\`||
🆔 Key ID --> \`${keyData.keyId}\`
🪄 Key Creator --> <@${keyData.creatorId}>
🎈 Name Changed By --> ${member}
📜 Script Name --> ${scriptNameDisplay}
🧾 Creation Reason --> ${creationReasonDisplay}
📝 Name Change Reason --> \`${changeReason}\`
✨ New Script Name --> \`${newScriptName}\`
🌟 Old Script Name --> \`${oldScriptName}\`
⏰ Creation Time --> <t:${createdTs}:F>
⏱️ Expiration Time --> ${expiresText}
❗ __IF YOU THINK THERE IS AN ERROR, PLEASE OPEN A TICKET AT <#${ticketChannel}>__**`;
                        } else {
                            // TÜRKÇE MESAJ
                            dmTitle = "Bir Key'inizin Ad'ı Değiştirildi";
                            dmDesc = `
**⛓️‍💥 Key --> ||\`${keyData.key}\`||
🆔 Key ID --> \`${keyData.keyId}\`
🪄 Key'i Oluşturan Yetkili/Kişi --> <@${keyData.creatorId}>
🎈 Ad'ı Değiştiren Yetkili --> ${member}
📜 Script Adı --> ${scriptNameDisplay}
🧾 Key'in Oluşturulma Sebebi --> ${creationReasonDisplay}
📝 Ad'ın Değiştirilme Sebebi --> \`${changeReason}\`
✨ Script'in Yeni Adı --> \`${newScriptName}\`
🌟 Script'in Eski Adı --> \`${oldScriptName}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Süresi --> ${expiresText}
❗ __EĞER BİR HATA OLDUĞUNU DÜŞÜNÜYORSANIZ <#${ticketChannel}> KANALINDAN BİLET OLUŞTURUN__**`;
                        }

                        const dmEmbed = new EmbedBuilder()
                            .setTitle(dmTitle)
                            .setDescription(dmDesc)
                            .setColor('Random');

                        targetMember.send({ embeds: [dmEmbed] }).catch(() => {});
                    }

                } catch (error) {
                    console.error(error);
                    await i.update({ content: '**İşlem sırasında bir hata oluştu.**', embeds: [], components: [] });
                }
            }
        });
    },
};