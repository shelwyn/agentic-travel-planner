'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';

// Types for chat messages
interface Message {
  role: 'user' | 'model';
  parts: string;
  timestamp: Date;
}

interface TravelIntent {
  needsFlights: boolean;
  needsHotels: boolean;
  needsActivities: boolean;
  destination: string | null;
  origin: string | null;
  checkIn: string | null;
  checkOut: string | null;
  departureDate: string | null;
  returnDate: string | null;
  travelers: number | null;
  reasoning: string;
}

interface FlightBooking {
  departureDate: string;
  returnDate: string;
  travelers: number;
  destination: string;
  origin: string;
  flightName: string;
  price: number;
  departureTime: string;
  flightNumber: string;
  route: string;
}

interface HotelBooking {
  bookingId: string;
  checkIn: string;
  checkOut: string;
  destination: string;
  hotelName: string;
  ratePerNight: number;
}

interface ActivityData {
  name: string;
  description: string;
  price: string;
  category: string;
}

interface AgentResults {
  flights?: FlightBooking[];
  hotels?: HotelBooking[];
  activities?: ActivityData[];
  errors?: string[];
}

interface ChatResponse {
  success: boolean;
  response: string;
  history: Message[];
  metadata?: {
    intent: TravelIntent;
    agentsUsed: string[];
    agentResults: AgentResults;
  };
  timestamp: string;
}

// Component for rendering markdown-like text with proper formatting
const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  // Format inline text (bold, etc.)
  const formatInlineText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>;
      } else if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  // Simple markdown-like parser for Gemini responses
  const parseContent = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactElement[] = [];
    let tableRows: string[][] = [];
    let inTable = false;
    
    for (let index = 0; index < lines.length; index++) {
      const trimmedLine = lines[index].trim();
      
      // Check if this line is a table row
      const isTableRow = trimmedLine.includes('|') && trimmedLine.split('|').length > 2;
      
      if (isTableRow) {
        const cells = trimmedLine.split('|').map(cell => cell.trim()).filter(cell => cell);
        if (!inTable) {
          inTable = true;
          tableRows = [cells];
        } else {
          tableRows.push(cells);
        }
        continue;
      }
      
      // If we were in a table and this line isn't a table row, render the table
      if (inTable && !isTableRow) {
        if (tableRows.length > 0) {
          const headers = tableRows[0];
          const dataRows = tableRows.slice(1);
          
          elements.push(
            <div key={`table-${index}`} className="overflow-x-auto mt-3 mb-3">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((header, cellIndex) => (
                      <th key={cellIndex} className="px-3 py-2 text-left text-sm font-medium text-gray-700 border-b">
                        {formatInlineText(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-gray-100">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 text-sm text-gray-600">
                          {formatInlineText(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        inTable = false;
        tableRows = [];
      }
      
      // Headers
      if (trimmedLine.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-lg font-semibold text-gray-800 mt-4 mb-2">
            {trimmedLine.substring(4)}
          </h3>
        );
      } else if (trimmedLine.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-xl font-bold text-gray-800 mt-4 mb-2">
            {trimmedLine.substring(3)}
          </h2>
        );
      } else if (trimmedLine.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-2xl font-bold text-gray-800 mt-4 mb-2">
            {trimmedLine.substring(2)}
          </h1>
        );
      }
      // Lists
      else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        elements.push(
          <li key={index} className="ml-4 text-gray-700 mb-1">
            {formatInlineText(trimmedLine.substring(2))}
          </li>
        );
      }
      // Regular paragraphs
      else if (trimmedLine.length > 0) {
        elements.push(
          <p key={index} className="text-gray-700 mb-2 leading-relaxed">
            {formatInlineText(trimmedLine)}
          </p>
        );
      }
      // Empty lines for spacing
      else {
        elements.push(<br key={index} />);
      }
    }
    
    // Handle table at end of content
    if (inTable && tableRows.length > 0) {
      const headers = tableRows[0];
      const dataRows = tableRows.slice(1);
      
      elements.push(
        <div key="table-end" className="overflow-x-auto mt-3 mb-3">
          <table className="min-w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                {headers.map((header, cellIndex) => (
                  <th key={cellIndex} className="px-3 py-2 text-left text-sm font-medium text-gray-700 border-b">
                    {formatInlineText(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-gray-100">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 text-sm text-gray-600">
                      {formatInlineText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    return elements;
  };
  
  return <div className="space-y-1">{parseContent(content)}</div>;
};

// Heartbeat animation component
const HeartbeatLoader: React.FC = () => {
  return (
    <div className="flex items-center space-x-2 text-red-500">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
      <span className="text-sm text-gray-500 animate-pulse">Thinking...</span>
    </div>
  );
};

// Metadata display component
const MetadataPanel: React.FC<{ metadata: ChatResponse['metadata'] | null }> = ({ metadata }) => {
  const [activeTab, setActiveTab] = useState<'flights' | 'hotels' | 'activities'>('flights');

  // Define available tabs with proper typing
  const availableTabs: Array<{
    key: 'flights' | 'hotels' | 'activities';
    label: string;
    count: number;
    icon: string;
  }> = React.useMemo(() => {
    if (!metadata) return [];
    
    const { agentResults } = metadata;
    const tabs = [];
    
    if (agentResults.flights && agentResults.flights.length > 0) {
      tabs.push({ key: 'flights' as const, label: 'Flights', count: agentResults.flights.length, icon: '✈️' });
    }
    if (agentResults.hotels && agentResults.hotels.length > 0) {
      tabs.push({ key: 'hotels' as const, label: 'Hotels', count: agentResults.hotels.length, icon: '🏨' });
    }
    if (agentResults.activities && agentResults.activities.length > 0) {
      tabs.push({ key: 'activities' as const, label: 'Activities', count: agentResults.activities.length, icon: '🎯' });
    }
    
    return tabs;
  }, [metadata]);

  // Set default active tab to the first available tab
  React.useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(tab => tab.key === activeTab)) {
      setActiveTab(availableTabs[0].key);
    }
  }, [availableTabs, activeTab]);

  if (!metadata) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">API Metadata</h3>
        <p className="text-gray-500 text-sm">No metadata available yet. Send a message to see the agent results!</p>
      </div>
    );
  }

  const { intent, agentsUsed, agentResults } = metadata;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">API Metadata</h3>
      
      {/* Intent Section */}
      <div>
        <h4 className="text-md font-medium text-gray-700 mb-2">Intent Analysis</h4>
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className={`px-2 py-1 rounded text-xs ${intent.needsFlights ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              ✈️ Flights: {intent.needsFlights ? 'Yes' : 'No'}
            </div>
            <div className={`px-2 py-1 rounded text-xs ${intent.needsHotels ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              🏨 Hotels: {intent.needsHotels ? 'Yes' : 'No'}
            </div>
            <div className={`px-2 py-1 rounded text-xs ${intent.needsActivities ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              🎯 Activities: {intent.needsActivities ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="space-y-1">
            {intent.origin && <p><strong>Origin:</strong> {intent.origin}</p>}
            {intent.destination && <p><strong>Destination:</strong> {intent.destination}</p>}
            {intent.departureDate && <p><strong>Departure:</strong> {intent.departureDate}</p>}
            {intent.returnDate && <p><strong>Return:</strong> {intent.returnDate}</p>}
            {intent.travelers && <p><strong>Travelers:</strong> {intent.travelers}</p>}
          </div>
          <p className="mt-2 text-xs text-gray-600"><strong>Reasoning:</strong> {intent.reasoning}</p>
        </div>
      </div>

      {/* Agents Used Section */}
      <div>
        <h4 className="text-md font-medium text-gray-700 mb-2">Agents Used</h4>
        <div className="flex flex-wrap gap-2">
          {agentsUsed.length > 0 ? (
            agentsUsed.map((agent, index) => (
              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {agent}
              </span>
            ))
          ) : (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">No agents used</span>
          )}
        </div>
      </div>

      {/* Agent Results Section with Tabs */}
      <div>
        <h4 className="text-md font-medium text-gray-700 mb-2">Agent Results</h4>
        
        {availableTabs.length > 0 ? (
          <div>
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 mb-3">
              {availableTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.icon} {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-2">
              {/* Flights Tab */}
              {activeTab === 'flights' && agentResults.flights && (
                <div>
                  {agentResults.flights.map((flight, index) => (
                    <div key={index} className="bg-gray-50 rounded p-3 text-sm">
                      <div className="font-medium text-gray-800">{flight.flightName} - {flight.flightNumber}</div>
                      <div className="text-gray-600 mt-1">₹{flight.price} • {flight.departureTime}</div>
                      <div className="text-gray-500 text-xs mt-1">{flight.route}</div>
                      <div className="text-gray-500 text-xs">{flight.travelers} travelers</div>
                      <div className="text-gray-500 text-xs">
                        {flight.departureDate} → {flight.returnDate}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Hotels Tab */}
              {activeTab === 'hotels' && agentResults.hotels && (
                <div>
                  {agentResults.hotels.map((hotel, index) => (
                    <div key={index} className="bg-gray-50 rounded p-3 text-sm">
                      <div className="font-medium text-gray-800">{hotel.hotelName}</div>
                      <div className="text-gray-600 mt-1">₹{hotel.ratePerNight}/night</div>
                      <div className="text-gray-500 text-xs mt-1">Booking ID: {hotel.bookingId}</div>
                      <div className="text-gray-500 text-xs">
                        {hotel.checkIn} → {hotel.checkOut}
                      </div>
                      <div className="text-gray-500 text-xs">{hotel.destination}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Activities Tab */}
              {activeTab === 'activities' && agentResults.activities && (
                <div>
                  {agentResults.activities.map((activity, index) => (
                    <div key={index} className="bg-gray-50 rounded p-3 text-sm">
                      <div className="font-medium text-gray-800">{activity.name}</div>
                      <div className="text-gray-600 mt-1">{activity.price} • {activity.category}</div>
                      <div className="text-gray-500 text-xs mt-2">{activity.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No agent results available</p>
        )}

        {/* Errors */}
        {agentResults.errors && agentResults.errors.length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-medium text-red-600 mb-2">❌ Errors ({agentResults.errors.length})</h5>
            <div className="space-y-1">
              {agentResults.errors.map((error, index) => (
                <div key={index} className="bg-red-50 text-red-700 rounded p-2 text-xs">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main chat component
const TravelChatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      parts: 'Hello Shelwyn! How can I assist you today?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestMetadata, setLatestMetadata] = useState<ChatResponse['metadata'] | null>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Copy message functionality
  const copyMessage = async (text: string, messageIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageIndex(messageIndex);
      setTimeout(() => {
        setCopiedMessageIndex(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      parts: inputValue.trim(),
      timestamp: new Date()
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      // Prepare history for API (exclude the current user message as it's in the prompt)
      const historyForAPI = messages.map(msg => ({
        role: msg.role,
        parts: msg.parts
      }));

      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userMessage.parts,
          history: historyForAPI
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      if (data.success) {
        const botMessage: Message = {
          role: 'model',
          parts: data.response,
          timestamp: new Date()
        };

        // Update messages with the bot response
        setMessages(prev => [...prev, botMessage]);
        
        // Update metadata
        if (data.metadata) {
          setLatestMetadata(data.metadata);
        }
      } else {
        throw new Error('Failed to get response from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Add error message to chat
      const errorMessage: Message = {
        role: 'model',
        parts: 'I apologize, but I encountered an error. Please try again later.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const newChat = () => {
    setMessages([
      {
        role: 'model',
        parts: 'Hello Shelwyn! How can I assist you today?',
        timestamp: new Date()
      }
    ]);
    setError(null);
    setLatestMetadata(null);
    setCopiedMessageIndex(null);
    inputRef.current?.focus();
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Chat (Dynamic width based on sidebar state) */}
      <div className={`flex flex-col transition-all duration-300 ${
        isSidebarCollapsed ? 'w-full' : 'w-2/3'
      }`}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-800">Travel Assistant</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleSidebar}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-1"
              title={isSidebarCollapsed ? 'Show metadata' : 'Hide metadata'}
            >
              {isSidebarCollapsed ? (
                <>
                  <ChevronLeft className="w-4 h-4" />
                  <span>Show Metadata</span>
                </>
              ) : (
                <>
                  <span>Hide Metadata</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
            <button
              onClick={newChat}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              New chat
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-3 ${
                message.role === 'user' 
                  ? 'max-w-2xl flex-row-reverse space-x-reverse' 
                  : 'max-w-4xl'
              }`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user' 
                    ? 'bg-blue-500' 
                    : 'bg-orange-500'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message content */}
                <div className={`rounded-2xl px-4 py-3 relative group ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  {message.role === 'user' ? (
                    <p>{message.parts}</p>
                  ) : (
                    <>
                      <MessageContent content={message.parts} />
                      {/* Copy button for bot messages */}
                      <button
                        onClick={() => copyMessage(message.parts, index)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        title="Copy message"
                      >
                        {copiedMessageIndex === index ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-2xl">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <HeartbeatLoader />
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-600 text-sm">
                Error: {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-4/5 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask le Chat or @mention an agent"
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="w-10 h-10 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Panel - Metadata (Collapsible) */}
      <div className={`bg-gray-100 border-l border-gray-200 overflow-y-auto transition-all duration-300 ${
        isSidebarCollapsed ? 'w-0 opacity-0' : 'w-1/3 opacity-100'
      }`}>
        <div className={`p-4 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
          <MetadataPanel metadata={latestMetadata} />
        </div>
      </div>

      {/* Floating toggle button when sidebar is collapsed */}
      {isSidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          className="fixed top-1/2 right-4 transform -translate-y-1/2 bg-white border border-gray-200 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 z-10"
          title="Show metadata"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
      )}
    </div>
  );
};

export default TravelChatbot;