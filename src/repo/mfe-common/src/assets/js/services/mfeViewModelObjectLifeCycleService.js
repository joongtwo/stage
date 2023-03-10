// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import eventBus from 'js/eventBus';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';

/**
 * Mfe VMO service
 *
 * @module js/services/mfeViewModelObjectLifeCycleService
 */


let uidToVMOsArray = {};
let updatedEventSubscription;
let modifiedEventSubscription;

/**
 *
 * @param {viewModelObject} vmo - a given viewModelObject
 */
function addVmoToCache( vmo ) {
    if( !uidToVMOsArray[ vmo.uid ] ) {
        uidToVMOsArray[ vmo.uid ] = [];
    }
    uidToVMOsArray[ vmo.uid ].push( vmo );
}

/**
 *
 * @param {String} vmoUid - a given viewModelObject uid
 */
function deleteVmosFromCache( vmoUid ) {
    if( !uidToVMOsArray[ vmoUid ] ) {
        return;
    }
    delete uidToVMOsArray[ vmoUid ];
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @return {ViewModelObject} a view model object which represents the given modelObject
 */
export function createViewModelObjectFromModelObject( modelObject ) {
    if( modelObject ) {
        let vmo = viewModelObjectSvc.createViewModelObject( modelObject );
        addVmoToCache( vmo );
        return vmo;
    }
}

/**
 *
 * @param {string} uid - a given iod
 * @return {ViewModelObject} a view model object which represents the given uid
 */
export function createViewModelObjectFromUid( uid ) {
    if( typeof uid === 'string' ) {
        return createViewModelObjectFromModelObject( cdm.getObject( uid ) );
    }
}

/**
 *
 * @param {StringArray} uids - a given iod
 * @return {ViewModelObject Array}  array of view model objects which represent the given uids
 */
export function createViewModelObjectsFromUidArray( uids ) {
    let objArray = [];
    if( Array.isArray( uids ) ) {
        uids.forEach( ( uid ) => {
            if( typeof uid === 'string' ) {
                objArray.push( createViewModelObjectFromModelObject( cdm.getObject( uid ) ) );
            }
        } );
    }
    return objArray;
}

/**
 * For a given set of modelObjects, we update all of the equivalent cached VMOs
 * @param {modelObject[]} modelObjects - a given array of modelObjects
 */
function updateVmosOfGivenModelObjects( modelObjects ) {
    if( modelObjects && modelObjects.length > 0 ) {
        modelObjects.forEach( ( modelObj ) => {
            const vmoArray = uidToVMOsArray[ modelObj.uid ];
            if( vmoArray && vmoArray.length > 0 ) {
                viewModelObjectSvc.updateViewModelObjectCollection( vmoArray, [ modelObj ] );

                //The current viewModelObjectService does not add to the vmo new properties that were added to the cached model object
                //So we need to add these props by ourselves
                vmoArray.forEach( ( vmo ) => {
                    Object.keys( modelObj.props ).forEach( ( moPropName ) => {
                        if( !vmo.props.hasOwnProperty( moPropName ) ) {
                            vmo.props[ moPropName ] = viewModelObjectSvc.constructViewModelProperty( modelObj.props[ moPropName ], moPropName, vmo );
                        }
                    } );
                } );
            }
        } );

        //this event is fired after all VMOs have been updated
        //view models which listen to this event will surely use the up-to-date VMOs
        eventBus.publish( 'mfe.updated', { modelObjects } );
    }
}

/**
 * @param {modelObject[]} updatedObjects - an array of updated objects
 */
function onUpdate( { updatedObjects } ) {
    if( Object.keys( uidToVMOsArray ).length > 0 ) {
        updateVmosOfGivenModelObjects( updatedObjects );
    }
}

/**
 *
 * @param {modelObject[]} modifiedObjects - the modified objects
 */
function onModified( { modifiedObjects } ) {
    if( Object.keys( uidToVMOsArray ).length > 0 ) {
        updateVmosOfGivenModelObjects( modifiedObjects );
    }
}

/**
 * initializes the service which listens to relevant events
 */
export function init() {
    updatedEventSubscription = eventBus.subscribe( 'cdm.updated', onUpdate );
    modifiedEventSubscription = eventBus.subscribe( 'cdm.modified', onModified );
}

/**
 * Unsubscribes from listening to cdm events
 *
 */
export function destroy() {
    eventBus.unsubscribe( updatedEventSubscription );
    updatedEventSubscription = null;
    eventBus.unsubscribe( modifiedEventSubscription );
    modifiedEventSubscription = null;
    uidToVMOsArray = {};
}

let exports = {};
export default exports = {
    createViewModelObjectFromModelObject,
    createViewModelObjectFromUid,
    init,
    destroy,
    createViewModelObjectsFromUidArray,
    deleteVmosFromCache
};
