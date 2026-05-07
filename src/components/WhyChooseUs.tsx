import { ShieldCheck, CheckCircle, BarChart } from 'lucide-react';

const reasons = [
  {
    icon: ShieldCheck,
    title: 'Secure & Confidential',
    description: 'Your information is protected with advanced security.',
    color: 'text-primary',
  },
  {
    icon: CheckCircle,
    title: 'Verified Process',
    description: 'Transparent and fair claim review by professionals.',
    color: 'text-primary',
  },
  {
    icon: BarChart,
    title: 'Transparent & Reliable',
    description: 'Real-time updates and clear communication every step.',
    color: 'text-purple-600',
  },
];

const WhyChooseUs = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-4">Why Choose ClaimsConnect?</h2>
          <p className="text-muted-foreground text-lg">
            We are committed to providing you with the best experience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reasons.map((reason, index) => (
            <div key={index} className="flex items-start space-x-4">
              <div className="mt-1">
                <reason.icon className={`w-8 h-8 ${reason.color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-xl mb-2">{reason.title}</h3>
                <p className="text-muted-foreground">
                  {reason.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
