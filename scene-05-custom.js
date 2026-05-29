import { Vector3, Vector4, Color3, MeshBuilder, StandardMaterial, SceneLoader, Matrix, Quaternion } from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock } from '@babylonjs/gui';
import '@babylonjs/loaders/glTF'; // Enable GLTF/GLB loader for loading 3D models
import { getCurrentSceneId } from '../core/sceneManager.js';

// Store references to created resources for cleanup

let skeletonMagicAttack = null;
let tableBust = null;
let pacmanArcadeAnimation = null;
let renderingGroupIdValue = 1;
/**
 * Scene 05: Load 3D models
 * @param {Scene} scene - Babylon.js scene
 * @param {string} [sceneId] - Optional scene ID (passed from sceneManager, falls back to getCurrentSceneId if not provided)
 */
export async function createScene05(scene, sceneId = null) {
    // Get the current scene ID - use provided sceneId or fall back to getCurrentSceneId()
    const currentSceneId = sceneId || getCurrentSceneId();
    console.log(`[scene-05-custom.js]: [N/A] - [createScene05] - scene has a value of ${scene.name || 'unnamed'}.`); // This is logged to debug the scene creation and verify scene was created correctly.
    console.log(`[scene-05-custom.js]: [N/A] - [createScene05] - sceneId parameter has a value of ${sceneId || 'null'}.`); // This is logged to debug the scene ID parameter and verify sceneId was passed correctly.
    console.log(`[scene-05-custom.js]: [N/A] - [createScene05] - currentSceneId has a value of ${currentSceneId || 'null'}.`); // This is logged to debug the scene detection and verify current scene ID is retrieved correctly.
    

            // Code specific to scene-05
            console.log(`[scene-05-custom.js]: [N/A] - [createScene05] - Running scene-05 specific code.`); // This is logged to debug the scene-specific logic and verify scene-05 code executes.
            

            // Load pacman arcade animation
            try {
                console.log(`[scene-05-custom.js]: [N/A] - [createScene05] - Starting to load pacman arcade animation from /assets/3D/pacman_arcade__animation.glb.`); // This is logged to debug the model loading and verify loading starts.
                const pacmanResult = await SceneLoader.ImportMeshAsync(null, '/assets/3D/', 'pacman_arcade__animation.glb', scene);
                console.log(`[scene-05-custom.js]: [N/A] - [createScene05] - pacmanResult has a value of ${pacmanResult ? 'object' : 'null'}, meshes count: ${pacmanResult?.meshes?.length || 0}.`); // This is logged to debug the model loading and verify SceneLoader returned results.
                
                if (pacmanResult && pacmanResult.meshes && pacmanResult.meshes.length > 0) {
                    pacmanArcadeAnimation = pacmanResult.meshes[0];
                    pacmanArcadeAnimation.name = 'pacmanArcadeAnimation';
                    pacmanArcadeAnimation.position = new Vector3(2, -1, 2);
                    pacmanArcadeAnimation.rotation = new Vector3(0, 180, 0);
                    pacmanArcadeAnimation.scaling = new Vector3(0.01, 0.01, 0.01);
                    pacmanArcadeAnimation.renderingGroupId = renderingGroupIdValue;
                    console.log(`[scene-05-custom.js]: [N/A] - [createScene05] - pacmanArcadeAnimation has a value of ${pacmanArcadeAnimation.name}, position: (${pacmanArcadeAnimation.position.x}, ${pacmanArcadeAnimation.position.y}, ${pacmanArcadeAnimation.position.z}).`); // This is logged to debug the model loading and verify model was configured correctly.
                } else {
                    console.error(`[scene-05-custom.js]: [N/A] - [createScene05] - Failed to load pacman arcade animation: no meshes returned.`); // This is logged to debug the model loading and verify why loading failed.
                }
            } catch (error) {
                console.error(`[scene-05-custom.js]: [N/A] - [createScene01] - Error loading pacman arcade animation:`, error, '.'); // This is logged to debug the model loading and verify error handling works.
            }

            // Load skeleton magic attack
            try {
                console.log(`[scene-05-custom.js]: [N/A] - [createScene01] - Starting to load skeleton magic attack from /assets/3D/animated_skeleton_magic_attack.glb.`); // This is logged to debug the model loading and verify loading starts.
                const skeletonResult = await SceneLoader.ImportMeshAsync(null, '/assets/3D/', 'animated_skeleton_magic_attack.glb', scene);
                console.log(`[scene-05-custom.js]: [N/A] - [createScene01] - skeletonResult has a value of ${skeletonResult ? 'object' : 'null'}, meshes count: ${skeletonResult?.meshes?.length || 0}.`); // This is logged to debug the model loading and verify SceneLoader returned results.
                
                if (skeletonResult && skeletonResult.meshes && skeletonResult.meshes.length > 0) {
                    skeletonMagicAttack = skeletonResult.meshes[0];
                    skeletonMagicAttack.name = 'skeletonMagicAttack';
                    skeletonMagicAttack.position = new Vector3(-1, -1, -2);
                    skeletonMagicAttack.rotation = new Vector3(0, 180, 0);
                    skeletonMagicAttack.scaling = new Vector3(0.75, 0.75, 0.75);
                    skeletonMagicAttack.renderingGroupId = renderingGroupIdValue;
                    console.log(`[scene-05-custom.js]: [N/A] - [createScene01] - skeletonMagicAttack has a value of ${skeletonMagicAttack.name}, position: (${skeletonMagicAttack.position.x}, ${skeletonMagicAttack.position.y}, ${skeletonMagicAttack.position.z}).`); // This is logged to debug the model loading and verify model was configured correctly.
                } else {
                    console.error(`[scene-05-custom.js]: [N/A] - [createScene01] - Failed to load skeleton magic attack: no meshes returned.`); // This is logged to debug the model loading and verify why loading failed.
                }
            } catch (error) {
                console.error(`[scene-05-custom.js]: [N/A] - [createScene01] - Error loading skeleton magic attack:`, error, '.'); // This is logged to debug the model loading and verify error handling works.
            }
            
            // Load table bust
            try {
                console.log(`[scene-05-custom.js]: [N/A] - [createScene01] - Starting to load table bust from /assets/3D/table-bust.glb.`); // This is logged to debug the model loading and verify loading starts.
                const tableResult = await SceneLoader.ImportMeshAsync(null, '/assets/3D/', 'table-bust.glb', scene);
                console.log(`[scene-05-custom.js]: [N/A] - [createScene01] - tableResult has a value of ${tableResult ? 'object' : 'null'}, meshes count: ${tableResult?.meshes?.length || 0}.`); // This is logged to debug the model loading and verify SceneLoader returned results.
                
                if (tableResult && tableResult.meshes && tableResult.meshes.length > 0) {
                    tableBust = tableResult.meshes[0];
                    tableBust.name = 'tableBust';
                    tableBust.position = new Vector3(2, -1, -3);
                    tableBust.rotation = new Vector3(0, 180, 0);
                    tableBust.scaling = new Vector3(50, 50, 50);
                    tableBust.renderingGroupId = renderingGroupIdValue;
                    console.log(`[scene-05-custom.js]: [N/A] - [createScene01] - tableBust has a value of ${tableBust.name}, position: (${tableBust.position.x}, ${tableBust.position.y}, ${tableBust.position.z}).`); // This is logged to debug the model loading and verify model was configured correctly.
                } else {
                    console.error(`[scene-05-custom.js]: [N/A] - [createScene01] - Failed to load table bust: no meshes returned.`); // This is logged to debug the model loading and verify why loading failed.
                }
            } catch (error) {
                console.error(`[scene-05-custom.js]: [N/A] - [createScene01] - Error loading table bust:`, error, '.'); // This is logged to debug the model loading and verify error handling works.
            }
            
                   // Code for any other scene or fallback (including null)
            console.log(`[scene-05-custom.js]: [N/A] - [createScene01] - Running default code for scene: ${currentSceneId || 'null'}.`); // This is logged to debug the scene-specific logic and verify default code executes when scene ID is unknown or null.
    
 


}

/**
 * Cleanup function for Scene 05 - disposes all resources created by createScene05
 */
export function disposeScene05() {
    console.log(`[scene-05-custom.js]: [N/A] - [disposeScene05] - Cleaning up Scene 05 resources.`); // This is logged to debug the scene-05 cleanup and verify cleanup starts.
    
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

    
    console.log(`[scene-05-custom.js]: [N/A] - [disposeScene05] - Scene 05 resources cleaned up.`); // This is logged to debug the scene-05 cleanup and verify cleanup completed.
}

