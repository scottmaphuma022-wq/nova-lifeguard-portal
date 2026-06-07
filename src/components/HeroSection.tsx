import { useEffect, useState } from 'react';

const slides = [
  {
    id: 1,
    // 1200 px wide, WebP, quality 75 — sufficient for a full-bleed hero
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=1200&q=75&fm=webp&auto=format',
    headline: 'Fast & Transparent Claims Processing',
    subtext: 'Submit, track, and manage your insurance claims in one secure and convenient place.',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=75&fm=webp&auto=format',
    headline: 'Secure and Confidential',
    subtext: 'Your data is secure with us. We prioritize your privacy and protection.',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=75&fm=webp&auto=format',
    headline: 'Quick Transaction Processing',
    subtext: 'We help you when it matters most with immediate updates and reliable processing.',
  },
];

/* Preload the next slide image so the transition is seamless */
const preloadImage = (src: string) => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
};

const HeroSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Preload slide 1 immediately (slide 0 is the LCP image loaded via <img eager>)
  useEffect(() => {
    preloadImage(slides[1].image);
  }, []);

  // Auto-advance slides & preload the upcoming slide
  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentSlide((prev) => {
          const next = (prev + 1) % slides.length;
          // Preload the one after next
          preloadImage(slides[(next + 1) % slides.length].image);
          return next;
        });
        setIsAnimating(false);
      }, 400); // match CSS transition duration
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const goToSlide = (index: number) => {
    if (index === currentSlide) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setIsAnimating(false);
    }, 400);
  };

  return (
    <section className="relative h-[90vh] min-h-[600px] overflow-hidden">
      {/* Background Images — only render active + adjacent for DOM economy */}
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className="absolute inset-0 transition-opacity duration-700 ease-in-out"
          style={{ opacity: index === currentSlide ? 1 : 0, willChange: 'opacity' }}
          aria-hidden={index !== currentSlide}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-transparent z-10" />
          <img
            src={slide.image}
            alt={slide.headline}
            className="w-full h-full object-cover"
            /* Only the first slide is above-the-fold LCP content — load it eagerly.
               The rest are hidden, so defer them. */
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding={index === 0 ? 'sync' : 'async'}
            fetchPriority={index === 0 ? 'high' : 'low'}
          />
        </div>
      ))}

      {/* Content */}
      <div className="relative z-20 container mx-auto px-4 h-full flex items-center">
        <div
          className="max-w-2xl transition-opacity duration-400 ease-out"
          style={{ opacity: isAnimating ? 0 : 1 }}
        >
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
          <button
            key={index}
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-3 rounded-full transition-all duration-300 ${
              currentSlide === index ? 'w-8 bg-white' : 'w-3 bg-white/50'
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
