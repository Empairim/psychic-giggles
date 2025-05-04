import { AUTO, Game } from "phaser";

// OBJECT TYPES class replacements
type Player = {
  sprite: Phaser.Physics.Arcade.Sprite;
  moveSpeed: number;
  health: number;
  inputKeys?:
    | Phaser.Types.Input.Keyboard.CursorKeys
    | { [key: string]: Phaser.Input.Keyboard.Key };
  pointer?: Phaser.Input.Pointer;
};

type Enemy = Phaser.Physics.Arcade.Sprite & {
  moveSpeed: number;
  health: number;
};

type Bullet = Phaser.Physics.Arcade.Sprite & {
  damage: number;
  moveSpeed: number;
  hit?: boolean;
};

type GameState = {
  scene: Phaser.Scene;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  bullets: Phaser.Physics.Arcade.Group;
};

let gameState: GameState;
let fpsText: Phaser.GameObjects.Text;
//
//
//
//

// PRELOAD assets
function preload(this: Phaser.Scene) {
  // Load assets here (images, spritesheets, etc.)
  this.load.image("background", "assets/bg.png");
}
//
//
//
//
//CREATE game Objects
function create(this: Phaser.Scene) {
  //DEBUG TOOLS
  //FPS
  fpsText = this.add.text(10, 10, "FPS: 0", {
    font: "16px Arial",
  });

  // Draw world bounds
  const worldBoundsGraphics = this.add.graphics();
  worldBoundsGraphics.lineStyle(2, 0xff0000, 1); // Red line with 2px thickness
  worldBoundsGraphics.strokeRect(
    this.physics.world.bounds.x,
    this.physics.world.bounds.y,
    this.physics.world.bounds.width,
    this.physics.world.bounds.height
  );
  //
  //
  //
  //
  //

  //GAME STATE OBJECTS
  gameState = {
    scene: this,
    player: {
      sprite: this.physics.add.sprite(512, 384, "player"),
      moveSpeed: 200,
      health: 100,
    },
    enemies: this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      createCallback: (enemy) => {
        configureEnemy(enemy as Enemy);
      },
    }),
    bullets: this.physics.add.group({
      createCallback: (bullet) => {
        configureBullet(bullet as Bullet);
      },
    }),
  };
  //Spawner
  createEnemySpawner(this, gameState.enemies);

  //
  //
  //
  //

  /////VISUALS and FX MANAGERS

  // Camera Lights Shadow setup
  this.lights.enable();
  this.lights.addLight(512, 384, 400, 0xffa500, 2);

  const camera = this.cameras.main;
  camera.setBackgroundColor(0x000000);
  let background = this.add.image(512, 384, "background");
  background.setAlpha(0.5);
  background.setPipeline("Light2D");

  //EFFECTS FOR PLAYER
  camera.startFollow(gameState.player.sprite);
  gameState.player.sprite.setPipeline("Light2D");

  //
  //
  //

  // Inputs
  gameState.player.inputKeys = this.input.keyboard?.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D,
  }) as { [key: string]: Phaser.Input.Keyboard.Key };
  //MOUSE Inputs
  gameState.player.pointer = this.input.activePointer;
  this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    const player = gameState.player;
    const distance = Phaser.Math.Distance.Between(
      player.sprite.x,
      player.sprite.y,
      pointer.worldX,
      pointer.worldY
    );

    const meleeRange = 100; // Define melee range
    if (distance <= meleeRange) {
      meleeAttack(gameState); // Trigger melee attack
    } else {
      createBullet(gameState); // Trigger ranged attack
    }
  });
  //
  //
  //

  //PHYSICS
  (
    gameState.player.sprite.body as Phaser.Physics.Arcade.Body
  ).setCollideWorldBounds(true); //it can be either static or dynamic so hard typing that its dynamic
  this.physics.world.on("worldbounds", (body: Phaser.Physics.Arcade.Body) => {
    const bullet = body.gameObject as Bullet; // Get the bullet from the body
    if (bullet && bullet.active) {
      gameState.bullets.killAndHide(bullet);
    }
  });
  // Persistent collision for bullets and enemies
  this.physics.add.collider(
    gameState.bullets,
    gameState.enemies,
    (bullet, enemy) => {
      const bulletSprite = bullet as Bullet;

      // Check if the bullet has already hit something
      if (bulletSprite.hit) return;

      bulletSprite.hit = true; // Mark the bullet as "used"

      const enemySprite = enemy as Enemy;
      enemySprite.health -= bulletSprite.damage;

      if (enemySprite.health <= 0) {
        enemySprite.destroy();
      }

      bulletSprite.setActive(false);
      bulletSprite.setVisible(false);
      (bulletSprite.body as Phaser.Physics.Arcade.Body).enable = false;

      gameState.bullets.killAndHide(bulletSprite);
    }
  );
  /////////
}
//
//
//
//

// UPDATE game state
function update(this: Phaser.Scene) {
  // Get the current FPS/ DEBUG TOOLS
  const fps = this.game.loop.actualFps;
  fpsText.setText(`FPS: ${Math.round(fps)}`);
  //
  //
  //
  //
  //

  ///GAME LOGIC////
  // Update the player's direction based on the mouse pointer
  playerDirection(gameState);
  //
  //
  movePlayer(gameState.player);
  chase(gameState);
}
//
//
//
//
//
//

//GAME FUNCTIONS
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
  if (inputVec.lengthSq() > 0) {
    inputVec.normalize(); // makes diagonal movement same speed as straight
    inputVec.scale(player.moveSpeed); // apply player’s speed
  }
  player.sprite.setVelocity(inputVec.x, inputVec.y);
}

function createBullet(gameState: GameState) {
  const player = gameState.player.sprite;
  const pointer = gameState.player.pointer;

  // Calculate the angle between the player and the mouse pointer
  if (pointer) {
    const angle = Phaser.Math.Angle.Between(
      player.x,
      player.y,
      pointer.worldX,
      pointer.worldY
    );

    // Get the direction from the angle
    const direction = getDirectionFromAngle(angle);

    // Update the player's sprite or animation
    switch (direction) {
      case "up":
        player.setTexture("player_up");
        break;
      case "down":
        player.setTexture("player_down");
        break;
      case "left":
        player.setTexture("player_left");
        break;
      case "right":
        player.setTexture("player_right");
        break;
      case "up-left":
        player.setTexture("player_up_left");
        break;
      case "up-right":
        player.setTexture("player_up_right");
        break;
      case "down-left":
        player.setTexture("player_down_left");
        break;
      case "down-right":
        player.setTexture("player_down_right");
        break;
    }

    // Fire the bullet
    const bullet = gameState.bullets.get(
      player.x,
      player.y,
      "bullet"
    ) as Bullet;
    if (bullet) {
      bullet.setActive(true);
      bullet.setVisible(true);
      bullet.setRotation(angle);
      bullet.setVelocity(
        Math.cos(angle) * bullet.moveSpeed,
        Math.sin(angle) * bullet.moveSpeed
      );
    }
  }
}

function chase(gameState: GameState) {
  const player = gameState.player.sprite;
  gameState.enemies.children.iterate((enemy) => {
    const enemySprite = enemy as Enemy; // Cast to Enemy type
    const angle = Phaser.Math.Angle.Between(
      enemySprite.x,
      enemySprite.y,
      player.x,
      player.y
    );

    enemySprite.setVelocity(
      Math.cos(angle) * enemySprite.moveSpeed,
      Math.sin(angle) * enemySprite.moveSpeed
    );

    return null; // Explicitly return null to satisfy the callback type
  });
}

function createEnemySpawner(
  scene: Phaser.Scene,
  enemyGroup: Phaser.Physics.Arcade.Group,
  spawnRate: number = 2000,
  maxEnemies: number = 50
) {
  let waveCount = 1;

  // Spawn enemies at regular intervals
  scene.time.addEvent({
    delay: spawnRate,
    loop: true,
    callback: () => {
      if (enemyGroup.countActive(true) < maxEnemies) {
        const spawnX = Math.random() * scene.scale.width;
        const spawnY = (Math.random() * scene.scale.height) / 2;
        const enemy = gameState.enemies.get(spawnX, spawnY, "enemy") as Enemy;
        enemyGroup.add(enemy);
      }

      // Increase difficulty over time
      waveCount++;
      if (waveCount % 5 === 0) {
        spawnRate *= 0.9; // Increase spawn speed
        maxEnemies += 5; // More enemies per wave
      }
    },
  });
}

function meleeAttack(gameState: GameState) {
  const scene = gameState.scene;
  const player = gameState.player;
  const pointer = gameState.player.pointer;

  // Calculate the angle between the player and the mouse pointer
  if (pointer) {
    const angle = Phaser.Math.Angle.Between(
      player.sprite.x,
      player.sprite.y,
      pointer.worldX,
      pointer.worldY
    );

    // Get the direction from the angle
    const direction = getDirectionFromAngle(angle);

    // Update the player's sprite or animation
    switch (direction) {
      case "up":
        player.sprite.setTexture("player_up");
        break;
      case "down":
        player.sprite.setTexture("player_down");
        break;
      case "left":
        player.sprite.setTexture("player_left");
        break;
      case "right":
        player.sprite.setTexture("player_right");
        break;
      case "up-left":
        player.sprite.setTexture("player_up_left");
        break;
      case "up-right":
        player.sprite.setTexture("player_up_right");
        break;
      case "down-left":
        player.sprite.setTexture("player_down_left");
        break;
      case "down-right":
        player.sprite.setTexture("player_down_right");
        break;
    }

    // Create a temporary hitbox for the melee attack
    const hitbox = scene.add.zone(player.sprite.x, player.sprite.y, 50, 50);
    scene.physics.world.enable(hitbox);

    // Offset the hitbox based on the direction
    switch (direction) {
      case "up":
        hitbox.y -= 30;
        break;
      case "down":
        hitbox.y += 30;
        break;
      case "left":
        hitbox.x -= 30;
        break;
      case "right":
        hitbox.x += 30;
        break;
      case "up-left":
        hitbox.x -= 30;
        hitbox.y -= 30;
        break;
      case "up-right":
        hitbox.x += 30;
        hitbox.y -= 30;
        break;
      case "down-left":
        hitbox.x -= 30;
        hitbox.y += 30;
        break;
      case "down-right":
        hitbox.x += 30;
        hitbox.y += 30;
        break;
    }

    // Check for overlaps with enemies
    scene.physics.add.overlap(hitbox, gameState.enemies, (_, enemy) => {
      const enemySprite = enemy as Enemy;
      enemySprite.health -= 10;

      if (enemySprite.health <= 0) {
        enemySprite.destroy();
      }
    });

    // Destroy the hitbox after a short delay
    scene.time.delayedCall(200, () => {
      hitbox.destroy();
    });
  }
}
//
//
//
//
//
//HELPER FUNCTIONS
// allows me to pass types to groups without classes
function configureBullet(bullet: Bullet) {
  bullet.damage = 10;
  bullet.moveSpeed = 300;

  (bullet.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
  (bullet.body as Phaser.Physics.Arcade.Body).onWorldBounds = true; // Trigger events when hitting world bounds

  (bullet.body as Phaser.Physics.Arcade.Body).enable = true;
}

function configureEnemy(enemy: Enemy) {
  enemy.health = 10;
  enemy.moveSpeed = 100;

  (enemy.body as Phaser.Physics.Arcade.Body).setImmovable(true);
}

function getDirectionFromAngle(angle: number): string {
  // Convert angle to degrees
  const degrees = Phaser.Math.RadToDeg(angle);

  // Map the angle to one of 8 directions
  if (degrees >= -22.5 && degrees < 22.5) return "right";
  if (degrees >= 22.5 && degrees < 67.5) return "down-right";
  if (degrees >= 67.5 && degrees < 112.5) return "down";
  if (degrees >= 112.5 && degrees < 157.5) return "down-left";
  if (degrees >= 157.5 || degrees < -157.5) return "left";
  if (degrees >= -157.5 && degrees < -112.5) return "up-left";
  if (degrees >= -112.5 && degrees < -67.5) return "up";
  if (degrees >= -67.5 && degrees < -22.5) return "up-right";

  return "right"; // Default to right
}

function playerDirection(gameState: GameState) {
  const player = gameState.player.sprite;
  const pointer = gameState.player.pointer;

  // Calculate the angle between the player and the mouse pointer

  if (pointer) {
    const angle = Phaser.Math.Angle.Between(
      player.x,
      player.y,
      pointer.worldX,
      pointer.worldY
    );

    // Get the direction from the angle
    const direction = getDirectionFromAngle(angle);

    // Update the player's sprite or animation based on the direction
    switch (direction) {
      case "up":
        player.setTexture("player_up"); // Replace with your up-facing sprite or animation
        break;
      case "down":
        player.setTexture("player_down");
        break;
      case "left":
        player.setTexture("player_left");
        break;
      case "right":
        player.setTexture("player_right");
        break;
      case "up-left":
        player.setTexture("player_up_left");
        break;
      case "up-right":
        player.setTexture("player_up_right");
        break;
      case "down-left":
        player.setTexture("player_down_left");
        break;
      case "down-right":
        player.setTexture("player_down_right");
        break;
    }
  }
}
//
//
//
//

//Game Configs
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
