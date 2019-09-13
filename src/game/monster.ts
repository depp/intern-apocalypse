import {
  Vector,
  normalizeSubtract,
  zeroVector,
  distanceSquared,
} from '../lib/math';
import { ModelAsset } from '../model/models';
import { Team } from './entity';
import { Collider, colliders } from './physics';
import { NavigationGraph, newNavigationGraph } from './navigation';
import { levelTime, frameDT } from './time';
import { level } from './world';
import { spawnActor, Actor, MovementParameters } from './actor';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';

/** Interval, in seconds, between navigation updates. */
const navigationUpdateInterval = 0.5;

/** Level time when navigation graph was last updated.. */
let lastNavigationUpdateTime!: number;

/** The graph for level navigation. */
let navigationGraph: NavigationGraph | undefined | null;

/** The target where monsters navigate towards. */
let navigationTarget: Collider | undefined | null;

/** Reset monster data when the level starts. */
export function resetMonsters(): void {
  lastNavigationUpdateTime = -1;
  navigationGraph = null;
}

/** Update the monster navigation data. */
function updateNavigation(): void {
  navigationTarget = null;
  for (const entity of colliders) {
    if (entity.team == Team.Player) {
      navigationTarget = entity;
    }
  }
  if (!navigationGraph) {
    navigationGraph = newNavigationGraph(level);
  }
  if (levelTime > lastNavigationUpdateTime + navigationUpdateInterval) {
    lastNavigationUpdateTime = levelTime;
    navigationGraph.update(navigationTarget ? [navigationTarget.pos] : []);
  }
}

/** Spawn a monster in the level. */
export function spawnMonster(pos: Vector): void {
  // Distance at which monster navigates instead of just traveling towards
  // player.
  const navigationThreshold = 3;
  const attackDistance = 0.5;
  const attackTime = 0.5;
  const params: MovementParameters = {
    speed: 4,
    acceleration: 20,
    turnSpeed: 20,
  };
  let attackTimer = 0;
  spawnActor({
    pos,
    angle: 0,
    model: ModelAsset.Eyestalk,
    radius: 0.5,
    team: Team.Monster,
    health: 2,
    actorUpdate(this: Actor): void {
      const pos = this.pos;
      let movement = zeroVector;
      updateNavigation();
      const target = navigationTarget;
      const oldAttackTimer = attackTimer;
      attackTimer = 0;
      if (target) {
        let targetDistanceSquared = distanceSquared(pos, target.pos);
        if (targetDistanceSquared < navigationThreshold ** 2) {
          movement = normalizeSubtract(target.pos, pos);
          if (
            targetDistanceSquared <
            (this.radius + target.radius + attackDistance) ** 2
          ) {
            if (oldAttackTimer >= attackTime) {
              playSound(Sounds.MonsterAttack);
              target.damage(movement);
            } else {
              attackTimer = oldAttackTimer + frameDT;
            }
          }
        } else {
          movement = navigationGraph!.navigate(pos).direction;
        }
      }
      this.actorMove(params, movement);
    },
    actorDamaged() {},
    actorDied() {},
  });
}
