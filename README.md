# MemLayer - Enhanced Memory Management System

A powerful, feature-rich memory management system with MCP (Model Context Protocol) integration, designed to compete with advanced solutions.

## 🚀 Features

### Enhanced Memory Structure
- **Rich Metadata**: Titles, types, tags, categories, folders, and importance levels
- **Auto-Generation**: Automatic title generation, tag suggestions, and content categorization
- **Memory Types**: Support for notes, tasks, ideas, code snippets, links, and documents
- **Hierarchical Organization**: Folder-based organization system

### Advanced Search & Retrieval
- **Hybrid Search**: Combines semantic similarity with keyword matching
- **Advanced Filters**: Filter by type, tags, category, importance, and date ranges
- **Multiple Sort Options**: Sort by relevance, importance, date, or access count
- **Search Suggestions**: Intelligent search suggestions based on existing content

### Comprehensive MCP Integration
- **8 MCP Tools**: Complete memory management through MCP
- **Enhanced Operations**: Store, search, update, delete, list, and analyze memories
- **Rich Metadata Support**: Full support for all memory fields through MCP

### Modern Web Interface
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Statistics**: Live dashboard with memory analytics
- **Intuitive UI**: Clean, modern interface with smooth animations
- **Advanced Filtering**: Visual filters and search capabilities
- **Bulk Operations**: Select and remove multiple memories at once
- **Confirmation Dialogs**: Safe deletion with confirmation prompts
- **Graph View**: Visualize memories and their relationships with multiple layouts

## 📋 API Endpoints

### Memory Management
- `POST /memory` - Create a new memory
- `GET /memory/:id` - Get memory by ID
- `PUT /memory/:id` - Update memory
- `DELETE /memory/:id` - Delete memory
- `DELETE /memory/bulk` - Bulk remove memories by filters
- `DELETE /memory/remove` - Remove specific memories by IDs
- `GET /memory` - List memories with pagination and filters

### Search & Discovery
- `GET /memory/search` - Advanced search with filters
- `GET /memory/stats` - Comprehensive statistics

### Relations & Graph
- `POST /relations` - Create a relation between two memories
- `GET /relations` - List relations (filter by source_id/target_id/type)
- `DELETE /relations/:id` - Delete a relation
- `GET /relations/graph` - Get graph data (nodes/edges) for visualization

## 🛠️ MCP Tools

### Core Operations
1. **store_memory** - Store a new memory with enhanced metadata
2. **search_memories** - Advanced search with filtering options
3. **get_memory** - Retrieve a specific memory by ID
4. **update_memory** - Update existing memory content and metadata
5. **delete_memory** - Delete a memory by ID
6. **bulk_remove_memories** - Remove multiple memories based on filters
7. **remove_memories_by_ids** - Remove specific memories by their IDs
8. **list_memories** - List memories with pagination and filters
9. **get_memory_stats** - Get comprehensive statistics
10. **get_search_suggestions** - Get search suggestions

## 🔐 **Authentication**

MemLayer uses **email and password authentication** with secure session tokens:

- **Registration**: Create account with name, email, and password
- **Login**: Sign in with email and password to get a session token
- **Session Management**: Automatic token validation and logout functionality
- **Password Security**: SHA-256 hashing with minimum 6-character requirement
- **Backward Compatibility**: Still supports legacy API key authentication for existing integrations

### **User Management Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /users/register` | Public | Create new user account |
| `POST /users/login` | Public | Authenticate user and get session token |
| `POST /users/logout` | Auth | Invalidate session token |
| `GET /users/me` | Auth | Get current user information |
| `GET /users/api-key` | Auth | Get current API key (for MCP server) |
| `POST /users/change-password` | Auth | Change user password |
| `POST /users/rotate-key` | Auth | Generate new API key (legacy) |

### **Authentication Headers**

```bash
# For session token authentication (recommended)
Authorization: Bearer <session_token>

# For legacy API key authentication
Authorization: Bearer <api_key>
X-API-Key: <api_key>
```

## 🏗️ Architecture

### Backend
- **Node.js/Express**: Fast, scalable API server
- **MongoDB**: Flexible document storage with embedding support
- **Hybrid Embeddings**: Support for both local (Xenova) and OpenAI embeddings
- **Advanced Search**: Semantic + keyword hybrid search algorithm

### Frontend
- **Modern HTML5/CSS3**: Responsive, accessible design
- **Vanilla JavaScript**: No framework dependencies
- **Real-time Updates**: Live statistics and memory management
- **Progressive Enhancement**: Works without JavaScript for basic functionality

## 🚀 **Quick Start**

### **1. Start the Server**
```bash
npm install
npm run dev
```

### **2. Create Your Account**
```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "your.email@example.com",
    "password": "your_secure_password"
  }'
```

### **3. Sign In**
```bash
curl -X POST http://localhost:3000/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your.email@example.com",
    "password": "your_secure_password"
  }'
```

### **4. Use the API**
```bash
# Store a memory
curl -X POST http://localhost:3000/memory \
  -H "Authorization: Bearer <session_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is my first memory in MemLayer!",
    "type": "note",
    "importance": 3
  }'

# Get your memories
curl -H "Authorization: Bearer <session_token>" \
  http://localhost:3000/memory
```

### Environment Variables

```env
# Database
MONGO_URI=mongodb://localhost:27017
DB_NAME=memlayer

# API Security (optional)
# API_KEY is an optional legacy fallback for local testing.
# Prefer registering a user to get a unique per-user api_key.
# API_KEY=

# Embeddings (optional)
EMBEDDINGS_PROVIDER=LOCAL  # or OPENAI
OPENAI_API_KEY=your-openai-key

# MCP Configuration
MEMORY_API_URL=http://localhost:3000
```

## 📊 Memory Schema

```javascript
{
  user_id: String,           // User identifier
  content: String,           // Memory content
  title: String,             // Auto-generated or user-provided title
  type: String,              // note, task, idea, code, link, snippet, document
  tags: [String],            // Auto-suggested or user tags
  category: String,          // Auto-categorized content
  folder: String,            // Hierarchical organization
  importance: Number,        // 1-5 importance scale
  metadata: Object,          // Rich metadata including source, word count, etc.
  embedding: Array,          // Vector representation for semantic search
  created_at: Date,          // Creation timestamp
  updated_at: Date,          // Last update timestamp
  accessed_at: Date,         // Last access timestamp
  access_count: Number       // Usage tracking
}
```

## 🔍 Search Features

### Hybrid Search Algorithm
- **Semantic Similarity (70%)**: Uses embeddings for meaning-based search
- **Keyword Matching (30%)**: Traditional text search with weighted scoring
- **Metadata Boost**: Title and tag matches get higher scores

### Advanced Filtering
- **Type Filtering**: Filter by memory type
- **Tag Filtering**: Filter by specific tags
- **Category Filtering**: Filter by content category
- **Importance Range**: Filter by importance level
- **Date Range**: Filter by creation date
- **Folder Filtering**: Filter by folder structure

## 🎯 Competitive Advantages

### 
- **Open Source**: Full control and customization
- **Local-First**: Privacy-focused with local embedding support
- **Developer-Friendly**: MCP integration and API-first design
- **Extensible**: Plugin system and modular architecture
- **Performance**: Optimized for speed and efficiency

### Key Differentiators
1. **MCP Integration**: Native MCP server with 8 comprehensive tools
2. **Hybrid Search**: Advanced semantic + keyword search
3. **Auto-Intelligence**: Smart tagging, categorization, and title generation
4. **Web UI**: Modern, responsive interface
5. **Developer Tools**: API-first design with comprehensive documentation

## 🔧 Development

### Running in Development Mode
```bash
npm run dev
```

### Running MCP Server
```bash
npm run mcp
```

## 🧪 **API Testing**

### **User Registration & Authentication**
```bash
# 1. Register a new user
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "testpass123"
  }'

# 2. Login to get session token
curl -X POST http://localhost:3000/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123"
  }'

# Save the session_token from the response
```

### **Memory Management (with Session Token)**
```bash
# Store a memory
curl -X POST http://localhost:3000/memory \
  -H "Authorization: Bearer <session_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Testing the new authentication system",
    "type": "note",
    "importance": 4,
    "tags": ["test", "auth"],
    "category": "Development"
  }'

# Get memories
curl -H "Authorization: Bearer <session_token>" \
  http://localhost:3000/memory

# Search memories
curl -H "Authorization: Bearer <session_token>" \
  "http://localhost:3000/memory/search?query=authentication"
```

### Relations API Examples
```bash
# Create a relation
curl -X POST http://localhost:3000/relations \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "<memory_id_A>",
    "target_id": "<memory_id_B>",
    "type": "references",
    "weight": 2
  }'

# Get graph data
curl -X GET "http://localhost:3000/relations/graph" \
  -H "Authorization: Bearer your-api-key"
```

## 📈 Performance

### Search Performance
- **Hybrid Algorithm**: Combines semantic and keyword search for optimal results
- **Caching**: Intelligent caching of embeddings and search results
- **Pagination**: Efficient pagination for large result sets
- **Indexing**: Optimized database indexes for fast queries

### Scalability
- **Horizontal Scaling**: Stateless API design supports multiple instances
- **Database Optimization**: Efficient MongoDB queries and indexing
- **Memory Management**: Optimized embedding storage and retrieval

## 🔒 Security

### Authentication
- **API Key Authentication**: Secure bearer token authentication
- **User Isolation**: Complete user data isolation
- **Input Validation**: Comprehensive input validation and sanitization

### Data Protection
- **Encryption**: Support for encrypted storage
- **Privacy**: Local-first design with optional cloud features
- **Audit Trail**: Comprehensive logging and audit capabilities

## 🚀 Roadmap

### Phase 2 (Next 1-2 months)
- [ ] Vector database integration (Pinecone/Weaviate)
- [ ] Advanced memory intelligence (auto-summarization)
- [x] Memory relationships and linking
- [ ] Collaborative features
- [ ] Advanced analytics dashboard

### Phase 3 (Next 2-3 months)
- [ ] Plugin system
- [ ] Integration ecosystem
- [ ] Mobile application
- [ ] Enterprise features
- [ ] Advanced AI capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: See this README and inline code comments
- **Issues**: Report bugs and feature requests via GitHub issues
- **Discussions**: Join community discussions for help and ideas

---

**MemLayer** - Your intelligent memory companion with MCP integration
