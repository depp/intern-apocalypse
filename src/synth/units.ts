import { AssertionError } from '../debug';

/** Units that expressions can have. */
export enum Units {
  /** Unitless number, used as a ratio. */
  None,
  /** Audio output, in Volts, with full scale = 1V. */
  Volt,
  /** Frequency, in Hertz. */
  Hertz,
  /** Time, in seconds. */
  Second,
  /** Oscillator phase, where a full cycle has a value of 1. */
  Phase,
  /** Alternate units for unitless ratios. */
  Decibel,
}

/** Fundamental components of units, as multiplied base units with exponents. */
interface UnitComponents {
  second: number;
  volt: number;
  phase: number;
}

const ratioComponents: Readonly<UnitComponents> = {
  second: 0,
  volt: 0,
  phase: 0,
};

/** Map from units to their base components. */
const unitComponents: ReadonlyMap<Units, Readonly<UnitComponents>> = (() => {
  type PartialComponents = { [K in keyof UnitComponents]?: number };
  const items: [Units, PartialComponents][] = [
    [Units.None, {}],
    [Units.Volt, { volt: 1 }],
    [Units.Hertz, { second: -1 }],
    [Units.Second, { second: 1 }],
    [Units.Phase, { phase: 1 }],
  ];
  const m = new Map<Units, Readonly<UnitComponents>>();
  for (const [units, partial] of items) {
    m.set(units, Object.assign({}, ratioComponents, partial));
  }
  return m;
})();

export class UnitError extends Error {}

export function multiplyUnits(units: Units[]): Units {
  let c: UnitComponents = Object.assign({}, ratioComponents);
  for (const unit of units) {
    const cm = unitComponents.get(unit);
    if (cm == null) {
      throw new AssertionError(`missing definition for unit ${Units[unit]}`);
    }
    for (const key in c) {
      const k = key as keyof UnitComponents;
      c[k] += cm[k];
    }
  }
  for (const [uresult, cr] of unitComponents.entries()) {
    let match = true;
    for (const key in c) {
      const k = key as keyof UnitComponents;
      if (c[k] != cr[k]) {
        match = false;
        break;
      }
    }
    if (match) {
      return uresult;
    }
  }
  throw new UnitError(`no units match ${JSON.stringify(c)}`);
}
