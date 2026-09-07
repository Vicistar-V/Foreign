import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";
// V4: InstantPlayBanner removed
import { Home, Search, HelpCircle, ArrowRight, MapPin } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const quickLinks = [
    { 
      icon: Home, 
      label: "Go Home", 
      description: "Back to the main page",
      to: "/" 
    },
    { 
      icon: Search, 
      label: "See Winners", 
      description: "Check who won today",
      to: "/winners" 
    },
    { 
      icon: HelpCircle, 
      label: "How It Works", 
      description: "Learn about Viketa",
      to: "/how-it-works" 
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <main className="pt-20 pb-16 px-4">
        {/* 404 Hero Section */}
        <motion.section
          className="max-w-lg mx-auto text-center mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Big 404 with fun styling */}
          <div className="relative mb-6">
            <motion.div
              className="text-[120px] sm:text-[160px] font-black leading-none text-primary/10"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              404
            </motion.div>
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="bg-primary text-primary-foreground rounded-full p-4 shadow-lg shadow-primary/30">
                <MapPin className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
            </motion.div>
          </div>

          {/* Friendly message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Oops! This Page Got Lost
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg mb-2">
              We couldn't find what you're looking for.
            </p>
            <p className="text-sm text-muted-foreground/80">
              The page <span className="font-mono text-primary bg-primary/10 px-2 py-1 rounded">{location.pathname}</span> doesn't exist.
            </p>
          </motion.div>
        </motion.section>

        {/* Quick Links */}
        <motion.section
          className="max-w-lg mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h2 className="text-sm font-medium text-muted-foreground text-center mb-4">
            Here's where you can go instead:
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {quickLinks.map((link, index) => (
              <motion.div
                key={link.to}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.7 + index * 0.1 }}
              >
                <Link to={link.to}>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <link.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {link.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {link.description}
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* V4: The Viketa Line CTA */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="max-w-lg mx-auto text-center"
        >
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-2">Activate a Viketa ad share</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Pick the advert picture you like each day. When your campaign reaches 100%, that share pays you.
            </p>
            <Button asChild className="w-full">
              <Link to="/signup">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.section>

        {/* Bottom CTA */}
        <motion.section
          className="max-w-lg mx-auto text-center mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.1 }}
        >
          <p className="text-sm text-muted-foreground mb-4">
            Still can't find what you need?
          </p>
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <Link to="/support">
              <HelpCircle className="h-4 w-4 mr-2" />
              Contact Support
            </Link>
          </Button>
        </motion.section>
      </main>
    </div>
  );
};

export default NotFound;