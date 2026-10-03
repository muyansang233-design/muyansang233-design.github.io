import React from "react";
import ReactDOM from "react-dom";
import {createRoot} from 'react-dom/client'
import "@fontsource/anonymous-pro";

import TreeEmbedApp from "./TreeEmbedApp";
import "./index.css";


// ReactDOM.render(
const container = document.getElementById("root");
const root =createRoot(container as HTMLElement);

root.render(
    <React.StrictMode>
        <TreeEmbedApp />
    </React.StrictMode>,
);
