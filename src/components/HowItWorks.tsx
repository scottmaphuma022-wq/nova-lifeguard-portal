import { FileEdit, Upload, Search, CheckCircle } from 'lucide-react';

const steps = [
  {
    icon: FileEdit,
    title: 'Submit Claim',
    description: 'Fill in the claim form with accurate details.',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    icon: Upload,
    title: 'Upload Documents',
    description: 'Upload the required supporting documents.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Search,
    title: 'Under Review',
    description: 'Our team reviews your claim and verifies details.',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: CheckCircle,
    title: 'Get Paid',
    description: 'Once approved, payment is processed to you.',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
];

const HowItWorks = () => {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground text-lg">
            Four simple steps to get your claim processed
          </p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-12 left-0 w-full h-[2px] bg-border border-dashed border-2 -z-10" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-background shadow-md border-4 border-white ${step.color}`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${step.bgColor}`}>
                     <step.icon className="w-8 h-8" />
                  </div>
                </div>
                <h3 className="font-semibold text-lg mb-2">
                  <span className={`${step.color} mr-2`}>{index + 1}</span>
                  {step.title}
                </h3>
                <p className="text-muted-foreground text-sm max-w-[200px]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
