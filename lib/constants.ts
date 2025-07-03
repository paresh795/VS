// Style presets from PRD
export const STYLE_PRESETS = {
  modern: {
    name: "Modern",
    description: "Clean lines, neutral colors, minimalist furniture",
    prompt: "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Insert or replace **movable furniture and décor only**.\n\nNow our goal is to move items into this room that make it look like a Modern style {space} without changing any of the structural or architectural things like doors, stairs, windows, walls, floor, stairways, walkway & spacing any of the things we don't have to change at all just insert some of the furniture and furnishings lightings and plants and justice intelligently insert them without changing anything else\n\nOUTPUT: one photoreal JPEG, 4K, same resolution and framing as input.",
    thumbnail: "/style-previews/modern.jpg",
    color: "#2563eb"
  },
  scandinavian: {
    name: "Scandinavian",
    description: "Light woods, white walls, hygge elements",
    prompt: "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Insert or replace **movable furniture and décor only**.\n\nNow our goal is to move items into this room that make it look like a Scandinavian style {space} without changing any of the structural or architectural things like doors, stairs, windows, walls, floor, stairways, walkway & spacing any of the things we don't have to change at all just insert some of the furniture and furnishings lightings and plants and justice intelligently insert them without changing anything else\n\nOUTPUT: one photoreal JPEG, 4K, same resolution and framing as input.",
    thumbnail: "/style-previews/scandinavian.jpg",
    color: "#059669"
  },
  industrial: {
    name: "Industrial",
    description: "Raw materials, exposed elements, vintage touches",
    prompt: "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Insert or replace **movable furniture and décor only**.\n\nNow our goal is to move items into this room that make it look like an Industrial style {space} without changing any of the structural or architectural things like doors, stairs, windows, walls, floor, stairways, walkway & spacing any of the things we don't have to change at all just insert some of the furniture and furnishings lightings and plants and justice intelligently insert them without changing anything else\n\nOUTPUT: one photoreal JPEG, 4K, same resolution and framing as input.",
    thumbnail: "/style-previews/industrial.jpg",
    color: "#dc2626"
  },
  coastal: {
    name: "Coastal",
    description: "Light blues, whites, beach-inspired elements",
    prompt: "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Insert or replace **movable furniture and décor only**.\n\nNow our goal is to move items into this room that make it look like a Coastal style {space} without changing any of the structural or architectural things like doors, stairs, windows, walls, floor, stairways, walkway & spacing any of the things we don't have to change at all just insert some of the furniture and furnishings lightings and plants and justice intelligently insert them without changing anything else\n\nOUTPUT: one photoreal JPEG, 4K, same resolution and framing as input.",
    thumbnail: "/style-previews/coastal.jpg",
    color: "#0891b2"
  },
  farmhouse: {
    name: "Farmhouse",
    description: "Rustic elements, shiplap, vintage accessories",
    prompt: "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Insert or replace **movable furniture and décor only**.\n\nNow our goal is to move items into this room that make it look like a Farmhouse style {space} without changing any of the structural or architectural things like doors, stairs, windows, walls, floor, stairways, walkway & spacing any of the things we don't have to change at all just insert some of the furniture and furnishings lightings and plants and justice intelligently insert them without changing anything else\n\nOUTPUT: one photoreal JPEG, 4K, same resolution and framing as input.",
    thumbnail: "/style-previews/farmhouse.jpg",
    color: "#c2410c"
  },
  luxury: {
    name: "Luxury",
    description: "Rich fabrics, elegant furniture, high-end finishes",
    prompt: "### VIRTUAL STAGING ONLY – DO NOT REMODEL \n1. Keep every fixed architectural element IDENTICAL to the ROOM IN THE input photo: walls,ceiling, floor, trim, windows, windows style & spacing, door, stairs, vents, switch plates, baseboards, curtains. stairways, walkway etc\n2. Do **NOT** modify floor colour, floor material, grout lines, wall paint, window frames, or exterior view.\n3. Do **NOT** move, rotate, crop, zoom, or change camera perspective.\n4. Insert or replace **movable furniture and décor only**.\n\nNow our goal is to move items into this room that make it look like a Luxury style {space} without changing any of the structural or architectural things like doors, stairs, windows, walls, floor, stairways, walkway & spacing any of the things we don't have to change at all just insert some of the furniture and furnishings lightings and plants and justice intelligently insert them without changing anything else\n\nOUTPUT: one photoreal JPEG, 4K, same resolution and framing as input.",
    thumbnail: "/style-previews/luxury.jpg",
    color: "#7c3aed"
  }
} as const;

// Legacy style descriptions (now deprecated - use STYLE_PRESETS.description)
export const STYLE_DESCRIPTIONS = {
  modern: "Clean lines, minimalist design, neutral colors",
  scandinavian: "Light woods, cozy textures, hygge aesthetic", 
  industrial: "Exposed brick, metal accents, urban loft feel",
  coastal: "Beach-inspired, light blues, natural materials",
  farmhouse: "Rustic charm, vintage pieces, warm woods",
  luxury: "High-end finishes, elegant furniture, sophisticated"
} as const

export type StylePreset = keyof typeof STYLE_PRESETS

// Room types
export const ROOM_TYPES = {
  living_room: "living room",
  bedroom: "bedroom", 
  kitchen: "kitchen",
  dining_room: "dining room",
  bathroom: "bathroom",
  office: "home office",
  family_room: "family room",
  den: "den",
  study: "study"
} as const;

export type RoomType = typeof ROOM_TYPES[keyof typeof ROOM_TYPES]

// Credit costs from PRD (Updated based on 8x markup for $0.05 API cost)
export const CREDIT_COSTS = {
  MASK_AND_EMPTY: 10,       // Mask generation + empty room = $0.50
  STAGING_VARIANT: 10,      // Single staging variant = $0.50  
  STAGING_FULL: 20,         // Two variants = $1.00
  CHAT_EDIT: 8              // Chat-based edit = $0.40
} as const

// Credit pricing configuration with Stripe Price IDs
export const CREDIT_PACKAGES = {
  starter: {
    name: "Starter",
    credits: 1000,
    price: 19.99,
    priceId: "price_1ReFFfG7ItX1vxU8AbtRJkQo", // Test mode Price ID
    operations: 50,           // 20 credits per operation
    savings: null,
    popular: false,
    features: [
      "1,000 staging credits",
      "50 staging operations", 
      "All 6 style presets",
      "Standard support",
      "High-quality outputs"
    ]
  },
  professional: {
    name: "Professional", 
    credits: 2500,
    price: 49.99,
    priceId: "price_1ReFG0G7ItX1vxU8B6knx0SO", // Test mode Price ID
    operations: 125,          // 20 credits per operation
    savings: "25% bonus credits",
    popular: true,
    features: [
      "2,500 staging credits",
      "125 staging operations",
      "All 6 style presets", 
      "Priority support",
      "High-quality outputs",
      "25% bonus credits"
    ]
  },
  business: {
    name: "Business",
    credits: 6000,
    price: 119.99, 
    priceId: "price_1ReFGMG7ItX1vxU8lEAK1KbS", // Test mode Price ID
    operations: 300,          // 20 credits per operation
    savings: "50% bonus credits",
    popular: false,
    features: [
      "6,000 staging credits",
      "300 staging operations",
      "All 6 style presets",
      "Premium support", 
      "Highest quality outputs",
      "50% bonus credits",
      "Priority processing"
    ]
  }
} as const

export type CreditPackage = keyof typeof CREDIT_PACKAGES

// Legacy bundle (deprecated)
export const CREDIT_BUNDLE = {
  AMOUNT: 2000,             // Credits in bundle
  PRICE_CENTS: 1990         // $19.90 in cents
} as const

// File upload limits
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
  MAX_FILES: 1, // Single file upload for now
  ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  MIN_DIMENSIONS: {
    width: 512,
    height: 512
  },
  MAX_DIMENSIONS: {
    width: 4096, 
    height: 4096
  }
} as const

// Auto-purge configuration
export const AUTO_PURGE_DAYS = 30

// Processing timeouts
export const TIMEOUTS = {
  MASK_GENERATION: 60000,     // 60 seconds
  EMPTY_ROOM: 120000,         // 2 minutes
  STAGING: 180000,            // 3 minutes
  EDIT: 60000                 // 60 seconds
} as const

// Image processing settings
export const IMAGE_SETTINGS = {
  QUALITY: 0.9,
  THUMBNAIL_SIZE: 300,
  PREVIEW_SIZE: 800
} as const

export const STAGING_CREDITS_COST = 4; // 2 per variant × 2 variants (testing) 