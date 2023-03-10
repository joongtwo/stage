// Copyright (c) 2022 Siemens

/**
 * Defines {@link NgServices.viewer3DConnectionManager} manages the lifecycle of viewer connections
 *
 * @module js/viewer3DConnectionManager
 */
 import viewerContextService from 'js/viewerContext.service';
 import _ from 'lodash';
 import eventBus from 'js/eventBus';
 
 let exports = {};
 var beforeUnloadEventHandlerRegistered = false;
 var userSignOutEvent = null;
 
 /**
  * Register browser unload listener
  */
 export let registerBrowserUnloadListener = () => {
     if( !beforeUnloadEventHandlerRegistered ) {
         beforeUnloadEventHandlerRegistered = true;
         registerListenerToListenSignOut();        
     }
 };
 
 const registerListenerToListenSignOut = () => {
     if( userSignOutEvent === null ) {
         userSignOutEvent = eventBus.subscribe( 'progress.start', ( eventData ) => {
             if( eventData && eventData.endPoint && _.includes( eventData.endPoint, 'logout' ) ) {
                 viewerContextService.handleBrowserUnload( true );
             }
         }, 'viewer3DConnectionManager' );
     }
 };
 
 export default exports = {
     registerBrowserUnloadListener
 };
 