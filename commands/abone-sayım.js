// commands/abone-sayim.js
const { SlashCommandBuilder, EmbedBuilder, Colors } = require('discord.js');
const AboneStaff = require('../models/aboneStaffModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abone-sayım')
        .setDescription('Toplam Abone Sayınızı Gösterir')
        .setDescriptionLocalizations({
            'en-US': 'Shows your total subscriber grant count.',
            'tr': 'Toplam abone verme sayınızı gösterir.'
        }),

    async execute(interaction) {
        const { member } = interaction;
        const staffRoleId = process.env.ROLE_ID_ABONE_STAFF;
        
        // Dil Kontrolü
        const isEnglish = member.roles.cache.has(process.env.ROLE_ID_ENGLISH);

        // --- 1. YETKİ KONTROLÜ ---
        if (!member.roles.cache.has(staffRoleId)) {
            // Hata mesajı (İngilizce / Türkçe)
            const errorText = isEnglish
                ? `**You Must Have the <@&${staffRoleId}> Role to Use This Command**`
                : `**Bu Komutu Kullanmak İçin <@&${staffRoleId}> Adlı Role Sahip Olmalısın**`;

            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(errorText);
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // --- 2. VERİTABANINDAN VERİ ÇEKME ---
        const staffData = await AboneStaff.findOne({ userId: member.id });
        
        // Eğer veritabanında kaydı yoksa (hiç abone vermemişse) sayı 0 olsun
        const count = staffData ? staffData.count : 0;

        // --- 3. CEVAP EMBEDİ OLUŞTURMA ---
        const title = isEnglish ? "Your Subscriber Stats" : "Abone Sayın";
        
        // İstenilen format: ✨ Toplam Abone Sayın --> `abone sayısı`
        const description = isEnglish
            ? `**✨ Total Subscriber Count --> \`${count}\`**`
            : `**✨ Toplam Abone Sayın --> \`${count}\`**`;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor('Random'); // Rastgele Renk

        await interaction.reply({ embeds: [embed] });
    },
};