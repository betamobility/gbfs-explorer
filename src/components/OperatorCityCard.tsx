import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight } from 'lucide-react';
import { getCountryFlagEmoji } from 'utils/countryUtils';

export interface CityStats {
  city: string;
  countryCode: string;
  systemCount: number;
  totalFleet: number | null;
  formFactors: string[];
  isLoading: boolean;
  hasError: boolean;
}

interface Props {
  stats: CityStats;
  onCityClick: (city: string) => void;
}

const formatNumber = (num: number | null): string => {
  if (num === null) return "—";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const OperatorCityCard: React.FC<Props> = ({ stats, onCityClick }) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{getCountryFlagEmoji(stats.countryCode)}</span>
              <h3 className="font-semibold text-lg">{stats.city}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {stats.countryCode}
              {stats.systemCount > 1 && ` · ${stats.systemCount} feeds`}
            </p>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {stats.formFactors.map(ff => (
                <Badge key={ff} variant="secondary" className="text-xs uppercase">
                  {ff}
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Fleet</p>
                <p className="text-2xl font-bold">
                  {stats.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : stats.hasError ? (
                    <span className="text-sm text-muted-foreground">Unavailable</span>
                  ) : (
                    formatNumber(stats.totalFleet)
                  )}
                </p>
              </div>
              <div>
                {!stats.isLoading && !stats.hasError && stats.totalFleet !== null && (
                  <Badge variant={stats.totalFleet > 0 ? "default" : "secondary"} className="text-xs">
                    {stats.totalFleet > 0 ? "Online" : "No vehicles"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => onCityClick(stats.city)}
          className="mt-4 text-sm text-primary hover:underline flex items-center gap-1"
        >
          View City Details
          <ArrowRight className="h-3 w-3" />
        </button>
      </CardContent>
    </Card>
  );
};

export default OperatorCityCard;
