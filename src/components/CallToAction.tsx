import { Shield } from 'lucide-react';

const CallToAction = () => {
  return (
    <section className="py-20 bg-[#0f172a] text-white overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-primary/20 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-blue-600/20 blur-3xl"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="md:w-1/2 mb-10 md:mb-0 relative">
             <div className="relative z-10 max-w-md mx-auto">
                <div className="bg-primary/20 p-8 rounded-full inline-flex items-center justify-center relative">
                   <div className="absolute inset-0 bg-gradient-to-tr from-primary/40 to-transparent rounded-full animate-pulse"></div>
                   <Shield className="w-32 h-32 text-white relative z-10" />
                   
                   {/* Illustrative abstract shapes around the shield */}
                   <div className="absolute -top-4 -right-4 w-12 h-12 bg-success rounded-full flex items-center justify-center">
                     <div className="w-6 h-6 bg-white rounded-full"></div>
                   </div>
                   <div className="absolute bottom-4 -left-4 w-16 h-16 bg-warning rounded-full opacity-80"></div>
                </div>
             </div>
          </div>
          
          <div className="md:w-1/2 md:pl-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Start Your Claim?
            </h2>
            <p className="text-lg text-blue-100 mb-8 max-w-xl">
              Join thousands of satisfied customers who trust us for fast,
              transparent and reliable claim processing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
