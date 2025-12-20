const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const AboneStaff = require('../models/aboneStaffModel'); // Model dosya yolun (Görsele göre)

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abone-top')
        .setDescription('En Çok Abone Veren Yetkililer Listeler'),

    async execute(interaction) {
        // --- 1. DİL KONTROLÜ ---
        let lang = 'tr'; 
        const trRoleId = process.env.ROLE_ID_TURKISH;
        const enRoleId = process.env.ROLE_ID_ENGLISH;

        // İngilizce rolü varsa ve Türkçe yoksa (veya öncelik EN ise)
        if (interaction.member.roles.cache.has(enRoleId) && !interaction.member.roles.cache.has(trRoleId)) {
            lang = 'en';
        }

        // --- 2. METİNLER ---
        const texts = {
            tr: {
                title: "En Çok Abone Veren Yetkililer",
                empty: "❌ Henüz veritabanında hiç yetkili verisi yok."
            },
            en: {
                title: "Top Subscriber Staff",
                empty: "❌ No staff data found in the database yet."
            }
        };
        const t = texts[lang];

        // --- 3. VERİTABANINDAN ÇEKME VE SIRALAMA ---
        // .sort({ count: -1 }) -> Abone sayısına (count) göre ÇOKTAN aza sıralar.
        // .limit(20) -> Listeyi 20 kişiyle sınırlar (Embed karakter sınırı taşmasın diye).
        const topUsers = await AboneStaff.find({}).sort({ count: -1 }).limit(20);

        // Eğer veri yoksa
        if (!topUsers || topUsers.length === 0) {
            return interaction.reply({ content: t.empty, ephemeral: true });
        }

        // --- 4. LİSTE FORMATINI OLUŞTURMA ---
        // Veriyi döngüye sokup istediğin formata çeviriyoruz:
        // 1-) @yetkili --> `sayı`
        const description = topUsers.map((user, index) => {
            return `**${index + 1}-) <@${user.userId}> --> \`${user.count}\`**`;
        }).join('\n');

        // --- 5. EMBED GÖNDERME ---
        const embed = new EmbedBuilder()
            .setTitle(t.title)
            .setDescription(description)
            .setColor('Gold') // Liderlik tablosu olduğu için Altın rengi yakışır
            .setTimestamp()
            .setFooter({ text: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};