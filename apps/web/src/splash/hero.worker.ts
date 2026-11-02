// Worker del héroe del splash: recibe el lienzo y pasa las órdenes a hero.ts.
import { startHero, type HeroCommand, type HeroEvent, type HeroInit } from './hero';

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<{ canvas: OffscreenCanvas; init: HeroInit } | HeroCommand>) => void) | null;
  postMessage(e: HeroEvent): void;
};

let hero: ReturnType<typeof startHero> | null = null;

scope.onmessage = ({ data }) => {
  if ('canvas' in data) hero = startHero(data.canvas, data.init, (e) => scope.postMessage(e));
  else hero?.handle(data);
};
