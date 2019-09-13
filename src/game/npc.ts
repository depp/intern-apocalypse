import {
  Vector,
  zeroVector,
  normalizeSubtract,
  madd,
  canonicalAngle,
} from '../lib/math';
import { MovementParameters, spawnActor, Actor } from './actor';
import { ModelAsset } from '../model/models';
import { Team, ModelInstance, modelInstances } from './entity';
import { frameDT } from './time';
import { globalRandom } from '../lib/random';
import {
  matrixNew,
  rotateMatrixFromAngle,
  Axis,
  setIdentityMatrix,
  translateMatrix,
} from '../lib/matrix';
import { playSound } from '../audio/audio';
import { Sounds } from '../audio/sounds';

export function spawnNPC(pos: Vector): void {
  const params: MovementParameters = {
    speed: 2,
    acceleration: 5,
    turnSpeed: 4,
  };
  let moveTimer = 0;
  let movement = zeroVector;
  const pointer: ModelInstance = {
    model: ModelAsset.Pointer,
    transform: matrixNew(),
  };
  let pointerAngle = 0;
  spawnActor({
    pos,
    angle: 0,
    model: ModelAsset.Person,
    radius: 0.5,
    team: Team.NPC,
    health: -1,
    actorUpdate(this: Actor): void {
      // Update the pointer
      pointerAngle = canonicalAngle(pointerAngle + frameDT);
      setIdentityMatrix(pointer.transform);
      translateMatrix(pointer.transform, [
        this.pos.x,
        this.pos.y,
        0.5 * Math.sin(pointerAngle * 2),
      ]);
      rotateMatrixFromAngle(pointer.transform, Axis.Z, pointerAngle);

      // Decide where to move
      moveTimer -= frameDT;
      if (moveTimer < 0) {
        if (movement == zeroVector) {
          movement = normalizeSubtract(
            madd(normalizeSubtract(pos, this.pos), globalRandom.vector(), 0.5),
            zeroVector,
          );
        } else {
          movement = zeroVector;
        }
        moveTimer = globalRandom.range(2, 3);
      }
      this.actorMove(params, movement);
    },
    actorDamaged() {},
    actorDied() {},
    playerAction(this: Actor): void {
      playSound(Sounds.Interact);
    },
  });
  modelInstances.push(pointer);
}
