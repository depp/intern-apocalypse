import { Vector, zeroVector } from '../lib/math';
import { colliders } from './physics';
import { Team } from './entity';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';

export function spawnExit(pos: Vector): void {
  console.log('SPAWN EXIT');
  colliders.push({
    pos,
    velocity: zeroVector,
    radius: 0,
    team: Team.NPC,
    trigger: true,
    damage() {},
    playerNear(): void {
      playSound(Sounds.Sweep);
    },
  });
}
