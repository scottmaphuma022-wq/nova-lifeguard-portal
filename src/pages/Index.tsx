import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import InsuranceCovers from '@/components/InsuranceCovers';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import WhyChooseUs from '@/components/WhyChooseUs';
import CallToAction from '@/components/CallToAction';
import Footer from '@/components/Footer';
import ChatBot from '@/components/ChatBot';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <InsuranceCovers />
        <Features />
        <HowItWorks />
        <WhyChooseUs />
        <CallToAction />
      </main>
      <Footer />
      <ChatBot />
    </div>
  );
};

export default Index;
