import { Menu, X } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  onLogin: () => void;
}

export default function Header({ onLogin }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <img src="/NorthpathAI.jpg" alt="Northpath" className="h-8 w-auto opacity-90 drop-shadow-lg" />
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#services" className="text-slate-300 hover:text-white transition-colors">Services</a>
            <a href="#about" className="text-slate-300 hover:text-white transition-colors">About</a>
            <a href="#contact" className="text-slate-300 hover:text-white transition-colors">Contact</a>
            <button 
              onClick={onLogin}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-2 rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all duration-200 font-medium"
            >
              Get Started
            </button>
          </nav>

          <button 
            className="md:hidden text-slate-300 hover:text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-slate-800 rounded-lg mt-2">
              <a href="#services" className="block px-3 py-2 text-slate-300 hover:text-white transition-colors">Services</a>
              <a href="#about" className="block px-3 py-2 text-slate-300 hover:text-white transition-colors">About</a>
              <a href="#contact" className="block px-3 py-2 text-slate-300 hover:text-white transition-colors">Contact</a>
              <button 
                onClick={onLogin}
                className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-2 rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all duration-200 font-medium"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}