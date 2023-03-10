// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import wiPmiSvc from 'js/wiPmiService';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import cdm from 'soa/kernel/clientDataModel';

/**
 * @module js/wiPmiDragAndDropService
 */


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
 *
 * @param {object} dropData - the drop data object
 * @return {object} config for preventing default action
 */
function onDragOverAssignedPmisContent( dropData ) {
    const sourceUids = dragDataCache.draggedObjUids;
    for( let sourceUidsIndex = 0; sourceUidsIndex < sourceUids.length; sourceUidsIndex++ ) {
        const sourceObj = cdm.getObject( sourceUids[ sourceUidsIndex ] );
        if( sourceObj.type !== epBvrConstants.MCI_PMI_CHARACTERISTIC || !getAssingedPmiTableContext( dropData ) ) {
            return INVALID_TO_DROP_OBJECT;
        }
    }
    return VALID_TO_DROP_OBJECT;
}

/**
 * The method handles drop events on the assigned pmis content
 * @param {object} dropData - the drop data object
 */
function onDropInAssignedPmisContent( dropData ) {
    if( dragDataCache.draggedObjUids.length > 0 ) {
        const context = getAssingedPmiTableContext( dropData );
        if( context && context.uid ) {
            wiPmiSvc.assignPmisToCurrentContext( context, dragDataCache.draggedObjUids );
            return {
                preventDefault: true,
                stopPropagation: true
            };
        }
    }
}

/**
 *
 * @param {object} dropData - the drop data object
 * @return {modelObject} - the assigned pmi table context
 */
function getAssingedPmiTableContext( dropData ) {
    if( dropData ) {
        const dataObject = dropData.declViewModel.getData();
        return dataObject.inputObject;
    }
}

/**
 * Clear out any 'dragData' that may have been created by the last Drag-n-Drop operation.
 */
function clearCachedData() {
    dragDataCache.draggedFromView = null;
    dragDataCache.draggedObjUids = [];
}

/**
 * Cache the dragged data in local storage
 * @param {Object} dragData - The dragged data to be cached
 */
function cacheDraggedData( dragData ) {
    if( dragData && dragData.targetObjects ) {
        dragDataCache.draggedFromView = dragData.declViewModel._internal.viewId;
        dragDataCache.draggedObjUids = dragData.targetObjects.map( object => object.uid );
    } else {
        dragData.event.preventDefault();
    }
}

export default{
    onDragOverAssignedPmisContent,
    onDropInAssignedPmisContent,
    clearCachedData,
    cacheDraggedData
};
