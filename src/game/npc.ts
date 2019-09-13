import { Vector, zeroVector, normalizeSubtract, madd } from '../lib/math';
import { MovementParameters, spawnActor, Actor } from './actor';
import { ModelAsset } from '../model/models';
import { Team } from './entity';
import { frameDT } from './time';
import { globalRandom } from '../lib/random';

export function spawnNPC(pos: Vector): void {
  const params: MovementParameters = {
    speed: 2,
    acceleration: 5,
    turnSpeed: 4,
  };
  let moveTimer = 0;
  let movement = zeroVector;
  spawnActor({
    pos,
    angle: 0,
    model: ModelAsset.Person,
    radius: 0.5,
    team: Team.NPC,
    health: -1,
    actorUpdate(this: Actor): void {
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
  });
}
