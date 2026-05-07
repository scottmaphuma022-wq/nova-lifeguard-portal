import { FileCheck, UploadCloud, Search, Bell } from 'lucide-react';

const features = [
  {
    icon: FileCheck,
    title: 'Submit Claims Easily',
    description: 'Submit your claims online in just a few simple steps.',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    icon: UploadCloud,
    title: 'Upload Documents',
    description: 'Upload all required documents securely and conveniently.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Search,
    title: 'Track Claim Progress',
    description: 'Track your claim in real-time at every stage.',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: Bell,
    title: 'Receive Notifications',
    description: 'Get instant updates via email or SMS notifications.',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
];

const Features = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-bold mb-4">What You Can Do</h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to manage your claims easily
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-card rounded-xl p-6 shadow-card hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 flex items-start space-x-4 border border-border/50"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${feature.bgColor}`}
              >
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
