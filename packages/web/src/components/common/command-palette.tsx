import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useFeatures } from "@/hooks/queries/use-features";
import { useEpics } from "@/hooks/queries/use-epics";
import { Folder, FileText, Inbox, Settings } from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Fetch data for search
  const { data: featuresData } = useFeatures({ limit: 10 });
  const { data: projectsData } = useEpics({});

  const features = featuresData?.pages.flatMap((p) => p.data) ?? [];
  const projects = projectsData?.pages.flatMap((p) => p.data) ?? [];

  // Filter based on search
  const filteredFeatures = features.filter((f) =>
    f.title.toLowerCase().includes(search.toLowerCase())
  );
  const filteredEpics = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    setSearch("");
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search features, projects, or type a command..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => navigate("/inbox"))}>
            <Inbox className="mr-2 h-4 w-4" />
            Go to Inbox
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/projects"))}>
            <Folder className="mr-2 h-4 w-4" />
            View Epics
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Epics */}
        {filteredEpics.length > 0 && (
          <CommandGroup heading="Epics">
            {filteredEpics.slice(0, 5).map((epic) => (
              <CommandItem
                key={epic.id}
                onSelect={() =>
                  runCommand(() => navigate(`/epics/${epic.id}`))
                }
              >
                <Folder className="mr-2 h-4 w-4" />
                {epic.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Features */}
        {filteredFeatures.length > 0 && (
          <CommandGroup heading="Features">
            {filteredFeatures.slice(0, 5).map((feature) => (
              <CommandItem
                key={feature.id}
                onSelect={() =>
                  runCommand(() => navigate(`/features/${feature.id}`))
                }
              >
                <FileText className="mr-2 h-4 w-4" />
                {feature.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
