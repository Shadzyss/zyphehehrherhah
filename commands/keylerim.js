const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const GeneralKey = require('../models/generalKeyModel');
const SubscriberKey = require('../models/subscriberKeyModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('keylerim')
        .setDescription('Sahip olduğunuz keyleri listeler.'),

    async execute(interaction) {
        // --- 1. DİL AYARLAMA MANTIĞI ---
        let lang = 'tr'; // Varsayılan: Türkçe
        
        // .env dosyasından İngilizce rol ID'sini çek
        const enRoleId = process.env.ROLE_ID_ENGLISH;

        // EĞER KULLANICIDA İNGİLİZCE ROLÜ VARSA --> DİLİ İNGİLİZCE YAP
        if (interaction.member.roles.cache.has(enRoleId)) {
            lang = 'en';
        }

        // --- 2. BÜTÜN METİNLERİ DİLE GÖRE AYARLA ---
        const texts = {
            tr: {
                title: "Sahip Olduğun Keylerin",
                noKeys: "❌ Üzerinize kayıtlı hiç key bulunamadı.",
                page: "Sayfa",
                unlimited: "\`Sınırsız\`",
                yes: "\`✅ Evet\`",
                no: "\`❌ Hayır\`",
                subScript: "ABONE SCRİPT",
                subReason: "Abone Key",
                // ETİKETLER (DÜZELTİLEN KISIM)
                lblKey: "Key",
                lblId: "Key ID",
                lblCreator: "Key'i Oluşturan Yetkili",
                lblScript: "Script Adı",
                lblReason: "Key'in Oluşturulma Sebebi",
                lblCreated: "Key'in Oluşturulma Zamanı",
                lblExpires: "Key'in Bitiş Süresi",
                lblUsed: "Key Kullanılmış Mı?"
            },
            en: {
                title: "Your Owned Keys",
                noKeys: "❌ No keys found registered to you.",
                page: "Page",
                unlimited: "\`Unlimited\`",
                yes: "\`✅ Yes\`",
                no: "\`❌ No\`",
                subScript: "SUBSCRIBER SCRIPT",
                subReason: "Subscriber Key",
                // ETİKETLER (EN)
                lblKey: "Key",
                lblId: "Key ID",
                lblCreator: "Key Creator",
                lblScript: "Script Name",
                lblReason: "Creation Reason",
                lblCreated: "Creation Time",
                lblExpires: "Expiration Date",
                lblUsed: "Is Key Used?"
            }
        };
        const t = texts[lang];

        // --- 3. VERİLERİ ÇEKME ---
        const userId = interaction.user.id;
        
        // Veritabanı sorgusu (Model dosyalarındaki ownerId'ye göre)
        const generalKeys = await GeneralKey.find({ ownerId: userId }).lean();
        const subKeys = await SubscriberKey.find({ ownerId: userId }).lean();

        // Verileri birleştirme
        const allKeys = [
            ...generalKeys.map(k => ({ 
                ...k, 
                type: 'general',
                displayScript: k.scriptName, 
                displayReason: k.reason 
            })),
            ...subKeys.map(k => ({ 
                ...k, 
                type: 'subscriber',
                displayScript: t.subScript, 
                displayReason: t.subReason
            }))
        ];

        // Tarihe göre sıralama (Yeniden eskiye)
        allKeys.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (allKeys.length === 0) {
            return interaction.reply({ content: t.noKeys, ephemeral: true });
        }

        // --- 4. SAYFALAMA SİSTEMİ ---
        const ITEMS_PER_PAGE = 3;
        let currentPage = 0;
        const totalPages = Math.ceil(allKeys.length / ITEMS_PER_PAGE);

        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentKeys = allKeys.slice(start, end);

            const embed = new EmbedBuilder()
                .setTitle(t.title)
                .setColor('Blue')
                .setFooter({ text: `${t.page} ${page + 1} / ${totalPages}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            const descriptionArray = currentKeys.map(k => {
                const createdTimestamp = Math.floor(new Date(k.createdAt).getTime() / 1000);
                
                let expiryDisplay = t.unlimited;

                if (k.type === 'general') {
                    if (k.expiresAt) {
                        const expTimestamp = Math.floor(new Date(k.expiresAt).getTime() / 1000);
                        expiryDisplay = `<t:${expTimestamp}:R>`;
                    }
                }

                const isUsedDisplay = k.isUsed ? t.yes : t.no;

                // --- 5. DİNAMİK ETİKET KULLANIMI ---
                // Artık sol taraftaki metinler de (t.lblKey vb.) dile göre değişiyor.
                return `**⛓️‍💥 ${t.lblKey} --> ||\`${k.key}\`||
🆔 ${t.lblId} --> \`${k.keyId}\`
🪄 ${t.lblCreator} --> <@${k.creatorId}>
📜 ${t.lblScript} --> \`${k.displayScript}\`
🧾 ${t.lblReason} --> \`${k.displayReason}\`
⏰ ${t.lblCreated} --> <t:${createdTimestamp}:f>
⏱️ ${t.lblExpires} --> ${expiryDisplay}
👁️ ${t.lblUsed} --> ${isUsedDisplay}**`;
            });

            embed.setDescription(descriptionArray.join('\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n'));
            return embed;
        };

        const generateButtons = (page) => {
            const row = new ActionRowBuilder();
            row.addComponents(
                new ButtonBuilder().setCustomId('first').setEmoji('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1),
                new ButtonBuilder().setCustomId('last').setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1)
            );
            return row;
        };

        const components = totalPages > 1 ? [generateButtons(currentPage)] : [];
        
        const response = await interaction.reply({ 
            embeds: [generateEmbed(currentPage)], 
            components: components,
            ephemeral: true 
        });

        if (totalPages <= 1) return;

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000 
        });

        collector.on('collect', async i => {
            if (i.customId === 'prev' && currentPage > 0) currentPage--;
            else if (i.customId === 'next' && currentPage < totalPages - 1) currentPage++;
            else if (i.customId === 'first') currentPage = 0;
            else if (i.customId === 'last') currentPage = totalPages - 1;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });
        });
    },
};