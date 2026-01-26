import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter, MessageCircle } from 'lucide-react';
import Logo from './Logo';

const Footer = () => {
  const quickLinks = [
    { name: 'Home', href: '/' },
    { name: 'Insurance Covers', href: '/#covers' },
    { name: 'Claims', href: '/claims' },
    { name: 'Payments', href: '/payments' },
  ];

  const supportLinks = [
    { name: 'Help / FAQ', href: '/faq' },
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms & Conditions', href: '/terms' },
    { name: 'Contact Us', href: '/contact' },
  ];

  const socialLinks = [
    { name: 'Facebook', icon: Facebook, href: 'https://facebook.com' },
    { name: 'Instagram', icon: Instagram, href: 'https://instagram.com' },
    { name: 'Twitter', icon: Twitter, href: 'https://twitter.com' },
    { name: 'WhatsApp', icon: MessageCircle, href: 'https://wa.me/254729315019' },
  ];

  return (
    <footer className="bg-foreground text-background">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="font-bold text-xl">
                  Nova<span className="text-primary">Insurance</span>
                </span>
              </div>
            </div>
            <p className="text-background/70 mb-6">
              Protecting families and securing futures with reliable group life insurance solutions.
            </p>
            <div className="space-y-3">
              <a href="tel:0712345678" className="flex items-center gap-3 text-background/70 hover:text-primary transition-colors">
                <Phone className="h-4 w-4" />
                <span>0729315019</span>
              </a>
              <a href="mailto:info@novainsurance.co.ke" className="flex items-center gap-3 text-background/70 hover:text-primary transition-colors">
                <Mail className="h-4 w-4" />
                <span>info@novainsurance.co.ke</span>
              </a>
              <div className="flex items-start gap-3 text-background/70">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>Nairobi, Kenya</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-background/70 hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-lg mb-6">Support</h3>
            <ul className="space-y-3">
              {supportLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-background/70 hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="font-semibold text-lg mb-6">Connect With Us</h3>
            <div className="flex gap-4 mb-6">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label={social.name}
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
            <p className="text-background/70 text-sm">
              Follow us on social media for updates, tips, and insurance insights.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-background/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-background/60 text-sm">
              © {new Date().getFullYear()} Nova Insurance. All rights reserved.
            </p>
            <p className="text-background/60 text-sm">
              Licensed by the Insurance Regulatory Authority of Kenya
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
