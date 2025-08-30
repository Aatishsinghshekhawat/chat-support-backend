const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  senderId: {
    type: String,
    required: true
  },
  senderType: {
    type: String,
    enum: ['user', 'agent', 'system'],
    default: 'user'
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

messageSchema.index({ sessionId: 1, timestamp: 1 });

messageSchema.virtual('formattedTime').get(function() {
  return this.timestamp.toLocaleString();
});

messageSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Message', messageSchema);
