const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userType: {
    type: String,
    enum: ['user', 'agent', 'system'],
    default: 'user'
  },
  agentId: {
    type: String,
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'ended'],
    default: 'waiting',
    index: true
  },
  endedAt: {
    type: Date,
    default: null
  },
  endReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for finding active sessions by user
sessionSchema.index({ userId: 1, status: 1 });

// Virtual for session duration
sessionSchema.virtual('duration').get(function() {
  if (this.status === 'ended' && this.endedAt) {
    return this.endedAt - this.createdAt;
  }
  return new Date() - this.createdAt;
});

// Virtual for message count (will be populated via aggregation)
sessionSchema.virtual('messageCount').get(function() {
  return this._messageCount || 0;
});

// Method to end session
sessionSchema.methods.endSession = function(reason = 'Session ended') {
  this.status = 'ended';
  this.endedAt = new Date();
  this.endReason = reason;
  return this.save();
};

// Method to assign agent
sessionSchema.methods.assignAgent = function(agentId) {
  this.agentId = agentId;
  this.status = 'active';
  return this.save();
};

// Static method to find active session by user
sessionSchema.statics.findActiveByUserId = function(userId) {
  return this.findOne({ 
    userId, 
    status: { $in: ['waiting', 'active'] } 
  });
};

// Static method to get session with message count
sessionSchema.statics.findByIdWithMessageCount = async function(sessionId) {
  const session = await this.findById(sessionId);
  if (!session) return null;
  
  const Message = mongoose.model('Message');
  const messageCount = await Message.countDocuments({ sessionId });
  session._messageCount = messageCount;
  
  return session;
};

// Ensure virtuals are serialized
sessionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Session', sessionSchema);
