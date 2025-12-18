// models/subscriberKeyModel.js
const mongoose = require('mongoose');

const subscriberKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // ABCD-ABCD...
    keyId: { type: String, required: true, unique: true }, // 123456
    creatorId: { type: String, required: true }, // Oluşturan
    ownerId: { type: String, required: true }, // Sahibi (Kullanan veya Atanan)
    reason: { type: String, default: "Abone Key" }, // Sabit
    scriptName: { type: String, default: "ABONE KEY" }, // Sabit
    createdAt: { type: Date, default: Date.now }, // Oluşturulma zamanı
    duration: { type: String, default: "SINIRSIZ" }, // Süre
    hwid: { type: String, default: null }, // HWID (Başta boş)
    isUsed: { type: Boolean, default: false } // Kullanıldı mı?
});

module.exports = mongoose.model('SubscriberKey', subscriberKeySchema);