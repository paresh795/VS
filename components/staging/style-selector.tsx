'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles } from 'lucide-react';
import { STYLE_PRESETS, ROOM_TYPES, STAGING_CREDITS_COST, StylePreset } from '@/lib/constants';

interface StyleSelectorProps {
  selectedStyle: StylePreset | null;
  selectedRoomType: string | null;
  onStyleSelect: (style: StylePreset) => void;
  onRoomTypeSelect: (roomType: string) => void;
  onProceed: () => void;
  disabled?: boolean;
}

export function StyleSelector({
  selectedStyle,
  selectedRoomType,
  onStyleSelect,
  onRoomTypeSelect,
  onProceed,
  disabled = false
}: StyleSelectorProps) {
  const canProceed = selectedStyle && selectedRoomType && !disabled;

  return (
    <div className="space-y-8">
      {/* Style Presets Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Choose Your Design Style</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(STYLE_PRESETS).map(([key, preset]) => (
            <Card
              key={key}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
                selectedStyle === key
                  ? 'ring-2 ring-blue-500 shadow-lg border-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disabled && onStyleSelect(key as StylePreset)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle 
                    className="text-lg font-semibold" 
                    style={{ color: selectedStyle === key ? preset.color : '#374151' }}
                  >
                    {preset.name}
                  </CardTitle>
                  {selectedStyle === key && (
                    <div 
                      className="rounded-full p-1"
                      style={{ backgroundColor: preset.color }}
                    >
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600 leading-relaxed">
                  {preset.description}
                </p>
                
                {/* Style preview placeholder - would show actual preview images in production */}
                <div 
                  className="w-full h-24 rounded-lg flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: preset.color }}
                >
                  {preset.name} Preview
                </div>
                
                {selectedStyle === key && (
                  <Badge 
                    variant="secondary" 
                    className="w-full justify-center"
                    style={{ backgroundColor: `${preset.color}15`, color: preset.color }}
                  >
                    ✓ Selected
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Room Type Selection */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Select Room Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Object.entries(ROOM_TYPES).map(([key, displayName]) => (
            <Button
              key={key}
              variant={selectedRoomType === displayName ? "default" : "outline"}
              className={`h-12 text-sm font-medium transition-all duration-200 ${
                selectedRoomType === displayName
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                  : 'hover:bg-gray-50 hover:border-gray-300'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !disabled && onRoomTypeSelect(displayName)}
              disabled={disabled}
            >
              {displayName.charAt(0).toUpperCase() + displayName.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary and Proceed Section */}
      {selectedStyle && selectedRoomType && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Ready to Stage!</h3>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>
                    Style: <strong style={{ color: STYLE_PRESETS[selectedStyle].color }}>
                      {STYLE_PRESETS[selectedStyle].name}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Room: <strong>{selectedRoomType}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Cost: <strong>{STAGING_CREDITS_COST} credits</strong>
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  We'll generate 2 beautiful variants for comparison
                </p>
              </div>
              
              <Button
                onClick={onProceed}
                disabled={!canProceed}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                {disabled ? 'Staging...' : 'Start Staging'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 