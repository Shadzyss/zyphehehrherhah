// models/adminModel.js
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, // Yetkili ID'si
    addedAt: { type: Date, default: Date.now } // Ne zaman eklendi?
});

module.exports = mongoose.model('Admin', adminSchema);