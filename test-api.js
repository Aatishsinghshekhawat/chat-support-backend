const axios = require('axios');
require('dotenv').config(); 

const BASE_URL = 'http://localhost:5000/api';
const API_KEY = process.env.API_KEY;

async function testAPI() {
  console.log('Testing Chat Support API...\n');
  
  try {
    // Test health check
    console.log('1. Testing health check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('Health:', health.data.data.status);

    // Test start session
    console.log('\n2. Testing start session...');
    const session = await axios.post(`${BASE_URL}/chat/start-session`, 
      { userId: 'test-user-123' },
      { headers: { 'x-api-key': API_KEY } }
    );
    console.log('Session created:', session.data.data.sessionId);
    console.log('   Agent assigned:', session.data.data.agentId || 'Waiting for agent');

    const sessionId = session.data.data.sessionId;

    // Test get messages
    console.log('\n3. Testing get messages...');
    const messages = await axios.get(`${BASE_URL}/chat/messages/${sessionId}`, {
      headers: { 'x-api-key': API_KEY }
    });
    console.log('Messages retrieved:', messages.data.data.totalMessages);

    // Test stats
    console.log('\n4. Testing stats...');
    const stats = await axios.get(`${BASE_URL}/chat/stats`, {
      headers: { 'x-api-key': API_KEY }
    });
    console.log('Stats:', stats.data.data.activeSessions, 'active sessions');
    console.log('Total sessions:', stats.data.data.totalSessions);

    console.log('\n All tests passed!');

  } catch (error) {
    console.error(' Test failed:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log(' Make sure your server is running: npm run dev');
    }
  }
}

testAPI();
