import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AboutPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">About Dispatcher</h1>
        <p className="text-muted-foreground">
          Learn more about the OpenAPI Spec Analysis Platform.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What is Dispatcher?</CardTitle>
            <CardDescription>
              Understanding our platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Dispatcher is a powerful OpenAPI specification analysis platform
              that helps developers understand, validate, and visualize their
              API definitions.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>
              What you can do with Dispatcher
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Parse and validate OpenAPI specs</li>
              <li>Visualize API structure</li>
              <li>Compare spec versions</li>
              <li>Generate documentation</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
