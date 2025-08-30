const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  maxUsers: {
    type: Number,
    default: 2,
    min: 1,
    max: 10
  },
  activeUsers: [{
    type: String,
    ref: 'Session'
  }],
  isOnline: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

agentSchema.index({ isOnline: 1, activeUsers: 1 });

agentSchema.virtual('currentLoad').get(function() {
  return this.activeUsers.length;
});

agentSchema.virtual('utilizationRate').get(function() {
  return Math.round((this.activeUsers.length / this.maxUsers) * 100);
});

agentSchema.methods.assignUser = function(userId) {
  if (this.activeUsers.length < this.maxUsers && !this.activeUsers.includes(userId)) {
    this.activeUsers.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

agentSchema.methods.removeUser = function(userId) {
  this.activeUsers = this.activeUsers.filter(id => id !== userId);
  return this.save();
};

agentSchema.statics.getAvailable = function() {
  return this.find({
    isOnline: true,
    $expr: { $lt: [{ $size: '$activeUsers' }, '$maxUsers'] }
  });
};

agentSchema.statics.getLeastLoaded = async function() {
  const availableAgents = await this.getAvailable();
  
  if (availableAgents.length === 0) {
    return null;
  }
  
  return availableAgents.reduce((prev, current) => {
    return prev.activeUsers.length <= current.activeUsers.length ? prev : current;
  });
};

agentSchema.set('toJSON', { virtuals: true });

agentSchema.statics.initializeDefaultAgents = async function() {
  const count = await this.countDocuments();
  if (count === 0) {
    await this.create([
      { name: 'Aatish Support', maxUsers: 2 },
      { name: 'sanjay Support', maxUsers: 2 },
      { name: 'Ganesh Support', maxUsers: 2 }
    ]);
  }
};

module.exports = mongoose.model('Agent', agentSchema);
