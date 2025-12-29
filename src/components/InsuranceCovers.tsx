import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Heart, Shield, Accessibility, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

gsap.registerPlugin(ScrollTrigger);

const covers = [
  {
    icon: Heart,
    title: 'Funeral Expenses Cover',
    description: 'Comprehensive coverage for funeral and burial expenses, ensuring your family is financially protected during difficult times.',
    features: ['Up to KSH 500,000 coverage', 'Quick claim processing', 'No medical exam required'],
    color: 'primary',
  },
  {
    icon: Shield,
    title: 'Loan Guard Cover',
    description: 'Protects your loved ones from outstanding loan obligations. If the insured passes away, the remaining loan balance is covered.',
    features: ['Full loan balance coverage', 'Covers multiple loans', 'Immediate debt relief'],
    color: 'success',
  },
  {
    icon: Accessibility,
    title: 'Permanent Disability Cover',
    description: 'Financial protection in case of permanent disability, ensuring continued income and support for medical expenses.',
    features: ['Monthly disability payments', 'Medical expense coverage', 'Rehabilitation support'],
    color: 'info',
  },
];

const InsuranceCovers = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, index) => {
        if (card) {
          gsap.fromTo(
            card,
            { opacity: 0, y: 60, rotateX: 10 },
            {
              opacity: 1,
              y: 0,
              rotateX: 0,
              duration: 0.8,
              delay: index * 0.2,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
              },
            }
          );
        }
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="covers" className="py-20 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Our Coverage Plans
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Group Life Insurance <span className="text-primary">Covers</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Comprehensive protection plans designed to secure your family's future and provide peace of mind.
          </p>
        </div>

        {/* Cover Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {covers.map((cover, index) => (
            <div
              key={cover.title}
              ref={(el) => (cardsRef.current[index] = el)}
              className="group"
            >
              <Card className="h-full border-0 shadow-card hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
                <CardHeader className="pb-4">
                  <div className={`w-14 h-14 rounded-2xl bg-${cover.color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <cover.icon className={`h-7 w-7 text-${cover.color === 'primary' ? 'primary' : cover.color}`} />
                  </div>
                  <CardTitle className="text-xl">{cover.title}</CardTitle>
                  <CardDescription className="text-base">
                    {cover.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {cover.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button variant="ghost" className="group/btn p-0 h-auto text-primary hover:text-primary/80 hover:bg-transparent">
                    Learn more
                    <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            Ready to protect your family's future?
          </p>
          <Button size="lg" className="text-lg px-8">
            Get a Free Quote
          </Button>
        </div>
      </div>
    </section>
  );
};

export default InsuranceCovers;
