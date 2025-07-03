'use client';

import { useState, useEffect } from 'react';
import { ImageUpload } from '@/components/upload/image-upload';
import { EmptyRoomGenerator } from '@/components/empty-room/empty-room-generator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  Zap, 
  Palette, 
  Download,
  RotateCcw,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Lock,
  History,
  ChevronDown
} from 'lucide-react';
import { STYLE_PRESETS, ROOM_TYPES, CREDIT_COSTS, type StylePreset } from '@/lib/constants';
import { toast } from 'sonner';
import { type UploadResult } from '@/lib/upload';
import { useCreditsStore } from '@/lib/store/credits-store';

// Types for the new workflow
type WorkflowState = 'upload' | 'empty-room-decision' | 'empty-room-generation' | 'staging-setup' | 'staging-results';

interface EmptyRoomAttempt {
  id: string;
  url: string;
  timestamp: number;
  selected?: boolean;
}

interface StagingResult {
  id: string;
  originalImage: string;
  stagedImages: string[];
  style: string;
  roomType: string;
  timestamp: string;
  creditsUsed?: number;
  processingTime?: number;
  provider?: string;
}

interface SessionHistory {
  emptyRoomAttempts: EmptyRoomAttempt[];
  stagingResults: StagingResult[];
}

export default function NewStagingDashboard() {
  // Credit store for immediate UI updates
  const { deductCredits: deductCreditsFromStore, addCredits: addCreditsToStore, balance } = useCreditsStore()
  
  // Core workflow state
  const [currentState, setCurrentState] = useState<WorkflowState>('upload');
  
  // Upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  // Empty room state
  const [emptyRoomAttempts, setEmptyRoomAttempts] = useState<EmptyRoomAttempt[]>([]);
  const [selectedEmptyRoom, setSelectedEmptyRoom] = useState<string | null>(null);
  const [emptyRoomRetryCount, setEmptyRoomRetryCount] = useState(0);
  const [isGeneratingEmptyRoom, setIsGeneratingEmptyRoom] = useState(false);
  
  // Staging state
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<string | null>(null);
  const [stagingResults, setStagingResults] = useState<StagingResult[]>([]);
  const [isStaging, setIsStaging] = useState(false);
  
  // UI state
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showRoomTypeDropdown, setShowRoomTypeDropdown] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Session history management
  const [sessionHistory, setSessionHistory] = useState<SessionHistory>({
    emptyRoomAttempts: [],
    stagingResults: []
  });
  
  // Load session history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('vs-session-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessionHistory(parsed);
      } catch (error) {
        console.error('Failed to load session history:', error);
      }
    }
  }, []);

  // Save session history to localStorage
  const saveSessionHistory = (history: SessionHistory) => {
    setSessionHistory(history);
    localStorage.setItem('vs-session-history', JSON.stringify(history));
  };

  // Handle image upload
  const handleImageUpload = (results: UploadResult[]) => {
    const successfulResult = results.find(r => r.success && r.imageUrl);
    if (successfulResult?.imageUrl) {
      setUploadedImage(successfulResult.imageUrl);
      setCurrentState('empty-room-decision');
      toast.success('Image uploaded successfully!');
    }
  };

  // Handle empty room decision
  const handleEmptyRoomDecision = (decision: 'generate' | 'already-empty') => {
    if (decision === 'generate') {
      setCurrentState('empty-room-generation');
    } else {
      // Treat uploaded image as empty room
      if (uploadedImage) {
        const emptyRoomAttempt: EmptyRoomAttempt = {
          id: `manual-${Date.now()}`,
          url: uploadedImage,
          timestamp: Date.now(),
          selected: true
        };
        setEmptyRoomAttempts([emptyRoomAttempt]);
        setSelectedEmptyRoom(uploadedImage);
        setCurrentState('staging-setup');
        
        // Update session history
        const newHistory = {
          ...sessionHistory,
          emptyRoomAttempts: [...sessionHistory.emptyRoomAttempts, emptyRoomAttempt]
        };
        saveSessionHistory(newHistory);
      }
    }
  };

  // Handle empty room generation completion
  const handleEmptyRoomComplete = (emptyRoomUrl: string) => {
    const newAttempt: EmptyRoomAttempt = {
      id: `generated-${Date.now()}`,
      url: emptyRoomUrl,
      timestamp: Date.now(),
      selected: true
    };
    
    // Deselect previous attempts
    const updatedAttempts = emptyRoomAttempts.map(attempt => ({
      ...attempt,
      selected: false
    }));
    
    const newAttempts = [...updatedAttempts, newAttempt];
    setEmptyRoomAttempts(newAttempts);
    setSelectedEmptyRoom(emptyRoomUrl);
    setIsGeneratingEmptyRoom(false);
    
    // Update session history
    const newHistory = {
      ...sessionHistory,
      emptyRoomAttempts: [...sessionHistory.emptyRoomAttempts, newAttempt]
    };
    saveSessionHistory(newHistory);
    
    toast.success('Empty room generated successfully!');
  };

  // Handle retry empty room generation
  const handleRetryEmptyRoom = async () => {
    if (emptyRoomRetryCount >= 2) {
      toast.error('Maximum retry limit reached (2 retries)');
      return;
    }
    
    setIsGeneratingEmptyRoom(true);
    setEmptyRoomRetryCount(prev => prev + 1);
    
    // This will trigger the EmptyRoomGenerator component
    toast.info('Retrying empty room generation... (Free retry)');
  };

  // Handle empty room selection
  const handleEmptyRoomSelection = (attemptId: string) => {
    const selectedAttempt = emptyRoomAttempts.find(a => a.id === attemptId);
    if (selectedAttempt) {
      // Update selection
      const updatedAttempts = emptyRoomAttempts.map(attempt => ({
        ...attempt,
        selected: attempt.id === attemptId
      }));
      setEmptyRoomAttempts(updatedAttempts);
      setSelectedEmptyRoom(selectedAttempt.url);
    }
  };

  // Handle confirm empty room selection
  const handleConfirmEmptyRoom = () => {
    if (selectedEmptyRoom) {
      setCurrentState('staging-setup');
      toast.success('Empty room confirmed! Ready for staging.');
    }
  };

  // Handle staging execution
  const handleStartStaging = async () => {
    if (!uploadedImage || !selectedEmptyRoom || !selectedStyle || !selectedRoomType) {
      toast.error('Please complete all required selections');
      return;
    }
    
    // ✨ IMMEDIATE CREDIT DEDUCTION FOR UI
    const creditCost = CREDIT_COSTS.STAGING_FULL
    
    // Check if user has enough credits
    if (balance < creditCost) {
      toast.error(`Insufficient credits. Required: ${creditCost}, Available: ${balance}`)
      return
    }
    
    // Deduct credits immediately from UI (this will automatically track as pending)
    try {
      deductCreditsFromStore(creditCost, 'staging-pending', 'Virtual Staging')
      toast.info(`Deducted ${creditCost} credits. Generation starting...`)
    } catch (storeError) {
      toast.error('Failed to deduct credits from local store')
      return
    }
    
    setIsStaging(true);
    setCurrentState('staging-results');
    
    try {
      const response = await fetch('/api/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageUrl: uploadedImage,
          style: selectedStyle,
          space: selectedRoomType
        }),
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.stagedUrls) {
          // Add to staging results
          const newResult = {
            id: result.jobId,
            originalImage: uploadedImage,
            stagedImages: result.stagedUrls,
            style: result.style,
            roomType: result.space,
            timestamp: new Date().toISOString(),
            creditsUsed: result.creditsUsed,
            processingTime: result.processingTime,
            provider: result.provider
          };
          
          setStagingResults(prev => [newResult, ...prev]);
          
          // Save to history
          const history = JSON.parse(localStorage.getItem('stagingHistory') || '[]');
          history.unshift(newResult);
          localStorage.setItem('stagingHistory', JSON.stringify(history.slice(0, 50))); // Keep last 50
          
          // Reset form
          setUploadedImage('');
          setSelectedStyle('modern');
          setSelectedRoomType('living_room');
          
          toast.success(`Staging completed! Generated ${result.stagedUrls.length} variants in ${(result.processingTime / 1000).toFixed(1)}s`);
        } else {
          throw new Error(result.error || 'Staging failed');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || `Staging failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Staging error:', error);
      
      // 🔄 ROLLBACK CREDITS ON ANY ERROR
      try {
        addCreditsToStore(creditCost, 'Staging Refund - Error')
        console.log('🔄 [STAGING] Credits rolled back due to error')
      } catch (rollbackError) {
        console.error('❌ [STAGING] Failed to rollback credits:', rollbackError)
      }
      
      toast.error(error instanceof Error ? error.message : 'Staging failed');
      setIsStaging(false);
      setCurrentState('staging-setup');
    }
  };

  // Handle download
  const handleDownload = (imageUrl: string, variant: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `staged-room-${selectedStyle}-variant-${variant}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded variant ${variant}`);
  };

  // Handle regenerate staging
  const handleRegenerateStaging = () => {
    handleStartStaging();
  };

  // Render upload section
  const renderUploadSection = () => (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Room Image
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageUpload
          onUploadComplete={handleImageUpload}
                    maxFiles={1}
          className="min-h-[200px]"
                  />
        {uploadedImage && (
                    <div className="mt-4">
            <img 
              src={uploadedImage} 
              alt="Uploaded room" 
              className="w-full max-w-md mx-auto rounded-lg border shadow-sm"
            />
                    </div>
                  )}
                </CardContent>
              </Card>
  );

  // Render empty room decision section
  const renderEmptyRoomDecision = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Empty Room Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Your Uploaded Image</h4>
            <img 
              src={uploadedImage!} 
              alt="Original room" 
              className="w-full h-48 object-cover rounded-lg border"
            />
          </div>
          <div className="space-y-4">
            <h4 className="font-medium">Choose Your Approach</h4>
            <div className="space-y-3">
              <Button
                onClick={() => handleEmptyRoomDecision('generate')}
                className="w-full h-auto p-4 flex-col items-start"
                variant="outline"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5" />
                  <span className="font-semibold">Generate Empty Room</span>
                </div>
                <p className="text-sm text-muted-foreground text-left">
                  Let our AI remove all furniture and décor for you ({CREDIT_COSTS.MASK_AND_EMPTY} credits)
                </p>
              </Button>
              
              <Button
                onClick={() => handleEmptyRoomDecision('already-empty')}
                className="w-full h-auto p-4 flex-col items-start"
                variant="outline"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">Room is Already Empty</span>
                </div>
                <p className="text-sm text-muted-foreground text-left">
                  Skip to staging if your room is already empty (Free)
                </p>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render empty room generation section
  const renderEmptyRoomGeneration = () => (
    <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Empty Room Generation
                  </CardTitle>
                </CardHeader>
                <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Original Image</h4>
              <img 
                src={uploadedImage!} 
                alt="Original room" 
                className="w-full h-64 object-cover rounded-lg border"
              />
                          </div>
            <div>
              <EmptyRoomGenerator 
                imageUrl={uploadedImage!}
                onComplete={handleEmptyRoomComplete}
              />
                        </div>
                      </div>
        </CardContent>
      </Card>

      {/* Empty Room Results */}
      {emptyRoomAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Empty Room Results</span>
              <div className="flex items-center gap-2">
                {emptyRoomRetryCount < 2 && (
                  <Button
                    onClick={handleRetryEmptyRoom}
                    disabled={isGeneratingEmptyRoom}
                    variant="outline"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry ({2 - emptyRoomRetryCount} free retries left)
                  </Button>
                )}
                <Button
                  onClick={handleConfirmEmptyRoom}
                  disabled={!selectedEmptyRoom}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Confirm Selection
                </Button>
                    </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {emptyRoomAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                    attempt.selected 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleEmptyRoomSelection(attempt.id)}
                >
                  <img 
                    src={attempt.url} 
                    alt="Empty room attempt" 
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  {attempt.selected && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(attempt.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
          </div>
        );

  // Render staging setup section
  const renderStagingSetup = () => (
          <div className="space-y-6">
      {/* Selected Images Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Ready for Staging</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Original Image</h4>
              <img 
                src={uploadedImage!} 
                alt="Original room" 
                className="w-full h-32 object-cover rounded-lg border"
              />
            </div>
              <div>
              <h4 className="font-medium mb-2">Empty Room</h4>
              <img 
                src={selectedEmptyRoom!} 
                alt="Empty room" 
                className="w-full h-32 object-cover rounded-lg border"
              />
            </div>
              </div>
        </CardContent>
      </Card>

      {/* Style and Room Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Staging Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Style Selector Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Design Style</label>
            <div className="relative">
              <Button 
                onClick={() => setShowStyleDropdown(!showStyleDropdown)}
                variant="outline"
                className="w-full justify-between"
              >
                {selectedStyle ? STYLE_PRESETS[selectedStyle].name : 'Select a style...'}
                <ChevronDown className="h-4 w-4" />
              </Button>
              {showStyleDropdown && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {Object.entries(STYLE_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedStyle(key as StylePreset);
                        setShowStyleDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                    >
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: preset.color }}
                      />
                      <div>
                        <div className="font-medium">{preset.name}</div>
                        <div className="text-xs text-muted-foreground">{preset.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Room Type Selector Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Room Type</label>
            <div className="relative">
              <Button
                onClick={() => setShowRoomTypeDropdown(!showRoomTypeDropdown)}
                variant="outline"
                className="w-full justify-between"
              >
                {selectedRoomType || 'Select room type...'}
                <ChevronDown className="h-4 w-4" />
              </Button>
              {showRoomTypeDropdown && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {Object.entries(ROOM_TYPES).map(([key, displayName]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedRoomType(displayName);
                        setShowRoomTypeDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50"
                    >
                      {displayName.charAt(0).toUpperCase() + displayName.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Staging Button */}
          {selectedStyle && selectedRoomType && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <h4 className="font-medium">Ready to Stage</h4>
                  <p className="text-sm text-muted-foreground">
                    Style: <strong>{STYLE_PRESETS[selectedStyle].name}</strong> • 
                    Room: <strong>{selectedRoomType}</strong> • 
                                         Cost: <strong>{CREDIT_COSTS.STAGING_FULL} credits</strong>
                  </p>
                </div>
                <Button 
                  onClick={handleStartStaging}
                  disabled={isStaging}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isStaging ? 'Staging...' : 'Start Staging'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
            </div>
          );

  // Render staging results section
  const renderStagingResults = () => (
    <div className="space-y-6">
      {isStaging ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <h3 className="text-lg font-medium">Generating Staged Variants...</h3>
              <p className="text-sm text-muted-foreground">
                This may take 30-60 seconds. We're creating 2 beautiful variants for you.
              </p>
                             <div className="space-y-2">
                 <Progress value={50} className="w-full max-w-md mx-auto" />
                 <p className="text-xs text-muted-foreground">
                   Status: Processing...
                 </p>
               </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        stagingResults.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Staging Results
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={handleRegenerateStaging}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Current Results */}
                {stagingResults.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {stagingResults[stagingResults.length - 1].stagedImages.map((imageUrl, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Variant {index + 1}</span>
                          <Button
                            onClick={() => handleDownload(imageUrl, index + 1)}
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Save
              </Button>
                        </div>
                        <img 
                          src={imageUrl} 
                          alt={`Staged variant ${index + 1}`} 
                          className="w-full aspect-square object-cover rounded-lg border"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );

  // Render history section
  const renderHistorySection = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Session History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Empty Room History */}
          {sessionHistory.emptyRoomAttempts.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Empty Room Generations</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sessionHistory.emptyRoomAttempts.map((attempt) => (
                  <div key={attempt.id} className="space-y-1">
                    <img 
                      src={attempt.url} 
                      alt="Empty room" 
                      className="w-full aspect-square object-cover rounded border cursor-pointer hover:opacity-80"
                      onClick={() => window.open(attempt.url, '_blank')}
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      {new Date(attempt.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staging History */}
          {sessionHistory.stagingResults.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Staging Results</h4>
              <div className="space-y-4">
                {sessionHistory.stagingResults.map((result) => (
                  <div key={result.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">
                            {STYLE_PRESETS[result.style as keyof typeof STYLE_PRESETS]?.name || result.style} • {result.roomType}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {result.stagedImages.map((imageUrl, index) => (
                        <img 
                          key={index}
                          src={imageUrl} 
                          alt={`Staged variant ${index + 1}`} 
                          className="w-full aspect-square object-cover rounded border cursor-pointer hover:opacity-80"
                          onClick={() => window.open(imageUrl, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sessionHistory.emptyRoomAttempts.length === 0 && sessionHistory.stagingResults.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No history yet. Start by uploading an image!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Virtual Staging Dashboard</h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Transform your room photos into professionally staged spaces. Upload, generate empty rooms, 
            select your style, and get stunning results.
          </p>
        </div>

        {/* Progress Indicator */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Workflow Progress</h3>
              <Button
                onClick={() => setShowHistory(!showHistory)}
                variant="outline"
                size="sm"
              >
                <History className="h-4 w-4 mr-2" />
                {showHistory ? 'Hide' : 'Show'} History
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'upload', label: 'Upload', active: currentState === 'upload', completed: uploadedImage !== null },
                { key: 'empty-room', label: 'Empty Room', active: ['empty-room-decision', 'empty-room-generation'].includes(currentState), completed: selectedEmptyRoom !== null },
                { key: 'staging', label: 'Style Setup', active: currentState === 'staging-setup', completed: selectedStyle !== null && selectedRoomType !== null },
                { key: 'results', label: 'Results', active: currentState === 'staging-results', completed: stagingResults.length > 0 }
              ].map((step, index) => (
                <div
                  key={step.key}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    step.active 
                      ? 'bg-blue-50 border-blue-200 text-blue-700' 
                      : step.completed 
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
                >
                  <div className="text-sm font-medium">{step.label}</div>
                  {step.completed && <CheckCircle className="h-4 w-4 mx-auto mt-1" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-6">
            {currentState === 'upload' && renderUploadSection()}
            {currentState === 'empty-room-decision' && renderEmptyRoomDecision()}
            {currentState === 'empty-room-generation' && renderEmptyRoomGeneration()}
            {currentState === 'staging-setup' && renderStagingSetup()}
            {currentState === 'staging-results' && renderStagingResults()}
          </div>

          {/* History Sidebar */}
          <div className="xl:col-span-1">
            {showHistory && renderHistorySection()}
          </div>
        </div>

        {/* Start Over Button */}
        {currentState !== 'upload' && (
          <div className="text-center">
            <Button
              onClick={() => {
                setCurrentState('upload');
                setUploadedImage(null);
                setEmptyRoomAttempts([]);
                setSelectedEmptyRoom(null);
                setEmptyRoomRetryCount(0);
                setSelectedStyle(null);
                                 setSelectedRoomType(null);
                 setStagingResults([]);
                 setIsStaging(false);
                 toast.info('Starting new staging workflow');
              }}
              variant="outline"
              size="lg"
            >
              <Upload className="h-4 w-4 mr-2" />
              Start New Staging
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 