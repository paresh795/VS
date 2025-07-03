'use client';

import { useState } from 'react';

interface StagingOptions {
  imageFile: File;
  style: string;
  roomType: string;
}

interface StagingResult {
  success: boolean;
  jobId: string;
  stagedUrls: string[];
  style: string;
  space: string;
  creditsUsed: number;
  newCreditBalance: number;
  processingTime: number;
  provider: string;
  error?: string;
}

export function useStaging() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateStaging = async (options: StagingOptions): Promise<StagingResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Staging Hook] Starting staging process...');

      // Step 1: Upload image
      const formData = new FormData();
      formData.append('image', options.imageFile);
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include' // CRITICAL FIX: Include authentication cookies
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} - ${uploadError}`);
      }

      const uploadData = await uploadResponse.json();
      console.log('[Staging Hook] Upload successful:', uploadData);

      // Step 2: Start staging process with FAL.AI
      const stagingResponse = await fetch('/api/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageUrl: uploadData.url,
          style: options.style,
          space: options.roomType,
        }),
        credentials: 'include' // CRITICAL FIX: Include authentication cookies
      });

      if (!stagingResponse.ok) {
        const errorData = await stagingResponse.json();
        throw new Error(errorData.error || `Staging failed: ${stagingResponse.status}`);
      }

      const stagingData = await stagingResponse.json();
      console.log('[Staging Hook] Staging completed:', stagingData);

      // FAL.AI API returns results immediately (no polling needed)
      if (stagingData.success && stagingData.stagedUrls) {
        return {
          success: true,
          jobId: stagingData.jobId,
          stagedUrls: stagingData.stagedUrls,
          style: stagingData.style,
          space: stagingData.space,
          creditsUsed: stagingData.creditsUsed,
          newCreditBalance: stagingData.newCreditBalance,
          processingTime: stagingData.processingTime,
          provider: stagingData.provider || 'fal'
        };
      } else {
        throw new Error(stagingData.error || 'Staging failed - no results returned');
      }

    } catch (err) {
      console.error('[Staging Hook] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown staging error';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Legacy polling function (now unused with FAL.AI but kept for compatibility)
  const pollJobStatus = async (jobId: string): Promise<StagingResult | null> => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        credentials: 'include' // CRITICAL FIX: Include authentication cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Staging Hook] Job status:', data);

      if (data.status === 'completed' && data.resultUrls) {
        return {
          success: true,
          jobId: data.id,
          stagedUrls: data.resultUrls,
          style: data.style || 'Unknown',
          space: data.roomType || 'Unknown',
          creditsUsed: data.creditsUsed || 0,
          newCreditBalance: 0, // Not available in job status
          processingTime: 0, // Not available in job status
          provider: 'legacy'
        };
      } else if (data.status === 'failed') {
        throw new Error(data.errorMessage || 'Job failed');
      }

      // Job still processing
      return null;
    } catch (err) {
      console.error('[Staging Hook] Polling error:', err);
      throw err;
    }
  };

  return {
    generateStaging,
    pollJobStatus, // Kept for backward compatibility
    isLoading,
    error,
  };
} 