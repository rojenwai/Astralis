"use client";

import { useStore } from "@/lib/store";
import NeutrinoThread from "./NeutrinoThread";
import GammaRayBurst from "./GammaRayBurst";
import GravityRipple from "./GravityRipple";

/** Everything performing right now, coexisting in one universe. */
export default function Performances() {
  const performances = useStore((s) => s.performances);
  return (
    <group>
      {performances.map((p) => {
        switch (p.event.kind) {
          case "neutrino":
            return <NeutrinoThread key={p.perfId} perf={p} />;
          case "grb":
            return <GammaRayBurst key={p.perfId} perf={p} />;
          case "gw":
            return <GravityRipple key={p.perfId} perf={p} />;
        }
      })}
    </group>
  );
}
