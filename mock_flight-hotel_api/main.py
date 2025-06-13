from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import pandas as pd
import numpy as np

app = FastAPI()

# Load data using pandas
def load_hotels_data():
   """Load and process hotels data from CSV"""
   try:
       df = pd.read_csv('hotels.csv')
       
       # Clean column names (strip whitespace)
       df.columns = df.columns.str.strip()
       
       # Debug: print the column names to ensure they're correct
       print("Hotels CSV columns:", df.columns.tolist())
       
       # Forward fill the Destination column to handle grouped data
       df['Destination'] = df['Destination'].fillna(method='ffill')
       
       # Remove rows where Hotel Name is null or empty
       df = df.dropna(subset=['Hotel Name'])
       df = df[df['Hotel Name'].str.strip() != '']
       
       # Clean the rate column - remove commas and convert to numeric
       df['Rate Per Night (INR)'] = df['Rate Per Night (INR)'].str.replace(',', '').str.replace('"', '')
       df['Rate Per Night (INR)'] = pd.to_numeric(df['Rate Per Night (INR)'])
       
       # Convert to list of dictionaries
       hotels = []
       for _, row in df.iterrows():
           if pd.notna(row['Destination']) and pd.notna(row['Hotel Name']):
               hotels.append({
                   'destination': row['Destination'].strip().lower(),
                   'hotelName': row['Hotel Name'].strip(),
                   'ratePerNight': float(row['Rate Per Night (INR)'])
               })
       
       # Debug: print sample processed hotels
       print(f"Sample processed hotels: {hotels[:3]}")
       print(f"Available destinations: {list(set([h['destination'] for h in hotels]))}")
       
       return hotels
   except Exception as e:
       print(f"Error loading hotels data: {e}")
       return []

def load_flights_data():
   """Load and process flights data from CSV"""
   try:
       df = pd.read_csv('flights.csv')
       
       # Clean column names
       df.columns = df.columns.str.strip()
       
       # Clean the fare column - remove commas and convert to numeric
       df['Fare (INR)'] = df['Fare (INR)'].str.replace(',', '').str.replace('"', '')
       df['Fare (INR)'] = pd.to_numeric(df['Fare (INR)'])
       
       # Convert to list of dictionaries
       flights = []
       for _, row in df.iterrows():
           flights.append({
               'flightName': str(row['Flight Name']).strip(),
               'fare': float(row['Fare (INR)']),
               'departureCity': str(row['Departure City']).strip().lower(),
               'arrivalCity': str(row['Arrival City']).strip().lower(),
               'departureTime': str(row['Departure Time']).strip(),
               'flightNumber': str(row['Flight Number']).strip()
           })
       
       return flights
   except Exception as e:
       print(f"Error loading flights data: {e}")
       return []

# Load data at startup
hotels_data = load_hotels_data()
flights_data = load_flights_data()

print(f"Loaded {len(hotels_data)} hotels and {len(flights_data)} flights")

# Search Request Models
class FlightSearchRequest(BaseModel):
   departureDate: str
   returnDate: str
   travelers: int
   destination: str
   origin: str

class HotelSearchRequest(BaseModel):
   checkIn: str
   checkOut: str
   destination: str

# Search Result Models
class FlightSearch(BaseModel):
   searchId: Optional[str] = None
   departureDate: str
   returnDate: str
   travelers: int
   destination: str
   origin: str
   flightName: str
   price: float
   departureTime: str
   arrivalTime: Optional[str] = None
   flightNumber: str
   route: str

class HotelSearch(BaseModel):
   searchId: Optional[str] = None
   checkIn: str
   checkOut: str
   destination: str
   hotelName: str
   ratePerNight: float

# Search Response Models
class FlightSearchResponse(BaseModel):
   status: str
   results: List[FlightSearch]

class HotelSearchResponse(BaseModel):
   status: str
   results: List[HotelSearch]

@app.post("/searchflight", response_model=FlightSearchResponse)
async def search_flight(search_request: FlightSearchRequest):
   """Search for flights showing both directions between origin and destination"""
   
   # Convert request parameters to lowercase for comparison
   origin_lower = search_request.origin.lower()
   destination_lower = search_request.destination.lower()
   
   # Find flights from origin to destination
   origin_to_destination = [
       flight for flight in flights_data 
       if flight['departureCity'] == origin_lower 
       and flight['arrivalCity'] == destination_lower
   ]
   
   # Find flights from destination to origin
   destination_to_origin = [
       flight for flight in flights_data 
       if flight['departureCity'] == destination_lower 
       and flight['arrivalCity'] == origin_lower
   ]
   
   search_results = []
   
   # Add flights from origin to destination
   for flight in origin_to_destination:
       total_price = flight['fare'] * search_request.travelers
       search_results.append(FlightSearch(
           searchId=f"FL{flight['flightNumber']}{search_request.departureDate.replace('-', '')}",
           departureDate=search_request.departureDate,
           returnDate=search_request.returnDate,
           travelers=search_request.travelers,
           destination=search_request.destination,
           origin=search_request.origin,
           flightName=flight['flightName'],
           price=total_price,
           departureTime=flight['departureTime'],
           flightNumber=flight['flightNumber'],
           route=f"{search_request.origin} to {search_request.destination}"
       ))
   
   # Add flights from destination to origin (swap origin and destination to match actual flight route)
   for flight in destination_to_origin:
       total_price = flight['fare'] * search_request.travelers
       search_results.append(FlightSearch(
           searchId=f"FL{flight['flightNumber']}{search_request.returnDate.replace('-', '')}",
           departureDate=search_request.departureDate,
           returnDate=search_request.returnDate,
           travelers=search_request.travelers,
           destination=search_request.origin,  # Swapped: destination becomes origin
           origin=search_request.destination,  # Swapped: origin becomes destination
           flightName=flight['flightName'],
           price=total_price,
           departureTime=flight['departureTime'],
           flightNumber=flight['flightNumber'],
           route=f"{search_request.destination} to {search_request.origin}"
       ))
   
   if not search_results:
       return FlightSearchResponse(
           status="no_flights_found",
           results=[]
       )
   
   return FlightSearchResponse(
       status="success",
       results=search_results
   )

@app.post("/searchhotel", response_model=HotelSearchResponse)
async def search_hotel(search_request: HotelSearchRequest):
   """Search for hotels in the specified destination"""
   
   # Convert destination to lowercase for comparison
   destination_lower = search_request.destination.lower()
   
   # Debug: print what we're looking for
   print(f"Looking for hotels in: '{destination_lower}'")
   print(f"Available destinations: {list(set([hotel['destination'] for hotel in hotels_data]))}")
   
   # Find hotels in the specified destination
   destination_hotels = [
       hotel for hotel in hotels_data 
       if hotel['destination'] == destination_lower
   ]
   
   print(f"Found {len(destination_hotels)} hotels")
   
   search_results = []
   for index, hotel in enumerate(destination_hotels):
       search_results.append(HotelSearch(
           searchId=f"HT{search_request.destination.upper()[:3]}{search_request.checkIn.replace('-', '')}{index+1:02d}",
           checkIn=search_request.checkIn,
           checkOut=search_request.checkOut,
           destination=search_request.destination,
           hotelName=hotel['hotelName'],
           ratePerNight=hotel['ratePerNight']
       ))
   
   if not search_results:
       return HotelSearchResponse(
           status="no_hotels_found",
           results=[]
       )
   
   return HotelSearchResponse(
       status="success",
       results=search_results
   )

@app.get("/debug")
async def debug_data():
   """Debug endpoint to check loaded data"""
   return {
       "sample_hotels": hotels_data[:3] if hotels_data else [],
       "sample_flights": flights_data[:3] if flights_data else [],
       "hotels_count": len(hotels_data),
       "flights_count": len(flights_data),
       "available_destinations": list(set([h['destination'] for h in hotels_data])),
       "available_flight_routes": list(set([f"{f['departureCity']} to {f['arrivalCity']}" for f in flights_data]))
   }

@app.get("/")
async def root():
   return {
       "message": "Travel Search API", 
       "description": "API for searching flights and hotels",
       "endpoints": {
           "flight_search": "/searchflight",
           "hotel_search": "/searchhotel", 
           "debug": "/debug"
       },
       "data_loaded": {
           "hotels": len(hotels_data),
           "flights": len(flights_data)
       },
       "version": "1.0.0"
   }

@app.get("/health")
async def health_check():
   """Health check endpoint"""
   return {
       "status": "healthy",
       "service": "travel-search-api",
       "data_status": {
           "hotels_loaded": len(hotels_data) > 0,
           "flights_loaded": len(flights_data) > 0
       }
   }

if __name__ == "__main__":
   uvicorn.run(app, host="0.0.0.0", port=5000)