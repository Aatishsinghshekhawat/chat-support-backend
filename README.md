# Chat Support Backend

A real-time chat support system built with Node.js, Express, Socket.io, and MongoDB.

## Features

- **Real-time Chat**: WebSocket-based messaging with Socket.io
- **Session Management**: Create, manage, and end chat sessions
- **Agent Assignment**: Automatic load-balanced agent assignment (max 2 users per agent)
- **Authentication**: JWT tokens and API key support
- **Database Storage**: MongoDB for persistent chat history and session data
- **Comprehensive Logging**: Winston logging to console and files
- **Health Monitoring**: System health and statistics endpoints
- **CORS Support**: Configurable CORS for frontend integration

## API Endpoints

### Authentication
- `POST /api/auth/token` - Get JWT token (30-day expiry)

### Chat Management
- `POST /api/chat/start-session` - Create new chat session
- `GET /api/chat/session/:sessionId` - Get session details
- `POST /api/chat/end-session/:sessionId` - End chat session
- `GET /api/chat/messages/:sessionId` - Get session messages (with pagination)
- `POST /api/chat/send-message/:sessionId` - Send message (HTTP fallback)
- `GET /api/chat/stats` - System statistics

### System
- `GET /api/health` - Health check
- `GET /` - API information

## Socket.io Events

### Client to Server
- `join_session` - Join a chat session room
- `send_message` - Send a message
- `typing_start` / `typing_stop` - Typing indicators

### Server to Client
- `session_joined` - Session joined confirmation
- `new_message` - New message received
- `user_joined` / `user_left` - User presence updates
- `user_typing` - Typing indicator updates
- `session_ended` - Session termination

## Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd chat-support-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp env.example .env
```

4. Configure environment variables in `.env`:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URLs
FRONTEND_URLS=http://localhost:3000,http://localhost:5173

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# API Key (optional)
API_KEY=your-api-key-here

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/chat-support
MONGODB_DB=chat-support
```

5. Start MongoDB (if running locally):
```bash
# Start MongoDB service
mongod
```

6. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Database Schema

### Session
- `userId` (String, required) - User identifier
- `userType` (String, enum) - 'user', 'agent', 'system'
- `agentId` (String) - Assigned agent ID
- `status` (String, enum) - 'waiting', 'active', 'ended'
- `endedAt` (Date) - Session end timestamp
- `endReason` (String) - Reason for session end

### Message
- `sessionId` (String, required) - Session reference
- `senderId` (String, required) - Sender identifier
- `senderType` (String, enum) - 'user', 'agent', 'system'
- `message` (String, required, max 1000 chars) - Message content
- `timestamp` (Date) - Message timestamp

### Agent
- `name` (String, required) - Agent name
- `maxUsers` (Number, default 2) - Maximum concurrent users
- `activeUsers` (Array) - Currently assigned user IDs
- `isOnline` (Boolean, default true) - Online status

## Authentication

### JWT Token
1. Get token: `POST /api/auth/token`
   ```json
   {
     "userId": "user123",
     "userType": "user"
   }
   ```
2. Use token: `Authorization: Bearer <token>`

### API Key
Use header: `X-API-Key: <your-api-key>`

## Testing

### Using Postman
1. Get JWT token from `/api/auth/token`
2. Use token in Authorization header for protected endpoints
3. Test Socket.io connection with token in auth object

### Using cURL
```bash
# Get token
curl -X POST http://localhost:5000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "userType": "user"}'

# Start session
curl -X POST http://localhost:5000/api/chat/start-session \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "userType": "user"}'
```

## Logging

Logs are written to:
- Console (development)
- `logs/app.log` (application logs)
- `logs/error.log` (error logs)

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure MongoDB connection string
4. Set up proper CORS origins
5. Use environment-specific logging levels

## License

MIT