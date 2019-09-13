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
  Vector,
} from '../lib/math';
import { frameDT } from './time';
import { ModelInstance, modelInstances, Team } from './entity';
import { findColliders } from './physics';
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
import { isDebug, DebugColor } from '../debug/debug';
import { debugMarks } from '../debug/mark';
import { spawnSlash, spawnDeath } from './particles';
import { setState, State } from '../lib/global';
import { spawnActor, Actor } from './actor';

export let playerHealth = 10;
export let playerHealthMax = 10;

export let playerMana = 0;
export let playerManaMax = 0;

/** Spawn the player in the level. */
export function spawnPlayer(pos: Vector): void {
  const sword: ModelInstance = {
    model: ModelAsset.Sword,
    transform: matrixNew(),
  };

  // Amount of time into attack.
  let attackTime = -1;
  // True if the player has pressed attack and it will take effect at the next
  // opportunity.
  let pendingAttack = false;
  // True if the attack hasn't landed yet.
  let pendingHit = false;

  spawnActor({
    pos,
    angle: 0,
    model: ModelAsset.Person,
    radius: 0.5,
    team: Team.Player,
    health: 10,
    actorUpdate(this: Actor): void {
      // Update camera position.
      setCameraTarget(this.pos);

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
      this.actorMove(playerSettings, movement);

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
          const pos = madd(this.pos, this.facing, 0.5);
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
      swordTransform.set(this.transform);
      translateMatrix(swordTransform, [0.5 - 0.5 * Math.abs(frac), -0.4, 0.5]);
      rotateMatrixFromDirection(swordTransform, Axis.Y, 1 - blend, 1);
      rotateMatrixFromDirection(
        swordTransform,
        Axis.X,
        1 - blend * Math.abs(frac),
        -2 * blend * frac,
      );
      rotateMatrixFromDirection(swordTransform, Axis.Z, 1, 1 - blend);
      // Pass health to UI.
      playerHealth = this.health;
    },
    actorDamaged() {},
    actorDied(): void {
      setState(State.Dead);
      spawnDeath(sword.transform, sword.model);
    },
  });
  modelInstances.push(sword);
}
