import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useState } from "react";

export const Route = createFileRoute("/dex-test")({
  component: DexTestPage,
});

function DexTestPage() {
  const [testResult, setTestResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testFetch = useAction(api.dexActions.testFetchDexContacts);
  const triggerSync = useMutation(api.dexAdmin.triggerManualSync);

  const handleTestAPI = async () => {
    setLoading(true);
    setError(null);
    setTestResult(null);
    
    try {
      const result = await testFetch({});
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSync = async () => {
    setLoading(true);
    setError(null);
    setSyncResult(null);
    
    try {
      const result = await triggerSync({});
      setSyncResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dex API Test</h1>
        <p className="text-muted-foreground">
          Test the Dex API connection and inspect available contact fields
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Test API Connection</CardTitle>
            <CardDescription>
              Fetch a sample of contacts from Dex to see available fields
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleTestAPI} 
              disabled={loading}
              className="w-full"
            >
              {loading ? "Testing..." : "Test Dex API"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Sync</CardTitle>
            <CardDescription>
              Trigger an immediate sync from Dex to Convex
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleTriggerSync} 
              disabled={loading}
              variant="secondary"
              className="w-full"
            >
              {loading ? "Syncing..." : "Trigger Manual Sync"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-red-50 p-4 rounded text-sm overflow-auto">
              {error}
            </pre>
            <p className="mt-4 text-sm text-muted-foreground">
              Make sure you've added <code>DEX_API_KEY</code> to your Convex environment variables.
              <br />
              See <a href="/DEX_INTEGRATION.md" className="underline">DEX_INTEGRATION.md</a> for setup instructions.
            </p>
          </CardContent>
        </Card>
      )}

      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Found {testResult.totalContacts} total contacts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Available Fields:</h3>
              <div className="flex flex-wrap gap-2">
                {testResult.availableFields.map((field: string) => (
                  <span 
                    key={field}
                    className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Sample Contacts:</h3>
              <div className="space-y-3">
                {testResult.sampleContacts.map((contact: any, idx: number) => (
                  <Card key={idx}>
                    <CardContent className="pt-4">
                      <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                        {JSON.stringify(contact, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Full API Response Structure:</h3>
              <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(testResult.rawResponse, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {syncResult && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="text-green-600">Sync Triggered</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-green-50 p-4 rounded text-sm">
              {JSON.stringify(syncResult, null, 2)}
            </pre>
            <p className="mt-4 text-sm text-muted-foreground">
              Check the Convex dashboard logs to see the sync progress and results.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Get your Dex API key from: 
              <a 
                href="https://app.getdex.com/settings/api" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-1 text-blue-600 underline"
              >
                https://app.getdex.com/settings/api
              </a>
            </li>
            <li>
              Open your Convex dashboard and go to Settings → Environment Variables
            </li>
            <li>
              Add a new variable:
              <ul className="list-disc list-inside ml-6 mt-1">
                <li><strong>Key:</strong> <code>DEX_API_KEY</code></li>
                <li><strong>Value:</strong> Your Dex API key</li>
              </ul>
            </li>
            <li>
              Click the "Test Dex API" button above to verify the connection
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

