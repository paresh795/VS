'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticResult {
  timestamp: string;
  checks: {
    environment?: any;
    auth?: any;
    database?: any;
    credits?: any;
    constants?: any;
    replicate?: any;
    databaseConnection?: any;
  };
  summary: {
    allPassed: boolean;
    readyForStaging: boolean;
  };
}

export function StagingDebug() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 [STAGING DEBUG] Running diagnostics...');
      const response = await fetch('/api/staging-debug', {
        method: 'GET'
      });
      
      const data = await response.json();
      console.log('📊 [STAGING DEBUG] Results:', data);
      
      if (response.ok) {
        setDiagnostics(data);
        if (data.summary.readyForStaging) {
          toast.success('All staging checks passed! System is ready.');
        } else {
          toast.warning('Some staging checks failed. See details below.');
        }
      } else {
        setError(data.error || 'Diagnostic check failed');
        toast.error('Diagnostic check failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast.error('Failed to run diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const handleFixStuckJobs = async () => {
    setFixing(true);
    setError(null);
    
    try {
      console.log('🔧 [STAGING DEBUG] Fixing stuck jobs...');
      toast.info('Fixing stuck jobs...');
      
      const response = await fetch('/api/fix-stuck-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
      
      const data = await response.json();
      console.log('🔧 [STAGING DEBUG] Fix result:', data);
      
      if (response.ok) {
        if (data.fixedJobs?.length > 0) {
          toast.success(`✅ Fixed ${data.fixedJobs.length} stuck jobs!`);
          console.log('Fixed jobs:', data.fixedJobs);
        } else {
          toast.info('✅ No stuck jobs found to fix');
        }
      } else {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      toast.error(`❌ Failed to fix stuck jobs: ${errorMsg}`);
      console.error('Fix stuck jobs error:', err);
    } finally {
      setFixing(false);
    }
  };

  const renderCheck = (checkName: string, check: any) => {
    if (!check) return null;

    const isSuccess = check.success !== false && !check.error;
    const icon = isSuccess ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );

    return (
      <div key={checkName} className="flex items-start justify-between p-3 border rounded-lg">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium capitalize">{checkName.replace(/([A-Z])/g, ' $1')}</span>
        </div>
        <div className="text-right text-sm">
          {check.error ? (
            <Badge variant="destructive">{check.error}</Badge>
          ) : check.success === false ? (
            <Badge variant="destructive">Failed</Badge>
          ) : (
            <Badge variant="default">OK</Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          Staging System Diagnostics
        </CardTitle>
        <CardDescription>
          Check all staging system components for issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center gap-3">
          <Button 
            onClick={runDiagnostics} 
            disabled={loading || fixing}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Running Diagnostics...
              </>
            ) : (
              'Run Diagnostics'
            )}
          </Button>
          
          <Button
            onClick={handleFixStuckJobs}
            disabled={loading || fixing}
            variant="destructive"
            className="flex items-center gap-2"
          >
            {fixing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Fixing Jobs...
              </>
            ) : (
              'Fix Stuck Jobs'
            )}
          </Button>
        </div>

        {error && (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        {diagnostics && (
          <div className="space-y-4">
            {/* Summary */}
            <div className={`p-4 border rounded-lg ${
              diagnostics.summary.readyForStaging 
                ? 'border-green-200 bg-green-50' 
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center gap-2">
                {diagnostics.summary.readyForStaging ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-semibold">
                  {diagnostics.summary.readyForStaging 
                    ? 'System Ready for Staging' 
                    : 'System NOT Ready for Staging'
                  }
                </span>
              </div>
            </div>

            {/* Individual Checks */}
            <div className="space-y-2">
              {Object.entries(diagnostics.checks).map(([checkName, check]) => 
                renderCheck(checkName, check)
              )}
            </div>

            {/* Detailed Info */}
            <details className="border rounded-lg">
              <summary className="p-3 cursor-pointer font-medium">
                View Detailed Results
              </summary>
              <div className="p-3 border-t bg-gray-50">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(diagnostics, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 