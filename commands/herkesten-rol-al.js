// commands/herkesten-rol-al.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('herkesten-rol-al')
        .setDescription('Sunucudaki herkesten (botlar hariç) belirli bir rolü alır (Sadece Sunucu Sahibi).')
        .addRoleOption(option => 
            option.setName('rol')
                .setDescription('Alınacak rol')
                .setRequired(true)),

    async execute(interaction) {
        const { guild, member } = interaction;

        // --- 1. GÜVENLİK KONTROLÜ (Sadece Sunucu Sahibi) ---
        if (interaction.user.id !== guild.ownerId) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Bu komutu sadece sunucu sahibi kullanabilir!**');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        const targetRole = interaction.options.getRole('rol');

        // --- 2. ROL KONTROLÜ ---
        // Botun rolü, alınacak rolden yüksek mi?
        if (targetRole.position >= guild.members.me.roles.highest.position) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Bu rolü alamam çünkü benim rolümden daha yüksek veya aynı seviyede!**');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // --- 3. ONAY MEKANİZMASI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Herkesten Rol Alınacak')
            .setDescription(`**${member} Herkesten ${targetRole} Adlı Rolü Almak İstiyor Musun?
❗ __ÜYE SAYISINA GÖRE İŞLEMİN BİTME SÜRESİ DEĞİŞEBİLİR__**`)
            .setColor(Colors.Yellow);

        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_role_remove_all')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_role_remove_all')
            .setLabel('İptal Et')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

        const response = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '**Bu butonları sadece komutu kullanan kişi kullanabilir!**', ephemeral: true });
            }

            if (i.customId === 'cancel_role_remove_all') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                await i.update({ embeds: [cancelEmbed], components: [] });
                return;
            }

            if (i.customId === 'confirm_role_remove_all') {
                // --- İŞLEM BAŞLIYOR ---
                
                // 1. Üyeleri Çek
                await i.deferUpdate(); 
                const allMembers = await guild.members.fetch();
                
                // 2. Filtrele (Bot olmayanlar ve o role SAHİP olanlar)
                const eligibleMembers = allMembers.filter(m => !m.user.bot && m.roles.cache.has(targetRole.id));
                const totalTarget = eligibleMembers.size;

                if (totalTarget === 0) {
                    return i.editReply({ content: '**Zaten sunucudaki (bot olmayan) kimsede bu rol yok!**', embeds: [], components: [] });
                }

                let removedCount = 0;
                let remainingCount = totalTarget;

                // --- 3. İLK BİLGİ MESAJI ---
                const progressEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Herkesten Rol Alınıyor')
                    .setDescription(`
**👥 Rolün Alınacağı Toplam Kişi Sayısı --> \`${totalTarget}\`
🎭 Herkesten Alınacak Rol --> ${targetRole}
📥 Alınan Toplam Kişi Sayısı --> \`0\`
📤 Kalan Kişi Sayısı --> \`${totalTarget}\`**`)
                    .setColor(Colors.Yellow);

                await i.editReply({ embeds: [progressEmbed], components: [] });

                // --- 4. DÖNGÜ VE ROL ALMA ---
                for (const [memberId, member] of eligibleMembers) {
                    try {
                        await member.roles.remove(targetRole);
                        removedCount++;
                        remainingCount--;

                        // Her 5 kişide bir mesajı güncelle
                        if (removedCount % 5 === 0 || remainingCount === 0) {
                            const updatedEmbed = new EmbedBuilder()
                                .setTitle('⚠️ Herkesten Rol Alınıyor')
                                .setDescription(`
**👥 Rolün Alınacağı Toplam Kişi Sayısı --> \`${totalTarget}\`
🎭 Herkesten Alınacak Rol --> ${targetRole}
📥 Alınan Toplam Kişi Sayısı --> \`${removedCount}\`
📤 Kalan Kişi Sayısı --> \`${remainingCount}\`**`)
                                .setColor(Colors.Yellow);
                            
                            await i.editReply({ embeds: [updatedEmbed] });
                        }

                    } catch (error) {
                        console.error(`Rol alma hatası (${member.user.tag}):`, error);
                    }
                }

                // --- 5. İŞLEM BİTTİ MESAJI ---
                const finishEmbed = new EmbedBuilder()
                    .setTitle('✅ Başarılı')
                    .setDescription(`**${interaction.user} Başarıyla \`${removedCount}\` Tane Üyeden ${targetRole} Adlı Rol Alındı**`)
                    .setColor(Colors.Green);

                await i.editReply({ embeds: [finishEmbed] });
            }
        });
    },
};