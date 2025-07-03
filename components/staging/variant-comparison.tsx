'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { STYLE_PRESETS } from '@/lib/constants';
import { 
    Download, 
    RotateCcw, 
    ZoomIn, 
    Heart, 
    Star,
    RefreshCw,
    AlertTriangle,
    Wrench
  } from 'lucide-react';
import { toast } from 'sonner';

interface VariantComparisonProps {
  originalImageUrl: string;
  emptyRoomUrl: string;
  variant1Url: string;
  variant2Url: string;
  style: string;
  roomType: string;
  onRegenerate?: () => void;
  onDownload?: (imageUrl: string, variant: number) => void;
  onSaveFavorite?: (imageUrl: string, variant: number) => void;
  onZoom?: (imageUrl: string) => void;
}

export function VariantComparison({
  originalImageUrl,
  emptyRoomUrl,
  variant1Url,
  variant2Url,
  style,
  roomType,
  onRegenerate,
  onDownload,
  onSaveFavorite,
  onZoom
}: VariantComparisonProps) {
  const [favorites, setFavorites] = useState<{ [key: number]: boolean }>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  const toggleFavorite = (variant: number) => {
    setFavorites(prev => ({
      ...prev,
      [variant]: !prev[variant]
    }));
    onSaveFavorite?.(variant === 1 ? variant1Url : variant2Url, variant);
  };

  const handleDownload = (imageUrl: string, variant: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `staged-room-variant-${variant}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onDownload?.(imageUrl, variant);
  };

  const handleSyncStaging = async () => {
    setIsSyncing(true);
    try {
      console.log('🔄 [VARIANT COMPARISON] Starting staging sync...');
      
      const response = await fetch('/api/sync-staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log('📊 [VARIANT COMPARISON] Sync response:', data);
      
      if (response.ok) {
        toast.success(`Sync completed! Processed ${data.syncedJobs || 0} jobs`);
        
        // Refresh the page after a short delay to see updates
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast.error(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ [VARIANT COMPARISON] Sync error:', error);
      toast.error('Failed to sync staging jobs');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFixStuckJobs = async () => {
    setIsFixing(true);
    try {
      console.log('🔧 [VARIANT COMPARISON] Starting stuck job fix...');
      
      const response = await fetch('/api/fix-stuck-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log('📊 [VARIANT COMPARISON] Fix response:', data);
      
      if (response.ok) {
        const fixedCount = data.fixedJobs?.length || 0;
        if (fixedCount > 0) {
          toast.success(`Fixed ${fixedCount} stuck jobs! Page will refresh...`);
          
          // Refresh the page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          toast.success('No stuck jobs found - all jobs are properly tracked!');
        }
      } else {
        toast.error(`Fix failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ [VARIANT COMPARISON] Fix error:', error);
      toast.error('Failed to fix stuck jobs');
    } finally {
      setIsFixing(false);
    }
  };

  // Check if we're in a stuck state (processing but no results)
  const isStuck = (!variant1Url || !variant2Url);

  return (
    <div className="space-y-6">
      {/* Debug Section - Show when staging appears stuck */}
      {(!variant1Url || !variant2Url) && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-800">Staging Debug Tools</h3>
          </div>
          
          <p className="text-sm text-yellow-700">
            If your staging appears stuck or taking longer than 3 minutes, use these tools:
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleSyncStaging}
              disabled={isSyncing}
              variant="outline"
              size="sm"
              className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Staging Jobs
                </>
              )}
            </Button>
            
            <Button
              onClick={handleFixStuckJobs}
              disabled={isFixing}
              variant="outline"
              size="sm"
              className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
            >
              {isFixing ? (
                <>
                  <Wrench className="h-4 w-4 mr-2 animate-spin" />
                  Fixing...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4 mr-2" />
                  Fix Stuck Jobs
                </>
              )}
            </Button>
          </div>
          
          <p className="text-xs text-yellow-600">
            <strong>Sync:</strong> Check Replicate for completed results • <strong>Fix:</strong> Clean up truly broken jobs
          </p>
        </div>
      )}

      {/* Header Section */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">
          {isStuck ? '🎨 Creating Your Staged Room' : '✨ Your Virtual Staging Results'}
        </h2>
        <p className="text-gray-600">
          {isStuck 
            ? `We're generating 2 beautiful ${STYLE_PRESETS[style as keyof typeof STYLE_PRESETS]?.name.toLowerCase() || style} variants for your ${roomType}...`
            : `Compare your ${STYLE_PRESETS[style as keyof typeof STYLE_PRESETS]?.name.toLowerCase() || style} styled ${roomType} variants`
          }
        </p>
      </div>

      {/* Processing State */}
      {isStuck && (
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <RefreshCw className="h-12 w-12 text-blue-600 animate-spin" />
          </div>
          <div className="text-sm text-gray-500">
            This usually takes 1-2 minutes. Please don't close this page.
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Original Image */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              📸 Original Image
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={originalImageUrl}
                alt="Original room"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
              />
            </div>
          </CardContent>
        </Card>

        {/* Empty Room */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              🏠 Empty Room
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={emptyRoomUrl}
                alt="Empty room"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
              />
            </div>
          </CardContent>
        </Card>

        {/* Styled Variants */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              {(!variant1Url || !variant2Url) ? (
                <>
                  ⏳ Creating Variants...
                  <div className="ml-2 h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </>
              ) : (
                <>
                  ✨ Styled Variants
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!variant1Url || !variant2Url) ? (
              <div className="space-y-4">
                <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Generating beautiful {STYLE_PRESETS[style as keyof typeof STYLE_PRESETS]?.name.toLowerCase() || style} variants...</p>
                    <p className="text-xs text-gray-500 mt-1">This typically takes 1-2 minutes</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Variant 1 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Variant 1</h4>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(variant1Url, 1)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleFavorite(1)}
                        className="h-8 w-8 p-0"
                      >
                        <Heart className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={variant1Url}
                      alt="Staged room variant 1"
                      fill
                      className="object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => onZoom?.(variant1Url)}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                    />
                  </div>
                </div>

                {/* Variant 2 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Variant 2</h4>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(variant2Url, 2)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleFavorite(2)}
                        className="h-8 w-8 p-0"
                      >
                        <Heart className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={variant2Url}
                      alt="Staged room variant 2"
                      fill
                      className="object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => onZoom?.(variant2Url)}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      {variant1Url && variant2Url && (
        <div className="flex justify-center gap-4">
          <Button onClick={onRegenerate} variant="outline" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Generate New Variants
          </Button>
        </div>
      )}
    </div>
  );
} 