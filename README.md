# Agentic Travel Planner

> An intelligent, multi-agent travel planning system that automatically coordinates flight searches, hotel bookings, and activity recommendations using AI agents powered by the Vercel AI SDK and Google Gemini 2.0 Flash.


## 🌟 Overview

The Agentic Travel Planner is a sophisticated travel planning system that uses autonomous AI agents to intelligently coordinate multiple travel services. Unlike traditional booking platforms, this system employs AI agents that can understand natural language requests and automatically decide which services to call, when to call them, and how to combine the results into comprehensive travel plans.

### 🎯 Key Features

- **🤖 Autonomous AI Agents** - Intelligent agents that decide when and how to search for travel services
- **🧠 Smart Intent Analysis** - Automatically determines if requests are travel-related vs general questions
- **✈️ Multi-Service Coordination** - Seamlessly integrates flight search, hotel booking, and activity recommendations
- **💬 Natural Language Interface** - Chat with the system using everyday language
- **📊 Rich Metadata Display** - Real-time visualization of agent decisions and API responses
- **🔧 Multi-Step Tool Usage** - AI autonomously breaks down complex travel requests into manageable steps
- **🛡️ Type-Safe Architecture** - Full TypeScript and Zod validation throughout the system

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agentic Travel Planner                      │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)                                            │
│  ├── Chat Interface                                            │
│  ├── Metadata Visualization                                    │
│  └── Real-time Agent Tracking                                  │
├─────────────────────────────────────────────────────────────────┤
│  AI Orchestration Layer (Node.js + Vercel AI SDK)             │
│  ├── Intent Analyzer                                           │
│  ├── Agent Coordinator                                         │
│  ├── Multi-Step Tool Usage                                     │
│  └── Response Builder                                          │
├─────────────────────────────────────────────────────────────────┤
│  External Services                                             │
│  ├── Flight Search API (FastAPI + CSV Data)                   │
│  ├── Hotel Search API (FastAPI + CSV Data)                    │
│  └── Activity Generator (AI-powered)                          │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
agentic-travel-planner/
├── agentic_bot_api/                 # AI Orchestration Layer
│   ├── src/
│   │   └── index.ts                 # Main agent coordination logic
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── chatbot_frontend_agentic/        # Next.js Frontend
│   ├── src/
│   │   └── app/
│   │       ├── components/
│   │       │   └── TravelChatbot.tsx
│   │       ├── globals.css
│   │       ├── layout.tsx
│   │       └── page.tsx
│   ├── package.json
│   ├── next.config.ts
│   └── tailwind.config.ts
└── mock_flight_hotel_api/           # Travel Data APIs
    ├── main.py                      # FastAPI application
    ├── requirements.txt
    ├── flights.csv                  # Flight data
    └── hotels.csv                   # Hotel data
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.8+
- Google AI API key (Gemini)

### 1. Clone the Repository

```bash
git clone https://github.com/shelwyn/agentic-travel-planner.git
cd agentic-travel-planner
```

### 2. Setup Backend Data APIs

```bash
cd mock_flight_hotel_api

# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
python main.py
```
*Server runs on http://localhost:5000*

### 3. Setup AI Orchestration Layer

```bash
cd ../agentic_bot_api

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Add your Google AI API key to .env
echo "GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here" >> .env

# Start the server
npm run dev
```
*Server runs on http://localhost:8000*

### 4. Setup Frontend

```bash
cd ../chatbot_frontend_agentic

# Install dependencies
npm install

# Start the development server
npm run dev
```
*Frontend runs on http://localhost:3000*

### 5. Get Your API Keys

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key for Gemini 2.0 Flash
3. Add it to your `.env` file in the `agentic_bot_api` directory

## 🎮 Usage Examples

### Travel Planning Queries
```
🗣️ "Plan my vacation to Mumbai from Bangalore for 3 days starting June 20th"
🗣️ "Find flights from Delhi to Kerala on December 15th for 2 people"
🗣️ "Show me hotels in Goa for a weekend trip"
🗣️ "What are the best activities to do in Mumbai?"
```

### General Conversation
```
🗣️ "What's the weather like?"
🗣️ "Hello, how are you?"
🗣️ "Tell me about Indian cuisine"
```

The system intelligently routes travel-related queries to the appropriate agents while handling general questions directly.

## 🔧 Configuration

### Environment Variables

**agentic_bot_api/.env:**
```env
# Required: Google AI API Key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here

# Optional: External API URLs
FLIGHT_API_URL=http://localhost:5000/searchflight
HOTEL_API_URL=http://localhost:5000/searchhotel

# Optional: Server Configuration
PORT=8000
```

### API Response Format

**Chat API Response:**
```json
{
  "success": true,
  "response": "Here are your travel options...",
  "history": [...],
  "metadata": {
    "intent": {
      "needsFlights": true,
      "needsHotels": true,
      "needsActivities": true,
      "destination": "Mumbai",
      "origin": "Bangalore"
    },
    "agentsUsed": ["flights", "hotels", "activities"],
    "agentResults": {
      "flights": [
        {
          "searchId": "FL123456",
          "flightName": "Air India",
          "price": 18000,
          "departureTime": "08:00 AM",
          "route": "Bangalore to Mumbai"
        }
      ],
      "hotels": [...],
      "activities": [...]
    }
  }
}
```

## 🛠️ Technology Stack

### Frontend
- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Lucide React** for icons

### AI Orchestration
- **Vercel AI SDK** for agent coordination
- **Google Gemini 2.0 Flash** as the LLM
- **Express.js** as the web framework
- **Zod** for runtime validation

### Backend Services
- **FastAPI** for high-performance APIs
- **Pandas** for CSV data processing
- **Pydantic** for data validation

## 🔄 How It Works

### 1. Intent Analysis
The system first analyzes user input to determine:
- Is this a travel-related request?
- What travel services are needed (flights, hotels, activities)?
- What are the travel parameters (dates, destinations, travelers)?

### 2. Agent Coordination
Based on the intent analysis, the AI coordinator:
- Activates relevant travel agents
- Coordinates parallel API calls when possible
- Manages the execution flow using `maxSteps`

### 3. Multi-Step Tool Usage
Using the Vercel AI SDK's `maxSteps` feature, agents can:
- Make multiple API calls autonomously
- Adapt their strategy based on intermediate results
- Combine results from different services intelligently

### 4. Response Assembly
The system combines all agent results into:
- A natural language response for the chat interface
- Structured metadata for rich frontend displays
- Error handling with detailed feedback

## 🌐 API Endpoints

### AI Orchestration Layer (Port 8000)
- **POST** `/chat` - Main chat endpoint for travel planning
- **GET** `/health` - Health check endpoint

### Data Services (Port 5000)
- **POST** `/searchflight` - Flight search API
- **POST** `/searchhotel` - Hotel search API
- **GET** `/debug` - View sample data for troubleshooting

### Frontend (Port 3000)
- **/** - Main chat interface
- Rich metadata visualization
- Real-time agent tracking

## 🧪 Development

### Running Tests
```bash
# Backend API tests
cd mock_flight_hotel_api
python -m pytest

# Frontend tests
cd chatbot_frontend_agentic
npm test

# AI layer tests
cd agentic_bot_api
npm test
```

### Building for Production
```bash
# Build frontend
cd chatbot_frontend_agentic
npm run build

# Build AI orchestration layer
cd ../agentic_bot_api
npm run build

# Backend is ready for production as-is
```


## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Vercel AI SDK** for making agent coordination simple and powerful
- **Google Gemini** for providing advanced language understanding
- **FastAPI** for high-performance API development
- **Next.js** for the excellent React framework

## 📞 Support

For questions, issues, or contributions:
- **GitHub Issues**: [Create an issue](https://github.com/shelwyn/agentic-travel-planner/issues)
- **Documentation**: Check the individual component READMEs in each directory
- **API Documentation**: Visit `/docs` endpoints on running servers

---
