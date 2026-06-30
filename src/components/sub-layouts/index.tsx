import DAndDLayout from "./DAndDLayout";
import KingJLayout from "./KingJLayout";
import MainEventLayout from "./MainEventLayout";
import PowerPlayLayout from "./PowerPlayLayout";
import SAndCLayout from "./SAndCLayout";
import type { SubLayoutProps } from "./types";

const REGISTRY: Record<string, (p: SubLayoutProps) => JSX.Element> = {
  "d-and-d": DAndDLayout,
  "king-j": KingJLayout,
  "main-event": MainEventLayout,
  "powerplay": PowerPlayLayout,
  "s-and-c": SAndCLayout,
};

export function SubLayoutRouter(props: SubLayoutProps) {
  const Cmp = REGISTRY[props.slug] || DAndDLayout;
  return <Cmp {...props} />;
}