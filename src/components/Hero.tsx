import { ArrowRight, Zap, Target, Shield } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-3 h-3 bg-emerald-400 rounded-full animate-pulse delay-300"></div>
        <div className="absolute bottom-40 left-20 w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-700"></div>
        <div className="absolute bottom-20 right-40 w-3 h-3 bg-emerald-400 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-60 left-1/3 w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-500"></div>
        <div className="absolute top-80 right-1/3 w-2 h-2 bg-emerald-400 rounded-full animate-pulse delay-200"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              AI Automation for
              <span className="block bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Modern Business
              </span>
            </h1>
            
            <p className="mt-6 text-xl text-slate-300 leading-relaxed">
              Transform your operations with intelligent automation solutions. 
              We provide direction, clarity, and reliability in your digital transformation journey.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <button 
                onClick={() => {
                  const contactSection = document.getElementById('contact');
                  contactSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="group bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-8 py-4 rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all duration-200 font-medium text-lg flex items-center justify-center"
              >
                Start Your Journey
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </button>
              <button 
                onClick={() => {
                  const aboutSection = document.getElementById('about');
                  aboutSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 px-8 py-4 rounded-lg transition-all duration-200 font-medium text-lg"
              >
                Learn More
              </button>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-8 text-center lg:text-left">
              <div className="flex flex-col items-center lg:items-start">
                <Target className="text-emerald-400 mb-2" size={24} />
                <span className="text-2xl font-bold text-white">Direction</span>
                <span className="text-slate-400 text-sm">Strategic Focus</span>
              </div>
              <div className="flex flex-col items-center lg:items-start">
                <Zap className="text-cyan-400 mb-2" size={24} />
                <span className="text-2xl font-bold text-white">Clarity</span>
                <span className="text-slate-400 text-sm">Clear Solutions</span>
              </div>
              <div className="flex flex-col items-center lg:items-start">
                <Shield className="text-emerald-400 mb-2" size={24} />
                <span className="text-2xl font-bold text-white">Reliability</span>
                <span className="text-slate-400 text-sm">Trusted Results</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative z-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-slate-400 text-sm">AI Dashboard</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-slate-300">Process Automation</span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-green-400 text-sm">Active</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-slate-300">Data Analysis</span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-cyan-400 text-sm">Running</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                  <span className="text-slate-300">Workflow Optimization</span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-emerald-400 text-sm">Complete</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-lg border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Efficiency Gain</span>
                  <span className="text-emerald-400 font-bold text-xl">+247%</span>
                </div>
              </div>
            </div>
            
            {/* Floating elements */}
            <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-lg opacity-80 animate-bounce"></div>
            <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-lg opacity-60 animate-bounce delay-300"></div>
          </div>
        </div>
      </div>
    </section>
  );
}