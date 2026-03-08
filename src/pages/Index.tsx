import ConfettiParticles from "@/components/ConfettiParticles";
import Navbar from "@/components/Navbar";
import { Download } from "lucide-react";

const Index = () => {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <ConfettiParticles />
      <Navbar />

      {/* Hero Section */}
      <section className="relative z-20 flex flex-col items-center justify-center min-h-screen px-4 pointer-events-none">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-6 h-6 relative">
            <div className="absolute inset-0 bg-[hsl(var(--confetti-blue))] rotate-[-20deg] rounded-sm scale-75" />
            <div className="absolute inset-0 bg-[hsl(var(--confetti-red))] rotate-[20deg] rounded-sm scale-50 translate-x-1" />
          </div>
          <span className="text-lg font-medium text-foreground">Antigravity</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold text-center leading-[1.05] tracking-tight max-w-4xl text-foreground">
          Experience liftoff with the next-generation IDE
        </h1>

        <div className="flex items-center gap-3 mt-10 pointer-events-auto">
          <button className="flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
            <Download className="w-4 h-4" />
            Download for Linux
          </button>
          <button className="px-6 py-3 rounded-full text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors">
            Explore use cases
          </button>
        </div>
      </section>
    </div>
  );
};

export default Index;
