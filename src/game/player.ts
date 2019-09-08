/**
 * Player control.
 */

import { Button, buttonAxis, buttonPress } from '../lib/input';
import { vector, lengthSquared, scaleVector, madd } from '../lib/math';
import { frameDT } from './time';
import { entities, Entity, Collider, colliders, findColliders } from './entity';
import { ModelInstance, modelInstances } from './model';
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
import { createWalker } from './walker';
import { isDebug } from '../debug/debug';

/** Spawn the player in the level. */
export function spawnPlayer(): void {
  let pos = vector(0, 0);
  const walker = createWalker(pos);
  const swordTransform = matrixNew();
  const model: ModelInstance = {
    model: ModelAsset.Person,
    transform: walker.transform,
  };
  const swordModel: ModelInstance = {
    model: ModelAsset.Sword,
    transform: swordTransform,
  };
  modelInstances.push(model, swordModel);

  // Amount of time into attack.
  let attackTime = -1;
  // True if the player has pressed attack and it will take effect at the next
  // opportunity.
  let pendingAttack = false;
  // True if the attack hasn't landed yet.
  let pendingHit = false;

  const entity: Entity & Collider = {
    pos,
    radius: 0.5,
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
      this.pos = walker.pos;
      if (isDebug) {
        this.debugArrow = walker.facing;
      }

      // Update camera position.
      setCameraTarget(walker.pos);

      // Update attack state.
      if (buttonPress[Button.Action]) {
        pendingAttack = true;
      }
      if (attackTime < 0 && pendingAttack) {
        pendingAttack = false;
        pendingHit = true;
        attackTime = 0;
        playSound(Sounds.Swoosh);
      }
      let frac = -1; // Position along attack, from -1 to +1.
      let blend = 0; // Animation blend value, 0 = idle, 1 = attack.
      if (attackTime >= 0) {
        attackTime += frameDT;
        if (pendingHit && attackTime > playerSettings.attackTime * 0.3) {
          pendingHit = false;
          const targets = findColliders(
            madd(this.pos, walker.facing, 0.5),
            0.5,
          );
          let isHit = false;
          for (const target of targets) {
            if (target != this) {
              isHit = true;
            }
          }
          if (isHit) {
            playSound(Sounds.Clang);
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
      swordTransform.set(walker.transform);
      translateMatrix(swordTransform, [-0.4, 0.5, 0.5 - 0.5 * Math.abs(frac)]);
      rotateMatrixFromDirection(swordTransform, Axis.X, 1 - blend, 1);
      rotateMatrixFromDirection(
        swordTransform,
        Axis.Z,
        1 - blend * Math.abs(frac),
        -2 * blend * frac,
      );
      rotateMatrixFromDirection(swordTransform, Axis.Y, 1, 1 - blend);
    },
  };
  entities.push(entity);
  colliders.push(entity);
}
