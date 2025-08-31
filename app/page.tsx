"use client";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import { BackgroundLines } from "@/components/ui/background-lines";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { useRouter } from "next/navigation";
import { generateSessionToken } from "@/lib/utils";

export default function Home() {
  const router = useRouter();

  const handleDashboardClick = () => {
    const sessionToken = generateSessionToken();
    router.push(`/dashboard/${sessionToken}`);
  };
  return (
    <BackgroundLines className="min-h-screen bg-black font-mono" svgOptions={{ duration: 8 }}>
      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-4 font-mono">
        {/* AIDB Text with Hover Effect - Much Larger */}
        <div className="h-64 w-full max-w-6xl">
          <TextHoverEffect text="AIDB" duration={0.3} />
        </div>

        {/* Tagline with Text Generate Effect */}
        <div className="max-w-4xl text-center -mt-6">
          <TextGenerateEffect 
            words="Transform complex database queries into natural conversations with AI-powered intelligence"
            className="font-mono text-white text-xl md:text-2xl font-light"
            duration={0.8}
            highlightWords={["database", "natural", "conversations", "ai-powered", "intelligence"]}
          />
        </div>

        {/* Perfect Dashboard Button with Animation */}
        <button 
          onClick={handleDashboardClick}
          className="group relative px-8 py-3 rounded-full border border-white bg-white text-black font-mono font-medium text-lg overflow-hidden transition-all duration-300 ease-out hover:shadow-lg hover:shadow-white/30 hover:-translate-y-1 mt-6"
        >
          <span className="relative z-10 flex items-center gap-2 transition-transform duration-300 group-hover:-translate-y-0.5">
            <span className="transition-transform duration-300 group-hover:-translate-y-0.5">Dashboard</span>
            <svg className="w-5 h-5 transition-all duration-300 group-hover:translate-x-2 group-hover:-translate-y-0.5 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </span>
          {/* Subtle shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-out"></div>
        </button>
      </div>

      {/* Developer Credit */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
        <p className="text-neutral-400 font-mono text-sm">
          Dev: <span className="text-white font-medium">Samarth Ghante</span>
        </p>
      </div>
    </BackgroundLines>
  );
}
