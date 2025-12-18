// deploy-commands.js

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Komutları toplayacağımız array
const commands = [];

// commands klasöründen komut dosyalarını oku
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Her komut dosyasını içeri aktar ve komut verisini (data) array'e ekle
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Yalnızca geçerli 'data' özelliğine sahip komutları al
    if ('data' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[UYARI] ${filePath} komutunda gerekli olan 'data' özelliği eksik.`);
    }
}

// Discord REST API ayarları
const rest = new REST({ version: '10' }).setToken(process.env.CLIENT_TOKEN);

// Komutları kaydetme işlevi (Async IIFE)
(async () => {
    try {
        console.log(`⚙️ Başarıyla ${commands.length} adet uygulama komutu yüklenecek.`);

        // Komutları sadece geliştirme yaptığımız sunucuya (Guild) kaydetmek daha hızlıdır.
        // Eğer komutları tüm sunuculara (Global) kaydetmek istersen Routes.applicationCommands kullanmalısın.
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log(`✅ Başarıyla ${data.length} adet uygulama komutu kaydedildi.`);
    } catch (error) {
        // Hata yakalama
        console.error(error);
    }
})();