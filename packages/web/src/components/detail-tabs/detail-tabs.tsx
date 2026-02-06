import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Re-export TabsContent for convenience
export { TabsContent };

export interface DetailTabsProps {
  tabs: Array<{ id: string; label: string; badge?: number }>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

/**
 * Generic tabbed component for detail views.
 * Uses shadcn/ui Tabs for consistent styling.
 * Supports tab badge counts and controlled active tab.
 */
export const DetailTabs: React.FC<DetailTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  children,
}) => {
  // Children should be <TabsContent value="tabId">...</TabsContent>
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="mb-2">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="relative">
            {tab.label}
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span
                className="ml-2 inline-block rounded-full bg-primary text-white text-xs px-2 py-0.5 font-medium absolute top-0 right-0 translate-x-1/2 -translate-y-1/2"
                aria-label={`Count for ${tab.label}`}
              >
                {tab.badge}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
};
