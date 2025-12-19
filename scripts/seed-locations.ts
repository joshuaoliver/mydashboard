/**
 * Seed script for populating locations with lat/lng coordinates
 * 
 * Run with: bunx convex run locationMutations:seedLocations --args '{"locations": [...]}'
 * 
 * Or copy the locations array below and run via Convex dashboard
 */

export const locationsToSeed = [
  // From the screenshot - existing locations
  { name: "Adelaide", latitude: -34.9285, longitude: 138.6007 },
  { name: "Amsterdam", latitude: 52.3676, longitude: 4.9041 },
  { name: "Antwerp", latitude: 51.2194, longitude: 4.4025 },
  { name: "Bali", latitude: -8.3405, longitude: 115.0920 },
  { name: "Barcelona", latitude: 41.3851, longitude: 2.1734 },
  { name: "Brisbane", latitude: -27.4698, longitude: 153.0251 },
  { name: "Budapest", latitude: 47.4979, longitude: 19.0402 },
  { name: "Canberra", latitude: -35.2809, longitude: 149.1300 },
  { name: "Davao", latitude: 7.1907, longitude: 125.4553 }, // Corrected from "Devao"
  { name: "Dubai", latitude: 25.2048, longitude: 55.2708 },
  { name: "Europe", latitude: 54.5260, longitude: 15.2551 }, // Geographic center of Europe
  { name: "Gold Coast", latitude: -28.0167, longitude: 153.4000 },
  { name: "Italy", latitude: 41.8719, longitude: 12.5674 }, // Rome as center
  { name: "London", latitude: 51.5074, longitude: -0.1278 },
  { name: "Melbourne", latitude: -37.8136, longitude: 144.9631 },
  { name: "Mexico City", latitude: 19.4326, longitude: -99.1332 },
  { name: "Miami", latitude: 25.7617, longitude: -80.1918 },
  { name: "Norway", latitude: 60.4720, longitude: 8.4689 }, // Geographic center
  { name: "Paris", latitude: 48.8566, longitude: 2.3522 },
  { name: "Russia", latitude: 61.5240, longitude: 105.3188 }, // Geographic center
  { name: "Stockholm", latitude: 59.3293, longitude: 18.0686 },
  { name: "Switzerland", latitude: 46.8182, longitude: 8.2275 }, // Geographic center
  
  // Additional common travel destinations
  { name: "Sydney", latitude: -33.8688, longitude: 151.2093 },
  { name: "Perth", latitude: -31.9505, longitude: 115.8605 },
  { name: "Auckland", latitude: -36.8509, longitude: 174.7645 },
  { name: "Tokyo", latitude: 35.6762, longitude: 139.6503 },
  { name: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { name: "Hong Kong", latitude: 22.3193, longitude: 114.1694 },
  { name: "Bangkok", latitude: 13.7563, longitude: 100.5018 },
  { name: "Berlin", latitude: 52.5200, longitude: 13.4050 },
  { name: "Vienna", latitude: 48.2082, longitude: 16.3738 },
  { name: "Prague", latitude: 50.0755, longitude: 14.4378 },
  { name: "Munich", latitude: 48.1351, longitude: 11.5820 },
  { name: "Rome", latitude: 41.9028, longitude: 12.4964 },
  { name: "Milan", latitude: 45.4642, longitude: 9.1900 },
  { name: "Madrid", latitude: 40.4168, longitude: -3.7038 },
  { name: "Lisbon", latitude: 38.7223, longitude: -9.1393 },
  { name: "Athens", latitude: 37.9838, longitude: 23.7275 },
  { name: "Istanbul", latitude: 41.0082, longitude: 28.9784 },
  { name: "New York", latitude: 40.7128, longitude: -74.0060 },
  { name: "Los Angeles", latitude: 34.0522, longitude: -118.2437 },
  { name: "San Francisco", latitude: 37.7749, longitude: -122.4194 },
  { name: "Chicago", latitude: 41.8781, longitude: -87.6298 },
  { name: "Las Vegas", latitude: 36.1699, longitude: -115.1398 },
  { name: "Toronto", latitude: 43.6532, longitude: -79.3832 },
  { name: "Vancouver", latitude: 49.2827, longitude: -123.1207 },
  { name: "Montreal", latitude: 45.5017, longitude: -73.5673 },
  { name: "Rio de Janeiro", latitude: -22.9068, longitude: -43.1729 },
  { name: "São Paulo", latitude: -23.5505, longitude: -46.6333 },
  { name: "Buenos Aires", latitude: -34.6037, longitude: -58.3816 },
  { name: "Lima", latitude: -12.0464, longitude: -77.0428 },
  { name: "Bogotá", latitude: 4.7110, longitude: -74.0721 },
  { name: "Medellín", latitude: 6.2476, longitude: -75.5658 },
  { name: "Cape Town", latitude: -33.9249, longitude: 18.4241 },
  { name: "Johannesburg", latitude: -26.2041, longitude: 28.0473 },
  { name: "Nairobi", latitude: -1.2921, longitude: 36.8219 },
  { name: "Cairo", latitude: 30.0444, longitude: 31.2357 },
  { name: "Marrakech", latitude: 31.6295, longitude: -7.9811 },
  { name: "Tel Aviv", latitude: 32.0853, longitude: 34.7818 },
  { name: "Mumbai", latitude: 19.0760, longitude: 72.8777 },
  { name: "Delhi", latitude: 28.7041, longitude: 77.1025 },
  { name: "Kuala Lumpur", latitude: 3.1390, longitude: 101.6869 },
  { name: "Manila", latitude: 14.5995, longitude: 120.9842 },
  { name: "Seoul", latitude: 37.5665, longitude: 126.9780 },
  { name: "Taipei", latitude: 25.0330, longitude: 121.5654 },
  { name: "Jakarta", latitude: -6.2088, longitude: 106.8456 },
  { name: "Phuket", latitude: 7.8804, longitude: 98.3923 },
  { name: "Chiang Mai", latitude: 18.7883, longitude: 98.9853 },
  { name: "Ho Chi Minh City", latitude: 10.8231, longitude: 106.6297 },
  { name: "Hanoi", latitude: 21.0285, longitude: 105.8542 },
  { name: "Copenhagen", latitude: 55.6761, longitude: 12.5683 },
  { name: "Helsinki", latitude: 60.1699, longitude: 24.9384 },
  { name: "Oslo", latitude: 59.9139, longitude: 10.7522 },
  { name: "Dublin", latitude: 53.3498, longitude: -6.2603 },
  { name: "Edinburgh", latitude: 55.9533, longitude: -3.1883 },
  { name: "Brussels", latitude: 50.8503, longitude: 4.3517 },
  { name: "Zurich", latitude: 47.3769, longitude: 8.5417 },
  { name: "Geneva", latitude: 46.2044, longitude: 6.1432 },
  { name: "Dubrovnik", latitude: 42.6507, longitude: 18.0944 },
  { name: "Split", latitude: 43.5081, longitude: 16.4402 },
  { name: "Santorini", latitude: 36.3932, longitude: 25.4615 },
  { name: "Mykonos", latitude: 37.4467, longitude: 25.3289 },
  { name: "Ibiza", latitude: 38.9067, longitude: 1.4206 },
  { name: "Mallorca", latitude: 39.6953, longitude: 3.0176 },
  { name: "Canary Islands", latitude: 28.2916, longitude: -16.6291 },
  { name: "Maldives", latitude: 3.2028, longitude: 73.2207 },
  { name: "Fiji", latitude: -17.7134, longitude: 178.0650 },
  { name: "Hawaii", latitude: 19.8968, longitude: -155.5828 },
  { name: "Cancún", latitude: 21.1619, longitude: -86.8515 },
  { name: "Tulum", latitude: 20.2114, longitude: -87.4654 },
  { name: "Cartagena", latitude: 10.3910, longitude: -75.4794 },
];

// Command to run this seed:
// bunx convex run locationMutations:seedLocations --args "$(cat scripts/seed-locations-args.json)"
console.log("Locations to seed:", locationsToSeed.length);
console.log(JSON.stringify({ locations: locationsToSeed }, null, 2));
