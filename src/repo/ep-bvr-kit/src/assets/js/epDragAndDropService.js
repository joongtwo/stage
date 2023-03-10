// Copyright (c) 2022 Siemens

/**
 * @module js/epDragAndDropService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import epSaveService from 'js/epSaveService';
import { constants as _epBvrConstants } from 'js/epBvrConstants';
import saveInputWriterService from 'js/saveInputWriterService';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import appCtxService from 'js/appCtxService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import messagingService from 'js/messagingService';
import localeService from 'js/localeService';

const EP_SCOPE_OBJECT = 'ep.scopeObject';
const VALID_TO_DROP_OBJECT = {
    dropEffect: 'copy',
    preventDefault: true,
    stopPropagation: true
};
const INVALID_TO_DROP_OBJECT = {
    dropEffect: 'none',
    stopPropagation: true
};
let dragDataCache = {
    draggedObjUids: [],
    draggedFromView: null
};

/**
 * @param {Object} dragData dragAndDrop Params
 */
export const handleDragStart = ( dragData ) => {
    if( dragData && dragData.targetObjects ) {
        dragDataCache.draggedFromView = dragData.declViewModel._internal.viewId;
        dragDataCache.draggedObjUids = dragData.targetObjects.map( object => object.uid );
    } else {
        dragData.event.preventDefault();
    }
};

/**
 *
*/
export function handleDragEnd() {
    dragDataCache.draggedFromView = null;
    dragDataCache.draggedObjUids = [];
}

/**
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dragOverParts( extraParams, dropData ) {
    //Check to ensure only Parts are dragged
    const sourceUids = dragDataCache.draggedObjUids;
    const dragFrom = dragDataCache.draggedFromView;
    for( let sourceUidsIndex = 0; sourceUidsIndex < sourceUids.length; sourceUidsIndex++ ) {
        const sourceObj = cdm.getObject( sourceUids[ sourceUidsIndex ] );
        if( !extraParams.includes( dragFrom ) || sourceObj.type !== 'BOMLine' || !dropData.declViewModel.getData().inputObject || !dropData.declViewModel.getData().inputObject.uid ) {
            return INVALID_TO_DROP_OBJECT;
        }
    }
    return VALID_TO_DROP_OBJECT;
}


/**
 *
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dropParts( dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    const saveInputWriter = saveInputWriterService.get();
    let relatedObject = [];
    _.forEach( sourceUids, function( sourceUid ) {
        const sourceObj = cdm.getObject( sourceUid );
        relatedObject.push( sourceObj );
    } );
    const targetObjectInput = {
        id: dropData.declViewModel.getData().inputObject.uid
    };
    // Part Assignment should pick Occurance based on MEAssignCustomizedOccurrenceType
    const partsAddObject = createAssignmentObject( null, sourceUids );
    relatedObject.push( cdm.getObject( dropData.declViewModel.getData().inputObject.uid ) );
    saveInputWriter.addRelatedObjects( relatedObject );
    saveInputWriter.addAssignedParts( targetObjectInput, partsAddObject );
    //Tree handles adding of new obj
    epSaveService.saveChanges( saveInputWriter, true, relatedObject );
    return {
        preventDefault: true,
        stopPropagation: true
    };
}

/**
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dragOverWorkareas( dropData ) {
    //Check to ensure only Parts are dragged
    const sourceUids = dragDataCache.draggedObjUids;
    for( let sourceUidsIndex = 0; sourceUidsIndex < sourceUids.length; sourceUidsIndex++ ) {
        const sourceObj = cdm.getObject( sourceUids[ sourceUidsIndex ] );
        const inputObj = dropData.declViewModel.getData().inputObject;
        if( !inputObj || !inputObj.uid || !isWorkareaDropAllowedOnTarget( sourceObj, inputObj ) ) {
            return INVALID_TO_DROP_OBJECT;
        }
    }
    return VALID_TO_DROP_OBJECT;
}

/**
 *
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dropWorkareas( dropData ) {
    return dropBoeData( dropData, _epBvrConstants.ME_WORKAREA );
}

/**
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dragOverResources( dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    const inputObj = dropData.declViewModel.getData().inputObject;
    //Check that we can't drag multiple resources to the Process Resource
    if( !inputObj || !inputObj.uid || sourceUids.length > 1 && mfeTypeUtils.isOfType( inputObj, _epBvrConstants.MFG_BVR_PROCESS_RESOURCE ) ) {
        return INVALID_TO_DROP_OBJECT;
    }
    //Check to ensure only Resources are dragged Target may be operation, process or process resource
    for( let sourceUidsIndex = 0; sourceUidsIndex < sourceUids.length; sourceUidsIndex++ ) {
        const sourceObj = cdm.getObject( sourceUids[ sourceUidsIndex ] );
        if( !isResourceDropAllowedOnTarget( sourceObj, inputObj ) ) {
            return INVALID_TO_DROP_OBJECT;
        }
    }
    return VALID_TO_DROP_OBJECT;
}

/**
 *
 * @param {Object} dropData objects
 * @returns {Object} config for preventing default action
 */
function dropResources( dropData ) {
    return dropBoeData( dropData );
}

/**
 *
 * @param {Object} dropData objects
 * @param {String} relationType objects
 * @returns {Object} config for preventing default action
 */
const dropBoeData = function( dropData, relationType ) {
    const sourceUids = dragDataCache.draggedObjUids;
    const saveInputWriter = saveInputWriterService.get();
    let relatedObject = [];
    _.forEach( sourceUids, function( sourceUid ) {
        const sourceObj = cdm.getObject( sourceUid );
        relatedObject.push( sourceObj );
    } );
    const targetObjectInput = {
        id: dropData.declViewModel.getData().inputObject.uid
    };
    const workareasAddObject = createAssignmentObject( relationType, sourceUids );
    relatedObject.push( cdm.getObject( dropData.declViewModel.getData().inputObject.uid ) );
    saveInputWriter.addRelatedObjects( relatedObject );
    saveInputWriter.addAssignedTools( targetObjectInput, workareasAddObject );
    //Tree handles adding of new obj
    epSaveService.saveChanges( saveInputWriter, true, relatedObject );
    return {
        preventDefault: true,
        stopPropagation: true
    };
};

/**
 * @param {String} relationType relation Type
 * @param {String} assignedObjIds assigned Obj Ids
 * @return {Object} assignment jsn object
 */
let createAssignmentObject = function( relationType, assignedObjIds ) {
    if( relationType ) {
        return {
            relationType: relationType,
            Add: assignedObjIds
        };
    }
    return {
        Add: assignedObjIds,
        useDefaultRelationType: 'true'
    };
};

/**
 * @param {Object} sourceObj sourceObj Object that is dragged
 * @param {Object} targrtObj target Object to drop workarea on it
 * @return {Boolean} is drop allowed
 */
const isWorkareaDropAllowedOnTarget = function( sourceObj, targrtObj ) {
    if( !mfeTypeUtils.isOfType( sourceObj, _epBvrConstants.MFG_BVR_WORKAREA ) ) { return false; }
    if( mfeTypeUtils.isOfType( targrtObj, _epBvrConstants.MFG_BVR_OPERATION ) ) {
        const scopeObject = appCtxService.getCtx( EP_SCOPE_OBJECT );
        return mfeTypeUtils.isOfType( scopeObject, _epBvrConstants.MFG_BVR_PROCESS );
    }
    return true;
};

/**
 * @param {Object} sourceObj sourceObj Object that is dragged
 * @param {Object} targrtObj target Object to drop workarea on it
 * @return {Boolean} is drop allowed
 */
const isResourceDropAllowedOnTarget = function( sourceObj, targrtObj ) {
    if( mfeTypeUtils.isOfType( sourceObj, _epBvrConstants.MFG_BVR_WORKAREA ) ) { return false; }

    const dragFrom = dragDataCache.draggedFromView;
    if( dragFrom !== 'AssemblyPlanningBoeTree_EpBoeTreeTable' ) { return false; }
    if( !mfeTypeUtils.isOfType( targrtObj, _epBvrConstants.MFG_BVR_OPERATION ) &&
        !mfeTypeUtils.isOfType( targrtObj, _epBvrConstants.MFG_BVR_PROCESS ) &&
        !mfeTypeUtils.isOfType( targrtObj, _epBvrConstants.MFG_BVR_PROCESS_RESOURCE ) ) { return false; }
    return true;
};

/**
 * Drop over Target Assemblies
 * @param {Object} dropData objects
 */
function dropTargetAssemblies( dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    const resource = localeService.getLoadedText( 'PlanningMessages' );
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = {
        [ dropData.declViewModel.inputObject.uid ]: {
            type: dropData.declViewModel.inputObject.type,
            uid: dropData.declViewModel.inputObject.uid
        }
    };
    let objectsToModifyEntry = {
        Object: {
            nameToValuesMap: {
                id: [ dropData.declViewModel.inputObject.uid ]
            }
        }
    };

    let objectToAdd = [];
    //Handling drag+drop of multiple assemblies
    _.forEach( sourceUids, function( uid ) {
        relatedObjects[ uid ] = {
            type: 'BOMLine',
            uid: uid
        };
        objectToAdd.push( uid );
        objectsToModifyEntry.ProductScopes = {
            nameToValuesMap: {
                Add: objectToAdd
            }
        };
    } );
    saveInputWriter.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, objectsToModifyEntry );
    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        if( response.ServiceData ) {
            const saveEventsArray = response.saveEvents;
            const modelObjects = response.ServiceData.modelObjects;
            let assemblyNameArray = [];
            let modifiedProcName = '';
            _.forEach( saveEventsArray, function( params ) {
                if( params.eventType === 'addedToRelation' ) {
                    assemblyNameArray.push( modelObjects[ params.eventObjectUid ].props.object_string.uiValues[ 0 ] );
                }
                if( params.eventType === 'modifyRelations' ) {
                    modifiedProcName = modelObjects[ params.eventObjectUid ].props.object_string.uiValues[ 0 ];
                }
            } );
            if( assemblyNameArray.length > 0 ) {
                const assemblyName = assemblyNameArray.join( ',' );
                let msg = resource.scopingSuccessMsg;
                msg = msg.format( assemblyName, modifiedProcName );
                messagingService.showInfo( msg );
            }
        }
        return {
            preventDefault: true,
            stopPropagation: true
        };
    } );
}

let exports;
export default exports = {
    dragOverParts,
    dropParts,
    dragOverWorkareas,
    dropWorkareas,
    handleDragStart,
    handleDragEnd,
    dragOverResources,
    dropResources,
    dropTargetAssemblies
};
