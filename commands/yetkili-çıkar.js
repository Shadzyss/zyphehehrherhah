// commands/yetkili-cikar.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel'); // Veritabanı modelimiz

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yetkili-çıkar')
        .setDescription('Mevcut bir bot yetkilisini çıkarır (Sadece Kurucu).')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Yetkisi alınacak kişi')
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

        // --- 3. VERİTABANI KONTROLÜ (Bu kişi zaten yetkili değilse?) ---
        const existingAdmin = await Admin.findOne({ userId: targetUser.id });
        if (!existingAdmin) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`**${targetUser} zaten bot yetkilisi değil!**`);
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // --- 4. ONAY EMBEDİ VE BUTONLAR ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Yetkili Çıkarıyorsunuz')
            .setDescription(`**${targetUser} Adlı Kişiyi \`Bot Yetkilisi\` Kategorisinden Çıkarmak İstiyor Musunuz?**`)
            .setColor(Colors.Yellow); 

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_remove')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_remove')
            .setLabel('İptal Et')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        // Mesajı gönder
        const response = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            fetchReply: true
        });

        // --- 5. BUTON DİNLEYİCİSİ ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonları sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'confirm_remove') {
                // SİLME İŞLEMİ
                try {
                    // Veritabanından siliyoruz
                    await Admin.deleteOne({ userId: targetUser.id });

                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Başarılı')
                        .setDescription(`**${targetUser} Adlı Kişi \`Bot Yetkilisi\` Kategorisinden Çıkarıldı**`)
                        .setColor(Colors.Green);

                    await i.update({ embeds: [successEmbed], components: [] });
                } catch (error) {
                    console.error(error);
                    await i.update({ content: '**Silme işlemi sırasında bir hata oluştu.**', embeds: [], components: [] });
                }
            } else if (i.customId === 'cancel_remove') {
                // İPTAL EDİLDİ
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                
                await i.update({ embeds: [cancelEmbed], components: [] });
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