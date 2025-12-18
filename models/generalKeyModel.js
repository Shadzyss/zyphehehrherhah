// models/generalKeyModel.js
const mongoose = require('mongoose');

const generalKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // ABCD-ABCD...
    keyId: { type: String, required: true, unique: true }, // 123456
    creatorId: { type: String, required: true }, // Oluşturan Yetkili
    ownerId: { type: String, required: true }, // Key Sahibi (Kullanıcı)
    reason: { type: String, required: true }, // Sebep
    scriptName: { type: String, required: true }, // Script Adı
    durationLabel: { type: String, required: true }, // Girilen süre metni (örn: 30g)
    createdAt: { type: Date, default: Date.now }, // Oluşturulma
    expiresAt: { type: Date, default: null }, // Bitiş (Null ise sınırsız)
    hwid: { type: String, default: null }, // HWID
    isUsed: { type: Boolean, default: false } // Kullanıldı mı?
});

module.exports = mongoose.model('GeneralKey', generalKeySchema);