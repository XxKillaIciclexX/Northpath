import Header from './Header';
import Hero from './Hero';
import Services from './Services';
import About from './About';
import Contact from './Contact';
import Footer from './Footer';
import { ArrowLeft } from 'lucide-react';

interface MainLandingPageProps {
  onBack: () => void;
  onLogin: () => void;
}

export default function MainLandingPage({ onBack, onLogin }: MainLandingPageProps) {
  return (
    <div className="min-h-screen">
      {/* Preview Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <button
              onClick={onBack}
              className="flex items-center text-slate-300 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to Coming Soon
            </button>
            <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-500/30">
              Preview Mode
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content with top padding for preview header */}
      <div className="pt-12">
        <Header onLogin={onLogin} />
        <Hero />
        <Services />
        <About />
        <Contact />
        <Footer />
      </div>
    </div>
  );
}