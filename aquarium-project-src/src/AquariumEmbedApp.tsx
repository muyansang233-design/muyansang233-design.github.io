import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    AThreeJSContextComponent,
    AppState,
    Color,
    CreateAppState,
    Vec2
} from "./anigraph";
import AppClasses from "./C1Scenes/Example2";
import {Example2SceneModel} from "./C1Scenes/Example2/Example2SceneModel";
import "./aquarium-embed.css";

const FISH_TYPES = [
    {value: 0, label: "Asian Carp"},
    {value: 1, label: "Puffer Fish"},
    {value: 2, label: "Pacific Saury"},
    {value: 3, label: "Anchovy"},
    {value: 4, label: "Tuna"},
    {value: 5, label: "Eel"},
];

type EmbedState = {
    appState: AppState;
    sceneModel: Example2SceneModel;
    ready: boolean;
};

export default function AquariumEmbedApp() {
    const appStateRef = useRef<AppState | null>(null);
    const sceneRef = useRef<Example2SceneModel | null>(null);

    const [embedState, setEmbedState] = useState<EmbedState | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isSceneReady, setIsSceneReady] = useState(false);
    const [presetColor, setPresetColor] = useState("#ffffff");
    const [trailEnabled, setTrailEnabled] = useState(true);
    const [feedingMode, setFeedingMode] = useState(false);
    const [selectedFish, setSelectedFish] = useState<number>(0);
    const [rippleRadius, setRippleRadius] = useState(2.8);
    const [rippleSteps, setRippleSteps] = useState(80);

    const sceneStatusText = useMemo(() => {
        if (!isReady) return "Initializing aquarium...";
        if (!isSceneReady) return "Loading simulation...";
        return "Interactive ready";
    }, [isReady, isSceneReady]);
    const [sceneError, setSceneError] = useState<string | null>(null);

    useEffect(() => {
        if (isReady) return;
        setIsReady(true);

        const sceneModel = new AppClasses.SceneModelClass() as Example2SceneModel;
        const appState = CreateAppState(sceneModel);
        sceneModel.initAppState(appState);

        appState.createMainRenderWindow(AppClasses.SceneControllerClass);
        appState.setState("presetColor", Color.FromString(presetColor));
        appState.setState("TrailEnabled", trailEnabled);
        appState.setState("Feeding Mode", feedingMode);

        appStateRef.current = appState;
        sceneRef.current = sceneModel;
        setEmbedState({appState, sceneModel, ready: true});

        appState.confirmInitialized().then(() => {
            appState.updateControlPanel();
            setIsSceneReady(true);
        }).catch((error) => {
            const message = error instanceof Error ? error.message : "Unknown initialization error";
            console.error("Aquarium initialization failed", error);
            setSceneError(message);
            setIsSceneReady(false);
        });
    }, [feedingMode, isReady, presetColor, trailEnabled]);

    const updateStateValue = useCallback((key: string, value: any) => {
        if (!appStateRef.current) return;
        appStateRef.current.setState(key, value);
    }, []);

    useEffect(() => {
        updateStateValue("presetColor", Color.FromString(presetColor));
        updateStateValue("TrailEnabled", trailEnabled);
        updateStateValue("Feeding Mode", feedingMode);
        if (sceneRef.current) {
            sceneRef.current.presetColor = Color.FromString(presetColor);
        }
    }, [feedingMode, presetColor, trailEnabled, updateStateValue]);

    const addFish = useCallback(() => {
        if (!sceneRef.current) return;
        sceneRef.current.addFish(selectedFish);
    }, [selectedFish]);

    const removeLastFish = useCallback(() => {
        if (!sceneRef.current) return;
        sceneRef.current.removeLastFish();
    }, []);

    const spawnRipple = useCallback(() => {
        if (!appStateRef.current || !sceneRef.current) return;
        const sceneController = appStateRef.current.mainSceneController;
        const camera = (sceneController as any).cameraModel;
        const bounds = camera?.getOrthoBounds ? camera.getOrthoBounds() : null;
        const center = bounds
            ? new Vec2((bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2)
            : new Vec2(0, 0);
        const steps = Math.max(10, Math.floor(rippleSteps));
        sceneRef.current.fireWaterWave(center, rippleRadius, steps);
        appStateRef.current.updateComponents();
    }, [rippleRadius, rippleSteps]);

    const handleColorChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setPresetColor(event.target.value);
    }, []);

    const handleFishTypeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = Number(event.target.value);
        if (Number.isNaN(value)) return;
        setSelectedFish(value);
    }, []);

    const handleRippleRadiusChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = Number(event.target.value);
        if (!Number.isNaN(nextValue)) setRippleRadius(nextValue);
    }, []);

    const handleRippleStepsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = Number(event.target.value);
        if (!Number.isNaN(nextValue)) setRippleSteps(nextValue);
    }, []);

    return (
        <div className="aquarium-embed-root">
            <div className="aquarium-embed-shell">
                <section className="aquarium-embed-canvas" aria-label="Interactive aquarium canvas">
                    <div className="aquarium-canvas-status" role="status" aria-live="polite">
                        {sceneStatusText}
                    </div>
                    <div className="aquarium-canvas-frame" aria-busy={!isSceneReady ? "true" : "false"}>
                        {embedState ? (
                            <AThreeJSContextComponent
                                renderWindow={embedState.appState.mainRenderWindow}
                            />
                        ) : (
                            <div className="aquarium-canvas-placeholder">
                                正在初始化 WebGL 场景，请稍候...
                            </div>
                        )}
                        {sceneError ? (
                            <div className="aquarium-canvas-error" role="alert">
                                {sceneError}
                            </div>
                        ) : null}
                    </div>
                </section>

                <aside className="aquarium-embed-panel" aria-label="Aquarium controls">
                    <label htmlFor="fish-color">Fish Color</label>
                    <input id="fish-color" type="color" value={presetColor} onChange={handleColorChange} />

                    <label htmlFor="fish-type">Spawn Fish</label>
                    <select id="fish-type" value={selectedFish} onChange={handleFishTypeChange}>
                        {FISH_TYPES.map((item) => (
                            <option key={`${item.value}-${item.label}`} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>

                    <button type="button" onClick={addFish}>
                        Generate Fish
                    </button>
                    <button type="button" onClick={removeLastFish}>
                        Remove Last Fish
                    </button>

                    <label htmlFor="ripple-radius">Ripple Radius ({rippleRadius.toFixed(1)})</label>
                    <input
                        id="ripple-radius"
                        type="range"
                        min="0.5"
                        max="4"
                        step="0.1"
                        value={rippleRadius}
                        onChange={handleRippleRadiusChange}
                    />

                    <label htmlFor="ripple-steps">Ripple Spread ({rippleSteps})</label>
                    <input
                        id="ripple-steps"
                        type="range"
                        min="20"
                        max="140"
                        step="1"
                        value={rippleSteps}
                        onChange={handleRippleStepsChange}
                    />

                    <label className="aquarium-toggle-row" htmlFor="trail-enabled">
                        <input
                            id="trail-enabled"
                            type="checkbox"
                            checked={trailEnabled}
                            onChange={(event) => setTrailEnabled(event.target.checked)}
                        />
                        <span>Trail Enabled</span>
                    </label>

                    <label className="aquarium-toggle-row" htmlFor="feeding-mode">
                        <input
                            id="feeding-mode"
                            type="checkbox"
                            checked={feedingMode}
                            onChange={(event) => setFeedingMode(event.target.checked)}
                        />
                        <span>Feeding Mode</span>
                    </label>

                    <button type="button" onClick={spawnRipple}>
                        Trigger Ripple
                    </button>
                </aside>
            </div>
        </div>
    );
}
