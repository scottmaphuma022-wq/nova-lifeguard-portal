import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const slides = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1920&q=80',
    headline: 'Fast & Transparent Claims Processing',
    subtext: 'Submit, track, and manage your insurance claims in one secure and convenient place.',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1920&q=80',
    headline: 'Secure and Confidential',
    subtext: 'Your data is secure with us. We prioritize your privacy and protection.',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1920&q=80',
    headline: 'Quick Transaction Processing',
    subtext: 'We help you when it matters most with immediate updates and reliable processing.',
  },
];

const HeroSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
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

  return (
    <section ref={heroRef} className="relative h-[90vh] min-h-[600px] overflow-hidden">
      {/* Background Images */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          ref={(el) => (imageRefs.current[index] = el)}
          className="absolute inset-0 opacity-0"
          style={{ transform: 'scale(1.1)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-transparent z-10" />
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
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            {slides[currentSlide].headline}
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-lg">
            {slides[currentSlide].subtext}
          </p>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">
        {slides.map((_, index) => (
          <div
            key={index}
            className={`w-3 h-3 rounded-full transition-all ${
              currentSlide === index
                ? 'bg-white w-8'
                : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
