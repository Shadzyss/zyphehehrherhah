// commands/butun-keyleri-sil.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel');
const SubscriberKey = require('../models/subscriberKeyModel');
const GeneralKey = require('../models/generalKeyModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bütün-keyleri-sil')
        .setDescription('Veritabanındaki Bütün Keyleri Siler'),

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

        // --- 2. ONAY MEKANİZMASI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Bütün Keyler Silinecek')
            .setDescription(`**${member} \`ONAYLA\` Butonuna Basarsanız Bütün Keyler Silinecektir**`)
            .setColor(Colors.Yellow);

        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_delete_all')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_delete_all')
            .setLabel('İptal Et')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        const response = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            fetchReply: true
        });

        // --- 3. BUTON DİNLEYİCİSİ ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonları sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'cancel_delete_all') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                
                await i.update({ embeds: [cancelEmbed], components: [] });
                return;
            }

            if (i.customId === 'confirm_delete_all') {
                try {
                    // --- SİLME İŞLEMİ ---
                    // Hem Abone hem Normal keylerin hepsini siliyoruz ({})
                    await SubscriberKey.deleteMany({});
                    await GeneralKey.deleteMany({});

                    // --- BAŞARILI MESAJI ---
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Başarılı')
                        .setDescription(`**${member} Başarıyla Bütün Keyler Silindi**`)
                        .setColor(Colors.Green);

                    await i.update({ embeds: [successEmbed], components: [] });

                } catch (error) {
                    console.error(error);
                    await i.update({ content: '**Silme işlemi sırasında bir hata oluştu.**', embeds: [], components: [] });
                }
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