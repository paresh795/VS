'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AuthDebugPage() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const { user } = useUser();
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runAuthTests = async () => {
    setIsLoading(true);
    const results = [];

    // Test 1: Credits API
    try {
      const response = await fetch('/api/credits/balance', {
        credentials: 'include'
      });
      const data = await response.json();
      results.push({
        test: 'Credits Balance API',
        status: response.ok ? 'SUCCESS' : 'FAILED',
        statusCode: response.status,
        data: data
      });
    } catch (error) {
      results.push({
        test: 'Credits Balance API',
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 2: Jobs API
    try {
      const response = await fetch('/api/jobs/active', {
        credentials: 'include'
      });
      const data = await response.json();
      results.push({
        test: 'Active Jobs API',
        status: response.ok ? 'SUCCESS' : 'FAILED',
        statusCode: response.status,
        data: data
      });
    } catch (error) {
      results.push({
        test: 'Active Jobs API',
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 3: System Health API
    try {
      const response = await fetch('/api/system/health', {
        credentials: 'include'
      });
      const data = await response.json();
      results.push({
        test: 'System Health API',
        status: response.ok ? 'SUCCESS' : 'FAILED',
        statusCode: response.status,
        data: data
      });
    } catch (error) {
      results.push({
        test: 'System Health API',
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 4: Token retrieval
    try {
      const token = await getToken();
      results.push({
        test: 'Clerk Token Retrieval',
        status: token ? 'SUCCESS' : 'FAILED',
        data: { hasToken: !!token, tokenLength: token?.length }
      });
    } catch (error) {
      results.push({
        test: 'Clerk Token Retrieval',
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setTestResults(results);
    setIsLoading(false);
  };

  const clearStorageAndRefresh = () => {
    // Clear all local storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear cookies (best effort)
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos) : c;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    });
    
    // Refresh page
    window.location.reload();
  };

  if (!isLoaded) {
    return <div className="p-8">Loading authentication...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Authentication Debug</h1>
          <p className="text-muted-foreground">
            Diagnose and fix authentication issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runAuthTests} disabled={isLoading}>
            {isLoading ? 'Testing...' : 'Run Tests'}
          </Button>
          <Button variant="destructive" onClick={clearStorageAndRefresh}>
            Clear Storage & Refresh
          </Button>
        </div>
      </div>

      {/* Authentication Status */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication Status</CardTitle>
          <CardDescription>Current Clerk authentication state</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Loaded</span>
              <Badge variant={isLoaded ? 'default' : 'destructive'}>
                {isLoaded ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Signed In</span>
              <Badge variant={isSignedIn ? 'default' : 'destructive'}>
                {isSignedIn ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">User ID</span>
              <Badge variant={userId ? 'default' : 'secondary'}>
                {userId ? userId.substring(0, 8) + '...' : 'None'}
              </Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Session ID</span>
              <Badge variant={sessionId ? 'default' : 'secondary'}>
                {sessionId ? sessionId.substring(0, 8) + '...' : 'None'}
              </Badge>
            </div>
          </div>
          
          {user && (
            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">User Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div><strong>Email:</strong> {user.primaryEmailAddress?.emailAddress}</div>
                <div><strong>Name:</strong> {user.fullName || 'Not set'}</div>
                <div><strong>Created:</strong> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</div>
                <div><strong>Last Sign In:</strong> {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : 'Unknown'}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>API Test Results</CardTitle>
            <CardDescription>Results from testing various API endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{result.test}</h3>
                    <Badge 
                      variant={
                        result.status === 'SUCCESS' ? 'default' : 
                        result.status === 'FAILED' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {result.status}
                    </Badge>
                  </div>
                  
                  {result.statusCode && (
                    <div className="text-sm text-muted-foreground mb-2">
                      Status Code: {result.statusCode}
                    </div>
                  )}
                  
                  {result.error && (
                    <div className="text-sm text-red-600 mb-2">
                      Error: {result.error}
                    </div>
                  )}
                  
                  {result.data && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        View Response Data
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common fixes for authentication issues</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="h-auto p-4 flex flex-col items-start"
            >
              <span className="font-semibold">Refresh Page</span>
              <span className="text-sm text-muted-foreground">
                Reload the page to refresh authentication state
              </span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={clearStorageAndRefresh}
              className="h-auto p-4 flex flex-col items-start"
            >
              <span className="font-semibold">Clear All Data</span>
              <span className="text-sm text-muted-foreground">
                Clear storage and refresh (will require re-login)
              </span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.open('/dashboard', '_blank')}
              className="h-auto p-4 flex flex-col items-start"
            >
              <span className="font-semibold">New Tab</span>
              <span className="text-sm text-muted-foreground">
                Open dashboard in a new tab
              </span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => navigator.clipboard.writeText(JSON.stringify({
                isLoaded,
                isSignedIn,
                userId,
                sessionId,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
              }, null, 2))}
              className="h-auto p-4 flex flex-col items-start"
            >
              <span className="font-semibold">Copy Debug Info</span>
              <span className="text-sm text-muted-foreground">
                Copy authentication state to clipboard
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 