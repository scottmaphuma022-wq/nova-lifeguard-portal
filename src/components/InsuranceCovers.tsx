import { Shield, FileEdit, Accessibility } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const covers = [
  {
    icon: FileEdit,
    title: 'Funeral Expenses Cover',
    description: 'Covers burial and funeral-related costs for your loved ones.',
    iconColor: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    icon: Shield,
    title: 'Loan Guard Policy',
    description: 'Pays outstanding loan in case of the policyholder\'s death.',
    iconColor: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Accessibility,
    title: 'Permanent Disability Cover',
    description: 'Provides financial support in case of permanent disability.',
    iconColor: 'text-purple-600',
    bgColor: 'bg-purple-600/10',
  },
];

const InsuranceCovers = () => {
  return (
    <section id="covers" className="py-20 bg-slate-50 border-t border-slate-100">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
            Life Insurance Claim Types
          </h2>
          <p className="text-lg text-slate-600">
            We help you when it matters most.
          </p>
        </div>

        {/* Cover Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {covers.map((cover) => (
            <Card key={cover.title} className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white text-center flex flex-col h-full rounded-2xl overflow-hidden">
              <CardHeader className="pb-4 items-center pt-8">
                <div className={`w-20 h-20 rounded-full ${cover.bgColor} flex items-center justify-center mb-6`}>
                  <cover.icon className={`h-10 w-10 ${cover.iconColor}`} />
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">{cover.title}</CardTitle>
                <CardDescription className="text-base text-slate-600 mt-3 h-16 flex items-center justify-center">
                  {cover.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-end px-8 pb-8 pt-4">
                {/* Information only */}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InsuranceCovers;
