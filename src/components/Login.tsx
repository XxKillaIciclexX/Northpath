import { useState } from 'react';
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onBack: () => void;
}

export default function Login({ onBack }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else if (data.user) {
        console.log('Login successful:', data.user);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) throw error;

      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-3 h-3 bg-emerald-400 rounded-full animate-pulse delay-300"></div>
        <div className="absolute bottom-40 left-20 w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-700"></div>
        <div className="absolute bottom-20 right-40 w-3 h-3 bg-emerald-400 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-60 left-1/3 w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-500"></div>
        <div className="absolute top-80 right-1/3 w-2 h-2 bg-emerald-400 rounded-full animate-pulse delay-200"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center text-slate-300 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Home
        </button>

        {/* Login Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <img src="/NorthpathAI.jpg" alt="Northpath" className="h-10 w-auto mx-auto mb-4 opacity-90 drop-shadow-lg" />
            <h1 className="text-3xl font-bold text-white mb-2">
              {showForgotPassword ? 'Reset Password' : 'Welcome Back'}
            </h1>
            <p className="text-slate-300">
              {showForgotPassword
                ? 'Enter your email to receive a password reset link'
                : 'Sign in to your Northpath account'}
            </p>
          </div>

          {/* Forgot Password Form */}
          {showForgotPassword ? (
            resetSent ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-full mb-6">
                  <Mail className="text-emerald-400" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Check Your Email</h3>
                <p className="text-slate-300 mb-6">
                  We've sent a password reset link to <span className="text-emerald-400">{resetEmail}</span>
                </p>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSent(false);
                    setResetEmail('');
                  }}
                  className="text-slate-400 hover:text-white transition-colors text-sm"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordReset} className="space-y-6">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-3 rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all duration-200 font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError(null);
                  }}
                  className="w-full text-slate-400 hover:text-white transition-colors text-sm"
                >
                  Back to Login
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-emerald-500 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500 focus:ring-2"
                />
                <span className="ml-2 text-sm text-slate-300">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setError(null);
                }}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-6 py-3 rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all duration-200 font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            {/* Footer */}
            <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  onBack();
                  setTimeout(() => {
                    const contactSection = document.getElementById('contact');
                    if (contactSection) {
                      contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }}
                className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
              >
                Contact Us!
              </button>
            </p>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}