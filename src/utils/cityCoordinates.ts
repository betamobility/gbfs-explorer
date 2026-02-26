// City center coordinates [longitude, latitude]
// Used for operator global view map markers and per-operator map centering
const CITY_COORDS: Record<string, [number, number]> = {
  // Nordics
  'oslo': [10.7522, 59.9139],
  'bergen': [5.3221, 60.3913],
  'trondheim': [10.3951, 63.4305],
  'stavanger': [5.7331, 58.9700],
  'stockholm': [18.0686, 59.3293],
  'gothenburg': [11.9746, 57.7089],
  'malmö': [13.0038, 55.6050],
  'copenhagen': [12.5683, 55.6761],
  'helsinki': [24.9384, 60.1699],
  'tampere': [23.7610, 61.4978],
  'turku': [22.2666, 60.4518],
  'reykjavik': [-21.8174, 64.1466],

  // Western Europe
  'london': [-0.1276, 51.5074],
  'paris': [2.3522, 48.8566],
  'lyon': [4.8357, 45.7640],
  'marseille': [5.3698, 43.2965],
  'bordeaux': [-0.5792, 44.8378],
  'amsterdam': [4.9041, 52.3676],
  'rotterdam': [4.4777, 51.9244],
  'brussels': [4.3517, 50.8503],
  'antwerp': [4.4025, 51.2194],
  'berlin': [13.4050, 52.5200],
  'hamburg': [9.9937, 53.5511],
  'munich': [11.5820, 48.1351],
  'frankfurt': [8.6821, 50.1109],
  'cologne': [6.9603, 50.9375],
  'düsseldorf': [6.7735, 51.2277],
  'stuttgart': [9.1829, 48.7758],
  'nuremberg': [11.0767, 49.4521],
  'vienna': [16.3738, 48.2082],
  'zurich': [8.5417, 47.3769],
  'geneva': [6.1432, 46.2044],
  'bern': [7.4474, 46.9480],
  'dublin': [-6.2603, 53.3498],
  'lisbon': [-9.1393, 38.7223],
  'porto': [-8.6291, 41.1579],

  // Southern Europe
  'madrid': [-3.7038, 40.4168],
  'barcelona': [2.1734, 41.3851],
  'valencia': [-0.3763, 39.4699],
  'seville': [-5.9845, 37.3891],
  'rome': [12.4964, 41.9028],
  'milan': [9.1900, 45.4642],
  'florence': [11.2558, 43.7696],
  'naples': [14.2681, 40.8518],
  'turin': [7.6869, 45.0703],
  'athens': [23.7275, 37.9838],

  // Central & Eastern Europe
  'prague': [14.4378, 50.0755],
  'budapest': [19.0402, 47.4979],
  'warsaw': [21.0122, 52.2297],
  'kraków': [19.9450, 50.0647],
  'wrocław': [17.0385, 51.1079],
  'gdańsk': [18.6466, 54.3520],
  'poznań': [16.9252, 52.4064],
  'bucharest': [26.1025, 44.4268],
  'sofia': [23.3219, 42.6977],
  'zagreb': [15.9819, 45.8150],
  'ljubljana': [14.5058, 46.0569],
  'bratislava': [17.1077, 48.1486],
  'belgrade': [20.4489, 44.7866],
  'tallinn': [24.7536, 59.4370],
  'riga': [24.1052, 56.9496],
  'vilnius': [25.2798, 54.6872],

  // UK
  'manchester': [-2.2426, 53.4808],
  'birmingham': [-1.8904, 52.4862],
  'edinburgh': [-3.1883, 55.9533],
  'glasgow': [-4.2518, 55.8642],
  'bristol': [-2.5879, 51.4545],
  'liverpool': [-2.9916, 53.4084],
  'leeds': [-1.5491, 53.8008],

  // North America
  'new york': [-74.006, 40.7128],
  'los angeles': [-118.2437, 34.0522],
  'chicago': [-87.6298, 41.8781],
  'san francisco': [-122.4194, 37.7749],
  'washington dc': [-77.0369, 38.9072],
  'toronto': [-79.3832, 43.6532],
  'montreal': [-73.5673, 45.5017],
  'vancouver': [-123.1207, 49.2827],
  'mexico city': [-99.1332, 19.4326],

  // Asia Pacific
  'tokyo': [139.6917, 35.6895],
  'sydney': [151.2093, -33.8688],
  'melbourne': [144.9631, -37.8136],
  'singapore': [103.8198, 1.3521],
  'seoul': [126.9780, 37.5665],

  // Middle East / Africa
  'dubai': [55.2708, 25.2048],
  'tel aviv': [34.7818, 32.0853],
  'cape town': [18.4241, -33.9249],

  // Russia
  'moscow': [37.6176, 55.7558],
  'saint petersburg': [30.3351, 59.9343],
};

export function getCityCoords(cityName: string): [number, number] | null {
  return CITY_COORDS[cityName.toLowerCase().trim()] ?? null;
}

export default CITY_COORDS;
