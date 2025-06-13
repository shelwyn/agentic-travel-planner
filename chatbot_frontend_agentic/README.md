# Travel Assistant Chatbot Frontend

A modern, responsive Next.js chatbot frontend for the Agentic Travel Planner system. Features real-time travel planning with intelligent agent coordination, rich metadata display, and an intuitive chat interface.

## ✨ Features

### 🤖 **Intelligent Chat Interface**
- Real-time conversation with travel planning AI
- Rich text rendering (headers, bold text, tables, lists)
- Copy functionality for bot responses
- Auto-scroll and message history
- Responsive design with smooth animations

### 📊 **Live Metadata Display**
- **Intent Analysis**: Shows what the AI understood from user input
- **Agent Coordination**: Displays which agents (flights, hotels, activities) were triggered
- **Real-time Results**: Live display of API responses from travel agents
- **Tabbed Interface**: Organized view of flights, hotels, and activities
- **Collapsible Sidebar**: Toggle between focused chat and detailed metadata view

### 🎨 **Modern UI/UX**
- Clean, professional design matching modern chat interfaces
- Smooth transitions and hover effects
- Heartbeat loading animation during API calls
- Error handling with user-friendly messages
- Accessibility features and tooltips


## 📁 Project Structure

```
chatbot_frontend_agentic/
├── src/
│   └── app/
│       ├── components/
│       │   └── TravelChatbot.tsx     # Main chatbot component
│       ├── globals.css               # Global styles
│       ├── layout.tsx                # App layout
│       └── page.tsx                  # Main page
├── package.json                      # Dependencies
├── next.config.ts                    # Next.js configuration
├── tailwind.config.ts               # Tailwind CSS config
└── tsconfig.json                     # TypeScript config
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Backend API running on `http://localhost:8000`

### Installation & Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd chatbot_frontend_agentic
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000` (or the port shown in terminal)

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Type checking
npm run type-check
```

## 🔧 Configuration

### API Endpoint
The chatbot communicates with the backend API at:
```
http://localhost:8000/chat
```

If you need to change this endpoint, update the fetch URL in `src/app/components/TravelChatbot.tsx`:
```typescript
const response = await fetch('http://localhost:8000/chat', {
  // ... request configuration
});
```

### Environment Setup
No environment variables are required for basic functionality. The app works out of the box once dependencies are installed.

## 📡 API Integration

### Request Format
```json
{
  "prompt": "help me plan a vacation from mumbai to kerala for 3 days starting june 20th",
  "history": [
    {
      "role": "user", 
      "parts": "previous message"
    },
    {
      "role": "model",
      "parts": "previous response"
    }
  ]
}
```

### Response Format
```json
{
  "success": true,
  "response": "AI generated response text",
  "history": [...],
  "metadata": {
    "intent": {
      "needsFlights": true,
      "needsHotels": true,
      "needsActivities": true,
      "destination": "Kerala",
      "origin": "Mumbai"
    },
    "agentsUsed": ["flights", "hotels", "activities"],
    "agentResults": {
      "flights": [...],
      "hotels": [...], 
      "activities": [...]
    }
  }
}
```

## 🎯 Usage Guide

### Basic Chat
1. Type your travel planning query in the input box
2. Press Enter or click the send button
3. Watch the heartbeat animation while the AI processes your request
4. View the response and use the copy button to save information

### Metadata Panel
1. **Toggle Visibility**: Use the "Hide/Show Metadata" button in the header
2. **View Intent**: See how the AI interpreted your request
3. **Check Agents**: See which travel agents were activated
4. **Browse Results**: Use tabs to view flights, hotels, and activities
5. **Floating Access**: When collapsed, use the floating button to quickly show metadata

### Sample Queries
```
✈️ Travel Planning:
"Plan my vacation to Mumbai from Bangalore for 3 days starting June 20th"

🏨 Hotel Only:
"Find hotels in Kerala for June 20-23"

🎯 Activities Only:
"What are the best things to do in Goa?"

💬 General Chat:
"What's the weather like?" or "Hello, how are you?"
```

## 🛠️ Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **State Management**: React Hooks (useState, useEffect, useMemo)
- **HTTP Client**: Fetch API
- **Build Tool**: Next.js built-in bundler

## 🎨 Features Deep Dive

### Rich Text Rendering
- **Headers**: `#`, `##`, `###` for different heading levels
- **Bold Text**: `**text**` rendered with proper styling
- **Tables**: Pipe-separated format with responsive design
- **Lists**: Bullet points with proper indentation
- **Links**: Automatic link detection and styling

### Copy Functionality
- Hover over any bot message to reveal copy button
- Visual feedback with green checkmark
- Automatic clipboard API integration
- 2-second confirmation display

### Responsive Design
- **Desktop**: Full two-column layout with collapsible sidebar
- **Mobile**: Optimized single-column view
- **Tablet**: Adaptive layout based on screen size
- **Animations**: Smooth transitions across all devices

## 🚨 Troubleshooting

### Common Issues

**Backend Connection Error:**
```
Error: Failed to fetch
```
- Ensure backend is running on `http://localhost:8000`
- Check CORS configuration on backend
- Verify network connectivity

**TypeScript Errors:**
```bash
npm run type-check
```
- Run type checking to identify issues
- Ensure all dependencies are properly installed

**Styling Issues:**
```bash
npm run dev
```
- Restart development server
- Clear browser cache
- Check Tailwind CSS configuration

### Performance Tips
- Use the collapsible sidebar for focused chat experience
- Clear chat history periodically using "New chat" button
- Keep browser developer tools closed in production for better performance

## 📝 Development Notes

### Component Structure
- **TravelChatbot**: Main component handling chat logic and layout
- **MessageContent**: Renders markdown-like formatted text
- **MetadataPanel**: Displays API metadata with tabbed interface
- **HeartbeatLoader**: Loading animation component

### State Management
- Chat messages stored in component state
- Metadata updates with each API response
- UI state (sidebar, copy status) managed locally
- No external state management needed

### Styling Approach
- Utility-first with Tailwind CSS
- Component-specific styles where needed
- Consistent color scheme and spacing
- Responsive design principles
