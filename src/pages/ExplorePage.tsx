import { useAllPlatforms } from "../lib/platformDiscovery";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";
import { Layers, Users, Zap, ExternalLink } from "lucide-react";
import NavBar from "../components/NavBar";

export function ExplorePage() {
  const { data: platforms, isLoading } = useAllPlatforms();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Discover Platforms
          </h1>
          <p className="text-xl text-muted-foreground">
            Explore and subscribe to decentralized applications built on Sui.
            Stream payments securely with your favorite services.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-32 bg-muted/50 rounded-t-lg" />
                <CardContent className="p-6">
                  <div className="h-6 w-3/4 bg-muted rounded mb-4" />
                  <div className="h-4 w-full bg-muted rounded mb-2" />
                  <div className="h-4 w-2/3 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !platforms || platforms.length === 0 ? (
          <div className="text-center py-24 border border-dashed rounded-xl border-muted-foreground/30 bg-muted/10">
            <Layers className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-2xl font-semibold mb-2">No platforms found</h3>
            <p className="text-muted-foreground">
              There are currently no registered platforms on the network.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platforms.map((platform) => (
              <Card 
                key={platform.objectId} 
                className="group relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 bg-card/50 backdrop-blur-sm border-muted/50"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="secondary" className="capitalize px-3 py-1 bg-primary/10 text-primary">
                      {platform.json.category || "Service"}
                    </Badge>
                    {platform.json.subscriber_count > 0 && (
                      <Badge variant="outline" className="flex items-center gap-1 border-primary/20 text-foreground">
                        <Users className="w-3 h-3" />
                        {platform.json.subscriber_count}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-2xl font-bold line-clamp-1">{platform.json.name}</CardTitle>
                </CardHeader>
                
                <CardContent>
                  <CardDescription className="text-base line-clamp-2 min-h-[3rem] text-muted-foreground/80">
                    {platform.json.description || "No description provided."}
                  </CardDescription>
                  
                  <div className="mt-6 flex flex-col gap-2">
                    <div className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      {platform.json.tiers.length} Active {platform.json.tiers.length === 1 ? 'Tier' : 'Tiers'}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 pb-6">
                  <Button 
                    className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                    onClick={() => navigate(`/subscribe/${platform.objectId}`)}
                  >
                    View Plans
                    <ExternalLink className="w-4 h-4 ml-2 opacity-70" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
