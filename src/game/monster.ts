import {
  Vector,
  scaleVector,
  normalizeSubtract,
  zeroVector,
  distanceSquared,
} from '../lib/math';
import { ModelAsset } from '../model/models';
import { createWalker, WalkerParameters, Walker } from './walker';
import {
  ModelInstance,
  modelInstances,
  entities,
  Entity,
  Team,
} from './entity';
import { spawnDeath, spawnSlash } from './particles';
import { isDebug } from '../debug/debug';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';
import { Collider, colliders } from './physics';
import { NavigationGraph, newNavigationGraph } from './navigation';
import { levelTime, frameDT } from './time';
import { level } from './world';

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
  const params: WalkerParameters = {
    speed: 4,
    acceleration: 20,
    turnSpeed: 20,
  };
  let health = 2;
  let walker: Walker;
  let model: ModelInstance;
  let attackTimer = 0;
  const entity: Entity & Collider = {
    pos,
    velocity: zeroVector,
    radius: 0.5,
    team: Team.Monster,
    update() {
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
              spawnSlash(target.pos, movement);
              target.damage(movement);
            } else {
              attackTimer = oldAttackTimer + frameDT;
            }
          }
        } else {
          movement = navigationGraph!.navigate(pos).direction;
        }
      }
      walker.update(params, movement);
      if (isDebug) {
        this.debugArrow = walker.facing;
      }
    },
    damage(direction: Vector): void {
      if (this.isDead) {
        return;
      }
      health--;
      if (health > 0) {
        playSound(Sounds.MonsterHit);
        this.velocity = scaleVector(direction, 12);
      } else {
        spawnDeath(model.transform, model.model);
        playSound(Sounds.MonsterDeath);
        this.isDead = true;
        model.isDead = true;
      }
    },
  };
  walker = createWalker(entity);
  model = {
    model: ModelAsset.Eyestalk,
    transform: walker.transform,
  };
  modelInstances.push(model);
  entities.push(entity);
  colliders.push(entity);
}
