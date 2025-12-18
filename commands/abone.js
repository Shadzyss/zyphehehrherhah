// commands/abone.js
const { SlashCommandBuilder, EmbedBuilder, Colors } = require('discord.js');
const AboneStaff = require('../models/aboneStaffModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abone')
        .setDescription('Kullanıcıya abone rolü verir veya alır.')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('İşlem yapılacak kullanıcı')
                .setRequired(true)),

    async execute(interaction) {
        const { guild, member, options } = interaction;

        // Dil Kontrolü (İngilizce rolü var mı?)
        const isEnglish = member.roles.cache.has(process.env.ROLE_ID_ENGLISH);
        const staffRoleId = process.env.ROLE_ID_ABONE_STAFF;

        // --- 1. YETKİ KONTROLÜ ---
        if (!member.roles.cache.has(staffRoleId)) {
            const errorText = isEnglish
                ? `**You Must Have the <@&${staffRoleId}> Role to Use This Command**`
                : `**Bu Komutu Kullanmak İçin <@&${staffRoleId}> Adlı Role Sahip Olmalısın**`;

            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(errorText);
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const targetUser = options.getUser('kullanıcı');

        // --- 2. BOT KONTROLÜ (YENİ EKLENEN KISIM) ---
        if (targetUser.bot) {
            const botErrorText = isEnglish
                ? '**You Cannot Perform Operations on Bots!**'
                : '**Botlar Üzerinde İşlem Yapamazsınız!**';

            const botErrorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(botErrorText);
            
            return interaction.reply({ embeds: [botErrorEmbed], ephemeral: true });
        }

        // --- İŞLEMLER DEVAM EDİYOR ---
        const targetMember = await guild.members.fetch(targetUser.id);
        const aboneRoleId = process.env.ROLE_ID_ABONE;
        const logChannelId = process.env.CHANNEL_ID_LOG_ABONE;

        // Hedef kişide rol var mı?
        const hasRole = targetMember.roles.cache.has(aboneRoleId);

        // Log Kanalını Bul
        let logChannel;
        try {
            logChannel = await guild.channels.fetch(logChannelId);
        } catch (error) {
            console.log("Log kanalı bulunamadı.");
        }

        if (hasRole) {
            // ====================================================
            // --- DURUM A: ROL VARSA (ALMA İŞLEMİ) ---
            // ====================================================
            await targetMember.roles.remove(aboneRoleId);

            // 1. Kullanıcıya Cevap Ver (Yeşil Embed - Çift Dil)
            const title = isEnglish ? "✅ Success" : "✅ Başarılı";
            const description = isEnglish 
                ? `**Successfully removed the <@&${aboneRoleId}> role from ${targetUser}**`
                : `**${targetUser} Adlı Kişiden Başarıyla <@&${aboneRoleId}> Adlı Rol Alındı**`;

            const successEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(Colors.Green);

            await interaction.reply({ embeds: [successEmbed] });

            // 2. LOG KANALINA MESAJ GÖNDER (Sadece Türkçe - Kırmızı)
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📤 Abone Rol Alındı')
                    .setDescription(`**🪄 Abone Rolünü Alan Yetkili --> ${member}\n✨ Abone Rolünün Alındığı Kişi --> ${targetUser}**`)
                    .setColor(Colors.Red);
                
                logChannel.send({ embeds: [logEmbed] }).catch(e => console.error("Log atılamadı:", e));
            }

        } else {
            // ====================================================
            // --- DURUM B: ROL YOKSA (VERME İŞLEMİ) ---
            // ====================================================
            await targetMember.roles.add(aboneRoleId);

            // Veritabanı Güncelleme
            let staffData = await AboneStaff.findOne({ userId: member.id });
            if (!staffData) {
                staffData = new AboneStaff({ userId: member.id, count: 1 });
            } else {
                staffData.count += 1;
            }
            await staffData.save();

            // 1. Kullanıcıya Cevap Ver (Yeşil Embed - Çift Dil)
            const title = isEnglish ? "✅ Success" : "✅ Başarılı";
            const description = isEnglish 
                ? `**Successfully gave the <@&${aboneRoleId}> role to ${targetUser}**`
                : `**${targetUser} Adlı Kişiye Başarıyla <@&${aboneRoleId}> Adlı Rol Verildi**`;

            const successEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(Colors.Green);

            await interaction.reply({ embeds: [successEmbed] });

            // 2. LOG KANALINA MESAJ GÖNDER (Sadece Türkçe - Yeşil)
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📥 Abone Rol Verildi')
                    .setDescription(`
**🪄 Abone Rolünü Veren Yetkili --> ${member}
✨ Abone Rolünün Verildiği Kişi --> ${targetUser}
🧾 Yetkilinin Toplam Abone Sayısı --> \`${staffData.count}\`**`)
                    .setColor(Colors.Green);
                
                logChannel.send({ embeds: [logEmbed] }).catch(e => console.error("Log atılamadı:", e));
            }
        }
    },
};