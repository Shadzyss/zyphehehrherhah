// commands/mevcut-keyler.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel');
const SubscriberKey = require('../models/subscriberKeyModel');
const GeneralKey = require('../models/generalKeyModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mevcut-keyler')
        .setDescription('Aktif Olan Bütün Keyleri Listeler'),

    async execute(interaction) {
        const { member } = interaction;
        const isEnglish = member.roles.cache.has(process.env.ROLE_ID_ENGLISH);

        // --- 1. YETKİ KONTROLÜ ---
        const adminCheck = await Admin.findOne({ userId: member.id });
        if (!adminCheck) {
            const errorText = isEnglish
                ? `**You Do Not Have Permission to Use This Command!**`
                : `**Bu Komutu Kullanmak İçin Bot Yetkilisi Olmalısın!**`;
            
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(errorText);
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // --- 2. ONAY MEKANİZMASI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Bütün Keyler Listelenecek')
            .setDescription(`**Onayla Butonuna Basarsanız Bütün Aktif Keyler Listelenecektir \n❗ __HERKESE AÇIK BİR KANALDA KULLANIYORSANIZ ÖNERİLMEZ__**`)
            .setColor(Colors.Yellow);

        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_list_keys')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_list_keys')
            .setLabel('İptal Et')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        const response = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            fetchReply: true
        });

        // --- 3. COLLECTOR (ANA DİNLEYİCİ) ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000 // 2 dakika süre verelim, liste uzun olabilir
        });

        // Sayfalama için değişkenler
        let activeKeys = [];
        let currentPage = 0;
        const itemsPerPage = 3;

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonları sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            // --- İPTAL DURUMU ---
            if (i.customId === 'cancel_list_keys') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                await i.update({ embeds: [cancelEmbed], components: [] });
                collector.stop();
                return;
            }

            // --- ONAY VE SAYFALAMA DURUMLARI ---
            if (i.customId === 'confirm_list_keys' || ['btn_first', 'btn_prev', 'btn_next', 'btn_last'].includes(i.customId)) {
                
                // Eğer ilk kez onaylanıyorsa verileri çek
                if (i.customId === 'confirm_list_keys') {
                    // Veritabanından verileri çek
                    const subKeys = await SubscriberKey.find({});
                    const genKeys = await GeneralKey.find({});
                    
                    const now = new Date();

                    // Verileri birleştir ve süresi geçenleri filtrele
                    const allKeys = [...subKeys, ...genKeys].filter(k => {
                        // Eğer expiresAt null ise (sınırsız) veya şu anki zamandan büyükse (geçmemişse) tut
                        if (!k.expiresAt) return true; // Sınırsız
                        return new Date(k.expiresAt) > now;
                    });

                    if (allKeys.length === 0) {
                        return i.update({ content: '**Hiçbir aktif key bulunamadı.**', embeds: [], components: [] });
                    }

                    activeKeys = allKeys;
                }

                // Sayfa yönlendirmeleri
                const totalPages = Math.ceil(activeKeys.length / itemsPerPage);

                if (i.customId === 'btn_prev' && currentPage > 0) currentPage--;
                if (i.customId === 'btn_next' && currentPage < totalPages - 1) currentPage++;
                if (i.customId === 'btn_first') currentPage = 0;
                if (i.customId === 'btn_last') currentPage = totalPages - 1;

                // --- EMBED OLUŞTURMA ---
                // Mevcut sayfanın verilerini al
                const start = currentPage * itemsPerPage;
                const end = start + itemsPerPage;
                const currentData = activeKeys.slice(start, end);

                let descriptionText = "";

                currentData.forEach(data => {
                    const createdTs = Math.floor(new Date(data.createdAt).getTime() / 1000);
                    
                    // Bitiş Zamanı Ayarı
                    let expiresText = "\`Sınırsız\`";
                    if (data.expiresAt) {
                         expiresText = `<t:${Math.floor(new Date(data.expiresAt).getTime() / 1000)}:R>`;
                    } else if (data.duration && (data.duration === 'SINIRSIZ' || data.duration === 'Unlimited')) {
                        expiresText = "\`Sınırsız\`";
                    }

                    // Kullanım Durumu
                    const usedText = data.isUsed ? "\`✅ Evet\`" : "\`❌ Hayır\`";

                    descriptionText += `
**⛓️‍💥 Key --> ||\`${data.key}\`||
🆔 Key ID --> \`${data.keyId}\`
🪄 Key'i Oluşturan Yetkili/Kişi --> <@${data.creatorId}>
👑 Key Sahibi --> <@${data.ownerId}>
🧾 Script Adı --> \`${data.scriptName}\`
📜 Key'in Oluşturulma Sebebi --> \`${data.reason}\`
⏰ Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏱️ Key'in Bitiş Zamanı --> ${expiresText}
👁️ Kullanılmış Mı? --> ${usedText}**
--------------------------------------------------`; 
                });

                const listEmbed = new EmbedBuilder()
                    .setTitle('⛓️‍💥 Aktif Keyler')
                    .setDescription(descriptionText)
                    .setColor(Colors.Green)
                    // BURASI GÜNCELLENDİ: Hem sayfa sayısını hem de toplam key sayısını gösterir
                    .setFooter({ text: `Sayfa --> ${currentPage + 1}/${totalPages} | Toplam Aktif Keyler --> ${activeKeys.length}` });

                // --- BUTONLARI OLUŞTURMA ---
                const firstBtn = new ButtonBuilder()
                    .setCustomId('btn_first')
                    .setLabel('⏪ İlk Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0);

                const prevBtn = new ButtonBuilder()
                    .setCustomId('btn_prev')
                    .setLabel('◀️ Önceki Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0);

                const nextBtn = new ButtonBuilder()
                    .setCustomId('btn_next')
                    .setLabel('▶️ Sonraki Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1);

                const lastBtn = new ButtonBuilder()
                    .setCustomId('btn_last')
                    .setLabel('⏩ Son Sayfa')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1);

                const navRow = new ActionRowBuilder().addComponents(firstBtn, prevBtn, nextBtn, lastBtn);

                // Mesajı güncelle
                await i.update({ embeds: [listEmbed], components: [navRow] });
            }
        });
    },
};