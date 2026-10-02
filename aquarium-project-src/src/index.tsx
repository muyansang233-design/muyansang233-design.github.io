import React from "react";
import {createRoot} from 'react-dom/client'
import "@fontsource/anonymous-pro";

import AquariumEmbedApp from "./AquariumEmbedApp";

function isEmbedMode() {
    if (typeof window === "undefined") return false;
    const qs = new URLSearchParams(window.location.search);
    const embedQuery = qs.get("embed") === "1" || qs.get("embed") === "true" || qs.get("standalone") === "true";
    const pathname = window.location.pathname;
    const embedPath = pathname === "/aquarium" || pathname === "/aquarium/" || pathname.includes("/aquarium/");
    return embedQuery || embedPath;
}


const container = document.getElementById("root");
if (!container) {
    throw new Error("Missing #root element for Aquarium build.");
}

const root = createRoot(container as HTMLElement);
const shouldUseEmbed = isEmbedMode();

if (shouldUseEmbed) {
    root.render(
        <React.StrictMode>
            <AquariumEmbedApp />
        </React.StrictMode>,
    );
} else {
    import("./MainApp").then(({default: MainApp}) => {
        root.render(
            <React.StrictMode>
                <MainApp />
            </React.StrictMode>,
        );
    }).catch((error) => {
        console.error("Failed to load MainApp", error);
        root.render(
            <div style={{padding: 20, color: "#fff", background: "#111", minHeight: "100vh"}}>
                Unable to render MainApp. Check the console for details.
            </div>
        );
    });
}
