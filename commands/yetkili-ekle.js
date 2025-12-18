// commands/yetkili-ekle.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel'); // Veritabanı modelimiz

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yetkili-ekle')
        .setDescription('Bota yeni bir yönetici ekler (Sadece Kurucu).')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Yetkili yapılacak kişi')
                .setRequired(true)),

    async execute(interaction) {
        // --- 1. GÜVENLİK KONTROLÜ (Sadece Bot Sahibi) ---
        if (interaction.user.id !== process.env.OWNER_ID) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Bu komutu sadece bot sahibi kullanabilir!**');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const targetUser = interaction.options.getUser('kullanıcı');

        // --- 2. BOT KONTROLÜ (YENİ) ---
        if (targetUser.bot) {
            const botErrorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Botlar Üzerinde İşlem Yapamazsınız!**');
            return interaction.reply({ embeds: [botErrorEmbed], ephemeral: true });
        }

        // --- 3. VERİTABANI KONTROLÜ (Zaten ekli mi?) ---
        const existingAdmin = await Admin.findOne({ userId: targetUser.id });
        if (existingAdmin) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`**${targetUser} zaten bot yetkilisi olarak kayıtlı!**`);
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // --- 4. ONAY EMBEDİ VE BUTONLAR ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Yetkili Ekliyorsunuz')
            .setDescription(`**${targetUser} Adlı Kişiyi \`Bot Yetkilisi\` Kategorisine Eklemek İstiyor Musunuz?**`)
            .setColor(Colors.Yellow);

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_admin')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_admin')
            .setLabel('İptal Et')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        // Mesajı gönder
        const response = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            fetchReply: true
        });

        // --- 5. BUTON DİNLEYİCİSİ (COLLECTOR) ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 // 60 saniye süre
        });

        collector.on('collect', async i => {
            // Başkası basarsa engelle
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonları sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'confirm_admin') {
                // VERİTABANINA KAYIT
                try {
                    await Admin.create({ userId: targetUser.id });

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Başarılı')
                        .setDescription(`**${targetUser} Adlı Kişi \`Bot Yetkilisi\` Kategorisine Eklendi**`)
                        .setColor(Colors.Green);

                    // Mesajı güncelle, butonları kaldır
                    await i.update({ embeds: [successEmbed], components: [] });
                } catch (error) {
                    console.error(error);
                    await i.update({ content: '**Veritabanına eklenirken bir hata oluştu.**', embeds: [], components: [] });
                }
            } else if (i.customId === 'cancel_admin') {
                // İPTAL EDİLDİ
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
        });

        collector.on('end', collected => {
            // Süre dolarsa ve butonlara basılmamışsa butonları devre dışı bırak
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setDescription('**Süre dolduğu için işlem iptal edildi.**')
                    .setColor(Colors.Red);
                interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
    },
};