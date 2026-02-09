import { useEffect, useRef, useState, useCallback } from "react";
import type { ExecutionPlan } from "@/lib/api/types";

interface DependencyArrowsProps {
  executionPlan: ExecutionPlan;
  containerRef: React.RefObject<HTMLElement | null>;
}

interface ArrowPath {
  id: string;
  sourceId: string;
  targetId: string;
  path: string;
}

/**
 * DependencyArrows renders SVG arrows showing dependencies between tasks
 * in the execution plan.
 * 
 * Architecture:
 * - Uses data-task-id attributes on task cards to identify elements
 * - Calculates positions using getBoundingClientRect()
 * - Accounts for scroll position of container
 * - Renders curved bezier paths with arrow heads
 * - Updates on window resize using requestAnimationFrame
 */
export function DependencyArrows({
  executionPlan,
  containerRef,
}: DependencyArrowsProps) {
  const [arrows, setArrows] = useState<ArrowPath[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | undefined>(undefined);

  /**
   * Calculate all arrow paths from the execution plan
   */
  const calculateArrows = useCallback(() => {
    if (!containerRef.current) {
      setArrows([]);
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

    const newArrows: ArrowPath[] = [];

    // Iterate through all phases and items to find dependencies
    for (const phase of executionPlan.phases) {
      for (const item of phase.items) {
        // Skip items without dependencies
        if (item.dependencies.length === 0) continue;

        // Find the source element (this item)
        const sourceElement = container.querySelector(
          `[data-task-id="${item.id}"]`
        ) as HTMLElement;
        if (!sourceElement) continue;

        const sourceRect = sourceElement.getBoundingClientRect();

        // Create arrow for each dependency
        for (const depId of item.dependencies) {
          // Find the target element (dependency)
          const targetElement = container.querySelector(
            `[data-task-id="${depId}"]`
          ) as HTMLElement;
          if (!targetElement) continue;

          const targetRect = targetElement.getBoundingClientRect();

          // Calculate positions relative to container
          const sourceX = sourceRect.left - containerRect.left + scrollLeft;
          const sourceY = sourceRect.top - containerRect.top + scrollTop;
          const targetX = targetRect.left - containerRect.left + scrollLeft;
          const targetY = targetRect.top - containerRect.top + scrollTop;

          // Use center points of cards for connection
          const startX = sourceX + sourceRect.width / 2;
          const startY = sourceY; // Top of source card
          const endX = targetX + targetRect.width / 2;
          const endY = targetY + targetRect.height; // Bottom of target card

          // Calculate bezier curve control points
          // Use vertical offset for smooth curves
          const verticalDistance = Math.abs(endY - startY);
          const controlOffset = Math.min(verticalDistance / 3, 100);

          const controlPoint1X = startX;
          const controlPoint1Y = startY - controlOffset;
          const controlPoint2X = endX;
          const controlPoint2Y = endY + controlOffset;

          // Create SVG path using cubic bezier curve
          const path = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;

          newArrows.push({
            id: `${item.id}-${depId}`,
            sourceId: item.id,
            targetId: depId,
            path,
          });
        }
      }
    }

    setArrows(newArrows);
  }, [executionPlan, containerRef]);

  /**
   * Recalculate arrows with requestAnimationFrame for performance
   */
  const scheduleUpdate = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      calculateArrows();
    });
  }, [calculateArrows]);

  /**
   * Initial calculation and setup resize listener
   */
  useEffect(() => {
    // Initial calculation
    scheduleUpdate();

    // Listen for window resize
    const handleResize = () => {
      scheduleUpdate();
    };

    window.addEventListener("resize", handleResize);

    // Also listen for scroll events on the container
    const container = containerRef.current;
    const handleScroll = () => {
      scheduleUpdate();
    };

    if (container) {
      container.addEventListener("scroll", handleScroll);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [scheduleUpdate, containerRef]);

  /**
   * Recalculate when execution plan changes
   */
  useEffect(() => {
    scheduleUpdate();
  }, [executionPlan, scheduleUpdate]);

  // Don't render anything if no arrows
  if (arrows.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        width: "100%",
        height: "100%",
      }}
    >
      <defs>
        {/* Arrow head marker */}
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,6 L9,3 z"
            fill="currentColor"
            className="text-blue-500 dark:text-blue-400"
          />
        </marker>
      </defs>

      {/* Render all arrows */}
      {arrows.map((arrow) => (
        <path
          key={arrow.id}
          d={arrow.path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
          className="text-blue-500 dark:text-blue-400 opacity-60 hover:opacity-100 transition-opacity"
          style={{
            filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))",
          }}
        />
      ))}
    </svg>
  );
}
