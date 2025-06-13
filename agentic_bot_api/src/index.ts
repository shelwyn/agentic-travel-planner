import "dotenv/config";
import express, { Request, Response } from 'express';
import { google } from '@ai-sdk/google';
import { generateText, generateObject, tool } from 'ai';
import axios from 'axios';
import { z } from 'zod';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Initialize Vercel AI SDK with Google Gemini
const model = google('gemini-2.0-flash', {
  useSearchGrounding: false // Set to true if you want search grounding
});

// Global state store to capture tool results (workaround for AI SDK issue)
let globalToolResults: {
  flights?: FlightSearch[];
  hotels?: HotelSearch[];
  activities?: ActivityData[];
  errors?: string[];
} = {};

// API URLs from environment
const FLIGHT_API_URL = process.env.FLIGHT_API_URL || 'https://localhost:5000/bookflight';
const HOTEL_API_URL = process.env.HOTEL_API_URL || 'https://localhost:5000/bookhotel';

console.log('🔧 Environment Configuration:');
console.log(`📍 Flight API URL: ${FLIGHT_API_URL}`);
console.log(`📍 Hotel API URL: ${HOTEL_API_URL}`);
console.log(`🤖 Using Gemini Model: gemini-2.0-flash via Vercel AI SDK`);
console.log('═'.repeat(50));

// Zod Schemas for Data Validation - Support both old and new formats
const LegacyMessageSchema = z.object({
  role: z.enum(['user', 'model']), // Old format
  parts: z.string() // Old format
});

const NewMessageSchema = z.object({
  role: z.enum(['user', 'assistant']), // New format
  content: z.string() // New format
});

const MessageSchema = z.union([LegacyMessageSchema, NewMessageSchema]);

const TravelRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  history: z.array(MessageSchema).optional().default([])
});

// Helper function to normalize messages to new format
const normalizeMessage = (msg: any): { role: 'user' | 'assistant', content: string } => {
  if ('parts' in msg) {
    // Legacy format: convert 'model' -> 'assistant' and 'parts' -> 'content'
    return {
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: msg.parts
    };
  } else {
    // New format: use as-is
    return {
      role: msg.role,
      content: msg.content
    };
  }
};

const TravelIntentSchema = z.object({
  needsFlights: z.boolean(),
  needsHotels: z.boolean(),
  needsActivities: z.boolean(),
  destination: z.string().nullable().optional(),
  origin: z.string().nullable().optional(),
  checkIn: z.string().nullable().optional(),
  checkOut: z.string().nullable().optional(),
  departureDate: z.string().nullable().optional(),
  returnDate: z.string().nullable().optional(),
  travelers: z.number().nullable().optional(),
  reasoning: z.string()
});

// API Response Schemas
const FlightSearchSchema = z.object({
  searchId: z.string().optional(),
  departureDate: z.string(),
  returnDate: z.string(),
  travelers: z.number(),
  destination: z.string(),
  origin: z.string(),
  flightName: z.string(),
  price: z.number(),
  departureTime: z.string(),
  arrivalTime: z.string().optional().nullable(), // Allow null values
  flightNumber: z.string().optional(),
  route: z.string().optional()
});

const FlightAPIResponseSchema = z.object({
  status: z.string(),
  results: z.array(FlightSearchSchema)
});

const HotelSearchSchema = z.object({
  searchId: z.string().optional(),
  checkIn: z.string(),
  checkOut: z.string(),
  destination: z.string(),
  hotelName: z.string(),
  ratePerNight: z.number()
});

const HotelAPIResponseSchema = z.object({
  status: z.string(),
  results: z.array(HotelSearchSchema)
});

const ActivityDataSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.string(),
  category: z.string()
});

const AgentResultsSchema = z.object({
  flights: z.array(FlightSearchSchema).optional(),
  hotels: z.array(HotelSearchSchema).optional(),
  activities: z.array(ActivityDataSchema).optional(),
  errors: z.array(z.string()).optional()
});

// Type definitions from Zod schemas
type LegacyMessage = z.infer<typeof LegacyMessageSchema>;
type NewMessage = z.infer<typeof NewMessageSchema>;
type Message = z.infer<typeof MessageSchema>;
type TravelRequest = z.infer<typeof TravelRequestSchema>;
type TravelIntent = z.infer<typeof TravelIntentSchema>;
type FlightSearch = z.infer<typeof FlightSearchSchema>;
type HotelSearch = z.infer<typeof HotelSearchSchema>;
type ActivityData = z.infer<typeof ActivityDataSchema>;
type AgentResults = z.infer<typeof AgentResultsSchema>;

// Travel Intent Analyzer using Vercel AI SDK
class TravelIntentAnalyzer {
  async analyzeTravelIntent(prompt: string, history: Message[] = []): Promise<TravelIntent> {
    console.log('🔍 INTENT ANALYSIS - Starting...');
    console.log(`📝 User Prompt: "${prompt}"`);
    console.log(`📚 History Messages: ${history.length}`);
    
    // Normalize messages to new format
    const normalizedHistory = history.map(normalizeMessage);
    
    const conversationContext = normalizedHistory.map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    const analysisPrompt = `
You are a travel planning AI that analyzes user requests to determine what travel services they need.

IMPORTANT RULES:
1. If the user is asking a GENERIC question (weather, general info, greetings, non-travel topics), set ALL agent flags to false
2. For TRAVEL PLANNING requests, you need ALL required information before triggering agents:
   - Origin (where traveling FROM)
   - Destination (where traveling TO) 
   - Departure date (when going)
   - Return date (when coming back)
   - Number of travelers
3. If ANY required travel information is missing, set ALL agent flags to FALSE
4. Only trigger agents when you have COMPLETE travel information
5. For check-in/check-out dates, use the same dates as departure/return dates

TRAVEL PLANNING GUIDELINES:
- "Plan a trip/vacation" = needs ALL required info (origin, destination, dates, travelers)
- "Search flights" = needs origin, destination, dates, travelers
- "Find hotels" = needs destination, dates
- "Things to do" = needs destination only
- If planning ANY travel service, verify ALL required fields are present

REQUIRED INFORMATION CHECK:
- Look through BOTH current prompt AND conversation history for missing details
- If user says "plan my vacation" but doesn't provide origin → set all flags FALSE
- If user says "search flights" but no dates provided → set all flags FALSE
- If user says "find hotels" but no destination → set all flags FALSE

Conversation History:
${conversationContext}

Current User Request: "${prompt}"

Analyze this request and determine:
1. Do they need flight information? (true ONLY if they want flights AND have all required info)
2. Do they need hotel information? (true ONLY if they want hotels AND have all required info)
3. Do they need activity information? (true ONLY if they want activities AND have destination)
4. Extract travel details from BOTH current prompt AND conversation history:
   - Origin city/airport
   - Destination city
   - Departure date (YYYY-MM-DD format)
   - Return date (YYYY-MM-DD format)  
   - Number of travelers

Examples:
- "Hello, how are you?" → ALL FALSE (generic greeting)
- "Plan my vacation" → ALL FALSE (missing: origin, destination, dates, travelers)
- "Plan my vacation to Mumbai" → ALL FALSE (missing: origin, dates, travelers)  
- "Plan my vacation to Mumbai from Delhi" → ALL FALSE (missing: dates, travelers)
- "Plan my vacation to Mumbai from Delhi on Dec 15" → ALL FALSE (missing: return date, travelers)
- "Plan my vacation to Mumbai from Delhi on Dec 15-20 for 2 people" → ALL TRUE (complete info)
- "What to do in Paris?" → needsActivities: true (only needs destination for activities)
- "Search flights to Tokyo" → ALL FALSE (missing: origin, dates, travelers)
`;

    try {
      console.log('🤖 Sending prompt to Gemini via Vercel AI SDK...');
      
      const { object } = await generateObject({
        model,
        schema: TravelIntentSchema,
        prompt: analysisPrompt,
        temperature: 0.1, // Lower temperature for consistent analysis
      });
      
      console.log('✅ INTENT ANALYSIS - Completed');
      console.log('🎯 Final Intent:');
      console.log(`   🛫 Needs Flights: ${object.needsFlights}`);
      console.log(`   🏨 Needs Hotels: ${object.needsHotels}`);
      console.log(`   🎭 Needs Activities: ${object.needsActivities}`);
      console.log(`   📍 Origin: ${object.origin || 'Not specified'}`);
      console.log(`   📍 Destination: ${object.destination || 'Not specified'}`);
      console.log(`   📅 Departure: ${object.departureDate || 'Not specified'}`);
      console.log(`   📅 Return: ${object.returnDate || 'Not specified'}`);
      console.log(`   👥 Travelers: ${object.travelers || 'Not specified'}`);
      console.log(`   💭 Reasoning: ${object.reasoning}`);
      console.log('═'.repeat(50));
      
      return object;
      
    } catch (error) {
      console.error('❌ INTENT ANALYSIS - Failed:', error);
      
      // Return validated fallback response
      const fallback = TravelIntentSchema.parse({
        needsFlights: false,
        needsHotels: false,
        needsActivities: false,
        reasoning: 'Failed to analyze intent, defaulting to no agents'
      });
      
      console.log('🔄 Using fallback intent (no agents)');
      console.log('═'.repeat(50));
      return fallback;
    }
  }
}

// Flight API Agent with tool-based approach
const createFlightTool = () => tool({
  description: 'Search for flights between origin and destination',
  parameters: z.object({
    origin: z.string().describe('Origin city or airport'),
    destination: z.string().describe('Destination city or airport'),
    departureDate: z.string().describe('Departure date in YYYY-MM-DD format'),
    returnDate: z.string().describe('Return date in YYYY-MM-DD format'),
    travelers: z.number().describe('Number of travelers')
  }),
  execute: async ({ origin, destination, departureDate, returnDate, travelers }) => {
    console.log('🛫 FLIGHT TOOL - Executing...');
    console.log(`📍 Route: ${origin} → ${destination}`);
    console.log(`📅 Dates: ${departureDate} to ${returnDate}`);
    console.log(`👥 Travelers: ${travelers}`);
    
    try {
      const payload = {
        departureDate,
        returnDate,
        travelers,
        destination,
        origin
      };

      console.log('📤 FLIGHT API - Sending request...');
      console.log(`🔗 API URL: ${FLIGHT_API_URL}`);

      const response = await axios.post(FLIGHT_API_URL, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        },
        // Bypass SSL verification for localhost development
        httpsAgent: FLIGHT_API_URL.includes('localhost') ? 
          new (require('https').Agent)({ rejectUnauthorized: false }) : undefined
      });

      console.log('📥 FLIGHT API - Response received');
      console.log(`📊 Status Code: ${response.status}`);
      console.log('📋 Raw Response Data:', JSON.stringify(response.data, null, 2));

      // Validate API response
      const validatedResponse = FlightAPIResponseSchema.parse(response.data);
      
      if (validatedResponse.status === 'success') {
        console.log(`✅ FLIGHT TOOL - Success! Retrieved ${validatedResponse.results.length} flight options`);
        validatedResponse.results.forEach((flight, index) => {
          const flightInfo = `${flight.flightName} ${flight.flightNumber || ''}: ₹${flight.price}`;
          const timeInfo = flight.arrivalTime ? `(${flight.departureTime}-${flight.arrivalTime})` : `(${flight.departureTime})`;
          const routeInfo = flight.route || `${flight.origin} to ${flight.destination}`;
          console.log(`   ${index + 1}. ${flightInfo} ${timeInfo}${routeInfo}`);
        });
        
        // Store in global state as workaround
        globalToolResults.flights = validatedResponse.results;
        console.log('🔄 FLIGHT TOOL - Stored results in global state');
        
        const result = {
          success: true,
          flights: validatedResponse.results,
          message: `Found ${validatedResponse.results.length} flight options`,
          count: validatedResponse.results.length
        };
        
        console.log('🔍 FLIGHT TOOL - Returning result:', JSON.stringify(result, null, 2));
        return result;
      } else {
        console.log('❌ FLIGHT API - Non-success status received');
        const errorMsg = `Flight API returned non-success status: ${validatedResponse.status}`;
        if (!globalToolResults.errors) globalToolResults.errors = [];
        globalToolResults.errors.push(errorMsg);
        
        const errorResult = {
          success: false,
          flights: [],
          message: errorMsg,
          error: `API status: ${validatedResponse.status}`
        };
        console.log('🔍 FLIGHT TOOL - Returning error result:', JSON.stringify(errorResult, null, 2));
        return errorResult;
      }

    } catch (error) {
      console.error('❌ FLIGHT TOOL - API call failed:', error.message);
      const errorMsg = `Flight search failed: ${error.message}`;
      if (!globalToolResults.errors) globalToolResults.errors = [];
      globalToolResults.errors.push(errorMsg);
      
      const errorResult = {
        success: false,
        flights: [],
        message: errorMsg,
        error: error.message
      };
      console.log('🔍 FLIGHT TOOL - Returning exception result:', JSON.stringify(errorResult, null, 2));
      return errorResult;
    }
  },
});

// Hotel API Agent with tool-based approach
const createHotelTool = () => tool({
  description: 'Search for hotels in a destination',
  parameters: z.object({
    destination: z.string().describe('Destination city'),
    checkIn: z.string().describe('Check-in date in YYYY-MM-DD format'),
    checkOut: z.string().describe('Check-out date in YYYY-MM-DD format')
  }),
  execute: async ({ destination, checkIn, checkOut }) => {
    console.log('🏨 HOTEL TOOL - Executing...');
    console.log(`📍 Destination: ${destination}`);
    console.log(`📅 Dates: ${checkIn} to ${checkOut}`);
    
    try {
      const payload = {
        checkIn,
        checkOut,
        destination
      };

      console.log('📤 HOTEL API - Sending request...');
      console.log(`🔗 API URL: ${HOTEL_API_URL}`);

      const response = await axios.post(HOTEL_API_URL, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        },
        // Bypass SSL verification for localhost development
        httpsAgent: HOTEL_API_URL.includes('localhost') ? 
          new (require('https').Agent)({ rejectUnauthorized: false }) : undefined
      });

      console.log('📥 HOTEL API - Response received');
      console.log(`📊 Status Code: ${response.status}`);
      console.log('📋 Raw Response Data:', JSON.stringify(response.data, null, 2));

      // Validate API response
      const validatedResponse = HotelAPIResponseSchema.parse(response.data);
      
      if (validatedResponse.status === 'success') {
        console.log(`✅ HOTEL TOOL - Success! Retrieved ${validatedResponse.results.length} hotel options`);
        validatedResponse.results.forEach((hotel, index) => {
          const searchInfo = hotel.searchId ? ` (ID: ${hotel.searchId})` : '';
          console.log(`   ${index + 1}. ${hotel.hotelName}: ₹${hotel.ratePerNight}/night${searchInfo}`);
        });
        
        // Store in global state as workaround
        globalToolResults.hotels = validatedResponse.results;
        console.log('🔄 HOTEL TOOL - Stored results in global state');
        
        const result = {
          success: true,
          hotels: validatedResponse.results,
          message: `Found ${validatedResponse.results.length} hotel options`,
          count: validatedResponse.results.length
        };
        
        console.log('🔍 HOTEL TOOL - Returning result:', JSON.stringify(result, null, 2));
        return result;
      } else {
        console.log('❌ HOTEL API - Non-success status received');
        const errorMsg = `Hotel API returned non-success status: ${validatedResponse.status}`;
        if (!globalToolResults.errors) globalToolResults.errors = [];
        globalToolResults.errors.push(errorMsg);
        
        const errorResult = {
          success: false,
          hotels: [],
          message: errorMsg,
          error: `API status: ${validatedResponse.status}`
        };
        console.log('🔍 HOTEL TOOL - Returning error result:', JSON.stringify(errorResult, null, 2));
        return errorResult;
      }

    } catch (error) {
      console.error('❌ HOTEL TOOL - API call failed:', error.message);
      const errorMsg = `Hotel search failed: ${error.message}`;
      if (!globalToolResults.errors) globalToolResults.errors = [];
      globalToolResults.errors.push(errorMsg);
      
      const errorResult = {
        success: false,
        hotels: [],
        message: errorMsg,
        error: error.message
      };
      console.log('🔍 HOTEL TOOL - Returning exception result:', JSON.stringify(errorResult, null, 2));
      return errorResult;
    }
  },
});

// Activities Tool
const createActivitesTool = () => tool({
  description: 'Generate popular tourist activities and attractions for a destination',
  parameters: z.object({
    destination: z.string().describe('Destination city')
  }),
  execute: async ({ destination }) => {
    console.log('🎯 ACTIVITIES TOOL - Executing...');
    console.log(`📍 Destination: ${destination}`);
    
    try {
      const { object } = await generateObject({
        model,
        schema: z.object({
          activities: z.array(ActivityDataSchema).max(5)
        }),
        prompt: `Generate a list of 5 popular tourist activities and attractions for ${destination}.

Focus on:
- Popular tourist attractions
- Tours and experiences  
- Museums and cultural sites
- Food experiences
- Adventure activities
- Shopping areas

For each activity provide:
- name: Clear, specific name
- description: Brief description (1-2 sentences)
- price: Estimated price, "Free", "Varies", or specific amount with currency
- category: One of: Tours, Museums, Food, Adventure, Shopping, Culture, Nature

Make the activities diverse and appealing to different types of travelers.`,
        temperature: 0.7,
      });
      
      console.log(`✅ ACTIVITIES TOOL - Success! Generated ${object.activities.length} activities`);
      object.activities.forEach((activity, index) => {
        console.log(`   ${index + 1}. ${activity.name}: ${activity.price} (${activity.category})`);
      });
      
      // Store in global state as workaround
      globalToolResults.activities = object.activities;
      console.log('🔄 ACTIVITIES TOOL - Stored results in global state');
      
      const result = {
        success: true,
        activities: object.activities,
        message: `Generated ${object.activities.length} activity recommendations`,
        count: object.activities.length
      };
      
      console.log('🔍 ACTIVITIES TOOL - Returning result:', JSON.stringify(result, null, 2));
      return result;
      
    } catch (error) {
      console.error('❌ ACTIVITIES TOOL - Failed:', error.message);
      const errorMsg = `Activity generation failed: ${error.message}`;
      if (!globalToolResults.errors) globalToolResults.errors = [];
      globalToolResults.errors.push(errorMsg);
      
      const errorResult = {
        success: false,
        activities: [],
        message: errorMsg,
        error: error.message
      };
      console.log('🔍 ACTIVITIES TOOL - Returning exception result:', JSON.stringify(errorResult, null, 2));
      return errorResult;
    }
  },
});

// Travel Planning System with Multi-Step Tool Usage
class TravelPlanningSystem {
  private intentAnalyzer: TravelIntentAnalyzer;

  constructor() {
    console.log('🚀 Initializing Travel Planning System with Vercel AI SDK...');
    this.intentAnalyzer = new TravelIntentAnalyzer();
    console.log('✅ Travel Planning System initialized');
    console.log('═'.repeat(50));
  }

  async processRequest(prompt: string, history: Message[] = []): Promise<{
    response: string;
    intent: TravelIntent;
    agentResults: AgentResults;
    agentsUsed: string[];
  }> {
    console.log('🎯 MAIN SYSTEM - Processing travel request...');
    console.log(`📝 Request: "${prompt}"`);
    console.log(`📚 History: ${history.length} messages`);
    
    // Normalize message history to new format
    const normalizedHistory = history.map(normalizeMessage);
    
    // Step 1: Analyze intent
    const intent = await this.intentAnalyzer.analyzeTravelIntent(prompt, history);

    // Step 2: Determine which agents to use
    const agentsUsed: string[] = [];
    if (intent.needsFlights) agentsUsed.push('flights');
    if (intent.needsHotels) agentsUsed.push('hotels'); 
    if (intent.needsActivities) agentsUsed.push('activities');

    console.log('🤖 MAIN SYSTEM - Agent routing decision:');
    console.log(`   Agents to execute: ${agentsUsed.length > 0 ? agentsUsed.join(', ') : 'NONE (generic query)'}`);

    // Step 3: Process with AI SDK's multi-step tool usage
    let agentResults: AgentResults = {};
    
    if (agentsUsed.length > 0) {
      console.log('🚀 MAIN SYSTEM - Using AI SDK multi-step tool execution...');
      
      // Clear global state before starting
      globalToolResults = {};
      console.log('🔄 MAIN SYSTEM - Cleared global tool results state');
      
      // Build conversation context for the AI
      const conversationContext = normalizedHistory.map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n');

      // Create travel planning prompt based on intent
      let travelPrompt = `You are a travel planning assistant. Based on the user's request, use the available tools to search for travel information.

User Request: "${prompt}"

Conversation History:
${conversationContext}

Travel Intent Analysis:
- Needs Flights: ${intent.needsFlights}
- Needs Hotels: ${intent.needsHotels}  
- Needs Activities: ${intent.needsActivities}
- Origin: ${intent.origin || 'Not specified'}
- Destination: ${intent.destination || 'Not specified'}
- Departure Date: ${intent.departureDate || 'Not specified'}
- Return Date: ${intent.returnDate || 'Not specified'}
- Check-in Date: ${intent.checkIn || intent.departureDate || 'Not specified'}
- Check-out Date: ${intent.checkOut || intent.returnDate || 'Not specified'}
- Travelers: ${intent.travelers || 'Not specified'}

Instructions:
`;

      if (intent.needsFlights && intent.origin && intent.destination && intent.departureDate && intent.returnDate && intent.travelers) {
        travelPrompt += `1. Search for flights from ${intent.origin} to ${intent.destination} departing ${intent.departureDate} and returning ${intent.returnDate} for ${intent.travelers} travelers.\n`;
      }
      
      if (intent.needsHotels && intent.destination && (intent.checkIn || intent.departureDate) && (intent.checkOut || intent.returnDate)) {
        const checkIn = intent.checkIn || intent.departureDate;
        const checkOut = intent.checkOut || intent.returnDate;
        travelPrompt += `2. Search for hotels in ${intent.destination} from ${checkIn} to ${checkOut}.\n`;
      }
      
      if (intent.needsActivities && intent.destination) {
        travelPrompt += `3. Generate activity recommendations for ${intent.destination}.\n`;
      }

      travelPrompt += `
After using the tools, provide a comprehensive travel recommendation response that includes all the information you found.`;

      try {
        // Use generateText with tools and maxSteps for agentic behavior
        const result = await generateText({
          model,
          tools: {
            searchFlights: createFlightTool(),
            searchHotels: createHotelTool(),
            searchActivities: createActivitesTool(),
          },
          maxSteps: 5, // Allow up to 5 steps for multi-tool usage
          prompt: travelPrompt,
          temperature: 0.3,
        });

        console.log('✅ MAIN SYSTEM - AI SDK multi-step execution completed');
        
        // Use global state results as primary source (workaround for AI SDK issue)
        console.log('🔄 MAIN SYSTEM - Using global state results as primary source');
        console.log('🔍 Global tool results:', JSON.stringify(globalToolResults, null, 2));
        
        if (globalToolResults.flights) {
          agentResults.flights = globalToolResults.flights;
          console.log(`✅ Flight data captured from global state: ${globalToolResults.flights.length} flights`);
        }
        
        if (globalToolResults.hotels) {
          agentResults.hotels = globalToolResults.hotels;
          console.log(`✅ Hotel data captured from global state: ${globalToolResults.hotels.length} hotels`);
        }
        
        if (globalToolResults.activities) {
          agentResults.activities = globalToolResults.activities;
          console.log(`✅ Activity data captured from global state: ${globalToolResults.activities.length} activities`);
        }
        
        if (globalToolResults.errors && globalToolResults.errors.length > 0) {
          agentResults.errors = globalToolResults.errors;
          console.log(`❌ Errors captured from global state: ${globalToolResults.errors.length} errors`);
        }

        console.log('🔍 Final agent results before validation:');
        console.log(`   Flights: ${agentResults.flights?.length || 0}`);
        console.log(`   Hotels: ${agentResults.hotels?.length || 0}`);
        console.log(`   Activities: ${agentResults.activities?.length || 0}`);
        console.log(`   Errors: ${agentResults.errors?.length || 0}`);

        if (agentResults.errors && agentResults.errors.length > 0) {
          console.log('❌ Error details:');
          agentResults.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
          });
        }

        console.log('🎉 MAIN SYSTEM - Request processing completed successfully');
        console.log('═'.repeat(50));

        return {
          response: result.text,
          intent,
          agentResults: AgentResultsSchema.parse(agentResults),
          agentsUsed
        };

      } catch (error) {
        console.error('❌ MAIN SYSTEM - AI SDK execution failed:', error);
        
        // Fallback response
        const fallbackResponse = await this.generateFallbackResponse(prompt, intent, history);
        
        return {
          response: fallbackResponse,
          intent,
          agentResults: AgentResultsSchema.parse({ errors: ['AI processing failed'] }),
          agentsUsed: []
        };
      }
      
    } else {
      console.log('🗨️  MAIN SYSTEM - No agents needed (generic query)');
      
      // Handle generic queries with simple text generation
      const conversationContext = normalizedHistory.map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n');

      try {
        const { text } = await generateText({
          model,
          prompt: `You are a helpful AI assistant. The user has asked a general question that is NOT related to travel planning.

Conversation History:
${conversationContext}

User Request: "${prompt}"

IMPORTANT: This is a GENERIC query, NOT a travel request. Respond naturally to their question without mentioning anything about travel, booking, or travel services. Just answer their question directly and helpfully.

Provide a helpful, natural response to their question.`,
          temperature: 0.7,
        });

        console.log('✅ MAIN SYSTEM - Generic query processed');
        console.log('═'.repeat(50));

        return {
          response: text,
          intent,
          agentResults: {},
          agentsUsed: []
        };

      } catch (error) {
        console.error('❌ MAIN SYSTEM - Generic query processing failed:', error);
        
        return {
          response: 'I apologize, but I encountered an error while processing your request. Please try again.',
          intent,
          agentResults: {},
          agentsUsed: []
        };
      }
    }
  }

  private async generateFallbackResponse(prompt: string, intent: TravelIntent, history: Message[]): Promise<string> {
    console.log('🔄 Generating fallback response...');
    
    const normalizedHistory = history.map(normalizeMessage);
    const conversationContext = normalizedHistory.map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    try {
      const { text } = await generateText({
        model,
        prompt: `You are a travel assistant. There was a technical issue with the travel booking systems, but you should still provide a helpful response.

Conversation History:
${conversationContext}

User Request: "${prompt}"

Intent Analysis: ${intent.reasoning}

The user wanted travel information but there was a technical glitch with our systems. Acknowledge their request, apologize for the technical issue, and ask them to try again later. Be helpful and professional.`,
        temperature: 0.7,
      });

      return text;
    } catch (error) {
      console.error('❌ Fallback response generation failed:', error);
      return 'I apologize, but I encountered a technical issue while processing your travel request. Please try again later.';
    }
  }
}

// Initialize the travel system
const travelSystem = new TravelPlanningSystem();

// Enhanced chat endpoint with Vercel AI SDK
app.post('/chat', async (req: Request, res: Response) => {
  console.log('🌐 NEW REQUEST - Chat endpoint called');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Validate request body with Zod
    console.log('🛡️  Validating request with Zod...');
    console.log('📥 Raw history format check:');
    if (req.body.history && req.body.history.length > 0) {
      const firstMsg = req.body.history[0];
      console.log(`   First message keys: ${Object.keys(firstMsg || {})}`);
      console.log(`   Message format: ${firstMsg?.parts ? 'LEGACY (parts/model)' : 'NEW (content/assistant)'}`);
    }
    
    const validatedRequest = TravelRequestSchema.parse(req.body);
    const { prompt, history } = validatedRequest;

    console.log('✅ Request validation successful');
    console.log(`📝 Validated prompt: "${prompt}"`);
    console.log(`📚 Validated history: ${history.length} messages`);

    // Process the travel request
    console.log('🚀 Starting travel request processing...');
    const result = await travelSystem.processRequest(prompt, history);

    // Build updated history with validated messages in NEW format
    console.log('📝 Building updated conversation history...');
    const updatedHistory = [
      ...history,
      { role: 'user', content: prompt }, // Use new format
      { role: 'assistant', content: result.response } // Use new format
    ];

    const responseData = {
      success: true,
      response: result.response,
      history: updatedHistory,
      metadata: {
        intent: result.intent,
        agentsUsed: result.agentsUsed,
        agentResults: result.agentResults,
        validation: {
          requestValidated: true,
          responseValidated: true,
          schemasUsed: ['TravelRequest', 'TravelIntent', 'AgentResults'],
          apiIntegration: true,
          modelUsed: 'gemini-2.0-flash',
          aiSdkVersion: 'vercel-ai-sdk'
        }
      },
      timestamp: new Date().toISOString()
    };

    console.log('📤 FINAL RESPONSE - Sending to client:');
    console.log('✅ Success: true');
    console.log(`📝 Response length: ${result.response.length} characters`);
    console.log(`🎯 Agents used: ${result.agentsUsed.join(', ') || 'none'}`);
    console.log(`📊 Flight results: ${result.agentResults.flights?.length || 0}`);
    console.log(`📊 Hotel results: ${result.agentResults.hotels?.length || 0}`);
    console.log(`📊 Activity results: ${result.agentResults.activities?.length || 0}`);
    console.log('🎉 REQUEST COMPLETED SUCCESSFULLY');
    console.log('═'.repeat(80));

    res.json(responseData);

  } catch (error) {
    console.error('💥 REQUEST FAILED - Error occurred:');
    console.error(`   Error Type: ${error.constructor.name}`);
    console.error(`   Error Message: ${error.message}`);
    
    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      console.error('🛡️  Zod Validation Error Details:');
      error.errors.forEach((err, index) => {
        console.error(`   ${index + 1}. Path: ${err.path.join('.')}`);
        console.error(`      Message: ${err.message}`);
        console.error(`      Received: ${err.input}`);
      });
      
      const errorResponse = {
        error: 'Validation error',
        message: 'Invalid request format',
        details: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          received: err.input
        })),
        success: false,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 Sending validation error response');
      console.log('═'.repeat(80));
      return res.status(400).json(errorResponse);
    }
    
    console.error('❌ Sending 500 error response');
    console.log('═'.repeat(80));
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process travel request',
      success: false,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  console.log('🏥 Health check requested');
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: ['travel-planning', 'flight-search', 'hotel-search', 'activity-generation'],
    apiEndpoints: {
      flights: FLIGHT_API_URL,
      hotels: HOTEL_API_URL
    },
    model: 'gemini-2.0-flash',
    aiSdk: 'vercel-ai-sdk',
    environment: {
      nodeVersion: process.version,
      port: PORT
    }
  };
  
  console.log('✅ Health check response:');
  console.log(JSON.stringify(healthData, null, 2));
  res.json(healthData);
});

app.listen(PORT, () => {
  console.log('🌟'.repeat(20));
  console.log('🌍 TRAVEL PLANNING API - STARTED SUCCESSFULLY');
  console.log('🌟'.repeat(20));
  console.log(`🚀 Server running on port: ${PORT}`);
  console.log(`🤖 AI Model: gemini-2.0-flash (via Vercel AI SDK)`);
  console.log(`🔗 Flight API: ${FLIGHT_API_URL}`);
  console.log(`🔗 Hotel API: ${HOTEL_API_URL}`);
  console.log('');
  console.log('📋 Available Features:');
  console.log('   ✅ Vercel AI SDK integration with multi-step tool usage');
  console.log('   ✅ API integration with external search services');
  console.log('   ✅ Structured outputs with Zod validation');
  console.log('   ✅ Tool-based agent architecture');
  console.log('   ✅ Generic query handling (non-travel)');
  console.log('   ✅ Comprehensive logging and debugging');
  console.log('   ✅ Environment-based configuration');
  console.log('');
  console.log('🌐 Endpoints:');
  console.log(`   💬 Chat: POST http://localhost:${PORT}/chat`);
  console.log(`   🏥 Health: GET http://localhost:${PORT}/health`);
  console.log('');
  console.log('🔧 Environment Variables Required:');
  console.log('   GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key');
  console.log('   FLIGHT_API_URL=your_flight_api_url');
  console.log('   HOTEL_API_URL=your_hotel_api_url');
  console.log('   PORT=3000 (optional)');
  console.log('');
  console.log('🎉 Ready to handle travel planning requests with Vercel AI SDK!');
  console.log('═'.repeat(80));
});

export default app;