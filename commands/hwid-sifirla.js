// commands/hwid-sifirla.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel');
const SubscriberKey = require('../models/subscriberKeyModel');
const GeneralKey = require('../models/generalKeyModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hwid-sıfırla')
        .setDescription('Belirlenen Keyin HWIDini Sıfırlar.')
        .addStringOption(option => 
            option.setName('anahtar')
                .setDescription('HWID sıfırlanacak Key veya Key ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Sıfırlama sebebi')
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
        const resetReason = options.getString('sebep'); // Sıfırlama sebebi

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
            .setTitle('⚠️ HWID Sıfırlama')
            .setDescription(`**${member} \`${keyData.keyId}\` ID'li Key'in HWID'ini Sıfırlamak İstiyor Musunuz?**`)
            .setColor(Colors.Yellow);

        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_hwid')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_hwid')
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

            if (i.customId === 'cancel_hwid') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                await i.update({ embeds: [cancelEmbed], components: [] });
                return;
            }

            if (i.customId === 'confirm_hwid') {
                try {
                    // --- HWID SIFIRLAMA ---
                    keyData.hwid = null;
                    keyData.isUsed = false;
                    await keyData.save();

                    // --- 5. BİLGİ HAZIRLIĞI ---
                    const createdTs = Math.floor(new Date(keyData.createdAt).getTime() / 1000);
                    
                    let expiresText = "`Sınırsız`";
                    if (keyData.expiresAt) {
                        expiresText = `<t:${Math.floor(new Date(keyData.expiresAt).getTime() / 1000)}:R>`;
                    } else if (keyData.duration && (keyData.duration === 'SINIRSIZ' || keyData.duration === 'Unlimited')) {
                        expiresText = "`Sınırsız`";
                    }

                    // Script Adı ve Oluşturulma Sebebi
                    let scriptNameDisplay = "";
                    let creationReasonDisplay = ""; // Key'in oluşturulma sebebi

                    if (keyType === 'abone') {
                        scriptNameDisplay = "`ABONE KEY`";
                        creationReasonDisplay = "`Abone Key`";
                    } else {
                        scriptNameDisplay = `\`${keyData.scriptName}\``;
                        creationReasonDisplay = `\`${keyData.reason}\``;
                    }

                    // --- 6. BAŞARILI MESAJI (GİZLİ İÇERİK İÇİN BUTONLU) ---
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ HWID Sıfırlandı')
                        .setDescription(`**${member} Başarıyla \`${keyData.keyId}\` ID'li Key'in HWID'i Sıfırlandı Key Tekrar Başkası Tarafından Kullanılabilir. HWID'i Sıfırlanan Key'in Bilgilerini Görmek İçin Aşağıdaki ⛓️‍💥 Butonuna Basın.
❗ __EĞER HERKESE AÇIK BİR KANALDA İSENİZ BUTONA BASMANIZ ÖNERİLMEZ AKSİ TAKTİRDE KEY BİLGİLERİNİ HERKES GÖREBİLİR VE KEY ÇALINABİLİR__**`)
                        .setColor(Colors.Green);

                    const revealButton = new ButtonBuilder()
                        .setCustomId('reveal_hwid_details')
                        .setLabel('Göster')
                        .setEmoji('⛓️‍💥')
                        .setStyle(ButtonStyle.Secondary);

                    const revealRow = new ActionRowBuilder().addComponents(revealButton);

                    // Mesajı güncelle
                    const updatedMsg = await i.update({ embeds: [successEmbed], components: [revealRow], fetchReply: true });

                    // --- 7. İKİNCİ COLLECTOR (GİZLİ BİLGİYİ GÖSTERMEK İÇİN) ---
                    const revealCollector = updatedMsg.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 60000
                    });

                    revealCollector.on('collect', async subI => {
                        if (subI.user.id !== interaction.user.id) {
                            return subI.reply({ content: '**Bu butonu sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
                        }

                        if (subI.customId === 'reveal_hwid_details') {
                            const detailsEmbed = new EmbedBuilder()
                                .setTitle('HWID\'i Sıfırlanan Key Bilgileri')
                                .setDescription(`
**⛓️‍💥 Key --> ||\`${keyData.key}\`||
🆔 Key ID --> \`${keyData.keyId}\`
🪄 Key'i Oluşturan Yetkili/Kişi --> <@${keyData.creatorId}>
🎈 HWID'i Sıfırlayan Yetkili --> ${member}
👑 Key Sahibi --> <@${keyData.ownerId}>
📜 Script Adı --> ${scriptNameDisplay}
🧾 Key'in Oluşturulma Sebebi --> ${creationReasonDisplay}
📝 HWID'in Sıfırlanma Sebebi --> \`${resetReason}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Süresi --> ${expiresText}**`)
                                .setColor('Random');

                            await subI.update({ embeds: [detailsEmbed], components: [] });
                        }
                    });

                    // --- 8. LOG KANALINA MESAJ (Sadece Türkçe) ---
                    const logChannel = guild.channels.cache.get(process.env.CHANNEL_ID_LOG_HWID);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('Bir Key\'in HWID\'i Sıfırlandı')
                            .setDescription(`
**⛓️‍💥 Key --> ||\`${keyData.key}\`||
🆔 Key ID --> \`${keyData.keyId}\`
🪄 Key'i Oluşturan Yetkili/Kişi --> <@${keyData.creatorId}>
🎈 HWID'i Sıfırlayan Yetkili --> ${member}
👑 Key Sahibi --> <@${keyData.ownerId}>
📜 Script Adı --> ${scriptNameDisplay}
🧾 Key'in Oluşturulma Sebebi --> ${creationReasonDisplay}
📝 HWID'in Sıfırlanma Sebebi --> \`${resetReason}\`
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
                        const ticketChannel = isEnglish ? process.env.CHANNEL_ID_TICKET_EN : process.env.CHANNEL_ID_TICKET_TR;

                        let dmTitle, dmDesc;

                        if (isEnglish) {
                            // İNGİLİZCE MESAJ
                            dmTitle = "One of Your Key's HWID Has Been Reset";
                            dmDesc = `
**⛓️‍💥 Key --> ||\`${keyData.key}\`||
🆔 Key ID --> \`${keyData.keyId}\`
🪄 Key Creator --> <@${keyData.creatorId}>
🎈 HWID Reset By --> ${member}
📜 Script Name --> ${scriptNameDisplay}
🧾 Creation Reason --> ${creationReasonDisplay}
📝 HWID Reset Reason --> \`${resetReason}\`
⏰ Creation Time --> <t:${createdTs}:F>
⏱️ Expiration Time --> ${expiresText}
❗ __IF YOU THINK THERE IS AN ERROR, PLEASE OPEN A TICKET AT <#${ticketChannel}>__**`;
                        } else {
                            // TÜRKÇE MESAJ
                            dmTitle = "Bir Key'inizin HWID'i Sıfırlandı";
                            dmDesc = `
**⛓️‍💥 Key --> ||\`${keyData.key}\`||
🆔 Key ID --> \`${keyData.keyId}\`
🪄 Key'i Oluşturan Yetkili/Kişi --> <@${keyData.creatorId}>
🎈 HWID'i Sıfırlayan Yetkili --> ${member}
📜 Script Adı --> ${scriptNameDisplay}
🧾 Key'in Oluşturulma Sebebi --> ${creationReasonDisplay}
📝 HWID'in Sıfırlanma Sebebi --> \`${resetReason}\`
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