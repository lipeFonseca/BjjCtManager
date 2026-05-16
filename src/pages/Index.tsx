import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";
import logo from "@/assets/logo.png";
import { Users, MapPin, Phone, Mail, Award, MessageSquare, ChevronRight, Star } from "lucide-react";

const testimonials = [
  { name: "Carlos Silva", belt: "Faixa Roxa", text: "A plataforma mudou a forma como acompanho minha evolução. Consigo ver meu histórico e me manter motivado." },
  { name: "Ana Souza", belt: "Faixa Azul", text: "Excelente ferramenta! O chat com a comunidade me ajuda a trocar experiências com outros atletas." },
  { name: "Pedro Mendes", belt: "Faixa Marrom", text: "Como mestre, consigo gerenciar todos os meus alunos de forma eficiente. Recomendo!" },
];

const features = [
  { icon: Users, title: "Gestão de Alunos", desc: "Cadastro completo com faixas, presenças e evolução" },
  { icon: Award, title: "Sistema de Faixas", desc: "Acompanhe a jornada de cada atleta" },
  { icon: MapPin, title: "Centros de Treinamento", desc: "Gerencie múltiplas unidades" },
  { icon: MessageSquare, title: "Comunicação", desc: "Chat e mensagens integrados" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-10 w-10" />
            <span className="font-heading text-xl uppercase tracking-wider text-foreground">BJJ Manager</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#sobre" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Sobre</a>
            <a href="#funcionalidades" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Funcionalidades</a>
            <a href="#depoimentos" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Depoimentos</a>
            <a href="#contato" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Contato</a>
          </div>
          <Link to="/login">
            <Button variant="hero" size="sm">Acessar Plataforma</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="Jiu-Jitsu" className="w-full h-full object-cover" />
          <div className="hero-overlay absolute inset-0" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl uppercase tracking-tight text-foreground mb-6 animate-fade-in">
            Domine o <span className="text-gradient">Tatame</span>
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            Plataforma completa de gestão para academias de Jiu-Jitsu. Gerencie alunos, mestres e centros de treinamento.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <Link to="/login">
              <Button variant="hero" size="lg" className="text-base px-10">
                Acessar Plataforma <ChevronRight className="ml-1" />
              </Button>
            </Link>
            <a href="#sobre">
              <Button variant="heroOutline" size="lg" className="text-base px-10">
                Saiba Mais
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-4xl md:text-5xl uppercase text-center mb-4 text-foreground">Funcionalidades</h2>
          <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">Tudo que sua academia precisa em uma única plataforma</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="glass-card rounded-lg p-6 hover:border-primary/50 transition-all group" style={{ animationDelay: `${i * 0.1}s` }}>
                <f.icon className="h-10 w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-heading text-lg uppercase mb-2 text-foreground">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section id="sobre" className="py-24 bg-secondary/30">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="font-heading text-4xl md:text-5xl uppercase mb-6 text-foreground">Sobre a Plataforma</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            O BJJ Manager é uma plataforma moderna de gestão esportiva criada especificamente para academias de Jiu-Jitsu. 
            Com ela, mestres e líderes podem acompanhar a evolução dos alunos, gerenciar presenças, comunicar-se 
            com a equipe e manter tudo organizado em um só lugar.
          </p>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Projetado para escalar desde uma única academia até uma rede inteira de centros de treinamento, 
            o sistema oferece controle de permissões avançado e está em conformidade com a LGPD.
          </p>
        </div>
      </section>

      {/* Depoimentos */}
      <section id="depoimentos" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-4xl md:text-5xl uppercase text-center mb-16 text-foreground">Depoimentos</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="glass-card rounded-lg p-8">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 italic">"{t.text}"</p>
                <div>
                  <p className="font-heading text-foreground uppercase">{t.name}</p>
                  <p className="text-primary text-sm">{t.belt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contato / Footer */}
      <footer id="contato" className="py-16 bg-secondary/30 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="Logo" className="h-10 w-10" />
                <span className="font-heading text-xl uppercase tracking-wider text-foreground">BJJ Manager</span>
              </div>
              <p className="text-muted-foreground text-sm">Plataforma completa de gestão para academias de Jiu-Jitsu.</p>
            </div>
            <div>
              <h3 className="font-heading uppercase text-foreground mb-4">Contato</h3>
              <div className="space-y-3 text-muted-foreground text-sm">
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> (11) 99999-9999</div>
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> contato@bjjmanager.com</div>
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> São Paulo, SP</div>
              </div>
            </div>
            <div>
              <h3 className="font-heading uppercase text-foreground mb-4">Links</h3>
              <div className="space-y-2 text-muted-foreground text-sm">
                <a href="#sobre" className="block hover:text-foreground transition-colors">Sobre</a>
                <a href="#funcionalidades" className="block hover:text-foreground transition-colors">Funcionalidades</a>
                <Link to="/login" className="block hover:text-foreground transition-colors">Acessar Plataforma</Link>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border text-center text-muted-foreground text-sm">
            © 2026 BJJ Manager. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
