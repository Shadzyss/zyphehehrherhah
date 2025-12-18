// commands/abone-ekle.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const AboneStaff = require('../models/aboneStaffModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abone-ekle')
        .setDescription('Bir yetkiliye manuel olarak abone sayısı ekler (Sadece Kurucu).')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Sayı eklenecek yetkili')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('sayı')
                .setDescription('Eklenecek miktar')
                .setRequired(true)),

    async execute(interaction) {
        const { member } = interaction; // Role bakmak için member'ı alıyoruz

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

        // --- 3. ONAY EMBEDİ VE BUTONLAR ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Abone Sayı Ekleniyor')
            .setDescription(`**${targetUser} Adlı Kişiye \`${amount}\` Tane Abone Sayısı Eklemek İstediğine Emin Misin?**`)
            .setColor(Colors.Yellow);

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_add_stats')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_add_stats')
            .setLabel('İptal Et')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const response = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            fetchReply: true
        });

        // --- 4. BUTON DİNLEYİCİSİ ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 // 60 saniye
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonları sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'confirm_add_stats') {
                try {
                    // --- VERİTABANI İŞLEMİ ---
                    // Önce mevcut veriyi bul
                    let staffData = await AboneStaff.findOne({ userId: targetUser.id });
                    
                    // Eğer veri yoksa oluştur, varsa üstüne ekle
                    if (!staffData) {
                        staffData = new AboneStaff({ userId: targetUser.id, count: amount });
                    } else {
                        staffData.count += amount;
                    }
                    
                    // Kaydet
                    await staffData.save();

                    // Başarılı Mesajı
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Başarılı')
                        .setDescription(`**${targetUser} Adlı Kişiye Başarıyla \`${amount}\` Kadar Abone Sayı Eklendi Yetkilinin Toplam Abone Sayısı \`${staffData.count}\` Olarak Güncellendi**`)
                        .setColor(Colors.Green);

                    await i.update({ embeds: [successEmbed], components: [] });

                } catch (error) {
                    console.error(error);
                    await i.update({ content: '**Veritabanı hatası oluştu.**', embeds: [], components: [] });
                }

            } else if (i.customId === 'cancel_add_stats') {
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