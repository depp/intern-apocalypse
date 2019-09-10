/**
 * Player control.
 */

import { Button, buttonAxis, buttonPress } from '../lib/input';
import {
  vector,
  lengthSquared,
  scaleVector,
  madd,
  normalizeSubtract,
  zeroVector,
} from '../lib/math';
import { frameDT } from './time';
import {
  ModelInstance,
  modelInstances,
  entities,
  Entity,
  Team,
} from './entity';
import { Collider, findColliders, colliders } from './physics';
import { ModelAsset } from '../model/models';
import { playerSettings } from '../lib/settings';
import {
  matrixNew,
  translateMatrix,
  Axis,
  rotateMatrixFromDirection,
} from '../lib/matrix';
import { setCameraTarget } from './camera';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';
import { createWalker, Walker } from './walker';
import { isDebug, DebugColor } from '../debug/debug';
import { debugMarks } from '../debug/mark';
import { spawnSlash } from './particles';

/** Spawn the player in the level. */
export function spawnPlayer(): void {
  let pos = vector(0, 0);
  let model: ModelInstance;
  let sword: ModelInstance;

  // Amount of time into attack.
  let attackTime = -1;
  // True if the player has pressed attack and it will take effect at the next
  // opportunity.
  let pendingAttack = false;
  // True if the attack hasn't landed yet.
  let pendingHit = false;

  let walker: Walker;
  const entity: Entity & Collider = {
    pos,
    velocity: zeroVector,
    radius: 0.5,
    team: Team.Player,
    update() {
      // Update player position.
      let movement = vector(
        buttonAxis(Button.Left, Button.Right),
        buttonAxis(Button.Backward, Button.Forward),
      );
      const magSquared = lengthSquared(movement);
      if (magSquared > 1) {
        // Maximum speed the same in all directions (no diagonal speed boost).
        movement = scaleVector(movement, 1 / Math.sqrt(magSquared));
      }
      walker.update(playerSettings, movement);
      if (isDebug) {
        this.debugArrow = walker.facing;
      }

      // Update camera position.
      setCameraTarget(this.pos);

      // Update attack state.
      if (buttonPress[Button.Action]) {
        pendingAttack = true;
      }
      if (attackTime < 0 && pendingAttack) {
        pendingAttack = false;
        pendingHit = true;
        attackTime = 0;
        playSound(Sounds.Swoosh);
        // spawnSlash(madd(this.pos, walker.facing, 1), walker.facing);
      }
      let frac = -1; // Position along attack, from -1 to +1.
      let blend = 0; // Animation blend value, 0 = idle, 1 = attack.
      if (attackTime >= 0) {
        attackTime += frameDT;
        if (pendingHit && attackTime > playerSettings.attackTime * 0.3) {
          pendingHit = false;
          const pos = madd(this.pos, walker.facing, 0.5);
          const radius = 0.75;
          if (isDebug) {
            debugMarks.push({
              time: 0.5,
              kind: 'circle',
              pos,
              radius,
              color: DebugColor.Green,
            });
          }
          const targets = findColliders(pos, radius);
          for (const target of targets) {
            if (target != this) {
              const direction = normalizeSubtract(target.pos, this.pos);
              target.damage(direction);
              spawnSlash(target.pos, direction);
            }
          }
        }
        if (attackTime > playerSettings.attackTime) {
          attackTime = -1;
        } else {
          frac = 2 * (attackTime / playerSettings.attackTime) - 1;
          blend = Math.min(2 * (1 - Math.abs(frac)), 1);
        }
      }

      // Set sword model transform.
      const swordTransform = sword.transform;
      swordTransform.set(walker.transform);
      translateMatrix(swordTransform, [0.5 - 0.5 * Math.abs(frac), -0.4, 0.5]);
      rotateMatrixFromDirection(swordTransform, Axis.Y, 1 - blend, 1);
      rotateMatrixFromDirection(
        swordTransform,
        Axis.X,
        1 - blend * Math.abs(frac),
        -2 * blend * frac,
      );
      rotateMatrixFromDirection(swordTransform, Axis.Z, 1, 1 - blend);
    },
    damage() {},
  };
  walker = createWalker(entity);
  model = {
    model: ModelAsset.Person,
    transform: walker.transform,
  };
  sword = {
    model: ModelAsset.Sword,
    transform: matrixNew(),
  };
  modelInstances.push(model, sword);
  entities.push(entity);
  colliders.push(entity);
}
