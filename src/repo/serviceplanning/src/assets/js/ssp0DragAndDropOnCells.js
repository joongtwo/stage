// Copyright (c) 2022 Siemens

/**
 * Service to drag and drop on cells
 *
 * @module js/ssp0DragAndDropOnCells
 */

import _ from 'lodash';
import eventBus from 'js/eventBus';
import localStrg from 'js/localStorage';
import occmgmtBackingObjectProviderSvc from 'js/occmgmtBackingObjectProviderService';
import { constants as servicePlannerConstants } from 'js/ssp0ServicePlannerConstants';

let exports = {};

/**
    * Clear the cache data.
    */
const clearCachedData = () => {
    localStrg.publish( 'draggedListData' );
};

/**
    * deHighlight Element
    */
const dehighlightElement = () => {
    const allHighlightedTargets = document.body.querySelectorAll( '.aw-theme-dropframe.aw-widgets-dropframe' );
    if ( allHighlightedTargets ) {
        _.forEach( allHighlightedTargets, function( target ) {
            eventBus.publish( 'dragDropEvent.highlight', {
                isHighlightFlag: false,
                targetElement: target
            } );
        } );
    }
};

/**
    * dragOverTreeTable
    * @param {Object} dragAndDropParams dragAndDropParams
    * @return {Object} the object with dropEffect
    */
export const dragOverTreeTable = ( dragAndDropParams ) => {
    const targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[0] : null;

    if ( targetObject && targetObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_SERVICE_REQUIREMENT_PROCESS )
         || targetObject.modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_WORK_CARD_PROCESS ) ) {
        dehighlightElement();
        dragAndDropParams.callbackAPIs.highlightTarget( {
            isHighlightFlag: true,
            targetElement: dragAndDropParams.targetElement
        } );
        return {
            preventDefault: true,
            dropEffect: 'copy'
        };
    }

    dehighlightElement();
    return {
        dropEffect: 'none'
    };
};

export const createSourceObjectForSOA = ( sourceObjects ) => {
    let sourceObjectForSOA = [];
    sourceObjects.forEach( sourceObject => {
        if ( sourceObject.type === servicePlannerConstants.TYPE_BVR_PART ||
             sourceObject.type === servicePlannerConstants.TYPE_AWB_PART_ELEMENT || sourceObjects[0].modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_AWB_ELEMENT ) ) {
            sourceObjectForSOA.push( { uid: sourceObject.uid, type: sourceObject.type } );
        }
    } );
    return sourceObjectForSOA;
};

/**
    * dropOnTreeTable
    * @param {Object} dragAndDropParams dragAndDropParams
    * @return {Object} the object with dropEffect
    */
export const dropOnTreeTable = ( dragAndDropParams ) => {
    // dehighlightElement();
    const targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[0] : null;
    let sourceObjects = localStrg.get( 'draggedListData' );
    sourceObjects = sourceObjects ? JSON.parse( sourceObjects ) : [];
    if ( sourceObjects.length > 0 ) {
        if ( sourceObjects[0].type === servicePlannerConstants.TYPE_AWB_PART_ELEMENT || sourceObjects[0].modelType.typeHierarchyArray.includes( servicePlannerConstants.TYPE_AWB_ELEMENT ) ) {
            return occmgmtBackingObjectProviderSvc.getBackingObjects( sourceObjects ).then( function( response ) {
                const eventData = {
                    sourceObject: response,
                    targetObject: targetObject
                };
                _highlighTargetAndClearCacheData( dragAndDropParams, eventData );
            } );
        }
        let sourceObjectsForSOA = createSourceObjectForSOA( sourceObjects );

        const eventData = {
            sourceObject: sourceObjectsForSOA,
            targetObject: targetObject
        };
        _highlighTargetAndClearCacheData( dragAndDropParams, eventData );
    }
};

let _highlighTargetAndClearCacheData = ( dragAndDropParams, eventData ) => {
    eventBus.publish( 'Ssp0ServicePlanTree.consumePart', { consumePartData: eventData } );
    dragAndDropParams.callbackAPIs.highlightTarget( {
        isHighlightFlag: false,
        targetElement: dragAndDropParams.targetElement
    } );
    clearCachedData();
};

/**
    * Publish the dragged List data
    * @param {Object} extraParams extraParams
    * @param {Object} dnDParams dragged and dropped parameters
    */
export let listDragStart = ( extraParams, dnDParams ) => {
    localStrg.publish( 'draggedListData', JSON.stringify( dnDParams.targetObjects ) );
};

export default exports = {
    dropOnTreeTable,
    dragOverTreeTable,
    listDragStart
};

