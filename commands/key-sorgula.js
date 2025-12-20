// commands/key-sorgula.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel');
const SubscriberKey = require('../models/subscriberKeyModel');
const GeneralKey = require('../models/generalKeyModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('key-sorgula')
        .setDescription('Belirtilen Key veya Key ID Hakkında Bilgi Verir.')
        .addStringOption(option => 
            option.setName('anahtar')
                .setDescription('Sorgulanacak Key veya Key ID')
                .setRequired(true)),

    async execute(interaction) {
        const { member } = interaction;

        // --- 1. YETKİ KONTROLÜ ---
        const adminCheck = await Admin.findOne({ userId: member.id });
        if (!adminCheck) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Bu Komutu Kullanmak İçin Bot Yetkilisi Olmalısın!**');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const inputData = interaction.options.getString('anahtar');

        // --- 2. VERİTABANI ARAMASI ---
        // Hem Key stringine hem Key ID'sine bakıyoruz ($or operatörü ile)
        // Önce Abone tablosuna bak
        let keyData = await SubscriberKey.findOne({ 
            $or: [{ key: inputData }, { keyId: inputData }] 
        });
        let keyType = 'abone';

        // Bulamazsa Genel tabloya bak
        if (!keyData) {
            keyData = await GeneralKey.findOne({ 
                $or: [{ key: inputData }, { keyId: inputData }] 
            });
            keyType = 'normal';
        }

        // Hiçbir yerde yoksa
        if (!keyData) {
            const notFoundEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`**Veritabanında \`${inputData}\` verisine ait bir Key bulunamadı!**`);
            return interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
        }

        // --- 3. ONAY MEKANİZMASI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle(`⚠️ ${keyData.keyId} ID'li Key Sorgulanacak`)
            .setDescription(`**${member} \`${keyData.keyId}\` ID'li Key'i Sorgulamak İstiyor Musunuz?
❗ __HERKESE AÇIK BİR KANALDA KULLANIYORSANIZ KOMUTU İPTAL ETMENİZ ÖNERİLİR AKSİ TAKTİRDE KEY BİLGİLERİ GÖZÜKECEKTİR__**`)
            .setColor(Colors.Yellow);

        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_key_search')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_key_search')
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
                return i.reply({ content: '**Bu butonları sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'cancel_key_search') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                await i.update({ embeds: [cancelEmbed], components: [] });
                return;
            }

            if (i.customId === 'confirm_key_search') {
                // --- VERİLERİ HAZIRLA ---
                
                // Oluşturulma Zamanı
                const createdTs = Math.floor(new Date(keyData.createdAt).getTime() / 1000);

                // Bitiş Zamanı
                let expiresText = "`Sınırsız`";
                if (keyData.expiresAt) {
                    const expTs = Math.floor(new Date(keyData.expiresAt).getTime() / 1000);
                    expiresText = `<t:${expTs}:R>`; // veya <t:${expTs}:F>
                } else if (keyData.duration && (keyData.duration === 'SINIRSIZ' || keyData.duration === 'Unlimited')) {
                    expiresText = "`Sınırsız`";
                }

                // Kullanım Durumu
                const usedText = keyData.isUsed ? "`✅ Evet`" : "`❌ Hayır`";

                // Script Adı ve Sebep (Abone Key ise sabit, değilse DB'den)
                let scriptNameDisplay = "";
                let reasonDisplay = "";

                if (keyType === 'abone') {
                    scriptNameDisplay = "`ABONE KEY`";
                    reasonDisplay = "`Abone Key`";
                } else {
                    scriptNameDisplay = `\`${keyData.scriptName}\``;
                    reasonDisplay = `\`${keyData.reason}\``;
                }

                // --- SONUÇ EMBEDİ ---
                const resultEmbed = new EmbedBuilder()
                    .setTitle('Key Bilgileri')
                    .setDescription(`
**⛓️‍💥 Key --> ||\`${keyData.key}\`||
🆔 Key ID --> \`${keyData.keyId}\`
🪄 Key'i Oluşturan Yetkili/Kişi --> <@${keyData.creatorId}>
👑 Key Sahibi --> <@${keyData.ownerId}>
📜 Script Adı --> ${scriptNameDisplay}
🧾 Key'in Oluşturulma Sebebi --> ${reasonDisplay}
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Süresi --> ${expiresText}
👁️ Kullanılmış Mı? --> ${usedText}**`)
                    .setColor('Random');

                await i.update({ embeds: [resultEmbed], components: [] });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setDescription('**Süre dolduğu için işlem iptal edildi.**')
                    .setColor(Colors.Red);
                interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
    },
};