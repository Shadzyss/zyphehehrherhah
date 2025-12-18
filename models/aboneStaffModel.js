// models/aboneStaffModel.js
const mongoose = require('mongoose');

const aboneStaffSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, // Yetkili ID
    count: { type: Number, default: 0 }, // Verdiği abone sayısı
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AboneStaff', aboneStaffSchema);