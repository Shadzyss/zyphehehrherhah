// commands/ping.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
// Artık config.js'ye ihtiyacımız yok, silebilirsin.

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botun Gecikme Süresini Gösterir')
        .setDescriptionLocalizations({
            'en-US': 'Shows the bot latency.',
            'tr': 'Botun Gecikme Süresini Gösterir'
        }),

    async execute(interaction) {
        // Kullanıcının rollerini al
        const memberRoles = interaction.member.roles.cache;
        
        // Botun anlık ping (gecikme) değeri
        const pingTime = interaction.client.ws.ping;

        let titleText = "";
        let descriptionText = "";

        // KONTROL: Kullanıcıda İngilizce rolü var mı?
        // process.env.ROLE_ID_ENGLISH değişkenini kullanıyoruz
        if (memberRoles.has(process.env.ROLE_ID_ENGLISH)) {
            titleText = "Bot Latency";
            descriptionText = `**Bot Latency is \`${pingTime}\`ms**`;
        } 
        // Kullanıcıda Türkçe rolü varsa veya hiçbir dil rolü yoksa Türkçe yanıt ver
        else {
            titleText = "Bot Gecikmesi";
            descriptionText = `**Botun Gecikme Süresi \`${pingTime}\`ms**`;
        }

        // Embed oluşturma
        const embed = new EmbedBuilder()
            .setTitle(titleText)
            .setDescription(descriptionText)
            .setColor('Random'); // Rastgele renk

        await interaction.reply({ embeds: [embed] });
    },
};