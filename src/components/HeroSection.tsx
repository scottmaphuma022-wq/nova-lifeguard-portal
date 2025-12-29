import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthModal from './AuthModal';

const slides = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1920&q=80',
    headline: 'Reliable Group Life Insurance You Can Trust',
    subtext: 'Protect your future and your loved ones with Nova Insurance',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80',
    headline: 'Comprehensive Coverage for Your Family',
    subtext: 'From funeral expenses to loan protection, we\'ve got you covered',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1920&q=80',
    headline: 'Claims Made Simple',
    subtext: 'Fast, transparent, and hassle-free claims processing',
  },
];

const HeroSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Initial animation
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.3 }
      );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    // Animate slide change
    const ctx = gsap.context(() => {
      imageRefs.current.forEach((img, index) => {
        if (img) {
          gsap.to(img, {
            opacity: index === currentSlide ? 1 : 0,
            scale: index === currentSlide ? 1 : 1.1,
            duration: 1,
            ease: 'power2.inOut',
          });
        }
      });

      // Animate content
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
      );
    }, heroRef);

    return () => ctx.revert();
  }, [currentSlide]);

  // Auto-advance slides
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <>
      <section ref={heroRef} className="relative h-[90vh] min-h-[600px] overflow-hidden">
        {/* Background Images */}
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(el) => (imageRefs.current[index] = el)}
            className="absolute inset-0 opacity-0"
            style={{ transform: 'scale(1.1)' }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/50 to-transparent z-10" />
            <img
              src={slide.image}
              alt={slide.headline}
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        {/* Content */}
        <div className="relative z-20 container mx-auto px-4 h-full flex items-center">
          <div ref={contentRef} className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-background mb-6 leading-tight">
              {slides[currentSlide].headline}
            </h1>
            <p className="text-lg md:text-xl text-background/80 mb-8 max-w-lg">
              {slides[currentSlide].subtext}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                className="text-lg px-8 py-6"
                onClick={() => handleOpenAuth('login')}
              >
                Login
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 bg-background/10 border-background/30 text-background hover:bg-background hover:text-foreground"
                onClick={() => handleOpenAuth('signup')}
              >
                Create Account
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-background/20 backdrop-blur-sm text-background hover:bg-background/30 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-background/20 backdrop-blur-sm text-background hover:bg-background/30 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                currentSlide === index
                  ? 'bg-background w-8'
                  : 'bg-background/50 hover:bg-background/70'
              }`}
            />
          ))}
        </div>
      </section>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </>
  );
};

export default HeroSection;
