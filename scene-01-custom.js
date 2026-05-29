import { Vector3, Vector4, Color3, MeshBuilder, StandardMaterial, SceneLoader, Matrix, Quaternion, AbstractMesh } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock } from '@babylonjs/gui';
import '@babylonjs/loaders/glTF'; // Enable GLTF/GLB loader for loading 3D models
import { getCurrentSceneId } from '../core/sceneManager.js';
import * as UI_MANAGER from '../core/uiManager.js';

// Store references to created resources for cleanup
let boxMesh = null;
let boxMaterial = null;

/**
 * Scene 01: Create ground and reference box, and load 3D models
 * @param {Scene} scene - Babylon.js scene
 * @param {string} [sceneId] - Optional scene ID (passed from sceneManager, falls back to getCurrentSceneId if not provided)
 */
export async function createScene01(scene, sceneId = null) {
    // Get the current scene ID - use provided sceneId or fall back to getCurrentSceneId()
    const currentSceneId = sceneId || getCurrentSceneId();
    console.log(`[scene-01-custom.js]: [N/A] - [createScene01] - scene has a value of ${scene.name || 'unnamed'}.`); // This is logged to debug the scene creation and verify scene was created correctly.
    console.log(`[scene-01-custom.js]: [N/A] - [createScene01] - sceneId parameter has a value of ${sceneId || 'null'}.`); // This is logged to debug the scene ID parameter and verify sceneId was passed correctly.
    console.log(`[scene-01-custom.js]: [N/A] - [createScene01] - currentSceneId has a value of ${currentSceneId || 'null'}.`); // This is logged to debug the scene detection and verify current scene ID is retrieved correctly.
    

            // Code specific to scene-01
            console.log(`[scene-01-custom.js]: [N/A] - [createScene01] - Running scene-01 specific code.`); // This is logged to debug the scene-specific logic and verify scene-01 code executes.
            
            // Create a simple box as a reference object
            boxMesh = MeshBuilder.CreateBox('box', { size: 0.5 }, scene);
            boxMesh.position = new Vector3(-9.4, -1.3, -3.1);
            
            // Create red material for the box
            boxMaterial = new StandardMaterial('boxMaterial', scene);
            boxMaterial.diffuseColor = new Color3(1, 0, 0); // Red color
            boxMesh.material = boxMaterial;
            boxMesh.renderingGroupId = 2;
            console.log(`[scene-01-custom.js]: [N/A] - [createScene01] - boxMesh has a value of ${boxMesh.name}.`); // This is logged to debug the scene-01 creation and verify box was created correctly.

            scene.onBeforeRenderObservable.add(() => {
                const deltaTime = scene.getEngine().getDeltaTime(); // ms
                boxMesh.rotation.y += 0.0005 * deltaTime;
            }); 
            
            boxMesh.renderOverlay = true;
            boxMesh.overlayColor = Color3.Green();
            
            // boxMesh.renderOutline = false;
            // boxMesh.outlineColor = Color3.Green();
            // boxMesh.outlineWidth = 0.04;
            
            //UI_MANAGER.BJSHighlightLayer.addMesh(boxMesh, Color3.White());

                // Code for any other scene or fallback (including null)
            console.log(`[scene-01-custom.js]: [N/A] - [createScene01] - Running default code for scene: ${currentSceneId || 'null'}.`); // This is logged to debug the scene-specific logic and verify default code executes when scene ID is unknown or null.

}

/**
 * Cleanup function for Scene 01 - disposes all resources created by createScene01
 */
export function disposeScene01() {
    console.log(`[scene-01-custom.js]: [N/A] - [disposeScene01] - Cleaning up Scene 01 resources.`); // This is logged to debug the scene-01 cleanup and verify cleanup starts.
    
    if (arcadeMachine) {
        arcadeMachine.dispose();
        arcadeMachine = null;
    }
    
    if (skeletonMagicAttack) {
        skeletonMagicAttack.dispose();
        skeletonMagicAttack = null;
    }
    
    if (tableBust) {
        tableBust.dispose();
        tableBust = null;
    }
    
    if (pacmanArcadeAnimation) {
        pacmanArcadeAnimation.dispose();
        pacmanArcadeAnimation = null;
    }
    
    if (boxMaterial) {
        boxMaterial.dispose();
        boxMaterial = null;
    }
    
    if (boxMesh) {
        boxMesh.dispose();
        boxMesh = null;
    }
    
    console.log(`[scene-01-custom.js]: [N/A] - [disposeScene01] - Scene 01 resources cleaned up.`); // This is logged to debug the scene-01 cleanup and verify cleanup completed.
}

