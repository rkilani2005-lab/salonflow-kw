import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Users, 
  CreditCard, 
  BarChart3, 
  Globe, 
  Smartphone,
  Sparkles,
  Check,
  ArrowRight,
  Star
} from 'lucide-react';

const features = [
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description: 'Intuitive calendar with drag-and-drop appointments and real-time availability.'
  },
  {
    icon: Users,
    title: 'Client Management',
    description: 'Track client history, preferences, and loyalty tiers for personalized service.'
  },
  {
    icon: CreditCard,
    title: 'Online Payments',
    description: 'Accept deposits and payments with MyFatoorah integration for Kuwait.'
  },
  {
    icon: BarChart3,
    title: 'Business Analytics',
    description: 'Real-time insights on revenue, bookings, and staff performance.'
  },
  {
    icon: Globe,
    title: 'Online Booking',
    description: 'Let clients book appointments 24/7 from your branded booking page.'
  },
  {
    icon: Smartphone,
    title: 'Multi-Branch Support',
    description: 'Manage multiple salon locations from a single dashboard.'
  }
];

const pricingPlans = [
  {
    name: 'Starter',
    price: '15',
    description: 'Perfect for small salons',
    features: [
      'Up to 3 staff members',
      'Basic scheduling',
      'Client management',
      'Online booking page',
      'Email support'
    ],
    popular: false
  },
  {
    name: 'Professional',
    price: '35',
    description: 'For growing salons',
    features: [
      'Up to 10 staff members',
      'Advanced scheduling',
      'Full client management',
      'Online payments',
      'Multi-branch support',
      'Priority support'
    ],
    popular: true
  },
  {
    name: 'AI Powered',
    price: '75',
    description: 'Enterprise features with AI',
    features: [
      'Unlimited staff',
      'AI appointment optimization',
      'Predictive analytics',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 phone support'
    ],
    popular: false
  }
];

const testimonials = [
  {
    name: 'Fatima Al-Rashid',
    role: 'Owner, Glamour Ladies Salon',
    content: 'SalonFlow transformed how we manage our salon. Bookings are up 40% since we started using online scheduling!',
    rating: 5
  },
  {
    name: 'Noura Al-Sabah',
    role: 'Manager, Beauty Hub Kuwait',
    content: 'The multi-branch feature is a lifesaver. I can manage all 3 locations from my phone.',
    rating: 5
  },
  {
    name: 'Sara Al-Mutairi',
    role: 'Owner, Serenity Spa',
    content: 'Finally, a salon software that understands the Kuwait market. Payment integration with MyFatoorah is seamless.',
    rating: 5
  }
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">SalonFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button>Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-6">
            <Sparkles className="w-3 h-3 mr-1" />
            14-Day Free Trial • No Credit Card Required
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto">
            The Complete Salon Management Platform for{' '}
            <span className="text-primary">Kuwait</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Streamline bookings, manage clients, accept payments, and grow your salon business with the most powerful software built for the GCC market.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="text-lg px-8">
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/book">
              <Button size="lg" variant="outline" className="text-lg px-8">
                See Demo Booking Page
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Trusted by 500+ salons across Kuwait
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Run Your Salon
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From appointment scheduling to payment processing, SalonFlow has all the tools you need to manage and grow your beauty business.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold">500+</div>
              <div className="text-primary-foreground/80 mt-1">Active Salons</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold">50K+</div>
              <div className="text-primary-foreground/80 mt-1">Monthly Bookings</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold">99.9%</div>
              <div className="text-primary-foreground/80 mt-1">Uptime</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold">4.9</div>
              <div className="text-primary-foreground/80 mt-1">Customer Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your salon. All plans include a 14-day free trial.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => (
              <Card 
                key={plan.name} 
                className={`relative ${plan.popular ? 'border-primary border-2 shadow-lg scale-105' : 'border-2'}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground"> KWD/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth?mode=signup">
                    <Button className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                      Start Free Trial
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Testimonials</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Loved by Salon Owners
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              See what salon owners across Kuwait are saying about SalonFlow.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="border-2">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4">"{testimonial.content}"</p>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-primary text-primary-foreground border-0">
            <CardContent className="py-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Transform Your Salon?
              </h2>
              <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
                Join 500+ salon owners who are already using SalonFlow to grow their business. Start your free 14-day trial today.
              </p>
              <Link to="/auth?mode=signup">
                <Button size="lg" variant="secondary" className="text-lg px-8">
                  Start Your Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl">SalonFlow</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The complete salon management platform built for Kuwait and the GCC.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><Link to="/book" className="hover:text-foreground">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Help Center</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
                <li><a href="#" className="hover:text-foreground">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2024 SalonFlow. All rights reserved. Built with ❤️ in Kuwait.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
