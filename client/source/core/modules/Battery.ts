export interface Battery {
  level: number;
  maximum: number;
}

export function drain(battery: Battery, cost: number, exact?: boolean): number {
  if (battery.level >= cost) {
    battery.level -= cost;
    return cost;
  }
  if (exact === true) {
    return 0;
  }
  cost = battery.level;
  battery.level = 0;
  return cost;
}

export function recharge(battery: Battery, charge: number): void {
  if (charge < battery.maximum) {
    battery.level += charge;
    if (battery.level > battery.maximum) {
      battery.level = battery.maximum;
    }
  }
}
