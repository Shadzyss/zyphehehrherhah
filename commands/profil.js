// commands/profil.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Admin = require('../models/adminModel');
const SubscriberKey = require('../models/subscriberKeyModel');
const GeneralKey = require('../models/generalKeyModel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Profilinizi Gösterir')
        .addUserOption(option => 
            option.setName('kullanıcı')
                .setDescription('Profili Görüntülenecek Kişi Boş Bırakırsanız Kendi Profilinizi Görürsünüz')
                .setRequired(false)),

    async execute(interaction) {
        const { member, guild } = interaction;
        
        // --- 1. DİL KONTROLÜ ---
        const isEnglish = member.roles.cache.has(process.env.ROLE_ID_ENGLISH);

        // --- 2. HEDEF KULLANICIYI BELİRLE ---
        const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
        
        let targetMember;
        try {
            targetMember = await guild.members.fetch(targetUser.id);
        } catch (error) {
            return interaction.reply({ content: isEnglish ? 'User not found in this server.' : 'Kullanıcı sunucuda bulunamadı.', ephemeral: true });
        }

        // --- 3. VERİLERİ HAZIRLA ---

        // A) Durum (Presence) Kontrolü
        let status = "offline";
        if (targetMember.presence) {
            status = targetMember.presence.status;
        }
        
        const statusMap = {
            online: isEnglish ? "Online" : "Çevrimiçi",
            idle: isEnglish ? "Idle" : "Boşta",
            dnd: isEnglish ? "Do Not Disturb" : "Rahatsız Etmeyin",
            offline: isEnglish ? "Offline/Invisible" : "Çevrimdışı/Görünmez"
        };
        const displayStatus = statusMap[status] || (isEnglish ? "Offline/Invisible" : "Çevrimdışı/Görünmez");

        // B) Yetki Kontrolleri
        const isBotStaffCheck = await Admin.findOne({ userId: targetUser.id });
        const isBotStaff = isBotStaffCheck ? (isEnglish ? "`✅ Yes`" : "`✅ Evet`") : (isEnglish ? "`❌ No`" : "`❌ Hayır`");

        const isAdminCheck = targetMember.permissions.has(PermissionFlagsBits.Administrator);
        const isAdmin = isAdminCheck ? (isEnglish ? "`✅ Yes`" : "`✅ Evet`") : (isEnglish ? "`❌ No`" : "`❌ Hayır`");

        const isSubStaffCheck = targetMember.roles.cache.has(process.env.ROLE_ID_ABONE_STAFF);
        const isSubStaff = isSubStaffCheck ? (isEnglish ? "`✅ Yes`" : "`✅ Evet`") : (isEnglish ? "`❌ No`" : "`❌ Hayır`");

        // C) Rol Sıralaması
        const roles = targetMember.roles.cache
            .filter(r => r.id !== guild.id) 
            .sort((a, b) => b.position - a.position)
            .map(r => r)
            .join(' ') || (isEnglish ? "No Roles" : "Rolü Yok");

        // D) Tarih Bilgileri (Hesap ve Sunucu)
        const createdAtTs = Math.floor(targetUser.createdTimestamp / 1000);
        const joinedAtTs = targetMember.joinedTimestamp ? Math.floor(targetMember.joinedTimestamp / 1000) : null;
        const joinedAtDisplay = joinedAtTs ? `<t:${joinedAtTs}:F>` : (isEnglish ? "`Unknown`" : "`Bilinmiyor`");

        // E) Key Bilgileri
        let totalActiveKeys = 0;
        let totalHistoryKeys = 0; // Bu şu anlık aktif keylerle aynı, geçmişi tutmadığımız için.
        let hasAboneKey = isEnglish ? "`❌ No`" : "`❌ Hayır`";
        let nextExpiration = isEnglish ? "`None`" : "`Yok`";

        if (targetUser.bot) {
            const botMsg = isEnglish ? "`BOTS CANNOT HAVE KEYS`" : "`BOTLAR KEYE SAHİP OLAMAZ`";
            totalActiveKeys = botMsg;
            totalHistoryKeys = botMsg;
            hasAboneKey = botMsg;
            nextExpiration = botMsg;
        } else {
            const subKeys = await SubscriberKey.find({ ownerId: targetUser.id });
            const genKeys = await GeneralKey.find({ ownerId: targetUser.id });
            const allKeys = [...subKeys, ...genKeys];

            // 1. Toplam Aktif Key Sayısı
            totalActiveKeys = `\`${allKeys.length}\``;
            
            // Not: Veritabanında silinen keyleri tutmadığımız için "Bugüne kadar sahip olduğu key sayısı" 
            // şimdilik "Mevcut Key Sayısı" ile aynıdır. İleride 'DeletedKeys' gibi bir tablo yaparsan orayı da saydırırız.
            totalHistoryKeys = `\`${allKeys.length}\``; 

            // 2. Abone Key Var mı?
            if (subKeys.length > 0) {
                hasAboneKey = isEnglish ? "`✅ Yes`" : "`✅ Evet`";
            }

            // 3. En Erken Bitecek Key (DÜZELTİLMİŞ HALİ)
            const timedKeys = allKeys.filter(k => {
                if (!k.expiresAt) return false; 
                const d = new Date(k.expiresAt);
                return !isNaN(d.getTime()); 
            });
            
            if (allKeys.length > 0 && timedKeys.length === 0) {
                nextExpiration = isEnglish ? "`Unlimited`" : "`Sınırsız`";
            } else if (timedKeys.length > 0) {
                timedKeys.sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));
                const nearestDate = Math.floor(new Date(timedKeys[0].expiresAt).getTime() / 1000);
                nextExpiration = `<t:${nearestDate}:R>`; 
            } else {
                nextExpiration = isEnglish ? "`No Keys`" : "`Key Yok`";
            }
        }

        // --- 4. EMBED METİNLERİ ---
        const titleText = isEnglish 
            ? `${targetUser.username}'s Profile` 
            : `${targetUser.username} Adlı Kişinin Profili`;

        const sectionUserInfo = isEnglish ? "`----- 👤 User Information 👤 -----`" : "`----- 👤 Kullanıcı Bilgileri 👤 -----`";
        const labelUsername = isEnglish ? "👤 Username" : "👤 Kullanıcı Adı";
        const labelID = isEnglish ? "🆔 User ID" : "🆔 Kullanıcının ID'si";
        const labelIsBot = isEnglish ? "🤖 Is Bot?" : "🤖 Kullanıcı Bot Mu?";
        const valIsBot = targetUser.bot ? (isEnglish ? "`✅ Yes`" : "`✅ Evet`") : (isEnglish ? "`❌ No`" : "`❌ Hayır`");
        const labelDisplayName = isEnglish ? "👥 Server Name" : "👥 Kişinin Sunucudaki Adı";
        const labelStatus = isEnglish ? "🟣 User Status" : "🟣 Kişinin Durumu";

        const sectionStaffInfo = isEnglish ? "`----- ⚒️ Authority Information ⚒️ -----`" : "`----- ⚒️ Yetki Bilgileri ⚒️ -----`";
        const labelBotStaff = isEnglish ? "🌟 Is Bot Staff?" : "🌟 Kişi Bot Yetkilisi Mi?";
        const labelAdmin = isEnglish ? "⁉️ Is Administrator?" : "⁉️ Kişi Yönetici Mi?";
        const labelSubStaff = isEnglish ? "⛓️‍💥 Is Subscriber Staff?" : "⛓️‍💥 Kişi Abone Yetkilisi Mi?";

        const sectionRoles = isEnglish ? "`----- 🎭 Roles 🎭 -----`" : "`----- 🎭 Rolleri 🎭 -----`";

        const sectionAccountInfo = isEnglish ? "`----- 🪪 Account Information 🪪 -----`" : "`----- 🪪 Hesap Bilgileri 🪪 -----`";
        const labelCreatedAt = isEnglish ? "📅 Account Created At" : "📅 Hesabın Oluşturulma Tarihi";
        const labelJoinedAt = isEnglish ? "📅 Server Joined At" : "📅 Kişinin Sunucuya Katılma Tarihi";

        const sectionKeyInfo = isEnglish ? "`----- 🔑 Key Information 🔑 -----`" : "`----- 🔑 Key Bilgileri 🔑 -----`";
        const labelTotalKeys = isEnglish ? "🟢 Total Active Keys" : "🟢 Kişinin Toplam Aktif Keyleri";
        const labelHasSubKey = isEnglish ? "🔴 Has Subscriber Key?" : "🔴 Kişi Abone Key'ine Sahip Mi?";
        const labelExpiration = isEnglish ? "⚫ Next Key Expiration" : "⚫ Kişinin Bitecek Key'inin Bitiş Süresi";

        const footerText = isEnglish 
            ? `Command Used By --> ${interaction.user.username}` 
            : `Komutu Kullanan --> ${interaction.user.username}`;

        // --- 5. EMBED OLUŞTURMA ---
        const embed = new EmbedBuilder()
            .setTitle(titleText)
            .setDescription(`
**${sectionUserInfo}
${labelUsername} --> \`${targetUser.username}\` (${targetUser})
${labelID} --> \`${targetUser.id}\`
${labelIsBot} --> ${valIsBot}
${labelDisplayName} --> \`${targetMember.displayName}\`
${labelStatus} --> \`${displayStatus}\`

${sectionStaffInfo}
${labelBotStaff} --> ${isBotStaff}
${labelAdmin} --> ${isAdmin}
${labelSubStaff} --> ${isSubStaff}

${sectionRoles}
${roles}

${sectionAccountInfo}
${labelCreatedAt} --> <t:${createdAtTs}:F>
${labelJoinedAt} --> ${joinedAtDisplay}

${sectionKeyInfo}
${labelTotalKeys} --> ${totalActiveKeys}
${labelHasSubKey} --> ${hasAboneKey}
${labelExpiration} --> ${nextExpiration}**
            `)
            .setColor('Random')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: footerText, 
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
            });

        await interaction.reply({ embeds: [embed] });
    },
};