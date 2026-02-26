import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GBFSSystem, groupSystemsByCity, CitySystemGroup } from 'utils/gbfsUtils';
import { OperatorId, getOperatorById, getSystemsForOperator } from 'utils/operatorConfig';
import { getCountryFlagEmoji } from 'utils/countryUtils';
import { getCityCoords } from 'utils/cityCoordinates';
import { classifyOperatorType } from 'utils/gbfsClassification';
import brain from 'brain';
import { GBFSFeed } from 'types';
import OperatorCityMap, { CityMarker } from './OperatorCityMap';
import OperatorStatsRow from './OperatorStatsRow';

interface Props {
  operatorId: OperatorId;
  allSystems: GBFSSystem[];
  onCityClick: (city: string) => void;
  onBack: () => void;
}

interface CityFeedState {
  totalFleet: number | null;
  formFactors: string[];
  isLoading: boolean;
  hasError: boolean;
}

async function fetchAllGbfsFeedsConcurrently(feeds: GBFSFeed[]) {
  try {
    const response = await brain.get_gbfs_feeds_data({ feeds });
    if (response.status !== 200) {
      throw new Error(`Concurrent feed fetch failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    return feeds.map(feed => ({
      feed_name: feed.name,
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    }));
  }
}

const formatNumberWithSpaces = (num: number | null): string => {
  if (num === null) return "";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const CITIES_PER_PAGE = 10;
const BATCH_SIZE = 10;

type TabView = 'cities' | 'countries';

interface CountryGroup {
  countryCode: string;
  cities: CitySystemGroup[];
  totalFleet: number | null;
  cityCount: number;
}

const OperatorGlobalView: React.FC<Props> = ({ operatorId, allSystems, onCityClick, onBack }) => {
  const [cityFeedStates, setCityFeedStates] = useState<Record<string, CityFeedState>>({});
  const [visibleCount, setVisibleCount] = useState(CITIES_PER_PAGE);
  const [activeTab, setActiveTab] = useState<TabView>('cities');

  const operator = getOperatorById(operatorId);
  const operatorSystems = useMemo(() => getSystemsForOperator(operatorId, allSystems), [operatorId, allSystems]);
  const cityGroups = useMemo(() => groupSystemsByCity(operatorSystems), [operatorSystems]);

  // Sort city groups by fleet size (descending), loading cities last
  const sortedCityGroups = useMemo(() => {
    return [...cityGroups].sort((a, b) => {
      const stateA = cityFeedStates[a.city.toLowerCase()];
      const stateB = cityFeedStates[b.city.toLowerCase()];
      const fleetA = stateA?.totalFleet ?? -1;
      const fleetB = stateB?.totalFleet ?? -1;
      return fleetB - fleetA;
    });
  }, [cityGroups, cityFeedStates]);

  const uniqueCountries = useMemo(() => {
    const codes = new Set(operatorSystems.map(s => s.countryCode).filter(Boolean));
    return codes.size;
  }, [operatorSystems]);

  const totalFleet = useMemo(() => {
    let sum = 0;
    let hasAny = false;
    Object.values(cityFeedStates).forEach(state => {
      if (state.totalFleet !== null) {
        sum += state.totalFleet;
        hasAny = true;
      }
    });
    return hasAny ? sum : null;
  }, [cityFeedStates]);

  const isAnyLoading = useMemo(() => {
    return Object.values(cityFeedStates).some(s => s.isLoading);
  }, [cityFeedStates]);

  // Build map markers
  const mapMarkers: CityMarker[] = useMemo(() => {
    return cityGroups
      .map(group => {
        const cityKey = group.city.toLowerCase();
        const state = cityFeedStates[cityKey];
        const coords = getCityCoords(group.city);
        if (!coords) return null;
        return {
          city: group.city,
          coords,
          totalFleet: state?.totalFleet ?? null,
        };
      })
      .filter((m): m is CityMarker => m !== null);
  }, [cityGroups, cityFeedStates]);

  // Aggregate by country
  const countryGroups: CountryGroup[] = useMemo(() => {
    const byCountry: Record<string, CitySystemGroup[]> = {};
    cityGroups.forEach(group => {
      const code = group.countryCode || 'XX';
      if (!byCountry[code]) byCountry[code] = [];
      byCountry[code].push(group);
    });

    return Object.entries(byCountry)
      .map(([countryCode, cities]) => {
        let countryFleet = 0;
        let hasAny = false;
        cities.forEach(city => {
          const state = cityFeedStates[city.city.toLowerCase()];
          if (state?.totalFleet !== null && state?.totalFleet !== undefined) {
            countryFleet += state.totalFleet;
            hasAny = true;
          }
        });
        return {
          countryCode,
          cities,
          totalFleet: hasAny ? countryFleet : null,
          cityCount: cities.length,
        };
      })
      .sort((a, b) => (b.totalFleet ?? -1) - (a.totalFleet ?? -1));
  }, [cityGroups, cityFeedStates]);

  // Progressive GBFS feed fetching
  useEffect(() => {
    if (cityGroups.length === 0) return;

    const initialStates: Record<string, CityFeedState> = {};
    cityGroups.forEach(group => {
      initialStates[group.city.toLowerCase()] = {
        totalFleet: null,
        formFactors: [],
        isLoading: true,
        hasError: false,
      };
    });
    setCityFeedStates(initialStates);

    const processBatch = async (batch: CitySystemGroup[]) => {
      const allOperators = batch.flatMap(g => g.operators);
      const discoveryFeeds: GBFSFeed[] = allOperators.map(op => ({
        name: op.systemId,
        url: op.autoDiscoveryUrl || op.url,
      }));

      const discoveryResults = await fetchAllGbfsFeedsConcurrently(discoveryFeeds);

      const operatorFeeds: Record<string, Record<string, string>> = {};
      const operatorTypes: Record<string, string> = {};

      discoveryResults.forEach((result: any) => {
        const op = allOperators.find(o => o.systemId === result.feed_name);
        if (!op || result.error || !result.data) {
          if (op) operatorFeeds[op.systemId] = {};
          return;
        }

        const rawGbfsJson = result.data;
        let gbfsContent = rawGbfsJson;
        if (rawGbfsJson.data && !rawGbfsJson.feeds) {
          gbfsContent = rawGbfsJson.data;
        }

        const feeds: Record<string, string> = {};
        const langPriority = ['en', 'nb'];
        const allKeys = [...new Set([...langPriority, ...Object.keys(gbfsContent)])];
        let found = false;
        for (const lang of allKeys) {
          const langData = gbfsContent[lang];
          if (langData?.feeds && Array.isArray(langData.feeds)) {
            langData.feeds.forEach((feed: any) => {
              if (feed?.name && feed?.url) feeds[feed.name] = feed.url;
            });
            if (Object.keys(feeds).length > 0) { found = true; break; }
          }
        }
        if (!found && gbfsContent.feeds && Array.isArray(gbfsContent.feeds)) {
          gbfsContent.feeds.forEach((feed: any) => {
            if (feed?.name && feed?.url) feeds[feed.name] = feed.url;
          });
        }

        operatorFeeds[op.systemId] = feeds;
        operatorTypes[op.systemId] = classifyOperatorType(feeds, op.name);
      });

      // Fetch vehicle_types for form factor detection
      const vehicleTypeFeeds: GBFSFeed[] = [];
      Object.entries(operatorFeeds).forEach(([systemId, feeds]) => {
        if (feeds["vehicle_types"]) {
          vehicleTypeFeeds.push({ name: `${systemId}::vehicle_types`, url: feeds["vehicle_types"] });
        }
      });

      const formFactorMap: Record<string, string[]> = {};
      if (vehicleTypeFeeds.length > 0) {
        const vtResults = await fetchAllGbfsFeedsConcurrently(vehicleTypeFeeds);
        vtResults.forEach((result: any) => {
          const [systemId] = result.feed_name.split('::');
          if (result.error || !result.data) return;
          const content = result.data.data || result.data;
          const vts = content.vehicle_types;
          if (Array.isArray(vts)) {
            const factors = vts.map((vt: any) => vt.form_factor).filter(Boolean);
            formFactorMap[systemId] = [...new Set(factors)];
            if (factors.some((f: string) => f.includes("scooter"))) {
              operatorTypes[systemId] = classifyOperatorType(operatorFeeds[systemId], '', content);
            }
          }
        });
      }

      // Fetch status feeds for vehicle counts
      const statusFeeds: GBFSFeed[] = [];
      Object.entries(operatorFeeds).forEach(([systemId, feeds]) => {
        const opType = operatorTypes[systemId];
        if (opType === 'station_based' && feeds["station_status"]) {
          statusFeeds.push({ name: `${systemId}::station_status`, url: feeds["station_status"] });
        } else if (opType === 'free_floating' || opType === 'free_floating_scooter') {
          if (feeds["vehicle_status"]) {
            statusFeeds.push({ name: `${systemId}::vehicle_status`, url: feeds["vehicle_status"] });
          } else if (feeds["free_bike_status"]) {
            statusFeeds.push({ name: `${systemId}::free_bike_status`, url: feeds["free_bike_status"] });
          }
        }
      });

      const vehicleCounts: Record<string, number> = {};
      if (statusFeeds.length > 0) {
        const statusResults = await fetchAllGbfsFeedsConcurrently(statusFeeds);
        statusResults.forEach((result: any) => {
          const [systemId, feedType] = result.feed_name.split('::');
          if (result.error || !result.data) return;
          const content = result.data.data || result.data;

          if (feedType === 'station_status' && Array.isArray(content.stations)) {
            let count = 0;
            content.stations.forEach((station: any) => {
              if (station.vehicle_types_available && Array.isArray(station.vehicle_types_available)) {
                count += station.vehicle_types_available.reduce((s: number, vt: any) => s + (vt.count || 0), 0);
              } else {
                count += (station.num_bikes_available ?? station.num_vehicles_available ?? 0);
                count += (station.num_ebikes_available ?? 0);
              }
            });
            vehicleCounts[systemId] = count;
          } else if (feedType === 'vehicle_status' || feedType === 'free_bike_status') {
            const vehicles = content.vehicles || content.bikes || [];
            vehicleCounts[systemId] = Array.isArray(vehicles) ? vehicles.length : 0;
          }
        });
      }

      // Aggregate per city
      batch.forEach(group => {
        const cityKey = group.city.toLowerCase();
        let cityFleet = 0;
        let hasAnyData = false;
        let hasError = true;
        const cityFormFactors = new Set<string>();

        group.operators.forEach(op => {
          const count = vehicleCounts[op.systemId];
          if (count !== undefined) {
            cityFleet += count;
            hasAnyData = true;
            hasError = false;
          } else if (Object.keys(operatorFeeds[op.systemId] ?? {}).length > 0) {
            hasError = false;
          }
          const factors = formFactorMap[op.systemId];
          if (factors) factors.forEach(f => cityFormFactors.add(f));
        });

        setCityFeedStates(prev => ({
          ...prev,
          [cityKey]: {
            totalFleet: hasAnyData ? cityFleet : null,
            formFactors: Array.from(cityFormFactors),
            isLoading: false,
            hasError: hasError && !hasAnyData,
          },
        }));
      });
    };

    const runBatches = async () => {
      for (let i = 0; i < cityGroups.length; i += BATCH_SIZE) {
        const batch = cityGroups.slice(i, i + BATCH_SIZE);
        await processBatch(batch);
      }
    };

    runBatches();
  }, [cityGroups]);

  if (!operator) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Unknown operator: {operatorId}</p>
        <button onClick={onBack} className="mt-4 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </button>
      </div>
    );
  }

  // Waiting for allSystems to load
  if (allSystems.length === 0) {
    return (
      <div className="text-left">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </button>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-lg text-muted-foreground">Loading systems data...</span>
        </div>
      </div>
    );
  }

  if (operatorSystems.length === 0) {
    return (
      <div className="text-left">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </button>
        <h2 className="text-2xl font-bold mb-2">{operator.name}</h2>
        <p className="text-muted-foreground">No live GBFS data available for this operator.</p>
      </div>
    );
  }

  const visibleCities = sortedCityGroups.slice(0, visibleCount);
  const hasMore = visibleCount < sortedCityGroups.length;

  return (
    <div className="text-left">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to search
      </button>

      {/* Header — matches existing city view heading style */}
      <h2 className="text-2xl font-bold mb-4">
        {operator.name} Global Fleet
        {isAnyLoading && (
          <span className="text-lg font-normal text-muted-foreground ml-2 inline-flex items-center">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Getting live data from operators...
          </span>
        )}
      </h2>

      {/* Stats row */}
      <div className="mb-6">
        <OperatorStatsRow
          totalFleet={totalFleet}
          countries={uniqueCountries}
          cities={cityGroups.length}
          isLoading={isAnyLoading}
        />
      </div>

      {/* Map */}
      {mapMarkers.length > 0 && (
        <div className="mb-8">
          <OperatorCityMap
            markers={mapMarkers}
            onCityClick={onCityClick}
          />
        </div>
      )}

      {/* Cities / Countries tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'cities' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full"
          onClick={() => { setActiveTab('cities'); setVisibleCount(CITIES_PER_PAGE); }}
        >
          Cities ({cityGroups.length})
        </Button>
        <Button
          variant={activeTab === 'countries' ? 'default' : 'outline'}
          size="sm"
          className="rounded-full"
          onClick={() => setActiveTab('countries')}
        >
          Countries ({uniqueCountries})
        </Button>
      </div>

      {/* City list */}
      {activeTab === 'cities' && (
        <>
          <div className="grid grid-cols-1 gap-4">
            {visibleCities.map(group => {
              const cityKey = group.city.toLowerCase();
              const state = cityFeedStates[cityKey];

              return (
                <Card key={group.city}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold">
                        {group.city} {getCountryFlagEmoji(group.countryCode)}
                      </CardTitle>
                      <button
                        onClick={() => onCityClick(group.city)}
                        className="text-sm text-primary hover:underline"
                      >
                        View City Details →
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {state?.isLoading ? (
                      <div className="flex items-center space-x-2 text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Getting live updates from operators...</span>
                      </div>
                    ) : state?.hasError ? (
                      <p className="text-sm text-muted-foreground">Unable to fetch live data for this city.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                        <div className="flex flex-col justify-center">
                          <h4 className="font-semibold mb-1 text-muted-foreground">Total Fleet</h4>
                          <p className="text-4xl font-bold">{formatNumberWithSpaces(state?.totalFleet ?? null) || "N/A"}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Details</h4>
                          <p>Feeds: <span className="font-medium">{group.operators.length}</span></p>
                          {state?.formFactors && state.formFactors.length > 0 && (
                            <p>Form Factor: <span className="font-medium">{state.formFactors.join(", ")}</span></p>
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Feeds</h4>
                          {group.operators.map(op => (
                            <p key={op.systemId} className="text-muted-foreground">{op.name}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => setVisibleCount(prev => prev + CITIES_PER_PAGE)}
              >
                Load More Cities ({sortedCityGroups.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Country list */}
      {activeTab === 'countries' && (
        <div className="grid grid-cols-1 gap-4">
          {countryGroups.map(country => (
            <Card key={country.countryCode}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">
                  {getCountryFlagEmoji(country.countryCode)} {country.countryCode}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div className="flex flex-col justify-center">
                    <h4 className="font-semibold mb-1 text-muted-foreground">Total Fleet</h4>
                    <p className="text-4xl font-bold">
                      {country.cities.some(c => cityFeedStates[c.city.toLowerCase()]?.isLoading) ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        formatNumberWithSpaces(country.totalFleet) || "N/A"
                      )}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Cities</h4>
                    <p className="text-2xl font-bold">{country.cityCount}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Active Cities</h4>
                    {country.cities.map(city => (
                      <button
                        key={city.city}
                        onClick={() => onCityClick(city.city)}
                        className="block text-sm text-primary hover:underline"
                      >
                        {city.city}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default OperatorGlobalView;
