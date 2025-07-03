# Virtual Staging Implementation Guide

## 🎯 **Critical Issues Encountered & Solutions**

### **Issue 1: Invalid Replicate Model Version**
- **❌ Problem**: Using hardcoded version ID `b8693a1c76b97b5bc2a0f2ec90b4faaba72db7dd635ecf70fa5a9ed5b54ab72c`
- **🔍 Root Cause**: Replicate version IDs change over time and become invalid
- **✅ Solution**: Use model name `black-forest-labs/flux-kontext-pro` (auto-resolves to latest)
- **📝 Key Lesson**: Always use model names, not version IDs for production

### **Issue 2: HTTPS Webhook Requirement in Development**
- **❌ Problem**: Replicate requires HTTPS webhooks, localhost is HTTP
- **🔍 Root Cause**: Security requirement from Replicate API
- **✅ Solution**: Disable webhooks in development, use manual sync polling
- **📝 Key Lesson**: Development needs different strategy than production

### **Issue 3: Missing Polling Infrastructure**
- **❌ Problem**: No mechanism to check Replicate status without webhooks
- **🔍 Root Cause**: Frontend relied on webhook updates only
- **✅ Solution**: Created `/api/sync-staging` and `/api/replicate/status/[id]` endpoints
- **📝 Key Lesson**: Always have fallback polling for development

### **Issue 4: Incomplete Error Handling**
- **❌ Problem**: Silent failures with no debugging information
- **🔍 Root Cause**: Insufficient logging and error reporting
- **✅ Solution**: Comprehensive step-by-step logging throughout the flow
- **📝 Key Lesson**: Debug logging is essential for complex async flows

## 🏗️ **Architecture Pattern for Replicate Integration**

### **Production Setup (with webhooks)**
```typescript
const prediction = await replicate.predictions.create({
  model: "black-forest-labs/flux-kontext-pro",
  input: { /* parameters */ },
  webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`,
  webhook_events_filter: ["start", "output", "logs", "completed"]
});
```

### **Development Setup (polling)**
```typescript
const prediction = await replicate.predictions.create({
  model: "black-forest-labs/flux-kontext-pro", 
  input: { /* parameters */ }
  // No webhook - relies on manual sync
});
```

## 🔄 **Required API Endpoints**

### **1. Main Generation Endpoint** (`/api/stage`)
- Creates Replicate predictions
- Stores job in database
- Returns job ID for tracking

### **2. Webhook Handler** (`/api/webhooks/replicate`)
- Handles production webhook updates
- Updates job status and results
- Manages multi-variant completion

### **3. Manual Sync Endpoint** (`/api/sync-staging`)
- Development fallback for webhook updates
- Polls Replicate API directly
- Updates job status manually

### **4. Status Check Endpoint** (`/api/replicate/status/[id]`)
- Direct Replicate prediction status
- Used by polling mechanisms
- Provides real-time status

### **5. Job Status Endpoint** (`/api/jobs/[id]`)
- Returns current job status from database
- Used by frontend polling
- Includes progress and results

## 🎨 **Staging-Specific Requirements**

### **Multi-Variant Generation**
- Always create 2 predictions with different seeds
- Store comma-separated Replicate IDs: `"id1,id2"`
- Job completed only when both variants finish
- Frontend expects `resultUrls` array with 2 URLs

### **Credit Management**
- Deduct credits upfront (40 credits for 2 variants)
- Refund on failure
- Update balance in response

### **Status Flow**
```
pending → processing → completed (with 2 results)
                   ↓
                 failed (with refund)
```

## 🔧 **Implementation Checklist**

### **✅ API Setup**
- [ ] Use model name, not version ID
- [ ] Environment-aware webhook configuration
- [ ] Comprehensive error logging
- [ ] Manual sync fallback
- [ ] Credit management integration

### **✅ Frontend Integration**
- [ ] Polling mechanism with timeout
- [ ] Manual sync triggering
- [ ] Progress indicators
- [ ] Error handling with user feedback
- [ ] Result display with variants

### **✅ Database Schema**
- [ ] `replicateJobId` field for tracking
- [ ] `resultUrls` JSON array for variants
- [ ] `status` enum including all states
- [ ] `creditsUsed` for billing tracking

## 🚨 **Common Pitfalls to Avoid**

1. **Don't hardcode version IDs** - Use model names
2. **Don't assume webhooks work in dev** - Always have polling fallback
3. **Don't forget multi-variant logic** - Staging needs 2 results
4. **Don't skip error logging** - Debug info is crucial
5. **Don't forget credit refunds** - Handle failures properly

## 🎯 **Best Practices**

1. **Environment Detection**: Different behavior for dev/prod
2. **Comprehensive Logging**: Step-by-step debug information
3. **Timeout Handling**: Don't let jobs hang indefinitely
4. **Credit Safety**: Deduct upfront, refund on failure
5. **User Feedback**: Clear status updates and error messages

## 📊 **Performance Expectations**

- **Generation Time**: 30-90 seconds per variant
- **Total Time**: 1-3 minutes for 2 variants
- **Success Rate**: >95% with proper error handling
- **Credit Cost**: 40 credits (20 per variant)

## 🔮 **Future Enhancements**

1. **Batch Processing**: Multiple jobs in parallel
2. **Priority Queue**: Premium users get faster processing
3. **Result Caching**: Cache successful generations
4. **A/B Testing**: Different prompts/parameters
5. **Analytics**: Track success rates and timing 