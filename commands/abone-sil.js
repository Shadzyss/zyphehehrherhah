// commands/abone-sil.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const AboneStaff = require('../models/aboneStaffModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abone-sil')
        .setDescription('Bir yetkiliden manuel olarak abone sayısı siler (Sadece Kurucu).')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Sayı silinecek yetkili')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('sayı')
                .setDescription('Silinecek miktar')
                .setRequired(true)),

    async execute(interaction) {
        const { member } = interaction; // Rol kontrolü için member'ı alıyoruz

        // --- 1. GÜVENLİK KONTROLÜ (Sadece Bot Sahibi) ---
        if (interaction.user.id !== process.env.OWNER_ID) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Bu komutu sadece bot sahibi kullanabilir!**');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const targetUser = interaction.options.getUser('kullanıcı');
        const amount = interaction.options.getInteger('sayı');

        // --- 2. BOT KONTROLÜ (YENİ EKLENEN KISIM) ---
        if (targetUser.bot) {
            // Dil Kontrolü
            const isEnglish = member.roles.cache.has(process.env.ROLE_ID_ENGLISH);

            const botErrorText = isEnglish
                ? '**You Cannot Perform Operations on Bots!**'
                : '**Botlar Üzerinde İşlem Yapamazsınız!**';

            const botErrorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(botErrorText);
            
            return interaction.reply({ embeds: [botErrorEmbed], ephemeral: true });
        }

        // --- 3. VERİTABANI ÖN KONTROLÜ ---
        // Kişinin verisi var mı diye baştan bakalım, yoksa silinecek bir şey de yoktur.
        const checkData = await AboneStaff.findOne({ userId: targetUser.id });
        if (!checkData) {
            const noDataEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`**${targetUser} kullanıcısının veritabanında hiç kaydı bulunmuyor!**`);
            return interaction.reply({ embeds: [noDataEmbed], ephemeral: true });
        }

        // --- 4. ONAY EMBEDİ VE BUTONLAR ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Abone Sayı Siliniyor')
            .setDescription(`**${targetUser} Adlı Kişiden \`${amount}\` Tane Abone Sayısı Silmek İstediğine Emin Misin?**`)
            .setColor(Colors.Yellow);

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_remove_stats')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_remove_stats')
            .setLabel('İptal Et')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

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

            if (i.customId === 'confirm_remove_stats') {
                try {
                    // --- VERİTABANI İŞLEMİ ---
                    let staffData = await AboneStaff.findOne({ userId: targetUser.id });
                    
                    if (staffData) {
                        staffData.count -= amount;
                        // Sayının eksiye düşmesini istemiyorsan aşağıdaki satırı aktif edebilirsin:
                        // if (staffData.count < 0) staffData.count = 0; 
                        
                        await staffData.save();

                        // Başarılı Mesajı
                        const successEmbed = new EmbedBuilder()
                            .setTitle('✅ Başarılı')
                            .setDescription(`**${targetUser} Adlı Kişiden Başarıyla \`${amount}\` Kadar Abone Sayı Silindi Yetkilinin Toplam Abone Sayısı \`${staffData.count}\` Olarak Güncellendi**`)
                            .setColor(Colors.Green);

                        await i.update({ embeds: [successEmbed], components: [] });
                    } else {
                        // Olası bir hata durumunda
                         await i.update({ content: '**Kullanıcı verisi bulunamadı.**', embeds: [], components: [] });
                    }

                } catch (error) {
                    console.error(error);
                    await i.update({ content: '**Veritabanı hatası oluştu.**', embeds: [], components: [] });
                }

            } else if (i.customId === 'cancel_remove_stats') {
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