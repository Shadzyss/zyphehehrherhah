// commands/key-sil.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
const Admin = require('../models/adminModel');
const SubscriberKey = require('../models/subscriberKeyModel');
const GeneralKey = require('../models/generalKeyModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('key-sil')
        .setDescription('Belirtilen kullanıcıya ait bir keyi siler (Sadece Bot Yetkilileri).')
        .addUserOption(option => option.setName('kullanıcı').setDescription('Key sahibi').setRequired(true))
        .addStringOption(option => option.setName('keyid').setDescription('Silinecek Key ID (6 Haneli)').setRequired(true))
        .addStringOption(option => option.setName('sebep').setDescription('Silme sebebi').setRequired(true)),

    async execute(interaction) {
        const { member, guild, options } = interaction;
        
        // Komutu kullananın dili (Hata mesajları için)
        const isCmdUserEnglish = member.roles.cache.has(process.env.ROLE_ID_ENGLISH);

        // --- 1. YETKİ KONTROLÜ ---
        const adminCheck = await Admin.findOne({ userId: member.id });
        if (!adminCheck) {
            const errorText = isCmdUserEnglish
                ? `**You Do Not Have Permission to Use This Command!**`
                : `**Bu Komutu Kullanmak İçin Bot Yetkilisi Olmalısın!**`;
            
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(errorText);
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const targetUser = options.getUser('kullanıcı');
        const keyIdInput = options.getString('keyid');
        const deleteReason = options.getString('sebep');

        // --- 2. BOT KONTROLÜ (YENİ EKLENEN KISIM) ---
        if (targetUser.bot) {
            const botErrorText = isCmdUserEnglish
                ? '**You Cannot Perform Operations on Bots!**'
                : '**Botlar Üzerinde İşlem Yapamazsınız!**';

            const botErrorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription(botErrorText);
            
            return interaction.reply({ embeds: [botErrorEmbed], ephemeral: true });
        }

        // Hedef kullanıcıyı sunucuda bul (Rol kontrolü için)
        let targetMember;
        try {
            targetMember = await guild.members.fetch(targetUser.id);
        } catch (e) {
            targetMember = null;
        }

        // --- 3. VERİTABANI ARAMASI ---
        // Önce Abone keylerinde ara, yoksa Genel keylerde ara
        let keyData = await SubscriberKey.findOne({ keyId: keyIdInput });
        let keyType = 'abone'; // Hangi tabloda bulduğumuzu işaretleyelim

        if (!keyData) {
            keyData = await GeneralKey.findOne({ keyId: keyIdInput });
            keyType = 'normal';
        }

        // Key bulunamadıysa
        if (!keyData) {
            const notFoundText = isCmdUserEnglish
                ? `**Key ID \`${keyIdInput}\` Not Found in Database!**`
                : `**\`${keyIdInput}\` ID'li Key Veritabanında Bulunamadı!**`;
            return interaction.reply({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription(notFoundText)], ephemeral: true });
        }

        // Key bulundu ama sahibi etiketlenen kişi değilse
        if (keyData.ownerId !== targetUser.id) {
            const wrongOwnerText = isCmdUserEnglish
                ? `**This Key Does Not Belong to ${targetUser}! (Owner ID: ${keyData.ownerId})**`
                : `**Bu Key ${targetUser} Kişisine Ait Değil! (Sahip ID: ${keyData.ownerId})**`;
            return interaction.reply({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription(wrongOwnerText)], ephemeral: true });
        }

        // --- 4. ONAY MEKANİZMASI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Key\'i Silmek İstiyor Musunuz?')
            .setDescription(`**${member} \`${keyIdInput}\` Adlı Key ID'yi Silmek İstediğinden Emin Misin?**`)
            .setColor(Colors.Yellow);

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_del_key')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_del_key')
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
                return i.reply({ content: '**Bu butonu sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'confirm_del_key') {
                try {
                    // SİLME İŞLEMİ
                    if (keyType === 'abone') {
                        await SubscriberKey.deleteOne({ keyId: keyIdInput });
                    } else {
                        await GeneralKey.deleteOne({ keyId: keyIdInput });
                    }

                    // Zamanlar
                    const createdTs = Math.floor(new Date(keyData.createdAt).getTime() / 1000);
                    const deletedTs = Math.floor(Date.now() / 1000);

                    // --- 1. KOMUT YANITI (Yeşil Embed - Detaylı) ---
                    const successEmbed = new EmbedBuilder()
                        .setTitle('✅ Silinen Key Bilgileri')
                        .setDescription(`
**⛓️‍💥 Silinen Key --> ||\`${keyData.key}\`||
🆔 Silinen Key ID --> \`${keyData.keyId}\`
🪄 Silinen Key'i Oluşturan Yetkili --> <@${keyData.creatorId}>
👑 Silinen Key'in Sahibi --> ${targetUser}
🧾 Silinen Key'in Script Adı --> \`${keyData.scriptName}\`
📜 Key'in Silinme Sebebi --> \`${deleteReason}\`
✨ Key'i Silen Yetkili --> ${member}
⏰ Silinen Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏲️ Key'in Silinme Zamanı --> <t:${deletedTs}:F>**`)
                        .setColor(Colors.Green);

                    await i.update({ embeds: [successEmbed], components: [] });

                    // --- 2. LOG KANALINA MESAJ (Sadece Türkçe) ---
                    const logChannel = guild.channels.cache.get(process.env.CHANNEL_ID_LOG_KEY_DELETE);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('Bir Key Silindi')
                            .setDescription(`
**⛓️‍💥 Silinen Key --> ||\`${keyData.key}\`||
🆔 Silinen Key ID --> \`${keyData.keyId}\`
🪄 Silinen Key'i Oluşturan Yetkili --> <@${keyData.creatorId}>
👑 Silinen Key'in Sahibi --> ${targetUser}
🧾 Silinen Key'in Script Adı --> \`${keyData.scriptName}\`
📜 Key'in Silinme Sebebi --> \`${deleteReason}\`
✨ Key'i Silen Yetkili --> ${member}
⏰ Silinen Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏲️ Key'in Silinme Zamanı --> <t:${deletedTs}:F>**`)
                            .setColor('Random');

                        logChannel.send({ embeds: [logEmbed] });
                    }

                    // --- 3. KULLANICIYA DM (Dil Kontrolü ve Ticket Kanalı) ---
                    // Hedefte İngilizce rolü var mı?
                    const isTargetEnglish = targetMember ? targetMember.roles.cache.has(process.env.ROLE_ID_ENGLISH) : false;
                    
                    let dmTitle, dmDesc;

                    if (isTargetEnglish) {
                        // İNGİLİZCE MESAJ
                        dmTitle = "A Key Has Been Deleted";
                        dmDesc = `
**⛓️‍💥 Deleted Key --> ||\`${keyData.key}\`||
🆔 Deleted Key ID --> \`${keyData.keyId}\`
🪄 Key Creator --> <@${keyData.creatorId}>
🧾 Script Name --> \`${keyData.scriptName}\`
📜 Deletion Reason --> \`${deleteReason}\`
✨ Deleted By --> ${member}
⏰ Creation Time --> <t:${createdTs}:F>
⏲️ Deletion Time --> <t:${deletedTs}:F>
❗ __IF YOU THINK THERE IS AN ERROR, PLEASE OPEN A TICKET AT <#1446514292873498817>__**`;
                    } else {
                        // TÜRKÇE MESAJ
                        dmTitle = "Bir Key'iniz Silindi";
                        dmDesc = `
**⛓️‍💥 Silinen Key --> ||\`${keyData.key}\`||
🆔 Silinen Key ID --> \`${keyData.keyId}\`
🪄 Silinen Key'i Oluşturan Yetkili --> <@${keyData.creatorId}>
🧾 Silinen Key'in Script Adı --> \`${keyData.scriptName}\`
📜 Key'in Silinme Sebebi --> \`${deleteReason}\`
✨ Key'i Silen Yetkili --> ${member}
⏰ Silinen Key'in Oluşturulma Zamanı --> <t:${createdTs}:F>
⏲️ Key'in Silinme Zamanı --> <t:${deletedTs}:F>
❗ __EĞER BİR HATA OLDUĞUNU DÜŞÜNÜYORSANIZ <#1446492655998599219> KANALINDAN BİLET OLUŞTURUN__**`;
                    }

                    const dmEmbed = new EmbedBuilder()
                        .setTitle(dmTitle)
                        .setDescription(dmDesc)
                        .setColor(Colors.Red);

                    targetUser.send({ embeds: [dmEmbed] }).catch(() => {
                        interaction.followUp({ content: isTargetEnglish ? `❌ Could not send DM to ${targetUser}.` : `❌ ${targetUser} kişisine DM gönderilemedi.`, ephemeral: true });
                    });

                } catch (error) {
                    console.error(error);
                    await i.update({ content: '**Silme işlemi sırasında bir hata oluştu.**', embeds: [], components: [] });
                }

            } else if (i.customId === 'cancel_del_key') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
        });
    },
};