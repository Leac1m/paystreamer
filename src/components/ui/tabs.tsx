import type { HTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

function Tabs({
  className,
  value,
  onValueChange,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("w-full", className)} data-state={value} {...props}>
      {children}
    </div>
  );
}

function TabsList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  value,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { value?: string }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        className,
      )}
      data-state={value}
      {...props}
    />
  );
}

function TabsContent({
  className,
  value,
  ...props
}: HTMLAttributes<HTMLDivElement> & { value?: string }) {
  return (
    <div
      className={cn("mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      data-state={value}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
