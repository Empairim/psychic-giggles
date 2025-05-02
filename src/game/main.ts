import { AUTO, Game } from "phaser";

// OBJECT TYPES class replacements
type Player = {
  sprite: Phaser.Physics.Arcade.Sprite;
  moveSpeed: number;
  health: number;
  inputKeys?:
    | Phaser.Types.Input.Keyboard.CursorKeys
    | { [key: string]: Phaser.Input.Keyboard.Key };
};

type Enemy = {
  sprite: Phaser.GameObjects.Sprite;
  moveSpeed: number;
  health: number;
};

type Bullet = {
  sprite: Phaser.GameObjects.Sprite;
  damage: number;
};

type GameState = {
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
};

let gameState: GameState;
let fpsText: Phaser.GameObjects.Text;
//////////////////////

// PRELOAD assets//////
function preload(this: Phaser.Scene) {
  // Load assets here (images, spritesheets, etc.)
}

//CREATE game Objects
function create(this: Phaser.Scene) {
  fpsText = this.add.text(10, 10, "FPS: 0", {
    font: "16px Arial",
  });

  gameState = {
    player: {
      sprite: this.physics.add.sprite(512, 384, "player"),
      moveSpeed: 200,
      health: 100,
    },
    enemies: [],
    bullets: [],
  };

  //INPUTS
  gameState.player.inputKeys = this.input.keyboard?.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D,
  }) as { [key: string]: Phaser.Input.Keyboard.Key };
}
//////////

// UPDATE game state///////
function update(this: Phaser.Scene) {
  const fps = this.game.loop.actualFps; // Get the current FPS
  fpsText.setText(`FPS: ${Math.round(fps)}`);
  ///GAME LOGIC////
  movePlayer(gameState.player);
}
///////////

//GAME FUNCTIONS//////////

function movePlayer(player: Player) {
  const inputKeys = player.inputKeys; // Access the mapped keys
  let inputVec = new Phaser.Math.Vector2(0, 0);
  //INPUTS
  // Check key states
  if (inputKeys) {
    if (inputKeys.left.isDown) inputVec.x = -1;
    if (inputKeys.right.isDown) inputVec.x = 1;
    if (inputKeys.up.isDown) inputVec.y = -1;
    if (inputKeys.down.isDown) inputVec.y = 1;
  }
  // NORMALIZE DIRECTION
  if (inputVec.lengthSq() > 0) {
    inputVec.normalize(); // makes diagonal movement same speed as straight
    inputVec.scale(player.moveSpeed); // apply player’s speed
  }
  player.sprite.setVelocity(inputVec.x, inputVec.y);
}

//Game Configs//////////
const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 1024,
  height: 768,
  parent: "game-container",
  backgroundColor: "#000000",

  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 }, debug: true },
  },

  scene: { preload, create, update },
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
};
///////////
export default StartGame;
