// Copyright (c) 2022 Siemens

/**
 * @module js/epBalancingDragAndDropService
 */

import epProcessResourceListForAssignPopupService from 'js/epProcessResourceListForAssignPopupService';
import awDragAndDropUtils from 'js/awDragAndDropUtils';
import cdm from 'soa/kernel/clientDataModel';

const VALID_TO_DROP_OBJECT = {
    dropEffect: 'copy',
    preventDefault: true,
    stopPropagation: true
};

/**
 * Drag operations over task/ process resource tile
 *
 * @returns {Object} config for preventing default action
 */
export function dragOverTiles() {
    return VALID_TO_DROP_OBJECT;
}

/**
 * Drop dragged operations on task/ process resource tile
 *
 * @param {Object} dropData dragAndDrop Params
 *
 * @returns {Object} config for preventing default action
 */
export function dropTiles( dropData ) {
    const draggedUids = awDragAndDropUtils.getCachedSourceUids();
    const draggedObjects = draggedUids.map( objUid => cdm.getObject( objUid ) );
    const targetUid = dropData.targetElement.attributes.vmouid.value;
    const targetObj = cdm.getObject( targetUid );
    epProcessResourceListForAssignPopupService.assignOperationsToProcessResource( targetObj, draggedObjects );
    return {
        preventDefault: true,
        stopPropagation: true
    };
}

export default {
    dragOverTiles,
    dropTiles
};
