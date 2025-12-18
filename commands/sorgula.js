// commands/sorgula.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel');
const SubscriberKey = require('../models/subscriberKeyModel');
const GeneralKey = require('../models/generalKeyModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sorgula')
        .setDescription('Bir kullanıcının sahip olduğu keyleri listeler (Sadece Bot Yetkilileri).')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Sorgulanacak kullanıcı veya ID')
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

        const targetUser = interaction.options.getUser('kullanıcı');

        // --- 2. BOT KONTROLÜ ---
        if (targetUser.bot) {
            const botErrorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Botları Sorgulayamazsınız!**');
            return interaction.reply({ embeds: [botErrorEmbed], ephemeral: true });
        }

        // --- 3. ONAY MEKANİZMASI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Emin Misiniz?')
            .setDescription(`**${member}, ${targetUser} Adlı Kişiyi Sorgulamak İstiyor Musunuz?
❗ __EĞER HERKESE AÇIK BİR KANALDA İSENİZ KOMUTU İPTAL EDİNİZ AKSİ TAKTİRDE KULLANICININ ÜSTÜNE KAYITLI OLAN KEYLER LİSTELENECEKTİR__**`)
            .setColor(Colors.Yellow);

        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_query')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_query')
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
            time: 120000 
        });

        // Sayfalama değişkenleri
        let activeKeys = [];
        let currentPage = 0;
        const itemsPerPage = 3;

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonları sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            // --- İPTAL ---
            if (i.customId === 'cancel_query') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                await i.update({ embeds: [cancelEmbed], components: [] });
                collector.stop();
                return;
            }

            // --- ONAY VE SAYFALAMA ---
            if (i.customId === 'confirm_query' || ['btn_first', 'btn_prev', 'btn_next', 'btn_last'].includes(i.customId)) {
                
                // Verileri çek (Sadece ilk onayda)
                if (i.customId === 'confirm_query') {
                    const subKeys = await SubscriberKey.find({ ownerId: targetUser.id });
                    const genKeys = await GeneralKey.find({ ownerId: targetUser.id });
                    
                    // İki listeyi birleştir
                    activeKeys = [...subKeys, ...genKeys];

                    if (activeKeys.length === 0) {
                        return i.update({ content: `**${targetUser} kullanıcısına ait kayıtlı key bulunamadı.**`, embeds: [], components: [] });
                    }
                }

                // Sayfa hesaplamaları
                const totalPages = Math.ceil(activeKeys.length / itemsPerPage);

                if (i.customId === 'btn_prev' && currentPage > 0) currentPage--;
                if (i.customId === 'btn_next' && currentPage < totalPages - 1) currentPage++;
                if (i.customId === 'btn_first') currentPage = 0;
                if (i.customId === 'btn_last') currentPage = totalPages - 1;

                // --- GÖRÜNTÜLENECEK VERİLER ---
                const start = currentPage * itemsPerPage;
                const end = start + itemsPerPage;
                const currentData = activeKeys.slice(start, end);

                let descriptionText = "";

                currentData.forEach(data => {
                    const createdTs = Math.floor(new Date(data.createdAt).getTime() / 1000);
                    
                    // Bitiş Zamanı
                    let expiresText = "`Sınırsız`";
                    if (data.expiresAt) {
                         expiresText = `<t:${Math.floor(new Date(data.expiresAt).getTime() / 1000)}:R>`;
                    } else if (data.duration && (data.duration === 'SINIRSIZ' || data.duration === 'Unlimited')) {
                        expiresText = "`Sınırsız`";
                    }

                    // Kullanım Durumu
                    const usedText = data.isUsed ? "`✅ Evet`" : "`❌ Hayır`";

                    // Script Adı ve Sebep
                    let scriptNameDisplay = data.scriptName;
                    let reasonDisplay = data.reason;

                    descriptionText += `
**⛓️‍💥 Key --> ||\`${data.key}\`||
🆔 Key ID --> \`${data.keyId}\`
🪄 Keyi Oluşturan Yetkili/Kişi --> <@${data.creatorId}>
📜 Script Adı --> \`${scriptNameDisplay}\`
🧾 Key'in Oluşturulma Sebebi --> \`${reasonDisplay}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Zamanı --> ${expiresText}
👁️ Key Kullanılmış Mı? --> ${usedText}**
--------------------------------------------------`; 
                });

                const listEmbed = new EmbedBuilder()
                    .setTitle(`${targetUser.username} Adlı Kişinin Sahip Olduğu Keyler`)
                    .setDescription(descriptionText)
                    .setColor('Random')
                    .setFooter({ text: `Sayfa --> ${currentPage + 1}/${totalPages}` });

                // --- BUTONLAR ---
                const firstBtn = new ButtonBuilder()
                    .setCustomId('btn_first')
                    .setLabel('İlk Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0);

                const prevBtn = new ButtonBuilder()
                    .setCustomId('btn_prev')
                    .setLabel('Önceki Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0);

                const nextBtn = new ButtonBuilder()
                    .setCustomId('btn_next')
                    .setLabel('Sonraki Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1);

                const lastBtn = new ButtonBuilder()
                    .setCustomId('btn_last')
                    .setLabel('Son Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1);

                const navRow = new ActionRowBuilder().addComponents(firstBtn, prevBtn, nextBtn, lastBtn);

                // Sayfa sayısı 1 ise butonları göstermeye gerek yok (veya disabled gösterelim)
                const components = totalPages > 1 ? [navRow] : [];

                await i.update({ embeds: [listEmbed], components: components });
            }
        });
    },
};