import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Calendar,
  Download,
  Home,
  MessageCircle,
  Pill,
  Scale,
  Settings,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useHotkey } from "@/hooks/use-hotkey";
import { useState } from "react";

const items = [
  { to: "/", label: "Today", icon: Home, hint: "g h" },
  { to: "/log", label: "Log daily entry", icon: Calendar, hint: "g l" },
  { to: "/meals", label: "Meals", icon: UtensilsCrossed, hint: "g m" },
  { to: "/weight", label: "Weight", icon: Scale, hint: "g w" },
  { to: "/supplements", label: "Supplements", icon: Pill, hint: "g s" },
  { to: "/insights", label: "Insights", icon: BarChart3, hint: "g i" },
  { to: "/chat", label: "AI Coach", icon: MessageCircle, hint: "g c" },
  { to: "/community", label: "Community", icon: Users },
  { to: "/import", label: "Import data", icon: Download },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useHotkey("mod+k", () => setOpen((o) => !o));

  // Quick-nav sequences: "g" followed by a letter
  useHotkey("g h", () => navigate({ to: "/" }));
  useHotkey("g l", () => navigate({ to: "/log" }));
  useHotkey("g m", () => navigate({ to: "/meals" }));
  useHotkey("g w", () => navigate({ to: "/weight" }));
  useHotkey("g s", () => navigate({ to: "/supplements" }));
  useHotkey("g i", () => navigate({ to: "/insights" }));
  useHotkey("g c", () => navigate({ to: "/chat" }));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to page or action…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {items.map(({ to, label, icon: Icon, hint }) => (
            <CommandItem
              key={to}
              value={label}
              onSelect={() => {
                setOpen(false);
                navigate({ to });
              }}
            >
              <Icon className="mr-2 size-4" />
              <span>{label}</span>
              {hint && (
                <span className="ml-auto text-xs text-muted-foreground tracking-widest">
                  {hint}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
