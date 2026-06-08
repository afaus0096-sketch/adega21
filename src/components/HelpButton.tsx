import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { HelpCircle, MessageCircle } from "lucide-react";

export function HelpButton() {
  const numero = "11963174123";
  const link = `https://wa.me/55${numero}`;
  return (
    <div className="fixed bottom-5 right-5 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            className="rounded-full h-14 w-14 shadow-lg p-0 bg-accent hover:bg-accent/90 text-accent-foreground"
            aria-label="Ajuda e suporte"
          >
            <HelpCircle className="w-6 h-6" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-72">
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-accent" /> Precisa de Suporte?
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Fale com nossa equipe pelo WhatsApp:
              </p>
            </div>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center font-mono text-lg font-bold text-accent hover:underline"
            >
              (11) 96317-4123
            </a>
            <Button asChild className="w-full" size="sm">
              <a href={link} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-2" /> Abrir WhatsApp
              </a>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
