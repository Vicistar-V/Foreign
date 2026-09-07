import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import logo from '@/assets/logo.png';
import { FEATURE_FLAGS } from '@/config/featureFlags';

export const LandingFooter = () => {
  const [ref, inView] = useInView({ threshold: 0.3, triggerOnce: true });
  const currentYear = new Date().getFullYear();

  return (
    <footer ref={ref} className="py-8 lg:py-12 px-4 border-t border-border bg-card/50">
      <motion.div className="max-w-lg md:max-w-4xl lg:max-w-5xl mx-auto" initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}>
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-8">
          <div className="text-center lg:text-left mb-6 lg:mb-0">
            <Link to="/" className="inline-flex items-center gap-2">
              <img src={logo} alt="Viketa" className="h-8 lg:h-10 w-auto" />
            </Link>
            <p className="text-sm lg:text-base text-muted-foreground mt-2">Get paid to rate advert pictures</p>
          </div>

          <div className="flex flex-wrap justify-center lg:justify-end gap-4 lg:gap-6 text-sm lg:text-base mb-6 lg:mb-0">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            {/* Hidden via feature flag */}
            {FEATURE_FLAGS.SHOW_WINNERS_NAV && (
              <Link to="/winners" className="text-muted-foreground hover:text-foreground transition-colors">Winners</Link>
            )}
            <Link to="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
            <Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            <a href="mailto:support@viketa.xyz" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-6 pt-6 border-t border-border">
          <div className="flex justify-center lg:justify-start">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-xs lg:text-sm text-muted-foreground">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
                <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Secured by Flutterwave</span>
            </div>
          </div>
          <div className="text-center lg:text-right text-xs lg:text-sm text-muted-foreground">
            <p>© {currentYear} Viketa. All rights reserved.</p>
            <p className="mt-1">Made with ❤️ in Nigeria 🇳🇬</p>
          </div>
        </div>
      </motion.div>
    </footer>
  );
};