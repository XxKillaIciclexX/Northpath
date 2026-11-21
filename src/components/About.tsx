import { Users, Award, Clock, TrendingUp } from 'lucide-react';

const stats = [
  { icon: Users, value: '500+', label: 'Clients Served' },
  { icon: Award, value: '98%', label: 'Success Rate' },
  { icon: Clock, value: '24/7', label: 'Support Available' },
  { icon: TrendingUp, value: '300%', label: 'Average ROI Increase' }
];

export default function About() {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
              Leading the Future of 
              <span className="block bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                Business Automation
              </span>
            </h2>
            
            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
              At Northpath, we believe in the transformative power of AI automation. Our mission is to 
              provide businesses with the direction, clarity, and reliability they need to navigate 
              the complex landscape of digital transformation.
            </p>
            
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              With years of experience and a team of dedicated experts, we've helped hundreds of 
              organizations streamline their operations, reduce costs, and unlock new opportunities 
              for growth through intelligent automation solutions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-8 py-3 rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition-all duration-200 font-medium">
                Our Story
              </button>
              <button className="border border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 px-8 py-3 rounded-lg transition-all duration-200 font-medium">
                Meet the Team
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-8 text-center">Our Impact</h3>
              
              <div className="grid grid-cols-2 gap-6">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="flex justify-center mb-3">
                      <div className="p-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg">
                        <stat.icon size={24} />
                      </div>
                    </div>
                    <div className="text-3xl font-bold mb-1">{stat.value}</div>
                    <div className="text-slate-300 text-sm">{stat.label}</div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 p-4 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">Client Satisfaction</span>
                  <span className="text-emerald-400 font-bold">4.9/5</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-2 rounded-full" style={{width: '98%'}}></div>
                </div>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-r from-emerald-400/20 to-cyan-400/20 rounded-full blur-xl"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-r from-cyan-400/20 to-emerald-400/20 rounded-full blur-xl"></div>
          </div>
        </div>
      </div>
    </section>
  );
}