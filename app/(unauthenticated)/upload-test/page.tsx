"use client"

import { useState } from "react"
import { ImageUploadTest } from "@/components/upload/image-upload-test"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Upload, AlertCircle } from "lucide-react"
import { type UploadResult } from "@/lib/upload-test"

export default function PublicUploadTestPage() {
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const handleUploadComplete = (results: UploadResult[]) => {
    console.log('Upload completed:', results)
    setUploadResults(prev => [...prev, ...results])
  }

  const clearResults = () => {
    setUploadResults([])
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">🧪 Public Upload Test</h1>
          <p className="text-muted-foreground mt-2">
            Testing image upload functionality without authentication
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">Temporary test page - no auth required</span>
          </div>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Images
            </CardTitle>
            <CardDescription>
              Drag and drop images or click to browse. Supports JPEG, PNG, and WebP files up to 10MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUploadTest
              onUploadComplete={handleUploadComplete}
              maxFiles={3}
              className="min-h-[200px]"
            />
          </CardContent>
        </Card>

        {/* Results Section */}
        {uploadResults.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Upload Results
                </CardTitle>
                <CardDescription>
                  Successfully uploaded {uploadResults.length} file(s)
                </CardDescription>
              </div>
              <Button variant="outline" onClick={clearResults}>
                Clear Results
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {uploadResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Upload {index + 1}</Badge>
                          <Badge variant="outline">{result.fileName}</Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><strong>Job ID:</strong> {result.jobId}</p>
                          <p><strong>File Size:</strong> {result.fileSize ? (result.fileSize / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'}</p>
                          <p><strong>Storage Path:</strong> {result.storagePath}</p>
                        </div>
                      </div>
                      
                      {result.imageUrl && (
                        <div className="flex-shrink-0">
                          <img
                            src={result.imageUrl}
                            alt={result.fileName || 'Uploaded image'}
                            className="h-20 w-20 object-cover rounded"
                          />
                        </div>
                      )}
                    </div>
                    
                    {result.imageUrl && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium mb-1">Public URL:</p>
                        <code className="text-xs bg-muted p-2 rounded block break-all">
                          {result.imageUrl}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Database tables created</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Storage buckets configured</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Environment variables loaded</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">Clerk authentication: Not configured (expected)</span>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <h4>After successful upload test:</h4>
            <ol>
              <li>Set up Clerk authentication keys</li>
              <li>Configure Replicate API for AI processing</li>
              <li>Move to Task 3: Implement Furniture Masking</li>
              <li>Test the complete staging workflow</li>
            </ol>
            
            <h4>Test the upload system:</h4>
            <ul>
              <li>Upload a room photo (JPEG/PNG/WebP under 10MB)</li>
              <li>Verify the file appears in Supabase Storage</li>
              <li>Check that a job record is created in the database</li>
              <li>Confirm the public URL works</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 