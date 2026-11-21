import { Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300 py-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <img src="/NorthpathAI.jpg" alt="Northpath" className="h-8 w-auto mb-4 opacity-90 drop-shadow-lg" />
            <p className="text-slate-400 mb-4 max-w-md">
              Providing direction, clarity, and reliability in AI automation solutions. 
              Transform your business with intelligent automation that scales.
            </p>
            <div className="flex space-x-4">
              <div className="flex items-center text-sm">
                <Mail size={16} className="mr-2 text-emerald-400" />
                hello@northpath.ai
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Process Automation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">AI Implementation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">System Integration</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Analytics & Insights</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-400 text-sm">
            © 2024 Northpath. All rights reserved.
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Privacy Policy</a>
            <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}