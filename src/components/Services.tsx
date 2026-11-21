import { Bot, Brain, Workflow, BarChart3, Cog, Zap } from 'lucide-react';

const services = [
  {
    icon: Bot,
    title: 'Process Automation',
    description: 'Streamline repetitive tasks and workflows with intelligent automation solutions that scale with your business.',
    features: ['Task Automation', 'Workflow Design', 'Integration Setup']
  },
  {
    icon: Brain,
    title: 'AI Implementation',
    description: 'Deploy cutting-edge AI technologies to enhance decision-making and operational efficiency.',
    features: ['Machine Learning', 'Predictive Analytics', 'AI Strategy']
  },
  {
    icon: Workflow,
    title: 'System Integration',
    description: 'Connect disparate systems and create seamless data flows across your entire technology stack.',
    features: ['API Development', 'Data Migration', 'System Optimization']
  },
  {
    icon: BarChart3,
    title: 'Analytics & Insights',
    description: 'Transform raw data into actionable insights with advanced analytics and reporting solutions.',
    features: ['Data Visualization', 'Custom Dashboards', 'Performance Metrics']
  },
  {
    icon: Cog,
    title: 'Custom Solutions',
    description: 'Tailored automation solutions designed specifically for your unique business requirements.',
    features: ['Bespoke Development', 'Consultation', 'Ongoing Support']
  },
  {
    icon: Zap,
    title: 'Optimization',
    description: 'Continuously improve and optimize your automated processes for maximum efficiency and ROI.',
    features: ['Performance Tuning', 'Cost Reduction', 'Scalability Planning']
  }
];

export default function Services() {
  return (
    <section id="services" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Our Services
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Comprehensive AI automation solutions designed to transform your business operations 
            and drive sustainable growth.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div 
              key={index}
              className="group bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 hover:border-emerald-200"
            >
              <div className="flex items-center mb-6">
                <div className="p-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-lg text-white group-hover:scale-110 transition-transform duration-300">
                  <service.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 ml-4">{service.title}</h3>
              </div>
              
              <p className="text-slate-600 mb-6 leading-relaxed">
                {service.description}
              </p>
              
              <ul className="space-y-2">
                {service.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center text-slate-700">
                    <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full mr-3"></div>
                    {feature}
                  </li>
                ))}
              </ul>
              
              <button className="mt-6 text-emerald-600 hover:text-emerald-700 font-medium group-hover:translate-x-1 transition-all duration-200 flex items-center">
                Learn More
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}