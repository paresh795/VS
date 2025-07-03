// FAL.AI Configuration and Utilities
// Professional configuration management for FAL.AI integration

import { fal } from '@fal-ai/client'

// Configure FAL.AI client on module load
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY
  })
  console.log('✅ [FAL CONFIG] FAL.AI client configured successfully')
} else {
  console.warn('⚠️ [FAL CONFIG] FAL_KEY environment variable not found')
}

// FAL.AI API endpoints we use - CORRECT ENDPOINTS FROM DOCUMENTATION
export const FAL_ENDPOINTS = {
  FLUX_KONTEXT_PRO: 'fal-ai/flux-pro/kontext'
} as const

// Default parameters for all requests
export const FAL_DEFAULTS = {
  guidance_scale: 3.5,
  num_images: 1,
  safety_tolerance: "2",
  output_format: "jpeg",
  aspect_ratio: "16:9"
} as const

// Utility function to check FAL.AI configuration
export function checkFALConfig(): { isConfigured: boolean; message: string } {
  if (!process.env.FAL_KEY) {
    return {
      isConfigured: false,
      message: 'FAL_KEY environment variable is missing'
    }
  }

  if (process.env.FAL_KEY.length < 10) {
    return {
      isConfigured: false,
      message: 'FAL_KEY appears to be invalid (too short)'
    }
  }

  return {
    isConfigured: true,
    message: 'FAL.AI is properly configured'
  }
}

// Build empty room prompt
export function buildEmptyRoomPrompt(): string {
  return "### VIRTUAL STAGING ONLY – EMPTY OUT THE WHOLE ROOM, DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. REMOVE **movable furniture and décor only**."
}

// Build staging prompt using the constants from the project
export function buildStagingPrompt(styleName: string): string {
  // Use the exact prompts from constants.ts
  const STYLE_PROMPTS: Record<string, string> = {
    'modern': "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Stage using ONLY **movable furniture and décor** in the **Modern** style: modern, sleek and contemporary look. Clean lines, neutral colour palette, minimalist décor. Upscale furniture.\n5. **Present like professional photography** but be slightly **better**.",
    
    'scandinavian': "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Stage using ONLY **movable furniture and décor** in the **Scandinavian** style: cozy, minimalist décor with natural materials. Light woods, neutral tones, hygge elements.\n5. **Present like professional photography** but be slightly **better**.",
    
    'traditional': "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Stage using ONLY **movable furniture and décor** in the **Traditional** style: classic, timeless décor. Rich fabrics, warm colors, elegant furniture pieces.\n5. **Present like professional photography** but be slightly **better**.",
    
    'rustic': "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Stage using ONLY **movable furniture and décor** in the **Rustic** style: farmhouse, country décor. Natural materials, vintage pieces, cozy textiles.\n5. **Present like professional photography** but be slightly **better**.",
    
    'industrial': "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Stage using ONLY **movable furniture and décor** in the **Industrial** style: urban loft décor. Metal fixtures, leather furniture, exposed elements aesthetic.\n5. **Present like professional photography** but be slightly **better**.",
    
    'bohemian': "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Stage using ONLY **movable furniture and décor** in the **Bohemian** style: eclectic, artistic décor. Mixed patterns, vibrant colors, plants and textiles.\n5. **Present like professional photography** but be slightly **better**."
  }
  
  return STYLE_PROMPTS[styleName.toLowerCase()] || STYLE_PROMPTS['modern']
}

// Error handling for FAL.AI responses
export function handleFALError(error: any): string {
  if (error?.message) {
    return error.message
  }
  
  if (error?.detail) {
    return Array.isArray(error.detail) ? error.detail[0]?.msg || 'FAL.AI API error' : error.detail
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  return 'Unknown FAL.AI error occurred'
}

export default fal 