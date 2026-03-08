import { ChevronDown, Download } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 relative">
            <div className="absolute inset-0 bg-[hsl(var(--confetti-blue))] rotate-[-20deg] rounded-sm scale-75" />
            <div className="absolute inset-0 bg-[hsl(var(--confetti-red))] rotate-[20deg] rounded-sm scale-50 translate-x-1" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Antigravity
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Product</a>
          <button className="flex items-center gap-1 hover:text-foreground transition-colors">
            Use Cases <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <a href="#" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="#" className="hover:text-foreground transition-colors">Blog</a>
          <button className="flex items-center gap-1 hover:text-foreground transition-colors">
            Resources <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <button className="flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
        Download <Download className="w-3.5 h-3.5" />
      </button>
    </nav>
  );
};

export default Navbar;
