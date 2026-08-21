# Implementation Notes

The provided generic dashboard component was evaluated and was not used because it enforces authentication and a conventional navigation pattern that would compete with the requested full-screen acoustic-engineering workstation. The custom shell instead uses a persistent instrumentation rail, scene graph, viewport, and inspector layout.

The room-material presets use octave-band absorption coefficients as direct inputs to ray attenuation, Sabine RT60, and Eyring RT60 calculations. The interactive WebGL viewport currently renders a transparent room shell, snapped sound nodes, selected surfaces, and material-dependent multi-bounce reflection paths.

The initial desktop visual review confirms that the viewport, amber HUD styling, scene graph, sliders, material controls, and selected node inspector render together in the intended workstation composition.

The source and listener markers use high-contrast canvas sprite icons, no depth write, and disabled size attenuation. The icons therefore stay screen-legible as the camera moves between near, mid, and far room framing, while their group anchors remain selectable and draggable in world space.

Responsive QA was captured at desktop, tablet, and 375 px mobile widths. The desktop layout preserves the full three-column engineering console. At tablet width the right inspector is intentionally suppressed to protect the WebGL field, while at mobile width the room viewport moves above the project, scene, ray, and RT60 panels so the simulation remains readable without horizontal clipping.

Release validation completed with four Vitest files and six passing tests: acoustic calculation behavior, authenticated logout behavior, report content, and add-source client interaction. The client interaction test mocks canvas-only rendering so it runs cleanly in JSDOM.
