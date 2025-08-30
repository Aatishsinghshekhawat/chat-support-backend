const mongoose = require('mongoose');
const logger = require('./winston');

const connectDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-support';
    const options = {
      dbName: process.env.MONGODB_DB || 'chat-support',
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    await mongoose.connect(uri, options);
    
    logger.info('MongoDB connected successfully', {
      uri: uri.replace(/\/\/.*@/, '//***:***@'),
      dbName: options.dbName
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB', { 
      error: error.message,
      stack: error.stack 
    });
    
    if (process.env.NODE_ENV === 'development' && process.env.ALLOW_MEMORY_FALLBACK === 'true') {
      logger.warn('Falling back to in-memory storage mode. Data will be lost on restart.');
      return false; 
    }
    
    throw error;
  }
  
  return true;
};

const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB', { error: error.message });
  }
};

module.exports = { connectDatabase, disconnectDatabase };
