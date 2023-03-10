// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * This service handles localStorage events.
 *
 * @module js/pertLocalStorageService
 */
 import appCtxService from 'js/appCtxService';
 import eventBus from 'js/eventBus';
 
 const MFE_KEY_LOCALSTORAGE = ':/mfe/';
 const MFE_PREDECESSORS_KEY = 'mfePredecessorNodes';
 
 /**
  * Register storage event for scope flows
  */
 export function registerStorageEventForScopeFlows() {
     window.addEventListener('storage', onStorageChange);
     eventBus.subscribe( 'session.signOut', clearStorageUponSignOut );
 }
 
 function onStorageChange(event) {
     if (event.key === MFE_PREDECESSORS_KEY + MFE_KEY_LOCALSTORAGE) {
         appCtxService.updatePartialCtx('ep.isPredecessorSetForPert', true);
     }
 }
 
 function clearStorageUponSignOut() {
     removeFromStorage(MFE_PREDECESSORS_KEY + MFE_KEY_LOCALSTORAGE);
 }
 
 /**
  * Get the requested object from localStorage
  * @param {String} storageKey storageKey
  */
 export function getFromStorage( storageKey ){
     return JSON.parse(localStorage.getItem( storageKey ));
 }
 
 /**
  * Remove the given object from localStorage
  * @param {String} storageKey storageKey
  */
 export function removeFromStorage ( storageKey ){
     const storageObject = JSON.parse(localStorage.getItem( storageKey ));
     if(storageObject){
         localStorage.removeItem( storageKey );
     }
 }
 
 let exports = {};
 export default exports = {
     registerStorageEventForScopeFlows,
     getFromStorage,
     removeFromStorage
 };