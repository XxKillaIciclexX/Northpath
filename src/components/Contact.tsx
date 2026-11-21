import { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Contact() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: tempPassword,
        options: {
          emailRedirectTo: `${window.location.origin}`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            company: formData.company,
            message: formData.message
          }
        }
      });

      if (signUpError) throw signUpError;

      setSuccess(true);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        message: ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to submit form. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <section id="contact" className="py-20 bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Let's discuss how Northpath can provide the direction, clarity, and reliability 
            your organization needs to succeed with AI automation.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-bold text-white mb-8">Get in Touch</h3>
            
            <div className="space-y-6 mb-8">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg text-white mr-4">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="text-white font-medium">Email</div>
                  <div className="text-slate-300">hello@northpath.ai</div>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg text-white mr-4">
                  <Phone size={20} />
                </div>
                <div>
                  <div className="text-white font-medium">Phone</div>
                  <div className="text-slate-300">(603) 913-5709</div>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg text-white mr-4">
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="text-white font-medium">Location</div>
                  <div className="text-slate-300">Bedford, NH</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h4 className="text-lg font-bold text-white mb-4">Why Choose Northpath?</h4>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
                  Expert team with proven track record
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mr-3"></div>
                  Customized solutions for your needs
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
                  24/7 support and maintenance
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mr-3"></div>
                  Guaranteed ROI improvement
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-8 border border-slate-700">
            {success ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-full mb-6">
                  <CheckCircle2 className="text-emerald-400" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Account Created!</h3>
                <p className="text-slate-300 mb-2">
                  Thank you for contacting us! Your account has been created.
                </p>
                <p className="text-emerald-400 font-medium mb-6">
                  Please check your email to confirm your account and set your password.
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="text-slate-400 hover:text-white transition-colors text-sm"
                >
                  Submit another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    placeholder="john@company.com"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    placeholder="Your Company"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Message
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none"
                    placeholder="Tell us about your automation needs..."
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-8 py-4 rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all duration-200 font-medium flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Account...' : 'Send Message'}
                  <Send className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}