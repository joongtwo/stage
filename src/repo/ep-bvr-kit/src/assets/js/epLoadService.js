// Copyright (c) 2022 Siemens

import typeUtils from 'js/utils/mfeTypeUtils';
import epLoadInputHelper from 'js/epLoadInputHelper';
import mfeReadOnlyService from 'js/mfeReadOnlyService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import epContextService from 'js/epContextService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import uwDirectiveDateTimeSvc from 'js/uwDirectiveDateTimeService';
import appCtxSvc from 'js/appCtxService';
import mfeVMOLifeCycleSvc from 'js/services/mfeViewModelObjectLifeCycleService';
import appCtxService from 'js/appCtxService';
import AwStateService from 'js/awStateService';

/**
 * @module js/epLoadService
 */

const EFFECTIVITY_DATE = 'effectivityDate';
const REVISION_RULE = 'revisionRule';
const UNIT_NUMBER = 'unitNumber';
const END_ITEM = 'endItem';
const NEXT_OP = 'nextOperationUID';
const PREV_OP = 'prevOperationUID';

/**
 * Call the SOA of loadObjectData3
 *
 * @param {Array} loadTypeInputs array of loat type inputs
 * @param {Boolean} replaceContext true to updated the ctx after the call returns
 * @return {Promise} promise of the response
 */
export function loadObject( loadTypeInputs, replaceContext ) {
    const jsonInput = epLoadInputHelper.getLoadInputJSON( loadTypeInputs );

    const promise = soaService.postUnchecked( 'Internal-MfgBvrCore-2015-03-DataManagement', 'loadObjectData3',
        jsonInput );
    return promise.then( function( responseData ) {
        if( responseData.ServiceData && responseData.ServiceData.partialErrors ) {
            const err = messagingService.getSOAErrorMessage( responseData.ServiceData );
            messagingService.showError( err );
            let awPromise = AwPromiseService.instance;
            return awPromise.reject( err );
        }
        appCtxSvc.updatePartialCtx( 'ep.closeOldWindows', false );

        const loadObjectResponse = {
            ServiceData: responseData.ServiceData,
            loadedObjectsMap: responseData.loadedObjectsMap ? responseData.loadedObjectsMap : {}
        };

        if( responseData.loadedObjectsMap && responseData.loadedObjectsMap.loadedObject ) {
            loadObjectResponse.loadedObjects = responseData.loadedObjectsMap.loadedObject;
        } else {
            loadObjectResponse.loadedObjects = [];
        }

        const relatedObjectsMap = responseData.relatedObjectsMap;
        if( relatedObjectsMap ) {
            for( let relatedObject in relatedObjectsMap ) {
                epObjectPropertyCacheService.setProperties( relatedObject,
                    relatedObjectsMap[ relatedObject ].additionalPropertiesMap2 );
            }

            loadObjectResponse.relatedObjectsMap = relatedObjectsMap;
        }
        if( loadObjectResponse.loadedObjectsMap ) {
            if( replaceContext ) {
                updateContext( loadObjectResponse.loadedObjectsMap );
                handleAppliedEffectivity();
                handlePreviousAndNextOperations();
            }

            // if associated assembly of the scope line is loaded, we need to update the context with it.
            let loadedObjUid = AwStateService.instance.params.uid;
            if ( relatedObjectsMap && relatedObjectsMap[loadedObjUid] && relatedObjectsMap[loadedObjUid].additionalPropertiesMap2 ) {
                if( relatedObjectsMap[loadedObjUid].additionalPropertiesMap2.associatedAssembly ) {
                    let associatedAssemblyUid = relatedObjectsMap[loadedObjUid].additionalPropertiesMap2.associatedAssembly[0];
                    let loadedProductObjectVMO = mfeVMOLifeCycleSvc.createViewModelObjectFromModelObject( { uid: associatedAssemblyUid } );
                    appCtxService.updatePartialCtx( 'ep.loadedProductObject', loadedProductObjectVMO );
                }
                // if associated resource of the scope line is loaded, we need to update the context with it.
                if( relatedObjectsMap[loadedObjUid].additionalPropertiesMap2.associatedResources ) {
                    let associatedResourcesUid = relatedObjectsMap[loadedObjUid].additionalPropertiesMap2.associatedResources[0];
                    let loadedResourceObjectVMO = mfeVMOLifeCycleSvc.createViewModelObjectFromModelObject( { uid: associatedResourcesUid } );
                    appCtxService.updatePartialCtx( 'ep.loadedResourceObject', loadedResourceObjectVMO );
                }
            }

            return loadObjectResponse;
        }
        localeService.getLocalizedText( 'EPServicesMessages', 'objectDoesNotExist' ).then( function( result ) {
            messagingService.showError( result );
            let awPromise = AwPromiseService.instance;
            return awPromise.reject( result );
        } );
    } );
}

/**
 * update the context
 * @param {Map} loadedObjectsMap map of loaded objects
 */
function updateContext( loadedObjectsMap ) {
    epContextService.clearContext();
    for( let object in loadedObjectsMap ) {
        epContextService.setPageContext( object, loadedObjectsMap[ object ][ 0 ] );
    }
    epContextService.notifyContextChanged();
}

/**
 * Update the context with the applied effectivity
 */
function handleAppliedEffectivity() {
    const workPackage = epContextService.getPageContext().collaborationContext;
    const readOnlyMode = mfeReadOnlyService.isReadOnlyMode();
    if( readOnlyMode && workPackage && typeUtils.isOfType( workPackage, 'Mbc0InternalWorkPackage' ) &&
        workPackage.props && workPackage.props[ epBvrConstants.MBC_IS_READ_ONLY ] &&
        workPackage.props[ epBvrConstants.MBC_IS_READ_ONLY ].uiValues[ 0 ] === 'True' ) {
        updateEffectivityDate( workPackage );
        updateRevisionRule( workPackage );
        updateUnitEffectivity( workPackage );
    }
}

/**
 * Update the context with previous and next operations
 */
function handlePreviousAndNextOperations() {
    appCtxSvc.registerPartialCtx( 'ep.nextOp.uid', '' );
    appCtxSvc.registerPartialCtx( 'ep.nextOp.name', '' );
    appCtxSvc.registerPartialCtx( 'ep.prevOp.uid', '' );
    appCtxSvc.registerPartialCtx( 'ep.prevOp.name', '' );
    const loadObject = epContextService.getPageContext().loadedObject;
    if( loadObject && typeUtils.isOfType( loadObject, 'Mfg0BvrOperation' ) ) {
        const nextOperationUID = epObjectPropertyCacheService.getProperty( loadObject.uid, NEXT_OP );
        if( nextOperationUID ) {
            const nextOperationName = epObjectPropertyCacheService.getProperty( nextOperationUID[ 0 ], epBvrConstants.BL_REV_OBJECT_NAME );
            appCtxSvc.updatePartialCtx( 'ep.nextOp.name', nextOperationName[ 0 ] );
            appCtxSvc.updatePartialCtx( 'ep.nextOp.uid', nextOperationUID[ 0 ] );
        }
        const prevOperationUID = epObjectPropertyCacheService.getProperty( loadObject.uid, PREV_OP );
        if( prevOperationUID ) {
            const prevOperationName = epObjectPropertyCacheService.getProperty( prevOperationUID[ 0 ], epBvrConstants.BL_REV_OBJECT_NAME );
            appCtxSvc.updatePartialCtx( 'ep.prevOp.name', prevOperationName[ 0 ] );
            appCtxSvc.updatePartialCtx( 'ep.prevOp.uid', prevOperationUID[ 0 ] );
        }
    }
}

/**
 * Update the effectivity date of the work package in the context
 * @param {Object} workPackage the work package
 */
function updateEffectivityDate( workPackage ) {
    const effectivityDate = epObjectPropertyCacheService.getProperty( workPackage.uid, EFFECTIVITY_DATE );
    if( effectivityDate && effectivityDate[ 0 ] ) {
        const date = new Date( effectivityDate[ 0 ] );
        const formatDate = uwDirectiveDateTimeSvc.formatDate( date, 'dd M yy' );
        epContextService.setEffectivityDate( formatDate );
    }
}

/**
 * Update the revision rule of the work package in the context
 * @param {Object} workPackage the work package
 */
function updateRevisionRule( workPackage ) {
    const revisionRule = epObjectPropertyCacheService.getProperty( workPackage.uid, REVISION_RULE );
    if( revisionRule && revisionRule[ 0 ] ) {
        epContextService.setRevisionRule( revisionRule[ 0 ] );
    }
}
/**
 * Update the effectivity unit of the work package in the context
 * @param {Object} workPackage the work package
 */
function updateUnitEffectivity( workPackage ) {
    const unitNumber = epObjectPropertyCacheService.getProperty( workPackage.uid, UNIT_NUMBER );
    const endItem = epObjectPropertyCacheService.getProperty( workPackage.uid, END_ITEM );
    if( unitNumber && unitNumber[ 0 ] && endItem && endItem[ 0 ] ) {
        epContextService.setUnitNumber( unitNumber[ 0 ] );
        epContextService.setEndItem( endItem[ 0 ] );
    }
}

let exports = {};
export default exports = {
    loadObject
};
