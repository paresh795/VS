import { Suspense } from 'react';
import { CreditsPurchase } from '@/components/payments/credits-purchase';
import { SafeCreditsDisplay } from '@/components/ui/credits-display-safe';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, TrendingUp, Clock, Shield } from 'lucide-react';

export default function CreditsPage() {
  return (
    <div className="flex-1 space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credits</h1>
          <p className="text-muted-foreground">
            Manage your staging credits and purchase more as needed
          </p>
        </div>
      </div>

      {/* Current Balance Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Suspense fallback="Loading...">
                <SafeCreditsDisplay compact={true} showAddButton={false} />
              </Suspense>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Per Operation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">20 credits</div>
            <p className="text-xs text-muted-foreground">
              Per staging operation (2 variants)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Expiry</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Never</div>
            <p className="text-xs text-muted-foreground">
              Credits never expire
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Stripe</div>
            <p className="text-xs text-muted-foreground">
              Secure payments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Section */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Purchase Credits</CardTitle>
            <CardDescription>
              Choose a credit package that fits your staging needs. All packages include the same high-quality AI staging with 6 style presets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreditsPurchase />
          </CardContent>
        </Card>
      </div>

      {/* Pricing Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How Credits Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Empty Room Generation</span>
              <span className="font-medium">10 credits</span>
            </div>
            <div className="flex justify-between">
              <span>Room Staging (2 variants)</span>
              <span className="font-medium">20 credits</span>
            </div>
            <div className="flex justify-between">
              <span>Chat Edit</span>
              <span className="font-medium">8 credits</span>
            </div>
            <div className="flex justify-between">
              <span>Furniture Masking</span>
              <span className="font-medium">10 credits</span>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Each staging operation generates 2 high-quality variants for comparison
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Value Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Traditional Staging</span>
              <span className="font-medium text-red-600">$500-800/room</span>
            </div>
            <div className="flex justify-between">
              <span>Our AI Staging</span>
              <span className="font-medium text-green-600">$0.40/room</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Your Savings</span>
              <span className="text-green-600">99.9%</span>
            </div>
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Professional quality results in minutes, not days
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 