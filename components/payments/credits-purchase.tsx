"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Loader2 } from 'lucide-react';
import { CREDIT_PACKAGES } from '@/lib/constants';
import { toast } from 'sonner';

interface CreditsPurchaseProps {
  onPurchaseSuccess?: () => void;
}

export function CreditsPurchase({ onPurchaseSuccess }: CreditsPurchaseProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (packageType: keyof typeof CREDIT_PACKAGES) => {
    setLoading(packageType);
    
    try {
      console.log('🛒 [CREDITS PURCHASE] Starting purchase for package:', packageType);
      
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageType
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      console.log('✅ [CREDITS PURCHASE] Checkout session created:', data);

      // Redirect to Stripe Checkout
      if (data.url) {
        console.log('🔄 [CREDITS PURCHASE] Redirecting to Stripe Checkout...');
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (error) {
      console.error('❌ [CREDITS PURCHASE] Purchase failed:', error);
      toast.error(error instanceof Error ? error.message : 'Purchase failed');
      setLoading(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Choose Your Credit Package</h2>
        <p className="text-muted-foreground mt-2">
          Select the perfect package for your virtual staging needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(CREDIT_PACKAGES).map(([key, pkg]) => (
          <Card 
            key={key} 
            className={`relative flex flex-col ${
              pkg.popular ? 'ring-2 ring-primary border-primary' : ''
            }`}
          >
            {pkg.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Most Popular
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">{pkg.name}</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold">${pkg.price}</span>
                <span className="text-muted-foreground ml-1">one-time</span>
              </div>
              <CardDescription className="text-center">
                {pkg.credits.toLocaleString()} credits • {pkg.operations} operations
                {pkg.savings && (
                  <div className="text-green-600 font-medium mt-1">
                    {pkg.savings}
                  </div>
                )}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                {pkg.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                onClick={() => handlePurchase(key as keyof typeof CREDIT_PACKAGES)}
                disabled={loading !== null}
                className={`w-full ${pkg.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                size="lg"
              >
                {loading === key ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Purchase ${pkg.name}`
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span>✅ Secure payment with Stripe</span>
          <span>✅ Instant credit delivery</span>
          <span>✅ No subscription required</span>
        </div>
        <p className="mt-2">
          Credits never expire • Perfect for real estate professionals
        </p>
      </div>
    </div>
  );
} 