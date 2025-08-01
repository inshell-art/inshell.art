import { createSystem, defaultConfig, ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Hero from "./components/Hero";
import Footer from "./components/Footer/Footer";
import { ErrorBoundary } from "react-error-boundary";

//todo: implement the font later
//todo: refactor the App to present Hero in main.tsx

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 10_000, // 10 seconds
    },
  },
});

export default function App() {
  const system = createSystem(defaultConfig, { preflight: true });
  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div style={{ padding: "20px", color: "red" }}>
          <h1>Something went wrong</h1>
          <p>{error.message}</p>
        </div>
      )}
    >
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={system}>
          <Hero />
          <Footer />
        </ChakraProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
