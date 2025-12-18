// commands/herkese-rol-ver.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('herkese-rol-ver')
        .setDescription('Sunucudaki herkese (botlar hariç) belirli bir rolü verir (Sadece Sunucu Sahibi).')
        .addRoleOption(option => 
            option.setName('rol')
                .setDescription('Verilecek rol')
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
        // Botun rolü, verilecek rolden yüksek mi?
        if (targetRole.position >= guild.members.me.roles.highest.position) {
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setDescription('**Bu rolü veremem çünkü benim rolümden daha yüksek veya aynı seviyede!**');
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // --- 3. ONAY MEKANİZMASI ---
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Herkese Rol Verilecek')
            .setDescription(`**${member} Herkese ${targetRole} Adlı Rolü Vermek İstiyor Musun?
❗ __ÜYE SAYISINA GÖRE İŞLEMİN BİTME SÜRESİ DEĞİŞEBİLİR__**`)
            .setColor(Colors.Yellow);

        const confirmBtn = new ButtonBuilder()
            .setCustomId('confirm_role_all')
            .setLabel('Onayla')
            .setStyle(ButtonStyle.Success);

        const cancelBtn = new ButtonBuilder()
            .setCustomId('cancel_role_all')
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

            if (i.customId === 'cancel_role_all') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('**İşlem iptal edildi.**')
                    .setColor(Colors.Red);
                await i.update({ embeds: [cancelEmbed], components: [] });
                return;
            }

            if (i.customId === 'confirm_role_all') {
                // --- İŞLEM BAŞLIYOR ---
                
                // 1. Üyeleri Çek
                await i.deferUpdate(); // İşlem uzun sürebilir, beklemeye alalım
                const allMembers = await guild.members.fetch();
                
                // 2. Filtrele (Bot olmayanlar ve o role sahip olmayanlar)
                const eligibleMembers = allMembers.filter(m => !m.user.bot && !m.roles.cache.has(targetRole.id));
                const totalTarget = eligibleMembers.size;

                if (totalTarget === 0) {
                    return i.editReply({ content: '**Zaten sunucudaki (bot olmayan) herkes bu role sahip!**', embeds: [], components: [] });
                }

                let givenCount = 0;
                let remainingCount = totalTarget;

                // --- 3. İLK BİLGİ MESAJI ---
                const progressEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Herkese Rol Veriliyor')
                    .setDescription(`
**👥 Rolün Verilecek Toplam Kişi Sayısı --> \`${totalTarget}\`
🎭 Herkese Verilecek Rol --> ${targetRole}
📥 Verilecek Toplam Kişi Sayısı --> \`0\`
📤 Kalan Kişi Sayısı --> \`${totalTarget}\`**`)
                    .setColor(Colors.Yellow);

                await i.editReply({ embeds: [progressEmbed], components: [] });

                // --- 4. DÖNGÜ VE ROL VERME ---
                for (const [memberId, member] of eligibleMembers) {
                    try {
                        await member.roles.add(targetRole);
                        givenCount++;
                        remainingCount--;

                        // Her 5 kişide bir veya son kişide mesajı güncelle (Rate Limit yememek için)
                        if (givenCount % 5 === 0 || remainingCount === 0) {
                            const updatedEmbed = new EmbedBuilder()
                                .setTitle('⚠️ Herkese Rol Veriliyor')
                                .setDescription(`
**👥 Rolün Verilecek Toplam Kişi Sayısı --> \`${totalTarget}\`
🎭 Herkese Verilecek Rol --> ${targetRole}
📥 Verilecek Toplam Kişi Sayısı --> \`${givenCount}\`
📤 Kalan Kişi Sayısı --> \`${remainingCount}\`**`)
                                .setColor(Colors.Yellow);
                            
                            await i.editReply({ embeds: [updatedEmbed] });
                        }

                        // Çok hızlı işlem yapmamak için minik bir bekleme (opsiyonel ama sağlıklı)
                        // await new Promise(res => setTimeout(res, 500)); 

                    } catch (error) {
                        console.error(`Rol verme hatası (${member.user.tag}):`, error);
                    }
                }

                // --- 5. İŞLEM BİTTİ MESAJI ---
                const finishEmbed = new EmbedBuilder()
                    .setTitle('✅ Başarılı')
                    .setDescription(`**${interaction.user} Başarıyla \`${givenCount}\` Tane Üyeye ${targetRole} Adlı Rol Verildi**`)
                    .setColor(Colors.Green);

                await i.editReply({ embeds: [finishEmbed] });
            }
        });
    },
};