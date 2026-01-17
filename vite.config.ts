import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables explicitly
  const env = loadEnv(mode, process.cwd(), '');
  
  // Extract VITE_ prefixed variables
  const viteEnv: Record<string, string> = {};
  Object.keys(env).forEach((key) => {
    if (key.startsWith('VITE_')) {
      viteEnv[`import.meta.env.${key}`] = JSON.stringify(env[key]);
    }
  });

  return {
    // Base path for production build (critical for Capacitor Android)
    base: './',
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Explicitly define environment variables for build
    define: {
      ...viteEnv,
      // Fallback for process.env (if needed by any dependency)
      'process.env': JSON.stringify(env),
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      // Ensure environment variables are embedded during build
      rollupOptions: {
        output: {
          // Ensure relative paths in output
          assetFileNames: 'assets/[name].[ext]',
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
        },
      },
    },
  };
});
