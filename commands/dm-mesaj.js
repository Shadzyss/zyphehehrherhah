// commands/dm-mesaj.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const translate = require('@iamtraction/google-translate'); // Çeviri modülü

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm-mesaj')
        .setDescription('Belirtilen kullanıcıya bot üzerinden DM atar (Sadece Kurucu).')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Mesajın gönderileceği kişi')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mesaj')
                .setDescription('Gönderilecek mesaj (Türkçe yazabilirsin)')
                .setRequired(true)),

    async execute(interaction) {
        const { member, guild, options } = interaction;

        // --- 1. GÜVENLİK KONTROLÜ (Sadece Bot Sahibi) ---
        if (interaction.user.id !== process.env.OWNER_ID) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Bu komutu sadece bot sahibi kullanabilir!**');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const targetUser = options.getUser('kullanıcı');
        const originalMessage = options.getString('mesaj');

        // --- 2. BOT KONTROLÜ (YENİ EKLENEN KISIM) ---
        if (targetUser.bot) {
            const botErrorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Botlara mesaj gönderemezsiniz!**');
            return interaction.reply({ embeds: [botErrorEmbed], ephemeral: true });
        }

        // --- 3. DİL VE ÇEVİRİ İŞLEMLERİ ---
        // Bekletme mesajı (Çeviri sürerse diye)
        await interaction.deferReply();

        let targetMember;
        try {
            targetMember = await guild.members.fetch(targetUser.id);
        } catch (e) {
            targetMember = null;
        }

        // Hedefte İngilizce rolü var mı?
        const isTargetEnglish = targetMember ? targetMember.roles.cache.has(process.env.ROLE_ID_ENGLISH) : false;

        let finalMessage = originalMessage; // Varsayılan olarak orijinal mesaj
        let dmTitle = `${interaction.user.username} Adlı Kişiden Bir Mesaj Aldınız`;

        // EĞER KULLANICI İNGİLİZCE ROLÜNE SAHİPSE ÇEVİR
        if (isTargetEnglish) {
            dmTitle = `You Received a Message from ${interaction.user.username}`;
            try {
                // Türkçeden (tr) İngilizceye (en) çevir
                const translated = await translate(originalMessage, { from: 'tr', to: 'en' });
                finalMessage = translated.text; 
            } catch (err) {
                console.error("Çeviri hatası:", err);
                // Çeviri yapılamazsa orijinalini yolla ama uyar
                finalMessage = originalMessage;
            }
        }

        const dmEmbed = new EmbedBuilder()
            .setTitle(dmTitle)
            .setDescription(`**- ${finalMessage}**`)
            .setColor('Random');

        // --- 4. DM GÖNDERME ---
        try {
            await targetUser.send({ embeds: [dmEmbed] });
        } catch (error) {
            console.error(error);
            const failEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(`**${targetUser} kullanıcısının DM kutusu kapalı, mesaj gönderilemedi!**`);
            return interaction.editReply({ embeds: [failEmbed] });
        }

        // --- 5. KANAL YANITI (BUTONLU - SADECE TÜRKÇE) ---
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Başarılı')
            .setDescription(`**${member} Başarıyla ${targetUser} Adlı Kişiye Mesaj Gönderildi Mesaj İçeriğini Görmek İçin 💬 Butonuna Basın**`)
            .setColor(Colors.Green);

        const showButton = new ButtonBuilder()
            .setCustomId('show_dm_content')
            .setLabel('Göster') 
            .setEmoji('💬')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(showButton);

        // Defer kullandığımız için editReply kullanıyoruz
        const response = await interaction.editReply({
            embeds: [successEmbed],
            components: [row]
        });

        // --- 6. BUTON DİNLEYİCİSİ ---
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonu sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'show_dm_content') {
                const contentEmbed = new EmbedBuilder()
                    .setTitle('Mesaj İçeriği')
                    .setDescription(`
**Mesaj Başlığı:** \`${interaction.user.username} Adlı Kişiden Bir Mesaj Aldınız\`
**Mesaj İçeriği:**
**- ${finalMessage}**
${isTargetEnglish ? `\n**❗ Not: Kullanıcı İngiliz olduğu için mesajın çevrildi.**` : ``}`)
                    .setColor('Random');
                
                await i.reply({ embeds: [contentEmbed], ephemeral: true });
            }
        });
    },
};