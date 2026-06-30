import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import UnoCSS from "unocss/vite";
import tidewave from "tidewave/vite-plugin";

export default defineConfig({
    plugins: [
        tidewave(),
        fresh({
            serverEntry: "src/ui/workspace/dev.js",
            clientEntry: "src/ui/workspace/client.js",
            staticDir: ["src/ui/workspace/static"],
            islandsDir: "src/ui/workspace/islands",
        }),
        UnoCSS(),
    ],
});
