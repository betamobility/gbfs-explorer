import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface Props {
  totalFleet: number | null;
  countries: number;
  cities: number;
  isLoading: boolean;
}

const formatNumber = (num: number | null): string => {
  if (num === null) return "—";
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

const OperatorStatsRow: React.FC<Props> = ({ totalFleet, countries, cities, isLoading }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">Total Global Fleet</p>
          <p className="text-3xl font-bold mt-1">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-muted-foreground text-lg">Loading...</span>
              </span>
            ) : (
              formatNumber(totalFleet)
            )}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">Active Countries</p>
          <p className="text-3xl font-bold mt-1">{countries}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-muted-foreground">Total Cities</p>
          <p className="text-3xl font-bold mt-1">{cities}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OperatorStatsRow;
