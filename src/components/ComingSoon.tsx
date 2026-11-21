import { ArrowRight, Bell, Eye, Zap, Target, Shield } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ComingSoonProps {
  onPreview: () => void;
}

export default function ComingSoon({ onPreview }: ComingSoonProps) {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('email_subscribers')
        .insert([
          {
            email: email.toLowerCase().trim(),
            source: 'coming_soon'
          }
        ]);

      if (insertError) {
        if (insertError.code === '23505') {
          // Unique constraint violation - email already exists
          setError('This email is already subscribed!');
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setIsSubscribed(true);
        setEmail('');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-3 h-3 bg-emerald-400 rounded-full animate-pulse delay-300"></div>
        <div className="absolute bottom-40 left-20 w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-700"></div>
        <div className="absolute bottom-20 right-40 w-3 h-3 bg-emerald-400 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-60 left-1/3 w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-500"></div>
        <div className="absolute top-80 right-1/3 w-2 h-2 bg-emerald-400 rounded-full animate-pulse delay-200"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20 pb-16">
        {/* Main Heading */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-8 pb-2" style={{ lineHeight: '1.4' }}>
          Something Amazing is
          <span className="block bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Coming Soon
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-slate-300 leading-relaxed mb-8 max-w-2xl mx-auto">
          We're building the future of AI automation. Get ready for intelligent solutions 
          that will provide your business with unparalleled direction, clarity, and reliability.
        </p>

        {/* Core Values */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
          <div className="flex flex-col items-center">
            <Target className="text-emerald-400 mb-3" size={32} />
            <span className="text-xl font-bold text-white">Direction</span>
            <span className="text-slate-400 text-sm">Strategic Focus</span>
          </div>
          <div className="flex flex-col items-center">
            <Zap className="text-cyan-400 mb-3" size={32} />
            <span className="text-xl font-bold text-white">Clarity</span>
            <span className="text-slate-400 text-sm">Clear Solutions</span>
          </div>
          <div className="flex flex-col items-center">
            <Shield className="text-emerald-400 mb-3" size={32} />
            <span className="text-xl font-bold text-white">Reliability</span>
            <span className="text-slate-400 text-sm">Trusted Results</span>
          </div>
        </div>

        {/* Email Subscription */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 mb-8 max-w-md mx-auto">
          <h3 className="text-2xl font-bold text-white mb-4">Be the First to Know</h3>
          <p className="text-slate-300 mb-6">
            Join our exclusive list and get early access when we launch.
          </p>
          
          {!isSubscribed ? (
            <form onSubmit={handleSubscribe} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-50"
                disabled={isLoading}
                required
              />
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-3 rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all duration-200 font-medium flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Subscribing...
                  </>
                ) : (
                  <>
                    <Bell className="mr-2" size={18} />
                    Notify Me
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="text-white" size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">You're In!</h4>
              <p className="text-slate-300">
                We'll notify you as soon as we launch. Thanks for your interest!
              </p>
            </div>
          )}
        </div>

        {/* Preview Button */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => {
              onPreview();
              // Scroll to top when preview is shown
              setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }, 100);
            }}
            className="group bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-lg transition-all duration-200 font-medium text-lg flex items-center border border-slate-600 hover:border-slate-500"
          >
            <Eye className="mr-2" size={20} />
            Preview Our Vision
            <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
          </button>
          
          <div className="text-slate-400 text-sm">
            Get a sneak peek at what's coming
          </div>
        </div>

        {/* Launch Timeline */}
        <div className="mt-16 bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-sm rounded-xl p-6 border border-slate-600 max-w-lg mx-auto">
          <h4 className="text-lg font-bold text-white mb-4">Launch Timeline</h4>
          <div className="space-y-3 text-left">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-emerald-400 rounded-full mr-3"></div>
              <span className="text-slate-300">Q4 2025: Platform Development</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-cyan-400 rounded-full mr-3"></div>
              <span className="text-slate-300">Q1 2026: Beta Testing</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-slate-500 rounded-full mr-3"></div>
              <span className="text-slate-400">Q2 2026: Public Launch</span>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-12 text-slate-400">
          <p>Questions? Reach out to us at <a href="mailto:hello@northpath.ai" className="text-emerald-400 hover:text-emerald-300 transition-colors">hello@northpath.ai</a></p>
        </div>
      </div>
    </div>
  );
}