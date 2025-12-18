// commands/yetkililer.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Admin = require('../models/adminModel'); // Yetkili veritabanını çağırıyoruz

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yetkililer')
        .setDescription('Bot Yetkillerini Listeler')
        .setDescriptionLocalizations({
            'en-US': 'Lists the bot staff.',
            'tr': 'Bot Yetkililerini Listeler'
        }),

    async execute(interaction) {
        // --- 1. DİL KONTROLÜ ---
        // Kullanıcıda İngilizce rolü var mı kontrol ediyoruz
        const isEnglish = interaction.member.roles.cache.has(process.env.ROLE_ID_ENGLISH);

        // --- 2. VERİTABANINDAN ÇEKME ---
        // Tüm yetkilileri veritabanından al
        const admins = await Admin.find({});

        // Eğer hiç yetkili yoksa
        if (admins.length === 0) {
            const emptyMessage = isEnglish 
                ? "**No staff members found in the database.**" 
                : "**Veritabanında kayıtlı yetkili bulunamadı.**";
            
            return interaction.reply({ content: emptyMessage, ephemeral: true });
        }

        // --- 3. LİSTEYİ OLUŞTURMA ---
        // Veritabanından gelen veriyi döngüye sokup listeliyoruz
        // Örnek çıktı: 1-) @Kullanıcı
        const adminList = admins.map((admin, index) => {
            return `**${index + 1}-)** <@${admin.userId}>`;
        }).join('\n'); // Her satırın sonuna alt satıra geçme işareti koyar

        // --- 4. EMBED OLUŞTURMA ---
        const titleText = isEnglish ? "Bot Staff" : "Bot Yetkilileri";

        const embed = new EmbedBuilder()
            .setTitle(titleText)
            .setDescription(adminList)
            .setColor('Random'); // Rastgele renk

        await interaction.reply({ embeds: [embed] });
    },
};