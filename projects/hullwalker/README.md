# Hullwalker · Boarding Action

[Play](./) · [Gallery](../../) · [Original working Site](https://hullwalker-eva.x-nihilo.chatgpt.site)

Retake the Morrow’s airlock from three mobile boarders. Use magnetic boots, open-space flight, hull cover and tether swings. The squad includes a flanker who traverses sidewalls and the underside, and a raider who crosses between structures. Clear the team, then reach the hatch with boots attached and press E.

Selected public release: **Sites v6 — combat and separated camera controls**, source commit `dfd30fdd7f48aefb99ce767ac0c494241f87f929`, exported October 14, 2026. All 32 tracked `dist/` files are byte-identical to the saved source. No sign-in or external CDN is required; Three.js and its MIT license are bundled.

Choose **RETAKE THE AIRLOCK**. **WASD** moves, **Q** reloads, **Space** pushes off/thrusts up, **Ctrl** thrusts down, **C** thrusts to the hull, and **Shift** runs/brakes. **G** clips/releases; **Z/X** reel in/pay out. **R** restarts.

**Mouse:** dragging looks without shooting when the cursor is not captured. Hold **F** or the **FIRE** button to shoot independently. **MOUSE LOOK** enables free mouse look and left-click firing where browser capture is available; right-click focuses aim.

**Phone/tablet:** left stick moves, canvas drag looks, and the separate FIRE button shoots. FOCUS toggles aim; reload, push-off, brake, vertical thrust, hull return and tether actions have touch controls. Both portrait and landscape layouts are included. Sound starts after an input gesture.

The optional tether trial, original EVA repair mission and guided route remain available. The cable is straight and does not wrap around corners; release or steer clear of snags.

The gallery’s `preview.jpg` remains an explicitly labeled v3 gameplay capture from the Canvas compatibility renderer. It predates combat. All six original source commits, including v4, are preserved in [history/](history/). Development notes are in [source/README.md](source/README.md).

Automated production-code checks and offline mesh renders were inspected. Simultaneous touch movement/look/fire passed simulated input checks. Hardware-accelerated rendering, actual phone layout/performance, and subjective control feel have not been verified on a physical device for this release.
