import Link from "next/link"

export default function MarketingPage() {
  const videoUrl = "https://res.cloudinary.com/doaqosei6/video/upload/v1752628508/Professional_Mode___The_camera_will_perform_a_slow_vleh15.mp4"

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Page Content */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Navbar */}
        <nav className="absolute top-0 left-0 right-0 z-50 px-8 py-6">
          <div className="flex justify-between items-center text-white/80 font-manrope text-sm">
            {/* Left */}
            <Link href="/" className="flex items-center space-x-2">
              {/* <img src="/logo-placeholder.svg" alt="Logo" className="h-6 w-6 invert" /> */}
              <span className="tracking-widest uppercase font-medium">Staging Studio</span>
            </Link>

            {/* Center */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/features" className="hover:text-white transition">Features</Link>
              <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
              <Link href="/contact" className="hover:text-white transition">Contact</Link>
            </div>

            {/* Right */}
            <div className="text-sm">
              <span>EN ⌄</span>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex items-center px-8">
          <div className="max-w-2xl">
            <h1 className="font-futura text-6xl text-white tracking-tight leading-[1.1]">
            TRANSFORM SPACES INTO EXPERIENCES
            </h1>
            <p className="font-manrope text-base text-white/80 mt-4 max-w-lg">
              From empty rooms to stunning, photorealistic designs in minutes. Our AI-powered virtual staging brings any vision to life.
            </p>
            <Link href="/dashboard">
              <button className="bg-white text-black px-6 py-2.5 rounded-lg font-manrope text-sm font-medium uppercase mt-8 hover:bg-gray-200 transition">
                Start Staging →
              </button>
            </Link>
          </div>
        </div>
        
        {/* Floating Labels */}
        <div
          className="absolute right-8 top-1/2 transform -translate-y-1/2 rotate-90 origin-bottom-right"
        >
          <p className="font-manrope uppercase tracking-widest text-sm text-white/60 whitespace-nowrap">
            AI-POWERED · VIRTUAL STAGING
          </p>
        </div>
        
        <div className="absolute bottom-6 left-8">
          <p className="font-manrope text-xs text-white/50">
            ✦ Powered by Generative AI, 2024
          </p>
        </div>
        
        <div className="absolute bottom-6 right-8">
          <p className="font-manrope text-xs text-white/60">
            ©️ Staging Studio
          </p>
        </div>
      </div>
    </main>
  )
}
