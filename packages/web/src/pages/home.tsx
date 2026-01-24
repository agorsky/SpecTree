import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiStatus {
  name: string;
  version: string;
  environment: string;
}

export function HomePage() {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/status")
      .then((res) => res.json() as Promise<ApiStatus>)
      .then(setStatus)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to fetch status");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to SpecTree
        </h1>
        <p className="text-muted-foreground">
          OpenAPI Spec Analysis Platform - Analyze and understand your API
          specifications.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>API Status</CardTitle>
            <CardDescription>
              Current status of the backend API
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-muted-foreground">Loading...</p>}
            {error && (
              <p className="text-destructive">Error: {error}</p>
            )}
            {status && (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Name:</dt>
                  <dd className="font-medium">{status.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Version:</dt>
                  <dd className="font-medium">{status.version}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Environment:</dt>
                  <dd className="font-medium">{status.environment}</dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>
              Get started with SpecTree
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Enter OpenAPI spec URL..." />
            <Button className="w-full">Analyze Spec</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Components Demo</CardTitle>
            <CardDescription>
              Shadcn/ui components showcase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
